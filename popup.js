const searchInput = document.getElementById("searchInput");

const resultsDiv = document.getElementById("results");

// Single place to configure where the backend and AI engine live.
const API_BASE = "http://localhost:3000";
const ENGINE_BASE = "http://localhost:8000";

/**
 * Read the current Instagram cookies (needed so the engine can resolve a
 * fresh video link — Instagram requires auth).
 */
async function getInstagramCookies() {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url: "https://www.instagram.com" }, (cookies) => {
      resolve((cookies || []).map((c) => `${c.name}=${c.value}`));
    });
  });
}

/**
 * Ask the engine to resolve a fresh direct video URL, then open it in a tab.
 */
async function downloadReel(reelUrl, btn) {
  const original = btn.textContent;
  btn.textContent = "Wait";
  btn.disabled = true;
  btn.style.backgroundColor = "red";

  try {
    const cookies = await getInstagramCookies();

    const res = await fetch(`${ENGINE_BASE}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: reelUrl, cookies }),
    });

    const data = await res.json();

    if (res.ok && data.videoUrl) {
      chrome.tabs.create({ url: data.videoUrl });
    } else {
      alert("Could not get the reel video. Is the engine running?");
    }
  } catch (err) {
    console.error("❌ Download error:", err);
    alert("Download failed — is the engine running on :8000?");
  } finally {
    btn.textContent = original;
  }
}

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

    // Thumbnail preview (Instagram CDN image).
    if (item.thumbnail) {
      const thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.src = item.thumbnail;
      thumb.alt = "";
      thumb.loading = "lazy";
      // Hide gracefully if the CDN link has expired / fails to load.
      thumb.onerror = () => thumb.remove();
      card.appendChild(thumb);
    }

    const creator = document.createElement("div");
    creator.className = "creator";
    creator.textContent = `@${item.creatorUsername || "unknown"}`;

    const caption = document.createElement("div");
    caption.className = "caption";
    caption.textContent = item.caption || "";

    card.appendChild(creator);
    card.appendChild(caption);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const url = safeInstagramUrl(item.postUrl);
    if (url) {
      const link = document.createElement("a");
      link.className = "open-btn";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open Reel";
      actions.appendChild(link);
    }

    // Resolve a FRESH direct video link on demand via the engine, so it
    // never depends on a URL saved earlier (which would have expired).
    if (url) {
      const dl = document.createElement("a");
      dl.className = "download-btn";
      dl.href = "#";
      dl.textContent = "Download";
      dl.addEventListener("click", (e) => {
        e.preventDefault();
        downloadReel(url, dl);
      });
      actions.appendChild(dl);
    }

    card.appendChild(actions);

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
