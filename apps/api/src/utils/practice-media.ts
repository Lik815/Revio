import { randomBytes } from 'crypto';
import type { Readable } from 'stream';
import { uploadFile } from './storage.js';
import { PRACTICE_LOGOS_DIR, PRACTICE_PHOTOS_DIR } from './storage-paths.js';

// Gemeinsame Upload-Logik für Admin- (admin.ts) und Claim-Pfad (claim.ts),
// damit beide nicht auseinanderlaufen. Siehe
// docs/praxis-zusatzdaten-umsetzung.md, Abschnitt A.

export const PRACTICE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const PRACTICE_PHOTOS_MAX = 10;

export function isAllowedPracticeImageMime(mimetype: string): boolean {
  return PRACTICE_IMAGE_MIMES.includes(mimetype);
}

function extFor(mimetype: string): string {
  return mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
}

type UploadedFile = { mimetype: string; file: Readable };

export async function uploadPracticeLogo(data: UploadedFile): Promise<string> {
  const key = `${randomBytes(16).toString('hex')}.${extFor(data.mimetype)}`;
  return uploadFile({
    key,
    stream: data.file,
    mimetype: data.mimetype,
    localDir: PRACTICE_LOGOS_DIR,
    publicPrefix: '/uploads/practice-logos',
  });
}

export async function uploadPracticePhoto(data: UploadedFile): Promise<string> {
  const key = `${randomBytes(16).toString('hex')}.${extFor(data.mimetype)}`;
  return uploadFile({
    key,
    stream: data.file,
    mimetype: data.mimetype,
    localDir: PRACTICE_PHOTOS_DIR,
    publicPrefix: '/uploads/practice-photos',
  });
}

// practice.photos ist ein untypisierter JSON-String in der DB — defensiv
// parsen, da ein defekter/leerer Wert nie zu einem 500 führen darf.
export function parsePracticePhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

export function serializePracticePhotos(photos: string[]): string {
  return JSON.stringify(photos);
}
