# 🚀 Insta AI Saver

An AI-powered Chrome Extension that lets you save Instagram reels and
posts, enrich them with AI (audio transcription, translation,
transliteration, permanent thumbnails), and search them later using
natural keywords — including words that are only **spoken** in the video.

## Features

### Capture

-   Detect Instagram **Save** and **Unsave** clicks in real time
-   Works on normal posts **and** the reels scroll feed (which has no
    `<article>` wrapper)
-   Extract:
    -   Logged-in user
    -   Creator / reel-owner username
    -   Post / Reel URL and ID
    -   Caption (auto-expands the **"… more"** link to grab the full text)
-   In-page **toast notifications** on save / unsave
-   Duplicate-click prevention so one save never fires twice
-   Instagram cookies collected transiently for the engine and **never
    persisted** to the database

### AI Enrichment (Python engine)

-   **Audio transcription** of reels with Faster-Whisper (native
    language, e.g. Hindi)
-   **English translation** of the spoken audio (second Whisper pass,
    skipped when already English)
-   **Hinglish transliteration** — Devanagari → Roman (ITRANS) so Hindi
    reels are searchable with romanized keywords
-   **Full, untruncated caption** pulled via yt-dlp (more complete than
    DOM scraping)
-   **Reliable creator username** from yt-dlp (works even where DOM
    scraping fails)
