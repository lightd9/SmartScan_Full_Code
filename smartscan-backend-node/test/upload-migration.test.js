const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { inspectLegacyUploads, copyLegacyUploads } = require('../upload-migration');

test('legacy image migration inventories only referenced valid files and can safely resume', async (t) => {
  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'smartscan-legacy-media-'));
  t.after(() => fs.rm(sourceRoot, { recursive: true, force: true }));
  await fs.mkdir(path.join(sourceRoot, 'product'), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, 'profile'), { recursive: true });
  const productBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const profileBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await fs.writeFile(path.join(sourceRoot, 'product', '1700000000000-deadbeef.jpg'), productBytes);
  await fs.writeFile(path.join(sourceRoot, 'profile', 'business_logo.png'), profileBytes);

  const pool = {
    async query(sql) {
      if (sql.includes('FROM product')) {
        assert.match(sql, /chain_image AS image/i);
        return { rows: [{ image: '1700000000000-deadbeef.jpg' }] };
      }
      if (sql.includes('FROM profile')) return { rows: [{ image: 'business_logo.png' }] };
      throw new Error('Unexpected migration query');
    },
  };
  const inspection = await inspectLegacyUploads({ pool, sourceRoot });
  assert.equal(inspection.referenceCount, 2);
  assert.equal(inspection.validFiles.length, 2);
  assert.equal(inspection.missing.length, 0);
  assert.equal(inspection.invalid.length, 0);

  const stored = new Map();
  const uploadStore = {
    async getMetadata(scope, fileName) {
      const buffer = stored.get(`${scope}/${fileName}`);
      return buffer ? { contentLength: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') } : null;
    },
    async putExisting(scope, fileName, file) { stored.set(`${scope}/${fileName}`, file.buffer); },
  };
  const firstCopy = await copyLegacyUploads({ files: inspection.validFiles, sourceRoot, uploadStore });
  const retryCopy = await copyLegacyUploads({ files: inspection.validFiles, sourceRoot, uploadStore });
  assert.deepEqual(firstCopy, { uploaded: 2, skipped: 0 });
  assert.deepEqual(retryCopy, { uploaded: 0, skipped: 2 });
  assert.deepEqual(stored.get('product/1700000000000-deadbeef.jpg'), productBytes);
  assert.deepEqual(await fs.readFile(path.join(sourceRoot, 'profile', 'business_logo.png')), profileBytes);
});

test('legacy image migration refuses to skip an existing object with different bytes', async (t) => {
  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'smartscan-conflicting-media-'));
  t.after(() => fs.rm(sourceRoot, { recursive: true, force: true }));
  await fs.mkdir(path.join(sourceRoot, 'product'), { recursive: true });
  const sourceBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  await fs.writeFile(path.join(sourceRoot, 'product', 'existing.jpg'), sourceBuffer);
  const uploadStore = {
    async getMetadata() { return { contentLength: sourceBuffer.length, sha256: 'different-hash' }; },
    async putExisting() { assert.fail('Conflicting object must not be overwritten'); },
  };
  await assert.rejects(copyLegacyUploads({
    files: [{ scope: 'product', fileName: 'existing.jpg' }],
    sourceRoot,
    uploadStore,
  }), /conflicting content/);
});

test('legacy image migration reports missing, unsafe, and invalid references instead of writing', async (t) => {
  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'smartscan-invalid-media-'));
  t.after(() => fs.rm(sourceRoot, { recursive: true, force: true }));
  await fs.mkdir(path.join(sourceRoot, 'product'), { recursive: true });
  await fs.writeFile(path.join(sourceRoot, 'product', 'bad-image.png'), Buffer.from('not an image'));
  const pool = {
    async query(sql) {
      if (sql.includes('FROM product')) return { rows: [
        { image: 'missing.jpg' },
        { image: 'bad-image.png' },
        { image: '..\\outside.png' },
      ] };
      return { rows: [] };
    },
  };
  const inspection = await inspectLegacyUploads({ pool, sourceRoot });
  assert.equal(inspection.missing.length, 1);
  assert.equal(inspection.invalid.length, 2);
  assert.equal(inspection.validFiles.length, 0);
});
