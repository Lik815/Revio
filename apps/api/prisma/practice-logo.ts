import { mkdirSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRACTICE_LOGO_DIR = join(__dirname, '../uploads/practice-logos');
const PRACTICE_LOGO_PREFIX = '/uploads/practice-logos/';
const GENERATOR_SCRIPT = join(__dirname, 'generate_practice_logo.py');

function normalizeForSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function hashPracticeIdentity(name: string, city?: string | null): number {
  const identity = `${name}::${city ?? ''}`;
  let hash = 0;

  for (let i = 0; i < identity.length; i++) {
    hash = (hash * 33 + identity.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export function buildPracticeLogoFilename(name: string, city?: string | null): string {
  const slugBase = [normalizeForSlug(name), normalizeForSlug(city ?? '')]
    .filter(Boolean)
    .join('-');
  const suffix = hashPracticeIdentity(name, city).toString(16).padStart(8, '0').slice(-8);

  return `${slugBase || 'practice'}-${suffix}.png`;
}

export function buildPracticeLogoUrl(name: string, city?: string | null): string {
  return `${PRACTICE_LOGO_PREFIX}${buildPracticeLogoFilename(name, city)}`;
}

export function getPracticeLogoAbsolutePath(name: string, city?: string | null): string {
  return join(PRACTICE_LOGO_DIR, buildPracticeLogoFilename(name, city));
}

export function isManagedPracticeLogo(logo: string | null | undefined): boolean {
  return typeof logo === 'string' && (
    logo.includes('ui-avatars.com/api/') ||
    logo.startsWith(PRACTICE_LOGO_PREFIX)
  );
}

export function shouldRefreshPracticeLogo(
  logo: string | null | undefined,
  name: string,
  city?: string | null,
): boolean {
  if (!logo || logo.trim() === '') return true;
  if (logo.includes('ui-avatars.com/api/')) return true;
  if (!logo.startsWith(PRACTICE_LOGO_PREFIX)) return false;

  return logo !== buildPracticeLogoUrl(name, city) || !existsSync(getPracticeLogoAbsolutePath(name, city));
}

export function ensurePracticeLogoAsset(
  name: string,
  city?: string | null,
  options: { force?: boolean } = {},
): string {
  const outputPath = getPracticeLogoAbsolutePath(name, city);
  const logoUrl = buildPracticeLogoUrl(name, city);

  mkdirSync(PRACTICE_LOGO_DIR, { recursive: true });

  if (!options.force && existsSync(outputPath)) {
    return logoUrl;
  }

  const result = spawnSync(
    'python3',
    [
      GENERATOR_SCRIPT,
      '--name', name,
      '--city', city ?? '',
      '--output', outputPath,
    ],
    {
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      [
        `Practice logo generation failed for "${name}"`,
        result.stderr?.trim(),
        result.stdout?.trim(),
      ].filter(Boolean).join('\n'),
    );
  }

  return logoUrl;
}

export function tryEnsurePracticeLogoAsset(name: string, city?: string | null): string | null {
  try {
    return ensurePracticeLogoAsset(name, city);
  } catch {
    return null;
  }
}
