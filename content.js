console.log("🚀 Insta AI Saver Loaded");

const processedPosts = new Set();

/**

* Extract Reel/Post ID
  */
function extractPostId(url) {
  const match = url.match(/\/(reel|p)\/([^/]+)\//);
  return match ? match[2] : null;
}

/**

* Get Logged In Instagram Username
  */
function getLoggedInUsername() {
  const meta = document.querySelector('meta[property="og:title"]');

  if (!meta) return "unknown_user";

  const content = meta.getAttribute("content");

  if (!content) return "unknown_user";

  return content.split("•")[0]?.trim() || "unknown_user";
}

/**

* Extract Username of Reel Owner
  */
function extractCreatorUsername(postArticle) {
  if (!postArticle) return "unknown_creator";

  const profileLinks = postArticle.querySelectorAll('a[href^="/"]');

  for (const link of profileLinks) {
    const href = link.getAttribute("href");

    if (href && !href.includes("/reel/") && !href.includes("/p/")) {
      return href.replaceAll("/", "");
    }
  }

  return "unknown_creator";
}

/**

* Extract Full Caption
  */
function extractCaption(postArticle) {
  let caption = "";

  // METHOD 1 → Meta description
  const metaDescription = document.querySelector(
    'meta[property="og:description"]',
  );

  if (metaDescription) {
    const content = metaDescription.getAttribute("content");

    if (content) {
      let cleaned = content;

      cleaned = cleaned.replace(/^.*?on Instagram:\s*/i, "");

      cleaned = cleaned.replace(/^["']|["']$/g, "");

      caption = cleaned.trim();
    }
  }

  // METHOD 2 → DOM scan fallback
  if (!caption && postArticle) {
    const spans = postArticle.querySelectorAll("span");

    let bestText = "";

    spans.forEach((span) => {
      const text = span.innerText?.trim();

      if (
        text &&
        text.length > bestText.length &&
        text.length > 25 &&
        !text.includes("Follow") &&
        !text.includes("Original audio") &&
        !text.includes("more") &&
        !text.includes("See translation")
      ) {
        bestText = text;
      }
    });

    caption = bestText;
  }

  return caption;
}

/**

* Toast Notification
  */
function showToast(message) {
  const toast = document.createElement("div");

  toast.innerText = message;

  toast.style.position = "fixed";
  toast.style.top = "20px";
  toast.style.right = "20px";
  toast.style.zIndex = "999999";
  toast.style.padding = "12px 18px";
  toast.style.background = "#262626";
  toast.style.color = "white";
  toast.style.borderRadius = "10px";
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "bold";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**

* Detect Save / Unsave
  */
document.addEventListener("click", async (event) => {
  const clickedElement = event.target;

  const saveButton =
    clickedElement.closest('[aria-label="Save"]') ||
    clickedElement.closest('svg[aria-label="Save"]');

  const unsaveButton =
    clickedElement.closest('[aria-label="Remove"]') ||
    clickedElement.closest('svg[aria-label="Remove"]');

  if (!saveButton && !unsaveButton) return;

  const action = saveButton ? "save" : "unsave";

  console.log(`✅ ${action.toUpperCase()} detected`);

  const postArticle = clickedElement.closest("article");

  let postUrl = window.location.href;

  if (postArticle) {
    const postLink = postArticle.querySelector(
      'a[href*="/reel/"], a[href*="/p/"]',
    );

    if (postLink) {
      postUrl = postLink.href;
    }
  }

  const postId = extractPostId(postUrl);

  if (!postId) return;

  // Duplicate prevention
  const uniqueKey = `${action}-${postId}`;

  if (processedPosts.has(uniqueKey)) {
    console.log("⚠️ Duplicate prevented");
    return;
  }

  processedPosts.add(uniqueKey);

  setTimeout(() => {
    processedPosts.delete(uniqueKey);
  }, 3000);

  const payload = {
    action,
    postId,
    postUrl,
    loggedInUser: getLoggedInUsername(),
    creatorUsername: extractCreatorUsername(postArticle),
    caption: extractCaption(postArticle),
    timestamp: new Date().toISOString(),
  };

  console.log("📦 PAYLOAD:", payload);

  chrome.runtime.sendMessage({
    action: "instagram_action",
    data: payload,
  });

  showToast(action === "save" ? "✅ Reel Saved" : "❌ Reel Unsaved");
});

// console.log("🚀 Insta AI Saver script loaded properly!");

// /**

// * Extract Reel/Post ID
//   */
// function extractReelId(url) {
//   const match = url.match(/\/(reel|p)\/([^/]+)\//);
//   return match ? match[2] : null;
// }

// /**

// * Extract Caption Properly
//   */
// function extractCaption(postArticle) {
//   let caption = "";

//   // STEP 1 → Try Open Graph Meta
//   const metaDescription = document.querySelector(
//     'meta[property="og:description"]',
//   );

//   if (metaDescription) {
//     const content = metaDescription.getAttribute("content");

//     if (content) {
//       // Example:
//       // "sumit: Coding late night 🔥"
//       const splitContent = content.split(":");

//       if (splitContent.length > 1) {
//         caption = splitContent.slice(1).join(":").trim();
//       } else {
//         caption = content.trim();
//       }
//     }
//   }

//   // STEP 2 → Fallback DOM Scan
//   if (!caption && postArticle) {
//     const spans = postArticle.querySelectorAll("span");

//     let longestText = "";

//     spans.forEach((span) => {
//       const text = span.innerText?.trim();

//       if (
//         text &&
//         text.length > longestText.length &&
//         text.length > 20 &&
//         !text.includes("Follow") &&
//         !text.includes("Original audio") &&
//         !text.includes("Liked by")
//       ) {
//         longestText = text;
//       }
//     });

//     caption = longestText;
//   }

//   return caption;
// }

// /**

// * Extract Username
//   */
// function extractUsername(postArticle) {
//   let username = "unknown_user";

//   if (postArticle) {
//     const profileLinks = postArticle.querySelectorAll('a[href^="/"]');

//     for (const link of profileLinks) {
//       const href = link.getAttribute("href");

//       if (href && !href.includes("/p/") && !href.includes("/reel/")) {
//         username = href.replaceAll("/", "");
//         break;
//       }
//     }
//   }

//   return username;
// }

// /**

// * Main Click Listener
//   */
// document.addEventListener("click", function (event) {
//   const clickedElement = event.target;

//   const saveButton =
//     clickedElement.closest('[aria-label="Save"]') ||
//     clickedElement.closest('svg[aria-label="Save"]');

//   if (!saveButton) return;

//   console.log("✅ Save button detected!");

//   // Default URL
//   let postUrl = window.location.href;

//   // Find related article
//   const postArticle = clickedElement.closest("article");

//   // Better URL extraction
//   if (postArticle) {
//     const specificPostLink = postArticle.querySelector(
//       'a[href*="/p/"], a[href*="/reel/"]',
//     );

//     if (specificPostLink) {
//       postUrl = specificPostLink.href;
//     }
//   }

//   const reelId = extractReelId(postUrl);

//   const username = extractUsername(postArticle);

//   const caption = extractCaption(postArticle);

//   const payload = {
//     reelId,
//     url: postUrl,
//     username,
//     caption,
//     timestamp: new Date().toISOString(),
//   };

//   console.log("📦 FINAL PAYLOAD:", payload);

//   chrome.runtime.sendMessage({
//     action: "save_reel",
//     data: payload,
//   });
// });
