/**
 * Skin validation for Cloudflare Workers.
 * Ported from moltamp/electron/skins/skin-validator.js.
 * Operates on in-memory ZIP entries instead of filesystem.
 */

// --- Constants ---

export const MAX_CSS_SIZE = 100 * 1024; // 100 KB
export const MAX_ASSET_SIZE = 5 * 1024 * 1024; // 5 MB per file
export const MAX_TOTAL_ASSETS_SIZE = 20 * 1024 * 1024; // 20 MB total
export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB (zip overhead buffer)

export const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'author', 'description', 'engine'];

export const ALLOWED_ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif',
]);

const FORBIDDEN_CSS_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /url\s*\(\s*['"]?https?:/i, message: 'External URL detected' },
  { pattern: /@import\s/i, message: '@import is not allowed' },
  { pattern: /expression\s*\(/i, message: 'CSS expression() is not allowed' },
  { pattern: /-moz-binding/i, message: '-moz-binding is not allowed' },
  { pattern: /url\s*\(\s*['"]?data:\s*text/i, message: 'data:text/* URIs are not allowed' },
  { pattern: /url\s*\(\s*['"]?javascript:/i, message: 'javascript: URIs are not allowed' },
  { pattern: /behavior\s*:/i, message: 'IE behavior property is not allowed' },
];

const PROTECTED_PROPERTY_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /visibility\s*:\s*hidden/i, message: 'visibility:hidden may hide permission dialogs' },
  { pattern: /opacity\s*:\s*0(?:\.0+)?(?:\s*[;!}])/i, message: 'opacity:0 may hide permission dialogs' },
  { pattern: /pointer-events\s*:\s*none/i, message: 'pointer-events:none may block permission dialogs' },
];

const SKIN_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// --- Manifest Validation ---

export interface ManifestResult {
  valid: boolean;
  errors: string[];
  manifest?: SkinManifest;
}

export interface SkinManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  engine: string;
}

export function validateManifest(raw: unknown): ManifestResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['skin.json must be a JSON object'] };
  }

  const obj = raw as Record<string, unknown>;

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!obj[field] || typeof obj[field] !== 'string') {
      errors.push(`Missing or invalid required field: ${field}`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  const id = (obj.id as string).trim();
  if (!SKIN_ID_REGEX.test(id)) {
    errors.push('Skin ID must be alphanumeric with hyphens/underscores only');
  }
  if (id.length < 3 || id.length > 64) {
    errors.push('Skin ID must be 3-64 characters');
  }

  if ((obj.name as string).length > 100) {
    errors.push('Name must be 100 characters or less');
  }
  if ((obj.description as string).length > 500) {
    errors.push('Description must be 500 characters or less');
  }
  if ((obj.author as string).length > 100) {
    errors.push('Author must be 100 characters or less');
  }

  if (obj.engine !== '1.0') {
    errors.push('Engine version must be "1.0"');
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    manifest: {
      id,
      name: (obj.name as string).trim(),
      version: (obj.version as string).trim(),
      author: (obj.author as string).trim(),
      description: (obj.description as string).trim(),
      engine: '1.0',
    },
  };
}

// --- CSS Validation ---

export interface CSSResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCSS(css: string): CSSResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof css !== 'string') {
    return { valid: false, errors: ['theme.css must be a string'], warnings: [] };
  }

  if (new TextEncoder().encode(css).length > MAX_CSS_SIZE) {
    errors.push(`theme.css exceeds ${MAX_CSS_SIZE / 1024}KB limit`);
  }

  for (const { pattern, message } of FORBIDDEN_CSS_PATTERNS) {
    if (pattern.test(css)) {
      errors.push(`Forbidden CSS: ${message}`);
    }
  }

  for (const { pattern, message } of PROTECTED_PROPERTY_PATTERNS) {
    if (pattern.test(css)) {
      warnings.push(`Warning: ${message}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --- Asset Validation (in-memory ZIP entries) ---

export interface AssetResult {
  valid: boolean;
  errors: string[];
  assetCount: number;
  totalSize: number;
}

export function validateAssets(
  entries: Record<string, Uint8Array>,
): AssetResult {
  const errors: string[] = [];
  let totalSize = 0;
  let assetCount = 0;

  for (const [path, data] of Object.entries(entries)) {
    // Only check files in assets/
    if (!path.startsWith('assets/')) continue;

    const relativePath = path.slice('assets/'.length);

    // No nested directories
    if (relativePath.includes('/')) {
      errors.push(`Nested directory in assets: ${path}`);
      continue;
    }

    // Check extension
    const ext = '.' + relativePath.split('.').pop()?.toLowerCase();
    if (!ALLOWED_ASSET_EXTENSIONS.has(ext)) {
      errors.push(`Disallowed file type: ${path} (${ext})`);
      continue;
    }

    // SVG security check
    if (ext === '.svg') {
      const svgText = new TextDecoder().decode(data);
      if (/<script/i.test(svgText) || /on\w+\s*=/i.test(svgText)) {
        errors.push(`SVG contains script or event handlers: ${path}`);
      }
    }

    // Size checks
    if (data.length > MAX_ASSET_SIZE) {
      const mb = (data.length / (1024 * 1024)).toFixed(1);
      errors.push(`Asset too large: ${path} (${mb}MB, max 5MB)`);
    }

    totalSize += data.length;
    assetCount++;
  }

  if (totalSize > MAX_TOTAL_ASSETS_SIZE) {
    const mb = (totalSize / (1024 * 1024)).toFixed(1);
    errors.push(`Total assets size ${mb}MB exceeds 20MB limit`);
  }

  return { valid: errors.length === 0, errors, assetCount, totalSize };
}

// --- ZIP Path Validation ---

export function validateZipPaths(paths: string[]): string[] {
  const errors: string[] = [];
  for (const path of paths) {
    if (path.includes('..') || path.startsWith('/') || path.includes('\\')) {
      errors.push(`Dangerous path in archive: ${path}`);
    }
  }
  return errors;
}
