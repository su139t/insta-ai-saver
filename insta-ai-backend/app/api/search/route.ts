import { NextResponse } from "next/server";

import { connectDB } from "@/lib/mongodb";

import Post from "@/models/Post";

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q") || "";

    const user = searchParams.get("user") || "";

    console.log("🔍 Search Query:", query);

    const results = await Post.find({
      loggedInUser: user,

      $or: [
        {
          caption: {
            $regex: query,
            $options: "i",
          },
        },

        {
          creatorUsername: {
            $regex: query,
            $options: "i",
          },
        },

        {
          transcript: {
            $regex: query,
            $options: "i",
          },
        },
      ],
    })
      .sort({
        createdAt: -1,
      })
      .limit(20);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      },
    );
  }
}
