const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createLocalUploadStore, createS3UploadStore } = require('../upload-storage');

test('local upload storage writes random files inside the selected scope and rejects traversal', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'smartscan-upload-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = createLocalUploadStore(root);
  const fileName = await store.put('product', {
    originalname: 'a product.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });

  assert.match(fileName, /^[a-f0-9-]+\.jpg$/i);
  const stored = await store.get('product', fileName);
  assert.equal(stored.type, 'local');
  assert.deepEqual(await fs.readFile(stored.filePath), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  assert.equal(await store.get('product', '00000000-0000-0000-0000-000000000000.png'), null);
  await assert.rejects(store.get('product', '..\\secret.png'), /Invalid upload path/);
  await assert.rejects(store.put('unknown', { originalname: 'x.png', buffer: Buffer.from('x') }), /Invalid upload path/);
});

test('S3 upload storage returns a short-lived signed URL for a private object read', async () => {
  const store = createS3UploadStore({
    bucket: 'smartscan-private-test',
    region: 'us-east-1',
    endpoint: 'https://objects.example.test',
    forcePathStyle: true,
    credentials: { accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key' },
    signedUrlTtlSeconds: 120,
  });
  const result = await store.get('product', 'abcd1234-1234-1234-1234-1234567890ab.png');
  const url = new URL(result.url);
  assert.equal(result.type, 'redirect');
  assert.equal(url.hostname, 'objects.example.test');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '120');
  assert.match(url.pathname, /smartscan-private-test\/product\//);
  await assert.rejects(store.get('other', 'abcd1234-1234-1234-1234-1234567890ab.png'), /Invalid upload path/);
});

test('S3 uploads are private-cacheable and never marked public', async () => {
  const calls = [];
  const store = createS3UploadStore({
    bucket: 'smartscan-private-test',
    region: 'us-east-1',
    client: { async send(command) { calls.push(command); return {}; } },
  });

  await store.put('profile', {
    originalname: 'profile.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, 'PutObjectCommand');
  assert.equal(calls[0].input.CacheControl, 'private, max-age=300');
});

test('S3 readiness performs a read-only bucket probe and propagates unavailable storage', async () => {
  const calls = [];
  const store = createS3UploadStore({
    bucket: 'smartscan-private-test',
    region: 'us-east-1',
    client: { async send(command) { calls.push(command); return {}; } },
  });
  assert.equal(await store.checkReady(), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, 'HeadBucketCommand');
  assert.equal(calls[0].input.Bucket, 'smartscan-private-test');

  const unavailable = createS3UploadStore({
    bucket: 'smartscan-private-test',
    region: 'us-east-1',
    client: { async send() { throw new Error('storage unavailable'); } },
  });
  await assert.rejects(unavailable.checkReady(), /storage unavailable/);
});
