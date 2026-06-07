/* global chrome, document */

chrome.runtime.sendMessage({ kind: "status" }, (status) => {
  const statusElement = document.getElementById("status");
  if (!statusElement) {
    return;
  }
  statusElement.textContent = status?.connected ? "Connected" : "Disconnected";
});
