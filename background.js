/**
 * background.js
 */

console.log("🚀 Background Service Worker Running");

// Single place to configure where the backend lives.
const API_BASE = "http://localhost:3000";

/**
 * Get Instagram cookies (needed by the AI engine to download gated reels).
 */
async function getInstagramCookies() {
  return new Promise((resolve) => {
    chrome.cookies.getAll(
      {
        url: "https://www.instagram.com",
      },

      (cookies) => {
        const formattedCookies = cookies.map((cookie) => {
          return `${cookie.name}=${cookie.value}`;
        });

        resolve(formattedCookies);
      },
    );
  });
}

/**
 * Do the actual work for an incoming save/unsave event.
 */
async function handleInstagramAction(data) {
  console.log("📨 Data Received", data);

  const cookies = await getInstagramCookies();

  const payload = {
    ...data,
    cookies,
  };

  const response = await fetch(`${API_BASE}/api/instagram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  console.log("✅ Backend Response:", result);

  return result;
}

/**
 * Listen for messages from content.js.
 *
 * NOTE: the listener callback itself must NOT be `async`. An async listener
 * returns a Promise, so Chrome never sees the `return true` that keeps the
 * message port open, and `sendResponse` can fire after the port has closed.
 * Instead we return `true` synchronously and resolve the async work inside.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "instagram_action") {
    return; // not ours — let other listeners handle it
  }

  handleInstagramAction(request.data)
    .then((result) => sendResponse({ success: true, result }))
    .catch((error) => {
      console.error("❌ Background Error:", error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // keep the message channel open for the async sendResponse
});
