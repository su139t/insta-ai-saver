from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import yt_dlp
import os

from dotenv import load_dotenv

from faster_whisper import WhisperModel

import cloudinary
import cloudinary.uploader

from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

# Load environment variables from a local .env file (never committed).
load_dotenv()

app = FastAPI()

# Credentials come from the CLOUDINARY_URL environment variable, e.g.
# CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
# (set it in insta-ai-engine/.env — see .env.example).
cloudinary.config(secure=True)

DOWNLOAD_FOLDER = "downloads"

os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)


def convert_to_hinglish(text):
    """
    Transliterate Devanagari (Hindi) into roman/Hinglish so reels can be
    searched with romanized keywords. Best-effort: returns "" on failure.
    """
    if not text:
        return ""
    try:
        return transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
    except Exception as err:
        print("⚠️ Transliteration failed:", str(err))
        return ""


def upload_thumbnail(image_url, public_id):
    """
    Upload the reel's thumbnail to Cloudinary so it doesn't expire like the
    raw Instagram CDN link. Falls back to the original URL if Cloudinary
    isn't configured or the upload fails.
    """
    if not image_url:
        return ""

    # Not configured -> keep the (expiring) original URL rather than fail.
    # Works whether configured via cloudinary.config(...) or CLOUDINARY_URL.
    if not cloudinary.config().api_key:
        return image_url

    try:
        result = cloudinary.uploader.upload(
            image_url,
            public_id=public_id,
            folder="insta-reels",
            overwrite=True,
            resource_type="image",
        )
        return result.get("secure_url") or image_url
    except Exception as err:
        print("⚠️ Cloudinary upload failed:", str(err))
        return image_url

# Speech-to-text model. "medium" gives solid Hindi accuracy; "base"/"small"
# are faster but poor for Hindi, "large-v3" is best but slow on CPU.
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "medium")

# Loaded lazily on first use so the server starts instantly and the model
# (downloaded from Hugging Face on first run) is only fetched when needed.
_whisper_model = None


def get_whisper_model():
    global _whisper_model

    if _whisper_model is None:
        print(f"🧠 Loading Whisper model '{WHISPER_MODEL_SIZE}' (first run may download it)...")
        _whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device="cpu",
            compute_type="int8",
        )

    return _whisper_model


def _run_whisper(model, filepath, task):
    """Run one Whisper pass and join the segments into a single string."""
    segments, info = model.transcribe(
        filepath,
        task=task,
        beam_size=5,
        # Voice-activity detection skips music/silence — the main cause of
        # hallucinated garbage on reels with background music.
        vad_filter=True,
        # Stops the model looping/repeating earlier (mis)transcriptions.
        condition_on_previous_text=False,
    )

    text = " ".join(segment.text.strip() for segment in segments).strip()

    return text, info


def transcribe_audio(filepath):
    """
    Transcribe a reel's audio into (native_text, english_text).
    Best-effort: returns ("", "") on any failure so a save never breaks.
    """
    try:
        if not filepath or not os.path.exists(filepath):
            return "", ""

        print("🎧 Transcribing audio:", filepath)

        model = get_whisper_model()

        # 1) Native transcription (auto-detects language, e.g. Hindi).
        native, info = _run_whisper(model, filepath, "transcribe")
        print(f"📝 Transcript ({info.language}, {len(native)} chars)")

        # 2) English translation. Skip the second pass if it's already English.
        if info.language == "en":
            english = native
        else:
            english, _ = _run_whisper(model, filepath, "translate")
            print(f"🌐 Translation (en, {len(english)} chars)")

        return native, english

    except Exception as err:
        print("⚠️ Transcription failed:", str(err))
        return "", ""


class ReelRequest(BaseModel):

    url: str
    cookies: list[str] = []


@app.get("/")
async def root():
    return {
        "message": "AI Engine Running"
    }


