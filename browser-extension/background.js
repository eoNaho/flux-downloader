chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !tab.id) return;

  if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
    return;
  }

  const deepLink = `fluxdownloader://download?url=${encodeURIComponent(tab.url)}`;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (link) => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = link;
      document.body.appendChild(iframe);
      setTimeout(() => iframe.remove(), 2000);
    },
    args: [deepLink],
  });
});
