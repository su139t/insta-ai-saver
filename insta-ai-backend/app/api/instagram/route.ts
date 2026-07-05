import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";

import Post from "@/models/Post";

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8000";

/**
 * Ask the Python AI engine to download + process the reel.
 * Best-effort: if the engine is down we still keep the saved metadata,
 * so a failure here must never break the save.
 */
async function processWithEngine(postUrl: string, cookies: string[]) {
  try {
    const res = await fetch(`${ENGINE_URL}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: postUrl, cookies: cookies || [] }),
    });

    const data = await res.json();

    if (!data.success) {
      console.warn("⚠️ Engine could not process reel:", data.error);
      return null;
    }

    return {
      videoPath: data.filepath as string | undefined,
      // yt-dlp's `description` is the FULL, untruncated post caption —
      // much more complete than what the extension can scrape from the DOM.
      fullCaption: data.description as string | undefined,
      // Speech-to-text of the reel's audio — lets users search by words
      // that are *spoken* in the video, not just written in the caption.
      transcript: data.transcript as string | undefined,
    };
  } catch (err) {
    console.warn("⚠️ Engine unreachable, saving metadata only:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();

    const { action, postId, postUrl, loggedInUser, creatorUsername, caption } =
      body;

    if (!postId || !loggedInUser) {
      return NextResponse.json(
        { success: false, error: "Missing postId or loggedInUser" },
        { status: 400 },
      );
    }

    /**
     * UNSAVE — remove only this user's copy.
     */
    if (action === "unsave") {
      await Post.deleteOne({ postId, loggedInUser });

      return NextResponse.json({
        success: true,
        message: "Post removed",
      });
    }

    /**
     * SAVE — dedupe per user, not globally.
     */
    const existingPost = await Post.findOne({ postId, loggedInUser });

    if (existingPost) {
      return NextResponse.json({
        success: true,
        message: "Already exists",
      });
    }

    // Hand the reel to the AI engine (best-effort). Cookies are used here
    // only, and never persisted to the database.
    const enriched = await processWithEngine(postUrl, body.cookies);

    // Prefer the engine's full caption; fall back to the scraped caption
    // (which may be truncated) if the engine is unavailable.
    const fullCaption = enriched?.fullCaption || caption || "";

    const newPost = await Post.create({
      postId,
      postUrl,
      loggedInUser,
      creatorUsername,
      caption: fullCaption,
      transcript: enriched?.transcript || "",
      videoPath: enriched?.videoPath,
      timestamp: body.timestamp,
    });

    return NextResponse.json({
      success: true,
      post: newPost,
    });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        success: false,
        error: "Server Error",
      },
      {
        status: 500,
      },
    );
  }
}
