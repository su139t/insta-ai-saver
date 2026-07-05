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
  // Try profile image alt text
  const profileImg = document.querySelector('img[alt*="profile picture"]');

  if (profileImg) {
    let altText = profileImg.alt;
    if (altText) {
      // Example:
      // "sumit.artz's profile picture"

      let username = altText
        .replace("'s profile picture", "")
        .replace("profile picture", "")
        .trim();
      chrome.storage.local.set({
        loggedInUser: username,
      });
      return username;
    }
  }

  // Fallback method
  const links = document.querySelectorAll('a[href^="/"]');

  for (const link of links) {
    const href = link.getAttribute("href");

    if (
      href &&
      href.split("/").length === 3 &&
      !href.includes("reel") &&
      !href.includes("p")
    ) {
      return href.replaceAll("/", "");
    }
  }

  return "unknown_user";
}

/**

* Extract Username of Reel Owner
  */
function extractCreatorUsername(postArticle) {
  if (!postArticle) return "unknown_creator";

  // Instagram routes that are NOT user profiles.
  const NON_PROFILE = [
    "explore",
    "reels",
    "reel",
    "p",
    "stories",
    "direct",
    "accounts",
    "about",
    "tags",
  ];

  const profileLinks = postArticle.querySelectorAll('a[href^="/"]');

  for (const link of profileLinks) {
    const href = link.getAttribute("href");
    if (!href) continue;

    // A profile link looks like "/username/" — exactly one path segment.
    const segments = href.split("/").filter(Boolean);
    if (segments.length !== 1) continue;

    const username = segments[0];
    if (NON_PROFILE.includes(username.toLowerCase())) continue;
    if (username.startsWith("#") || username.startsWith("?")) continue;

    return username;
  }

  return "unknown_creator";
}


/**

* Extract Full Caption
  */
async function extractCaption(postArticle) {
  if (!postArticle) return "";

  /**

* Auto expand caption
  */

  const moreButton = [...postArticle.querySelectorAll("span")].find(
    (el) => el.innerText?.trim().toLowerCase() === "more",
  );

  if (moreButton) {
    console.log("📖 Clicking more...");
    moreButton.click();

    // wait for DOM update
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  let caption = "";

  const elements = postArticle.querySelectorAll("span, div, h1");

  let bestText = "";

  elements.forEach((el) => {
    const text = el.innerText?.trim();

    if (!text) return;

    const ignored = [
      "Follow",
      "Following",
      "Original audio",
      "See translation",
      "View replies",
      "Liked by",
      "more",
    ];

    if (ignored.some((word) => text.includes(word))) {
      return;
    }

    if (text.length < 20) return;

    if (text.length > bestText.length) {
      bestText = text;
    }
  });

  caption = bestText;

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

  /**

* Wait for Instagram save action to complete
  */
  await new Promise((resolve) => setTimeout(resolve, 500));

  const payload = {
    action,
    postId,
    postUrl,
    loggedInUser: getLoggedInUsername(),
    creatorUsername: extractCreatorUsername(postArticle),
    caption: await extractCaption(postArticle),
    timestamp: new Date().toISOString(),
  };

  console.log("📦 PAYLOAD:", payload);

  chrome.runtime.sendMessage({
    action: "instagram_action",
    data: payload,
  });

  showToast(action === "save" ? "✅ Reel Saved" : "❌ Reel Unsaved");
});
