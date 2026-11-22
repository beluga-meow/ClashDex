// Register PWA service worker
if ("serviceWorker" in navigator &&
    (location.protocol === "https:" ||
     location.hostname === "localhost")) {

  window.addEventListener("load", async () => {
    try {
      const registration =
        await navigator.serviceWorker.register("./service-worker.js");

      console.log("ClashDex Service Worker registered:", registration.scope);

    } catch (error) {
      console.error("ClashDex Service Worker error:", error);
    }
  });
}