console.log("🚀 Insta AI Saver script loaded properly!");

/**

* Extract Reel/Post ID
  */
function extractReelId(url) {
  const match = url.match(/\/(reel|p)\/([^/]+)\//);
  return match ? match[2] : null;
}

/**

* Extract Caption Properly
  */
function extractCaption(postArticle) {
  let caption = "";

  // STEP 1 → Try Open Graph Meta
  const metaDescription = document.querySelector(
    'meta[property="og:description"]',
  );

  if (metaDescription) {
    const content = metaDescription.getAttribute("content");

    if (content) {
      // Example:
      // "sumit: Coding late night 🔥"
      const splitContent = content.split(":");

      if (splitContent.length > 1) {
        caption = splitContent.slice(1).join(":").trim();
      } else {
        caption = content.trim();
      }
    }
  }

  // STEP 2 → Fallback DOM Scan
  if (!caption && postArticle) {
    const spans = postArticle.querySelectorAll("span");

    let longestText = "";

    spans.forEach((span) => {
      const text = span.innerText?.trim();

      if (
        text &&
        text.length > longestText.length &&
        text.length > 20 &&
        !text.includes("Follow") &&
        !text.includes("Original audio") &&
        !text.includes("Liked by")
      ) {
        longestText = text;
      }
    });

    caption = longestText;
  }

  return caption;
}

/**

* Extract Username
  */
function extractUsername(postArticle) {
  let username = "unknown_user";

  if (postArticle) {
    const profileLinks = postArticle.querySelectorAll('a[href^="/"]');

    for (const link of profileLinks) {
      const href = link.getAttribute("href");

      if (href && !href.includes("/p/") && !href.includes("/reel/")) {
        username = href.replaceAll("/", "");
        break;
      }
    }
  }

  return username;
}

/**

* Main Click Listener
  */
document.addEventListener("click", function (event) {
  const clickedElement = event.target;

  const saveButton =
    clickedElement.closest('[aria-label="Save"]') ||
    clickedElement.closest('svg[aria-label="Save"]');

  if (!saveButton) return;

  console.log("✅ Save button detected!");

  // Default URL
  let postUrl = window.location.href;

  // Find related article
  const postArticle = clickedElement.closest("article");

  // Better URL extraction
  if (postArticle) {
    const specificPostLink = postArticle.querySelector(
      'a[href*="/p/"], a[href*="/reel/"]',
    );

    if (specificPostLink) {
      postUrl = specificPostLink.href;
    }
  }

  const reelId = extractReelId(postUrl);

  const username = extractUsername(postArticle);

  const caption = extractCaption(postArticle);

  const payload = {
    reelId,
    url: postUrl,
    username,
    caption,
    timestamp: new Date().toISOString(),
  };

  console.log("📦 FINAL PAYLOAD:", payload);

  chrome.runtime.sendMessage({
    action: "save_reel",
    data: payload,
  });
});
