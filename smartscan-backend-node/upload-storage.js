const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const SAFE_SCOPE = /^(profile|product)$/;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SAFE_FILE_NAME = /^[a-z0-9][a-z0-9_-]{0,180}\.(?:jpg|jpeg|png|gif|webp)$/i;
const MIME_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
const EXTENSION_MIME_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

function createFileName(mimeType) {
  const ext = MIME_EXTENSIONS[mimeType];
  if (!ext) {
    const error = new Error('Unsupported image type');
    error.status = 400;
    throw error;
  }
  return `${crypto.randomUUID()}${ext}`;
}

function validateScope(scope) {
  if (!SAFE_SCOPE.test(scope)) {
    const error = new Error('Invalid upload path');
    error.status = 400;
    throw error;
  }
}

function isSafeFileName(fileName) {
  return typeof fileName === 'string' && SAFE_FILE_NAME.test(fileName) && path.basename(fileName) === fileName;
}

function validateKey(scope, fileName) {
  validateScope(scope);
  if (!isSafeFileName(fileName)) {
    const error = new Error('Invalid upload path');
    error.status = 400;
    throw error;
  }
}

function imageMimeForFileName(fileName) {
  return EXTENSION_MIME_TYPES[path.extname(fileName).toLowerCase()] || null;
}

function hasValidImageSignature(file) {
  const bytes = file.buffer;
  if (!bytes) return false;
  const signatures = {
    'image/jpeg': bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/png': bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/gif': bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii')),
    'image/webp': bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  return Boolean(signatures[file.mimetype]);
}

function validateImageFile(fileName, file) {
  validateKey('product', fileName);
  const extensionMimeType = imageMimeForFileName(fileName);
  const valid = file && Buffer.isBuffer(file.buffer) && file.buffer.length <= MAX_UPLOAD_BYTES
    && MIME_EXTENSIONS[file.mimetype] && (extensionMimeType === file.mimetype)
    && hasValidImageSignature({ ...file, originalname: fileName });
  if (!valid) {
    const error = new Error('Image content, media type, and filename extension must match');
    error.status = 400;
    throw error;
  }
}

function createLocalUploadStore(baseDir) {
  const root = path.resolve(baseDir);
  return {
    async checkReady() { return true; },
    async put(scope, file) {
      validateScope(scope);
      const fileName = createFileName(file.mimetype);
      return this.putExisting(scope, fileName, file);
    },
    async putExisting(scope, fileName, file) {
      validateKey(scope, fileName);
      validateImageFile(fileName, file);
      const directory = path.join(root, scope);
      await fs.promises.mkdir(directory, { recursive: true });
      await fs.promises.writeFile(path.join(directory, fileName), file.buffer, { flag: 'wx', mode: 0o640 });
      return fileName;
    },
    async get(scope, fileName) {
      validateKey(scope, fileName);
      const filePath = path.resolve(root, scope, fileName);
      if (!filePath.startsWith(`${path.resolve(root, scope)}${path.sep}`)) {
        const error = new Error('Invalid file path');
        error.status = 400;
        throw error;
      }
      try {
        await fs.promises.access(filePath, fs.constants.R_OK);
        return { type: 'local', filePath };
      } catch (_error) {
        return null;
      }
    },
  };
}

function createS3UploadStore({ bucket, region, endpoint, forcePathStyle = false, credentials, signedUrlTtlSeconds = 300, client: suppliedClient }) {
  if (!bucket || !region) throw new Error('S3 upload storage requires a bucket and region');
  const client = suppliedClient || new S3Client({ region, endpoint: endpoint || undefined, forcePathStyle, credentials });
  return {
    async checkReady() {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    },
    async put(scope, file) {
      validateScope(scope);
      const fileName = createFileName(file.mimetype);
      return this.putExisting(scope, fileName, file);
    },
    async putExisting(scope, fileName, file) {
      validateKey(scope, fileName);
      validateImageFile(fileName, file);
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${scope}/${fileName}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'private, max-age=300',
        Metadata: { sha256: crypto.createHash('sha256').update(file.buffer).digest('hex') },
      }));
      return fileName;
    },
    async getMetadata(scope, fileName) {
      validateKey(scope, fileName);
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: `${scope}/${fileName}` }));
        return { contentLength: result.ContentLength, sha256: result.Metadata?.sha256 || null };
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey' || error?.name === 'NotFound') return null;
        throw error;
      }
    },
    async exists(scope, fileName) {
      return Boolean(await this.getMetadata(scope, fileName));
    },
    async get(scope, fileName) {
      validateKey(scope, fileName);
      try {
        const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: `${scope}/${fileName}` }), { expiresIn: signedUrlTtlSeconds });
        return { type: 'redirect', url };
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey' || error?.name === 'NotFound') return null;
        throw error;
      }
    },
  };
}

function createUploadStore(config) {
  if (config.driver === 's3') return createS3UploadStore(config);
  if (config.driver === 'local') return createLocalUploadStore(config.baseDir);
  throw new Error(`Unsupported upload storage driver: ${config.driver}`);
}

module.exports = { createUploadStore, createLocalUploadStore, createS3UploadStore, imageMimeForFileName, hasValidImageSignature, isSafeFileName, MAX_UPLOAD_BYTES };
