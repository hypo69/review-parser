// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "parseReview") {
//     fetch("http://localhost:3000/review", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ reviewUrl: request.reviewUrl }),
//     })
//       .then((response) => response.json())
//       .then((data) => sendResponse(data))
//       .catch((error) => sendResponse({ error: error.message }));
//     return true; // Keep the connection open to the sender until sendResponse is called.
//   }
// });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToAssistant",
    title: "Send to assistant",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sendToAssistant") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => document.documentElement.outerHTML
    }, (injectionResults) => {
      if (injectionResults && injectionResults[0].result) {
        chrome.runtime.sendMessage({ html: injectionResults[0].result });
      } else {
        console.error("Failed to retrieve HTML content");
      }
    });
  }
});