-   **Permanent thumbnails** uploaded to Cloudinary (Instagram CDN links
    expire; falls back to the raw URL when Cloudinary isn't configured)
-   Voice-activity detection + no-repeat decoding to cut hallucinated
    transcripts on music-heavy reels
-   Whisper model loaded **lazily** and size-configurable via env var
-   Downloaded video is deleted right after transcription to keep disk
    usage near zero

### Search & Download

-   Popup **search UI** with real-time (as-you-type) results
-   Searches across **caption, creator, transcript, English translation,
    and Hinglish** fields at once
-   Per-user results — you only see reels **you** saved
-   Result cards with **thumbnail preview**, creator handle, and caption
-   **Open Reel** and **Download** actions per result
-   Download resolves a **fresh** direct video URL on demand (never
    relies on a saved link that would have expired)
-   URL safety validation — only real `https://…instagram.com` links are
    allowed through (blocks `javascript:` / `data:` URLs)

### Reliability

-   **Best-effort processing** — if the AI engine is down, the reel
    metadata is still saved
-   Per-user dedupe via a compound MongoDB unique index (`postId` +
    `loggedInUser`), so two users can each save the same reel

## Architecture

``` text
Instagram
    │
    ▼
Chrome Extension (Manifest V3)
    │  content.js  → detect save/unsave, scrape metadata
    │  background.js → collect cookies, forward to backend
    ▼
Next.js API  (/api/instagram, /api/search)
    │
    ├──► MongoDB (Mongoose)  ── saved reels + AI fields
    │
    └──► Python AI Engine (FastAPI)
             /download → yt-dlp + Whisper + Cloudinary
             /resolve  → fresh direct video URL on demand
```

## Tech Stack

### Extension

-   Manifest V3
-   JavaScript, HTML, CSS

### Backend

-   Next.js 16 (App Router, API routes)
-   React 19
-   TypeScript
-   MongoDB + Mongoose 9
-   Tailwind CSS

### AI Engine

-   Python + FastAPI
-   yt-dlp — reel download & direct-URL resolution
-   Faster-Whisper — speech-to-text + translation
-   indic-transliteration — Devanagari → Hinglish
-   Cloudinary — permanent thumbnail hosting
-   python-dotenv — config

## Project Structure

``` text
insta-ai-saver/
│
├── manifest.json          # extension manifest (MV3)
├── content.js             # detect save/unsave, scrape metadata
├── background.js          # cookies + forward events to backend
├── popup.html             # search UI
├── popup.js               # search + on-demand download
├── styles.css
├── icon.png
│
├── insta-ai-backend/      # Next.js API + MongoDB
│   ├── app/api/instagram/route.ts   # save/unsave + engine enrichment
│   ├── app/api/search/route.ts      # multi-field search
│   ├── models/Post.ts               # Mongoose schema
│   ├── lib/mongodb.ts               # cached DB connection
│   └── .env.example
│
├── insta-ai-engine/       # FastAPI AI engine
│   ├── main.py            # /download, /resolve
│   ├── requirements.txt
│   ├── downloads/         # transient (deleted after transcription)
│   └── .env.example
│
└── Readme.md
```

## Data Model

Each saved reel (`models/Post.ts`) stores:

  Field              Source                    Purpose
  ------------------ ------------------------- ------------------------------
  postId / postUrl   Extension                 Identify the reel
  loggedInUser       Extension                 Owner of this saved copy
  creatorUsername    yt-dlp / DOM              Reel author
  caption            yt-dlp / DOM              Full caption text
  transcript         Whisper                   Spoken audio (native)
  translation        Whisper                   Spoken audio (English)
  hinglish           indic-transliteration     Romanized Hindi transcript
  thumbnail          Cloudinary / IG CDN       Preview image
  videoUrl           yt-dlp                    Direct CDN link (may expire)

## Workflow

1.  User clicks **Save** on Instagram.
2.  `content.js` extracts metadata and expands the full caption.
3.  `background.js` collects Instagram cookies and forwards the event.
4.  Next.js `/api/instagram` receives the payload.
5.  Backend calls the Python engine's `/download` (best-effort).
6.  Engine downloads the reel, transcribes + translates the audio,
    transliterates to Hinglish, uploads the thumbnail to Cloudinary,
    then deletes the local video file.
7.  Enriched metadata is stored in MongoDB (cookies are never persisted).
8.  User searches in the popup; matches on caption, creator, transcript,
    translation, or Hinglish are returned with thumbnails.
9.  Clicking **Download** resolves a fresh direct video URL via
    `/resolve` and opens it.

## Installation

### Backend (Next.js)

``` bash
cd insta-ai-backend
cp .env.example .env.local     # set MONGODB_URI and ENGINE_URL
npm install
npm run dev                    # http://localhost:3000
```

### AI Engine (FastAPI)

``` bash
cd insta-ai-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # set WHISPER_MODEL and CLOUDINARY_URL
uvicorn main:app --reload --port 8000
```

### Chrome Extension

1.  Open `chrome://extensions`
2.  Enable **Developer Mode**
3.  Click **Load unpacked**
4.  Select the repository root (where `manifest.json` lives)

## Configuration

### `insta-ai-engine/.env`

  Variable         Default    Description
  ---------------- ---------- --------------------------------------------
  WHISPER_MODEL    medium     tiny · base · small · medium · large-v3
  CLOUDINARY_URL   —          `cloudinary://<key>:<secret>@<cloud_name>`

### `insta-ai-backend/.env.local`

  Variable      Default                                    Description
  ------------- ------------------------------------------ ----------------------
  MONGODB_URI   mongodb://127.0.0.1:27017/insta_ai         MongoDB connection
  ENGINE_URL    http://localhost:8000                      Python engine base URL

## Current Status

  Feature                    Status
  -------------------------- --------
  Save / Unsave Detection    ✅
  Reels-feed Support         ✅
  Full Caption Extraction    ✅
  MongoDB Storage            ✅
  Per-user Dedupe            ✅
  Multi-field Search         ✅
  Popup Search UI            ✅
  Media Download             ✅
  Whisper Transcription      ✅
  English Translation        ✅
  Hinglish Transliteration   ✅
  Cloudinary Thumbnails      ✅
  On-demand Video Resolve    ✅
  OCR (image posts)          ⏳
  Vision AI                  ⏳
  Vector Embeddings          ⏳
  Semantic Search            ⏳

## Roadmap

-   OCR for text inside image posts
-   Video / visual scene understanding
-   Vector embeddings for meaning-based (not keyword) search
-   True semantic search over transcripts + captions
-   Automatic AI tagging / categories
-   Cloud sync across devices

## License

MIT
