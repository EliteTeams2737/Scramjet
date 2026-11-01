import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";

const require = createRequire(import.meta.url);
const packageDir = (name) => dirname(require.resolve(name));
const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

const controllerPath = packageDir("@mercuryworkshop/scramjet-controller");
const utilsPath = packageDir("@mercuryworkshop/scramjet-utils");
const libcurlPath = packageDir("@mercuryworkshop/libcurl-transport");

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
  hostname_blacklist: [/example\\.com/],
  dns_servers: ["1.1.1.1", "1.0.0.1"],
});

const fastify = Fastify({
  serverFactory: (handler) => {
    return createServer()
      .on("request", (req, res) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        handler(req, res);
      })
      .on("upgrade", (req, socket, head) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        if (pathname === "/wisp/") {
          req.url = pathname;
          wisp.routeRequest(req, socket, head);
        } else {
          socket.end();
        }
      });
  },
});

fastify.register(fastifyStatic, {
  root: publicPath,
  decorateReply: true,
});
fastify.register(fastifyStatic, {
  root: scramjetPath,
  prefix: "/scram/",
  decorateReply: false,
});
fastify.register(fastifyStatic, {
  root: controllerPath,
  prefix: "/controller/",
  decorateReply: false,
});
fastify.register(fastifyStatic, {
  root: utilsPath,
  prefix: "/utils/",
  decorateReply: false,
});
fastify.register(fastifyStatic, {
  root: libcurlPath,
  prefix: "/libcurl/",
  decorateReply: false,
});

fastify.setNotFoundHandler((request, reply) => {
  return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
  const address = fastify.server.address();
  console.log("Listening on:");
  console.log(`\\thttp://localhost:${address.port}`);
  console.log(`\\thttp://${hostname()}:${address.port}`);
  console.log(
    `\\thttp://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`
  );
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  console.log("SIGTERM signal received: closing HTTP server");
  fastify.close();
  process.exit(0);
}

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;

fastify.listen({
  port,
  host: "0.0.0.0",
});
