console.log("🚀 Insta AI Saver Loaded");

const processedPosts = new Set();

/**

* Extract Reel/Post ID
  */
function extractPostId(url) {
  // Handles /reel/<id>/, /reels/<id>/ (scroll feed) and /p/<id>/,
  // whether or not there's a trailing slash or query string.
  const match = url.match(/\/(?:reels?|p)\/([^/?#]+)/);
  return match ? match[1] : null;
}

/**
 * Find the container element for the clicked post.
 * Normal posts live in <article>; the reels scroll feed does not use
 * <article>, so fall back to the nearest ancestor that holds the reel <video>.
 */
function findPostContainer(el) {
  const article = el.closest("article");
  if (article) return article;

  let node = el;
  while (node && node !== document.body) {
    if (node.querySelector && node.querySelector("video")) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
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

  // Instagram renders the expander as "more" or "… more" on a <span>/<button>.
  const findMoreButton = () =>
    [...postArticle.querySelectorAll("span, button")].find((el) => {
      const t = el.innerText?.trim().toLowerCase();
      return t === "more" || t === "… more" || t === "...more";
    });

  // Expand a couple of times in case the caption reveals nested "more" links.
  for (let i = 0; i < 3; i++) {
    const moreButton = findMoreButton();
    if (!moreButton) break;

    console.log("📖 Clicking more...");
    moreButton.click();

    // wait for the DOM to render the expanded caption
    await new Promise((resolve) => setTimeout(resolve, 500));
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

  const postContainer = findPostContainer(clickedElement);

  // Build candidate URLs, then pick the first that yields a real post id.
  // NOTE: only match specific-post links (/reel/<id>/, /p/<id>/) inside the
  // container — a bare "/<user>/reels/" is the creator's reels *tab*, not a
  // post, and has no id. The scroll-feed reel id lives in the page URL.
  const candidates = [];

  if (postContainer) {
    postContainer
      .querySelectorAll('a[href*="/reel/"], a[href*="/p/"]')
      .forEach((a) => candidates.push(a.href));
  }

  candidates.push(window.location.href);

  let postUrl = null;
  let postId = null;

  for (const url of candidates) {
    const id = extractPostId(url);
    if (id) {
      postUrl = url;
      postId = id;
      break;
    }
  }

  if (!postId) {
    console.warn("⚠️ Could not determine post id. Tried:", candidates);
    return;
  }

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
    creatorUsername: extractCreatorUsername(postContainer),
    caption: await extractCaption(postContainer),
    timestamp: new Date().toISOString(),
  };

  console.log("📦 PAYLOAD:", payload);

  chrome.runtime.sendMessage({
    action: "instagram_action",
    data: payload,
  });

  showToast(action === "save" ? "✅ Reel Saved" : "❌ Reel Unsaved");
});
