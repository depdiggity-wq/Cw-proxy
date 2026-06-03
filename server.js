const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3131;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, clientId, clientid, Accept, x-api-key, anthropic-version");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Route: /anthropic — proxy to Anthropic API
  if (req.url.startsWith("/anthropic")) {
    const path = "/v1/messages";
    console.log(`→ Anthropic: ${path}`);

    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const options = {
        hostname: "api.anthropic.com",
        path: path,
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": req.headers["anthropic-version"] || "2023-06-01",
          "x-api-key": req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "") || "",
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        console.log(`  Anthropic response: ${proxyRes.statusCode}`);
        res.writeHead(proxyRes.statusCode, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (e) => {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      });

      if (body) proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // Route: /?url=... — proxy to ConnectWise
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const target = reqUrl.searchParams.get("url");

  if (!target) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing ?url= parameter" }));
    return;
  }

  console.log(`→ ConnectWise: ${target}`);

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
    console.log(`  CW response: ${proxyRes.statusCode}`);
    res.writeHead(proxyRes.statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (e) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`✅ Proxy running on port ${PORT}`);
});
