import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getEnv } from '../env.js';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const env = getEnv();
    s3Client = new S3Client({
      region: 'auto',
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export async function uploadFile(opts: {
  key: string;
  stream: Readable;
  mimetype: string;
  localDir: string;
  publicPrefix: string;
}): Promise<string> {
  const env = getEnv();

  if (env.STORAGE_PROVIDER === 's3') {
    const s3 = getS3Client();
    const chunks: Buffer[] = [];
    for await (const chunk of opts.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);

    await s3.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET!,
      Key: opts.key,
      Body: body,
      ContentType: opts.mimetype,
    }));

    const base = env.S3_PUBLIC_URL?.replace(/\/$/, '') ?? '';
    return `${base}/${opts.key}`;
  }

  // Local fallback
  mkdirSync(opts.localDir, { recursive: true });
  const filepath = join(opts.localDir, opts.key);
  await pipeline(opts.stream, createWriteStream(filepath));
  return `${opts.publicPrefix}/${opts.key}`;
}
