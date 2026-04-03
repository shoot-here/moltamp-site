/**
 * Widget validation for Cloudflare Workers.
 * Mirrors skin-validator.ts but for widget packages.
 * Widgets must contain widget.json + index.html.
 */

// --- Constants ---

export const MAX_ASSET_SIZE = 5 * 1024 * 1024; // 5 MB per file
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20 MB total
export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB (zip overhead buffer)

export const REQUIRED_MANIFEST_FIELDS = ['id', 'name'];

export const ALLOWED_ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif',
  '.html', '.css', '.js', '.json', '.woff', '.woff2', '.ttf',
]);

const WIDGET_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// --- Manifest Validation ---

export interface ManifestResult {
  valid: boolean;
  errors: string[];
  manifest?: WidgetManifest;
}

export interface WidgetManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
}

export function validateManifest(raw: unknown): ManifestResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['widget.json must be a JSON object'] };
  }

  const obj = raw as Record<string, unknown>;

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!obj[field] || typeof obj[field] !== 'string') {
      errors.push(`Missing or invalid required field: ${field}`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  const id = (obj.id as string).trim();
  if (!WIDGET_ID_REGEX.test(id)) {
    errors.push('Widget ID must be alphanumeric with hyphens/underscores only');
  }
  if (id.length < 3 || id.length > 64) {
    errors.push('Widget ID must be 3-64 characters');
  }

  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name.length > 100) {
    errors.push('Name must be 100 characters or less');
  }

  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  if (description.length > 500) {
    errors.push('Description must be 500 characters or less');
  }

  const author = typeof obj.author === 'string' ? obj.author.trim() : '';
  if (author.length > 100) {
    errors.push('Author must be 100 characters or less');
  }

  const version = typeof obj.version === 'string' ? obj.version.trim() : '1.0.0';

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    manifest: {
      id,
      name,
      version,
      author: author || 'Anonymous',
      description: description || '',
    },
  };
}

// --- File Validation (in-memory ZIP entries) ---

export interface FileResult {
  valid: boolean;
  errors: string[];
  fileCount: number;
  totalSize: number;
}

export function validateFiles(
  entries: Record<string, Uint8Array>,
): FileResult {
  const errors: string[] = [];
  let totalSize = 0;
  let fileCount = 0;

  for (const [path, data] of Object.entries(entries)) {
    // Skip directory entries
    if (path.endsWith('/') || !path) continue;

    // Skip manifest
    if (path === 'widget.json') continue;

    // Check extension
    const ext = '.' + path.split('.').pop()?.toLowerCase();
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
      errors.push(`File too large: ${path} (${mb}MB, max 5MB)`);
    }

    totalSize += data.length;
    fileCount++;
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    const mb = (totalSize / (1024 * 1024)).toFixed(1);
    errors.push(`Total size ${mb}MB exceeds 20MB limit`);
  }

  return { valid: errors.length === 0, errors, fileCount, totalSize };
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
