"use strict";

const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });

let controllerPromise;

async function initializeScramjet() {
  if (controllerPromise) return controllerPromise;

  controllerPromise = (async () => {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;

    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        });
      });
    }

    const serviceworker =
      navigator.serviceWorker.controller ?? registration.active;
    if (!serviceworker) {
      throw new Error("The Scramjet service worker did not become active.");
    }

    for (const src of [
      "/scram/scramjet.js",
      "/controller/controller.api.js",
      "/utils/scramjet-utils.js",
    ]) {
      await loadScript(src);
    }

    const { default: LibcurlClient } = await import("/libcurl/index.mjs");
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const transport = new LibcurlClient({
      wisp: `${scheme}//${location.host}/wisp/`,
    });

    const api = window.$scramjetController;
    const instance = new api.Controller({
      serviceworker,
      transport,
      config: {
        scramjetPath: "/scram/scramjet.js",
        wasmPath: "/scram/scramjet.wasm",
        injectPath: "/controller/controller.inject.js",
      },
    });

    await instance.wait();

    window.setInterval(() => {
      navigator.serviceWorker.controller?.postMessage("keepalive");
    }, 15000);

    return instance;
  })();

  return controllerPromise;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  errorCode.textContent = "";

  try {
    const controller = await initializeScramjet();
    const url = search(address.value, searchEngine.value);
    const iframe = document.createElement("iframe");
    iframe.id = "sj-frame";
    iframe.style.width = "100%";
    iframe.style.height = "80vh";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const frame = controller.createFrame(iframe, { plugins: [] });
    frame.go(url);
  } catch (err) {
    error.textContent = "Failed to initialize the proxy connection.";
    errorCode.textContent = err instanceof Error ? err.stack || err.message : String(err);
    controllerPromise = null;
  }
});
