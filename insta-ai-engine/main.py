from fastapi import FastAPI
from pydantic import BaseModel
import yt_dlp
import os

app = FastAPI()

DOWNLOAD_FOLDER = "downloads"

os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)


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

        return {
            "success": True,

            "id": video_id,

            "title": title,

            "description": description,

            "filepath": filepath,
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
