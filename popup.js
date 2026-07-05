const searchInput = document.getElementById("searchInput");

const resultsDiv = document.getElementById("results");

// Single place to configure where the backend lives.
const API_BASE = "http://localhost:3000";

/**
 * Only allow real Instagram links through — never javascript:/data: URLs
 * that could come from scraped/attacker-controlled content.
 */
function safeInstagramUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname.endsWith("instagram.com")) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**

* Get logged in user
* from extension storage
  */
async function getLoggedInUser() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["loggedInUser"], (result) => {
      resolve(result.loggedInUser || "unknown_user");
    });
  });
}

/**

* Render Search Results
  */
function renderResults(results) {
  resultsDiv.innerHTML = "";

  if (!results.length) {
    resultsDiv.innerHTML = "<p>No results found</p>";

    return;
  }

  results.forEach((item) => {
    const card = document.createElement("div");
    card.className = "result-card";

    const creator = document.createElement("div");
    creator.className = "creator";
    creator.textContent = `@${item.creatorUsername || "unknown"}`;

    const caption = document.createElement("div");
    caption.className = "caption";
    caption.textContent = item.caption || "";

    card.appendChild(creator);
    card.appendChild(caption);

    const url = safeInstagramUrl(item.postUrl);
    if (url) {
      const link = document.createElement("a");
      link.className = "open-btn";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open Reel";
      card.appendChild(link);
    }

    resultsDiv.appendChild(card);
  });
}

/**

* Search API
  */
async function searchPosts(query) {
  try {
    const user = await getLoggedInUser();

    console.log("👤 Logged In User:", user);

    const response = await fetch(
      `${API_BASE}/api/search?q=${encodeURIComponent(query)}&user=${encodeURIComponent(user)}`,
    );

    const data = await response.json();

    console.log("🔍 Search Results:", data);

    renderResults(data.results || []);
  } catch (error) {
    console.log("❌ Search Error:", error);
  }
}

/**

* Realtime Search
  */
searchInput.addEventListener("input", async (e) => {
  const query = e.target.value.trim();

  if (!query) {
    resultsDiv.innerHTML = "";
    return;
  }

  await searchPosts(query);
});
