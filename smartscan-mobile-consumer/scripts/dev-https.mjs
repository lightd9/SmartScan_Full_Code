import { X509Certificate } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCA, createCert } from 'mkcert';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
// Keep the CA private key outside Vite's project and public directories.
const certificateDirectory = join(homedir(), '.smartscan', 'dev-certificates');
await mkdir(certificateDirectory, { recursive: true });
const caKeyPath = join(certificateDirectory, 'ca.key');
const caCertPath = join(certificateDirectory, 'ca.crt');
let ca;
try {
  ca = { key: await readFile(caKeyPath, 'utf8'), cert: await readFile(caCertPath, 'utf8') };
  if (new Date(new X509Certificate(ca.cert).validTo) <= new Date(Date.now() + 86400000)) ca = null;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!ca) {
  ca = await createCA({ organization: 'SmartScan Local Development', countryCode: 'NG', state: 'Lagos', locality: 'Lagos', validity: 365 });
  await writeFile(caKeyPath, ca.key, { mode: 0o600 });
  await writeFile(caCertPath, ca.cert);
}

const addresses = [...new Set(Object.values(networkInterfaces()).flat()
  .filter(address => address && address.family === 'IPv4' && !address.internal)
  .map(address => address.address))];
const certificate = await createCert({ ca, domains: ['localhost', '127.0.0.1', ...addresses], validity: 30 });
const certificateDownload = new X509Certificate(ca.cert).raw;

// This HTTP endpoint serves only the public CA certificate needed by iOS.
// It never serves project files or private keys.
const setupServer = createHttpServer((request, response) => {
  if (request.url !== '/smartscan-dev-ca.cer') {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Use /smartscan-dev-ca.cer to install the SmartScan development certificate.');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'application/x-x509-ca-cert',
    'Content-Disposition': 'attachment; filename="smartscan-dev-ca.cer"',
    'Cache-Control': 'no-store',
  });
  response.end(certificateDownload);
});

// Phone previews use a same-origin proxy; the live backend only allows the
// deployed web/native origins. Keep this override local to this dev process.
process.env.VITE_API_BASE_URL ||= '/__smartscan_api';
const app = await createServer({
  root: resolve(root),
  server: {
    host: '0.0.0.0', port: 5177, strictPort: true, https: { key: certificate.key, cert: certificate.cert },
    proxy: {
      '/__smartscan_api': {
        target: 'https://smartscan-backend-52s4.onrender.com',
        changeOrigin: true,
        headers: { Origin: 'https://localhost' },
        rewrite: path => path.replace(/^\/__smartscan_api/, ''),
      },
    },
  },
});

try {
  await app.listen();
  await new Promise((resolveListening, reject) => {
    setupServer.once('error', reject);
    setupServer.listen(5178, '0.0.0.0', resolveListening);
  });
} catch (error) {
  await app.close();
  setupServer.close();
  throw error;
}

console.log('\nSmartScan HTTPS phone testing');
for (const address of addresses.length ? addresses : ['localhost']) {
  console.log(`  Install certificate once: http://${address}:5178/smartscan-dev-ca.cer`);
  console.log(`  Open the app: https://${address}:5177`);
}
console.log('\niPhone: Settings > General > VPN & Device Management > install the downloaded profile.');
console.log('Then General > About > Certificate Trust Settings > enable SmartScan Local Development.');
console.log('Open the HTTPS app in Safari, enable its camera, then add that HTTPS address to Home Screen.\n');

async function close() {
  setupServer.close();
  await app.close();
  process.exit(0);
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
