import { unzipSync } from 'fflate/browser';
import { getAuthUser } from '../_shared/auth';
import { jsonOk, jsonError, jsonErrors } from '../_shared/response';
import {
  validateManifest,
  validateCSS,
  validateAssets,
  validateZipPaths,
  MAX_UPLOAD_SIZE,
} from '../_shared/skin-validator';
import { extractColorsFromCSS } from '../_shared/color-extractor';

interface Env {
  DB: D1Database;
}

const MAX_SKINS_PER_USER = 20;
const MAX_STORAGE_PER_USER = 200 * 1024 * 1024; // 200MB

/**
 * GET /api/skins?q=&tag=&sort=newest|popular|updated&page=1&limit=24
 * Public gallery listing with search, tag filter, pagination.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);

  const q = url.searchParams.get('q')?.trim() ?? '';
  const tag = url.searchParams.get('tag')?.trim().toLowerCase() ?? '';
  const sort = url.searchParams.get('sort') ?? 'newest';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(48, Math.max(12, parseInt(url.searchParams.get('limit') ?? '24')));
  const offset = (page - 1) * limit;

  let where = `WHERE cs.status = 'active'`;
  const binds: unknown[] = [];

  if (q) {
    where += ` AND (cs.name LIKE ? OR cs.description LIKE ? OR cs.author_name LIKE ? OR cs.skin_id LIKE ?)`;
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }

  if (tag) {
    where += ` AND cs.id IN (SELECT skin_id FROM skin_tags WHERE tag = ?)`;
    binds.push(tag);
  }

  const author = url.searchParams.get('author')?.trim() ?? '';
  if (author) {
    where += ` AND cs.author_name = ?`;
    binds.push(author);
  }

  const orderBy =
    sort === 'popular'
      ? 'cs.download_count DESC'
      : sort === 'top-rated'
        ? 'avg_rating DESC NULLS LAST, rating_count DESC'
        : sort === 'updated'
          ? 'cs.updated_at DESC'
          : 'cs.created_at DESC';

  const countResult = await DB.prepare(
    `SELECT COUNT(*) as total FROM community_skins cs ${where}`,
  )
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await DB.prepare(
    `SELECT cs.skin_id, cs.name, cs.version, cs.author_name, cs.description,
            cs.colors_json, cs.download_count, cs.file_size, cs.created_at, cs.updated_at,
            GROUP_CONCAT(st.tag) as tags,
            (SELECT ROUND(AVG(sr.rating), 1) FROM skin_ratings sr WHERE sr.skin_id = cs.id) as avg_rating,
            (SELECT COUNT(*) FROM skin_ratings sr WHERE sr.skin_id = cs.id) as rating_count
     FROM community_skins cs
     LEFT JOIN skin_tags st ON st.skin_id = cs.id
     ${where}
     GROUP BY cs.id
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all();

  const skins = rows.results.map((row: Record<string, unknown>) => ({
    skin_id: row.skin_id,
    name: row.name,
    version: row.version,
    author_name: row.author_name,
    description: row.description,
    colors: JSON.parse(row.colors_json as string),
    tags: row.tags ? (row.tags as string).split(',') : [],
    download_count: row.download_count,
    file_size: row.file_size,
    avg_rating: row.avg_rating ?? 0,
    rating_count: row.rating_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return jsonOk({
    skins,
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      pages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
};

/**
 * POST /api/skins (multipart form)
 * Upload a .zip skin file. Requires auth.
 * Form fields: file (the skin archive), tags (comma-separated, optional)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    // Auth first
    const user = await getAuthUser(context.request, DB);
    if (!user) return jsonError('Not authenticated', 401);

    // Parse multipart form first (before any DB queries)
    let formData: FormData;
    try {
      formData = await context.request.formData();
    } catch {
      return jsonError('Invalid form data');
    }

    const file = formData.get('file') as File | null;
    const tagsRaw = (formData.get('tags') as string) ?? '';

    if (!file) return jsonError('No file provided');
    if (file.size > MAX_UPLOAD_SIZE) {
      return jsonError(`File too large (max ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB)`);
    }

    // Now check limits
    const skinCount = await DB.prepare(
      `SELECT COUNT(*) as count FROM community_skins WHERE user_id = ?`,
    ).bind(user.id).first<{ count: number }>();

    if ((skinCount?.count ?? 0) >= MAX_SKINS_PER_USER) {
      return jsonError(`Maximum ${MAX_SKINS_PER_USER} skins per user`);
    }

    const storageUsed = await DB.prepare(
      `SELECT COALESCE(SUM(file_size), 0) as total FROM community_skins WHERE user_id = ?`,
    ).bind(user.id).first<{ total: number }>();

    if ((storageUsed?.total ?? 0) + file.size > MAX_STORAGE_PER_USER) {
      return jsonError('Storage limit exceeded (200MB per user)');
    }

    // Read file and decompress
    const buffer = await file.arrayBuffer();
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(buffer));
    } catch (e) {
      return jsonError('Invalid ZIP archive: ' + (e instanceof Error ? e.message : 'unknown'));
    }

    // Validate zip paths
    const pathErrors = validateZipPaths(Object.keys(entries));
    if (pathErrors.length > 0) return jsonErrors(pathErrors);

    // Find skin.json — may be at root or inside a single top-level folder
    let prefix = '';
    const keys = Object.keys(entries);
    if (!entries['skin.json']) {
      const dirs = new Set(keys.map((k) => k.split('/')[0]));
      if (dirs.size === 1) {
        const dir = [...dirs][0];
        if (entries[`${dir}/skin.json`]) {
          prefix = `${dir}/`;
        }
      }
    }

    const skinJsonBytes = entries[`${prefix}skin.json`];
    if (!skinJsonBytes) return jsonError('Missing skin.json in archive');

    const cssBytes = entries[`${prefix}theme.css`];
    if (!cssBytes) return jsonError('Missing theme.css in archive');

    // Validate manifest
    let manifestObj: unknown;
    try {
      manifestObj = JSON.parse(new TextDecoder().decode(skinJsonBytes));
    } catch {
      return jsonError('Invalid JSON in skin.json');
    }

    const manifestResult = validateManifest(manifestObj);
    if (!manifestResult.valid) return jsonErrors(manifestResult.errors);
    const manifest = manifestResult.manifest!;

    // Validate CSS
    const cssText = new TextDecoder().decode(cssBytes);
    const cssResult = validateCSS(cssText);
    if (!cssResult.valid) return jsonErrors(cssResult.errors);

    // Validate assets
    const relativeEntries: Record<string, Uint8Array> = {};
    for (const [path, data] of Object.entries(entries)) {
      if (path.startsWith(prefix)) {
        relativeEntries[path.slice(prefix.length)] = data;
      }
    }
    const assetResult = validateAssets(relativeEntries);
    if (!assetResult.valid) return jsonErrors(assetResult.errors);

    // Check skin_id uniqueness
    const existing = await DB.prepare(
      `SELECT user_id FROM community_skins WHERE skin_id = ? LIMIT 1`,
    ).bind(manifest.id).first<{ user_id: number }>();

    if (existing && existing.user_id !== user.id) {
      return jsonError(`Skin ID "${manifest.id}" is already taken`);
    }

    // Extract colors for preview
    const colors = extractColorsFromCSS(cssText);

    // Store file data as blob in D1 (R2 migration later)
    const fileBytes = new Uint8Array(buffer);

    // Parse tags
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
      .filter((t) => t.length > 0 && t.length <= 24)
      .slice(0, 5);

    // Insert or update in D1
    if (existing && existing.user_id === user.id) {
      await DB.prepare(
        `UPDATE community_skins
         SET name = ?, version = ?, description = ?, author_name = ?, colors_json = ?,
             r2_key = ?, file_size = ?, css_size = ?, asset_count = ?, file_data = ?, updated_at = datetime('now')
         WHERE skin_id = ?`,
      ).bind(
        manifest.name, manifest.version, manifest.description, manifest.author,
        JSON.stringify(colors), `d1://${manifest.id}`, file.size, cssBytes.length,
        assetResult.assetCount, fileBytes, manifest.id,
      ).run();

      const row = await DB.prepare(
        `SELECT id FROM community_skins WHERE skin_id = ?`,
      ).bind(manifest.id).first<{ id: number }>();
      if (row) {
        await DB.prepare(`DELETE FROM skin_tags WHERE skin_id = ?`).bind(row.id).run();
        for (const tag of tags) {
          await DB.prepare(`INSERT INTO skin_tags (skin_id, tag) VALUES (?, ?)`).bind(row.id, tag).run();
        }
      }
    } else {
      const insertResult = await DB.prepare(
        `INSERT INTO community_skins
           (skin_id, user_id, name, version, description, author_name, colors_json, r2_key, file_size, css_size, asset_count, file_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        manifest.id, user.id, manifest.name, manifest.version,
        manifest.description, manifest.author, JSON.stringify(colors),
        `d1://${manifest.id}`, file.size, cssBytes.length, assetResult.assetCount, fileBytes,
      ).run();

      const newId = insertResult.meta.last_row_id;
      for (const tag of tags) {
        await DB.prepare(`INSERT INTO skin_tags (skin_id, tag) VALUES (?, ?)`).bind(newId, tag).run();
      }
    }

    return jsonOk({
      success: true,
      skin: {
        skin_id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        author_name: manifest.author,
        description: manifest.description,
        tags,
        colors,
        download_count: 0,
        warnings: cssResult.warnings,
      },
    });
  } catch (e) {
    console.error('Upload error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonError(`Upload failed: ${msg}`, 500);
  }
};
