chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action !== "save_reel") return;

  console.log("🎉 Reel data received!");

  console.log("🔗 URL:", request.data.url);
  console.log("🆔 Reel ID:", request.data.reelId);
  console.log("👤 Username:", request.data.username);
  console.log("📝 Caption:", request.data.caption);

  try {
    const response = await fetch("http://localhost:3000/api/save-reel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.data),
    });

    const result = await response.json();

    console.log("✅ Sent to backend:", result);

    sendResponse({
      success: true,
    });
  } catch (error) {
    console.error("❌ Backend Error:", error);

    sendResponse({
      success: false,
    });
  }

  return true;
});
