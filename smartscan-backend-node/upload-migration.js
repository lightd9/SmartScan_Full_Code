const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { hasValidImageSignature, imageMimeForFileName, isSafeFileName, MAX_UPLOAD_BYTES } = require('./upload-storage');

async function inspectLegacyUploads({ pool, sourceRoot }) {
  const [products, profiles] = await Promise.all([
    pool.query("SELECT DISTINCT chain_image AS image FROM product WHERE chain_image IS NOT NULL AND btrim(chain_image) <> ''"),
    pool.query("SELECT DISTINCT image FROM profile WHERE image IS NOT NULL AND btrim(image) <> ''"),
  ]);
  const references = [
    ...products.rows.map((row) => ({ scope: 'product', fileName: String(row.image).trim() })),
    ...profiles.rows.map((row) => ({ scope: 'profile', fileName: String(row.image).trim() })),
  ];
  const unique = new Map(references.map((entry) => [`${entry.scope}/${entry.fileName}`, entry]));
  const validFiles = [];
  const missing = [];
  const invalid = [];

  for (const entry of unique.values()) {
    if (!isSafeFileName(entry.fileName) || !imageMimeForFileName(entry.fileName)) {
      invalid.push(entry);
      continue;
    }
    const filePath = path.join(sourceRoot, entry.scope, entry.fileName);
    let buffer;
    try {
      const metadata = await fs.lstat(filePath);
      if (!metadata.isFile() || metadata.size > MAX_UPLOAD_BYTES) {
        invalid.push(entry);
        continue;
      }
      buffer = await fs.readFile(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') missing.push(entry);
      else throw error;
      continue;
    }
    const file = { originalname: entry.fileName, mimetype: imageMimeForFileName(entry.fileName), buffer };
    if (!hasValidImageSignature(file)) {
      invalid.push(entry);
      continue;
    }
    validFiles.push({ ...entry, filePath });
  }

  return { validFiles, missing, invalid, referenceCount: unique.size };
}

async function copyLegacyUploads({ files, sourceRoot, uploadStore }) {
  let uploaded = 0;
  let skipped = 0;
  for (const entry of files) {
    const filePath = path.join(sourceRoot, entry.scope, entry.fileName);
    const metadata = await fs.lstat(filePath);
    if (!metadata.isFile() || metadata.size > MAX_UPLOAD_BYTES) throw new Error('Legacy image changed or exceeded the allowed size after inspection');
    const buffer = await fs.readFile(filePath);
    const existing = await uploadStore.getMetadata(entry.scope, entry.fileName);
    if (existing) {
      const sourceHash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (existing.contentLength !== buffer.length || existing.sha256 !== sourceHash) {
        throw new Error('An existing object has conflicting content; no overwrite was attempted');
      }
      skipped += 1;
      continue;
    }
    await uploadStore.putExisting(entry.scope, entry.fileName, {
      originalname: entry.fileName,
      mimetype: imageMimeForFileName(entry.fileName),
      buffer,
    });
    uploaded += 1;
  }
  return { uploaded, skipped };
}

module.exports = { inspectLegacyUploads, copyLegacyUploads };
