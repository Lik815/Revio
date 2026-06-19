import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Compiled to apps/api/dist/utils/ — two levels up is the API root.
const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = join(__dirname, '../..');

export const API_STORAGE_DIR = join(API_ROOT, 'storage');

export const PUBLIC_UPLOADS_DIR = join(API_STORAGE_DIR, 'public/uploads');
export const PROFILE_PHOTOS_DIR = join(PUBLIC_UPLOADS_DIR, 'profile-photos');

export const PRIVATE_DOCUMENTS_DIR = join(API_STORAGE_DIR, 'private/documents');
export const THERAPIST_VERIFICATIONS_DIR = join(PRIVATE_DOCUMENTS_DIR, 'therapist-verifications');
