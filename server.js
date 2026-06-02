/**
 * ConnectWise Manage - Local CORS Proxy
 * 
 * SETUP:
 *   1. Open a terminal and navigate to where this file is saved
 *   2. Run: node server.js
 *   3. Keep this terminal open while using the dashboard
 */

const http = require("http");
const https = require("https");

const PORT = 3131;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, clientId, clientid, Accept");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse the target URL from query string
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const target = reqUrl.searchParams.get("url");

  if (!target) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing ?url= parameter" }));
    return;
  }

  console.log(`→ Proxying: ${target}`);
  console.log(`  Auth: ${req.headers["authorization"] ? "present" : "MISSING"}`);
  console.log(`  clientId: ${req.headers["clientid"] || req.headers["clientId"] || "MISSING"}`);

  const targetUrl = new URL(target);

  const options = {
    hostname: targetUrl.hostname,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      "Authorization": req.headers["authorization"] || "",
      "clientId": req.headers["clientid"] || req.headers["clientId"] || "",
      "Content-Type": "application/json",
      "Accept": "application/json",
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`  Response: ${proxyRes.statusCode}`);
    res.writeHead(proxyRes.statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (e) => {
    console.error("  Proxy error:", e.message);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log("✅ ConnectWise CORS Proxy running at http://localhost:" + PORT);
  console.log("   Keep this terminal open while using the dashboard.");
  console.log("   Press Ctrl+C to stop.\n");
});
