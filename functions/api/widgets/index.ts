import { unzipSync } from 'fflate/browser';
import { getAuthUser } from '../_shared/auth';
import { jsonOk, jsonError, jsonErrors } from '../_shared/response';
import {
  validateManifest,
  validateFiles,
  validateZipPaths,
  MAX_UPLOAD_SIZE,
} from '../_shared/widget-validator';

interface Env {
  DB: D1Database;
}

const MAX_WIDGETS_PER_USER = 20;
const MAX_STORAGE_PER_USER = 200 * 1024 * 1024; // 200MB

/**
 * GET /api/widgets?q=&tag=&sort=newest|popular|updated&page=1&limit=24
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

  let where = `WHERE cw.status = 'active'`;
  const binds: unknown[] = [];

  if (q) {
    where += ` AND (cw.name LIKE ? OR cw.description LIKE ? OR cw.author_name LIKE ? OR cw.widget_id LIKE ?)`;
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }

  if (tag) {
    where += ` AND cw.id IN (SELECT widget_id FROM widget_tags WHERE tag = ?)`;
    binds.push(tag);
  }

  const author = url.searchParams.get('author')?.trim() ?? '';
  if (author) {
    where += ` AND cw.author_name = ?`;
    binds.push(author);
  }

  const orderBy =
    sort === 'popular'
      ? 'cw.download_count DESC'
      : sort === 'top-rated'
        ? 'avg_rating DESC NULLS LAST, rating_count DESC'
        : sort === 'updated'
          ? 'cw.updated_at DESC'
          : 'cw.created_at DESC';

  const countResult = await DB.prepare(
    `SELECT COUNT(*) as total FROM community_widgets cw ${where}`,
  )
    .bind(...binds)
    .first<{ total: number }>();

  const rows = await DB.prepare(
    `SELECT cw.widget_id, cw.name, cw.version, cw.author_name, cw.description,
            cw.download_count, cw.file_size, cw.created_at, cw.updated_at,
            GROUP_CONCAT(wt.tag) as tags,
            (SELECT ROUND(AVG(wr.rating), 1) FROM widget_ratings wr WHERE wr.widget_id = cw.id) as avg_rating,
            (SELECT COUNT(*) FROM widget_ratings wr WHERE wr.widget_id = cw.id) as rating_count
     FROM community_widgets cw
     LEFT JOIN widget_tags wt ON wt.widget_id = cw.id
     ${where}
     GROUP BY cw.id
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all();

  const widgets = rows.results.map((row: Record<string, unknown>) => ({
    widget_id: row.widget_id,
    name: row.name,
    version: row.version,
    author_name: row.author_name,
    description: row.description,
    tags: row.tags ? (row.tags as string).split(',') : [],
    download_count: row.download_count,
    file_size: row.file_size,
    avg_rating: row.avg_rating ?? 0,
    rating_count: row.rating_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return jsonOk({
    widgets,
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      pages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
};

/**
 * POST /api/widgets (multipart form)
 * Upload a .zip widget file. Requires auth.
 * Form fields: file (the widget archive), tags (comma-separated, optional)
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
    const widgetCount = await DB.prepare(
      `SELECT COUNT(*) as count FROM community_widgets WHERE user_id = ?`,
    ).bind(user.id).first<{ count: number }>();

    if ((widgetCount?.count ?? 0) >= MAX_WIDGETS_PER_USER) {
      return jsonError(`Maximum ${MAX_WIDGETS_PER_USER} widgets per user`);
    }

    const storageUsed = await DB.prepare(
      `SELECT COALESCE(SUM(file_size), 0) as total FROM community_widgets WHERE user_id = ?`,
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

    // Find widget.json — may be at root or inside a single top-level folder
    let prefix = '';
    const keys = Object.keys(entries);
    if (!entries['widget.json']) {
      const dirs = new Set(keys.map((k) => k.split('/')[0]));
      if (dirs.size === 1) {
        const dir = [...dirs][0];
        if (entries[`${dir}/widget.json`]) {
          prefix = `${dir}/`;
        }
      }
    }

    const widgetJsonBytes = entries[`${prefix}widget.json`];
    if (!widgetJsonBytes) return jsonError('Missing widget.json in archive');

    const indexHtmlBytes = entries[`${prefix}index.html`];
    if (!indexHtmlBytes) return jsonError('Missing index.html in archive');

    // Validate manifest
    let manifestObj: unknown;
    try {
      manifestObj = JSON.parse(new TextDecoder().decode(widgetJsonBytes));
    } catch {
      return jsonError('Invalid JSON in widget.json');
    }

    const manifestResult = validateManifest(manifestObj);
    if (!manifestResult.valid) return jsonErrors(manifestResult.errors);
    const manifest = manifestResult.manifest!;

    // Validate files
    const relativeEntries: Record<string, Uint8Array> = {};
    for (const [path, data] of Object.entries(entries)) {
      if (path.startsWith(prefix)) {
        relativeEntries[path.slice(prefix.length)] = data;
      }
    }
    const fileResult = validateFiles(relativeEntries);
    if (!fileResult.valid) return jsonErrors(fileResult.errors);

    // Check widget_id uniqueness
    const existing = await DB.prepare(
      `SELECT user_id FROM community_widgets WHERE widget_id = ? LIMIT 1`,
    ).bind(manifest.id).first<{ user_id: number }>();

    if (existing && existing.user_id !== user.id) {
      return jsonError(`Widget ID "${manifest.id}" is already taken`);
    }

    // Extract index.html content for live iframe preview
    const htmlContent = new TextDecoder().decode(indexHtmlBytes);

    // Store file data as blob in D1
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
        `UPDATE community_widgets
         SET name = ?, version = ?, description = ?, author_name = ?,
             r2_key = ?, file_size = ?, file_data = ?, html_content = ?, updated_at = datetime('now')
         WHERE widget_id = ?`,
      ).bind(
        manifest.name, manifest.version, manifest.description, manifest.author,
        `d1://${manifest.id}`, file.size, fileBytes, htmlContent, manifest.id,
      ).run();

      const row = await DB.prepare(
        `SELECT id FROM community_widgets WHERE widget_id = ?`,
      ).bind(manifest.id).first<{ id: number }>();
      if (row) {
        await DB.prepare(`DELETE FROM widget_tags WHERE widget_id = ?`).bind(row.id).run();
        for (const tag of tags) {
          await DB.prepare(`INSERT INTO widget_tags (widget_id, tag) VALUES (?, ?)`).bind(row.id, tag).run();
        }
      }
    } else {
      const insertResult = await DB.prepare(
        `INSERT INTO community_widgets
           (widget_id, user_id, name, version, description, author_name, r2_key, file_size, file_data, html_content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        manifest.id, user.id, manifest.name, manifest.version,
        manifest.description, manifest.author,
        `d1://${manifest.id}`, file.size, fileBytes, htmlContent,
      ).run();

      const newId = insertResult.meta.last_row_id;
      for (const tag of tags) {
        await DB.prepare(`INSERT INTO widget_tags (widget_id, tag) VALUES (?, ?)`).bind(newId, tag).run();
      }
    }

    return jsonOk({
      success: true,
      widget: {
        widget_id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        author_name: manifest.author,
        description: manifest.description,
        tags,
        download_count: 0,
      },
    });
  } catch (e) {
    console.error('Upload error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonError(`Upload failed: ${msg}`, 500);
  }
};
