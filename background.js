// Suggested code may be subject to a license. Learn more: ~LicenseLog:3130774205.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "parseReview") {
    fetch("http://localhost:3000/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reviewUrl: request.reviewUrl }),
    })
      .then((response) => response.json())
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ error: error.message }));
    return true; // Keep the connection open to the sender until sendResponse is called.
  }
});
