from fastapi import FastAPI
from pydantic import BaseModel
import yt_dlp
import os

from faster_whisper import WhisperModel

app = FastAPI()

DOWNLOAD_FOLDER = "downloads"

os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# Speech-to-text model. "base" is a good speed/accuracy balance on CPU.
# Override with WHISPER_MODEL=small / medium for better accuracy (slower).
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")

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


def transcribe_audio(filepath):
    """
    Transcribe the spoken audio of a reel into text.
    Best-effort: returns "" on any failure so a save never breaks.
    """
    try:
        if not filepath or not os.path.exists(filepath):
            return ""

        print("🎧 Transcribing audio:", filepath)

        model = get_whisper_model()

        segments, info = model.transcribe(filepath)

        text = " ".join(segment.text.strip() for segment in segments).strip()

        print(f"📝 Transcript ({info.language}, {len(text)} chars)")

        return text

    except Exception as err:
        print("⚠️ Transcription failed:", str(err))
        return ""


class ReelRequest(BaseModel):

    url: str
    cookies: list[str] = []


@app.get("/")
async def root():
    return {
        "message": "AI Engine Running"
    }


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

        ext = info.get("ext", "mp4")

        filepath = (
            f"{DOWNLOAD_FOLDER}/"
            f"{video_id}.{ext}"
        )

        print(
            "✅ Download Complete:",
            filepath
        )

        # Extract spoken words from the reel's audio.
        transcript = transcribe_audio(filepath)

        return {
            "success": True,

            "id": video_id,

            "title": title,

            "description": description,

            "filepath": filepath,

            "transcript": transcript,
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
