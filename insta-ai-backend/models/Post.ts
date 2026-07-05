import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
  {
    postId: {
      type: String,
      required: true,
    },

    postUrl: String,

    loggedInUser: {
      type: String,
      required: true,
    },

    creatorUsername: String,

    caption: String,

    // Filled in by the AI engine after the reel is downloaded/processed.
    videoPath: String,
    transcript: String,

    timestamp: String,
  },
  {
    timestamps: true,
  },
);

// A reel is unique *per user*, not globally — otherwise the second user to
// save the same reel would be treated as a duplicate and never see it.
PostSchema.index({ postId: 1, loggedInUser: 1 }, { unique: true });

export default mongoose.models.Post || mongoose.model("Post", PostSchema);
