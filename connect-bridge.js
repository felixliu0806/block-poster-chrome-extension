if (!globalThis.__blockPosterConnectBridgeInstalled) {
  globalThis.__blockPosterConnectBridgeInstalled = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (
      message?.source !== "block-poster-web" ||
      message?.type !== "BLOCK_POSTER_AUTH_TOKEN" ||
      typeof message.token !== "string" ||
      typeof message.nonce !== "string"
    ) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "BLOCK_POSTER_AUTH_TOKEN",
      token: message.token,
      nonce: message.nonce,
    });
  });
}
