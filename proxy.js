/**
 * Simple secure proxy for the Luna / Kaliane / Clara chat app
 * 
 * 1. Put your xAI API key in the environment variable XAI_API_KEY
 * 2. Run:  node proxy.js
 * 3. Point the web app Settings → Proxy URL to http://YOUR_IP:3000
 *    (or to the public URL if you deploy this)
 */

const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const XAI_API_KEY = process.env.XAI_API_KEY || "";

if (!XAI_API_KEY) {
  console.error("\n❌  Missing XAI_API_KEY environment variable.");
  console.error("   Set it like this:");
  console.error("   export XAI_API_KEY=xai-your-key-here");
  console.error("   node proxy.js\n");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  // CORS headers so the iPhone / browser can talk to us
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "lkc-proxy" }));
    return;
  }

  // Only proxy the chat completions endpoint
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const options = {
        hostname: "api.x.ai",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${XAI_API_KEY}`,
          "Content-Length": Buffer.byteLength(body)
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        });
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (err) => {
        console.error("Proxy error:", err.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Proxy failed to reach xAI" }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅  Proxy running on http://0.0.0.0:${PORT}`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   On your network, use your computer’s IP, e.g. http://192.168.1.XX:${PORT}`);
  console.log(`\n   In the chat app Settings, set Proxy URL to that address.\n`);
});
