document.getElementById("searchBtn").addEventListener("click", async () => {
  const query = document.getElementById("searchInput").value.trim();

  if (!query) return;

  const response = await fetch(`http://localhost:3000/api/search?q=${query}`);

  const data = await response.json();

  const resultsDiv = document.getElementById("results");

  resultsDiv.innerHTML = "";

  data.results.forEach((item) => {
    const div = document.createElement("div");

    div.className = "result-card";

    div.innerHTML = `
    <p><strong>${item.creatorUsername}</strong></p>
    <p>${item.caption}</p>
    <a href="${item.postUrl}" target="_blank">
      Open Post
    </a>
  `;

    resultsDiv.appendChild(div);
  });
});
