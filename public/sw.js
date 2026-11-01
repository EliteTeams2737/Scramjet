importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
	await scramjet.loadConfig();

	if (!scramjet.route(event)) {
		return fetch(event.request);
	}

	// This host is an advertising/tracking beacon, not video content.
	// Some tracker responses trigger proxy-side parsing failures; the player
	// should not need the beacon to retrieve or play its media.
	let decodedRequestUrl = event.request.url;
	try {
		decodedRequestUrl = decodeURIComponent(decodedRequestUrl);
	} catch {
		// Keep the original URL if it contains malformed escaping.
	}
	if (
		event.request.method === "POST" &&
		decodedRequestUrl.includes("usrpubtrck.com/ut/hb.php")
	) {
		return new Response(null, { status: 204 });
	}

	try {
		return await scramjet.fetch(event);
	} catch (error) {
		console.error(
			"[Scramjet] Proxied request failed:",
			event.request.method,
			event.request.url,
			error
		);
		return new Response("The proxy could not complete this request.", {
			status: 502,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