@app.post("/resolve")
async def resolve(data: ReelRequest):
    """
    Resolve a fresh direct (CDN) video URL for a reel on demand. Called when
    the user clicks Download, so the link never depends on a URL saved earlier
    (which would have expired). Needs the user's cookies because Instagram
    requires authentication to resolve a reel.
    """
    url = data.url

    if "instagram.com" not in url:
        raise HTTPException(status_code=400, detail="Not an Instagram URL")

    cookie_file = None

    try:
        cookie_file = create_cookie_file(data.cookies)

        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "cookiefile": cookie_file,
            "http_headers": {"User-Agent": "Mozilla/5.0"},
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        video_url = info.get("url") or ""
        if not video_url:
            for f in reversed(info.get("formats") or []):
                if f.get("url"):
                    video_url = f["url"]
                    break

        if not video_url:
            raise HTTPException(status_code=404, detail="No video URL found")

        return {"success": True, "videoUrl": video_url}

    except HTTPException:
        raise
    except Exception as err:
        print("⚠️ Resolve failed:", str(err))
        raise HTTPException(status_code=502, detail="Could not resolve reel")

    finally:
        if cookie_file and os.path.exists(cookie_file):
            os.remove(cookie_file)


def create_cookie_file(cookies):

    cookie_path = "temp_cookies.txt"

    with open(cookie_path, "w") as file:

        # Netscape header
        file.write(
            "# Netscape HTTP Cookie File\n"
        )

        for cookie in cookies:

            try:

                name, value = cookie.split(
                    "=",
                    1
                )

                line = (
                    ".instagram.com\t"
                    "TRUE\t"
                    "/\t"
                    "FALSE\t"
                    "2147483647\t"
                    f"{name}\t"
                    f"{value}\n"
                )

                file.write(line)

            except Exception as err:

                print(
                    "Cookie Parse Error:",
                    err
                )

    return cookie_path


@app.post("/download")
async def download_reel(data: ReelRequest):

    cookie_file = None

    try:
        print("📦 REQUEST DATA:", data)

        url = data.url

        print("📥 Downloading:", url)

        cookie_file = create_cookie_file(
            data.cookies
        )

        ydl_opts = {

            "outtmpl":
            f"{DOWNLOAD_FOLDER}/%(id)s.%(ext)s",

            "cookiefile": cookie_file,

            "quiet": False,

            "noplaylist": False,

            "extract_flat": False,

            "ignoreerrors": False,

            "http_headers": {
                "User-Agent":
                "Mozilla/5.0"
            },

        }

        with yt_dlp.YoutubeDL(
            ydl_opts
        ) as ydl:

            info = ydl.extract_info(
                url,
                download=True
            )

        video_id = info.get("id")

        title = info.get("title")

        description = info.get(
            "description"
        )

        # Reel owner's username. In yt-dlp's Instagram extractor:
        #   channel     -> the @username handle   (what we want)
        #   uploader    -> the full display name  (fallback)
        #   uploader_id -> a numeric account id   (NOT a username, avoid)
        uploader = (
            info.get("channel")
            or info.get("uploader")
            or ""
        )

        # Some values arrive prefixed with "@" — normalise it away.
        uploader = uploader.lstrip("@").strip()

        # Preview image for the search card.
        thumbnail = info.get("thumbnail") or ""

        # Direct (CDN) video URL so we can open/download the reel later
        # without keeping the file on disk. NOTE: Instagram CDN URLs are
        # time-limited and eventually expire.
        video_url = info.get("url") or ""
        if not video_url:
            for f in reversed(info.get("formats") or []):
                if f.get("url"):
                    video_url = f["url"]
                    break

        ext = info.get("ext", "mp4")

        filepath = (
            f"{DOWNLOAD_FOLDER}/"
            f"{video_id}.{ext}"
        )

        print(
            "✅ Download Complete:",
            filepath
        )

        # Extract spoken words from the reel's audio (native + English).
        transcript, translation = transcribe_audio(filepath)

        # Roman/Hinglish version of the Hindi transcript for easy searching.
        hinglish = convert_to_hinglish(transcript)

        # We only needed the file for transcription — delete it now so the
        # downloads folder doesn't fill up with reels.
        if os.path.exists(filepath):
            os.remove(filepath)
            print("🗑️  Deleted local file:", filepath)

        # Store the thumbnail permanently on Cloudinary (falls back to the
        # raw CDN URL if Cloudinary isn't configured).
        thumbnail = upload_thumbnail(thumbnail, video_id)

        return {
            "success": True,

            "id": video_id,

            "title": title,

            "description": description,

            "uploader": uploader,

            "thumbnail": thumbnail,

            "videoUrl": video_url,

            "transcript": transcript,

            "translation": translation,

            "hinglish": hinglish,
        }

    except Exception as e:

        print("❌ ERROR:", str(e))

        return {
            "success": False,
            "error": str(e)
        }

    finally:

        # Always delete the session cookies from disk, even on error.
        if cookie_file and os.path.exists(cookie_file):
            os.remove(cookie_file)
