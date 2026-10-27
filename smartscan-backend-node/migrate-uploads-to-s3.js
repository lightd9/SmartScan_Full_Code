require('dotenv').config();

const path = require('path');
const { createPool } = require('./db');
const { createS3UploadStore } = require('./upload-storage');
const { inspectLegacyUploads, copyLegacyUploads } = require('./upload-migration');

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply' && arg !== '--dry-run') || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Use no option or --dry-run to inspect; pass only --apply to copy files to S3');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const sourceRoot = path.resolve(process.env.UPLOAD_LEGACY_DIR || path.join(__dirname, 'public', 'uploads'));
  const pool = createPool(process.env.DATABASE_URL);
  try {
    const inspection = await inspectLegacyUploads({ pool, sourceRoot });
    console.log(`Referenced images: ${inspection.referenceCount}; valid local files: ${inspection.validFiles.length}; missing: ${inspection.missing.length}; invalid: ${inspection.invalid.length}`);
    if (inspection.missing.length || inspection.invalid.length) {
      throw new Error('Repair missing or invalid source images before copying; no S3 writes were made');
    }
    if (!args.includes('--apply')) {
      console.log('Dry run only. Local files were not changed. Configure S3 and pass --apply to copy referenced images.');
      return;
    }
    if (process.env.UPLOAD_STORAGE_DRIVER !== 's3') throw new Error('Set UPLOAD_STORAGE_DRIVER=s3 before applying the media copy');
    if (process.env.UPLOAD_S3_ENDPOINT && new URL(process.env.UPLOAD_S3_ENDPOINT).protocol !== 'https:') {
      throw new Error('UPLOAD_S3_ENDPOINT must use HTTPS when copying production media');
    }
    const forcePathStyle = String(process.env.UPLOAD_S3_FORCE_PATH_STYLE || 'false').toLowerCase();
    if (!['true', 'false'].includes(forcePathStyle)) throw new Error('UPLOAD_S3_FORCE_PATH_STYLE must be true or false');
    const uploadStore = createS3UploadStore({
      bucket: process.env.UPLOAD_S3_BUCKET,
      region: process.env.UPLOAD_S3_REGION,
      endpoint: process.env.UPLOAD_S3_ENDPOINT,
      forcePathStyle: forcePathStyle === 'true',
      credentials: process.env.UPLOAD_S3_ACCESS_KEY_ID && process.env.UPLOAD_S3_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID, secretAccessKey: process.env.UPLOAD_S3_SECRET_ACCESS_KEY }
        : undefined,
    });
    const copied = await copyLegacyUploads({ files: inspection.validFiles, sourceRoot, uploadStore });
    console.log(`Media copy complete. Uploaded: ${copied.uploaded}; already present and left unchanged: ${copied.skipped}. Local source files were preserved.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Media migration failed: ${error.message}`);
  process.exitCode = 1;
});
