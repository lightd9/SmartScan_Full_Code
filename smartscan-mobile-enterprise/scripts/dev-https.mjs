import { X509Certificate } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCA, createCert } from "mkcert";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
// Share the already trusted local CA, but never put a signing key under a served project.
const directory = join(homedir(), ".smartscan", "dev-certificates");
await mkdir(directory, { recursive: true });
let ca;
try {
  ca = {
    key: await readFile(join(directory, "ca.key"), "utf8"),
    cert: await readFile(join(directory, "ca.crt"), "utf8"),
  };
  if (
    new Date(new X509Certificate(ca.cert).validTo) <=
    new Date(Date.now() + 86400000)
  )
    ca = null;
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
if (!ca) {
  ca = await createCA({
    organization: "SmartScan Local Development",
    countryCode: "NG",
    state: "Lagos",
    locality: "Lagos",
    validity: 365,
  });
  await writeFile(join(directory, "ca.key"), ca.key, { mode: 0o600 });
  await writeFile(join(directory, "ca.crt"), ca.cert);
}
const addresses = [
  ...new Set(
    Object.values(networkInterfaces())
      .flat()
      .filter((a) => a?.family === "IPv4" && !a.internal)
      .map((a) => a.address),
  ),
];
const certificate = await createCert({
  ca,
  domains: ["localhost", "127.0.0.1", ...addresses],
  validity: 30,
});
const certificateDownload = new X509Certificate(ca.cert).raw;
const setup = createHttpServer((req, res) => {
  if (req.url !== "/smartscan-dev-ca.cer") {
    res.writeHead(404);
    res.end("Use the HTTPS enterprise preview on port 5181.");
    return;
  }
  res.writeHead(200, {
    "Content-Type": "application/x-x509-ca-cert",
    "Content-Disposition": 'attachment; filename="smartscan-dev-ca.cer"',
    "Cache-Control": "no-store",
  });
  res.end(certificateDownload);
});
// Keep phone requests same-origin without widening the production CORS policy.
// This changes only this preview process, not the packaged native builds.
process.env.VITE_API_BASE_URL ||= "/__smartscan_api";
const app = await createServer({
  root,
  server: {
    host: "0.0.0.0",
    port: 5181,
    strictPort: true,
    https: { key: certificate.key, cert: certificate.cert },
    proxy: {
      "/__smartscan_api": {
        target: "https://smartscan-backend-52s4.onrender.com",
        changeOrigin: true,
        cookiePathRewrite: '/__smartscan_api/auth',
        headers: { Origin: "https://localhost" },
        rewrite: path => path.replace(/^\/__smartscan_api/, ""),
      },
    },
  },
});
try {
  await app.listen();
  await new Promise((resolve, reject) => {
    setup.once("error", reject);
    setup.listen(5182, "0.0.0.0", resolve);
  });
} catch (e) {
  await app.close();
  setup.close();
  throw e;
}
console.log("SmartScan Enterprise — HTTPS phone testing");
for (const address of addresses.length ? addresses : ["localhost"]) {
  console.log(`  App: https://${address}:5181`);
  console.log(
    `  Public certificate (only if not already trusted): http://${address}:5182/smartscan-dev-ca.cer`,
  );
}
const close = async () => {
  setup.close();
  await app.close();
  process.exit(0);
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
