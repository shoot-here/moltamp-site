import { getAuthUser } from '../../../_shared/auth';
import { jsonOk, jsonError } from '../../../_shared/response';

interface Env {
  DB: D1Database;
}

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * POST /api/skins/:skinId/screenshots
 * Upload 1-3 screenshots. Owner only. Replaces existing.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const skinId = (context.params as Record<string, string>).skinId;
  const { DB } = context.env;

  try {
    const user = await getAuthUser(context.request, DB);
    if (!user) return jsonError('Not authenticated', 401);

    // Verify ownership
    const skin = await DB.prepare(
      `SELECT id, user_id FROM community_skins WHERE skin_id = ? LIMIT 1`,
    ).bind(skinId).first<{ id: number; user_id: number }>();

    if (!skin) return jsonError('Skin not found', 404);
    if (skin.user_id !== user.id) return jsonError('Not authorized', 403);

    const formData = await context.request.formData();
    const files: File[] = [];

    // Collect all file entries
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        files.push(value);
      }
    }

    if (files.length === 0) return jsonError('No images provided');
    if (files.length > MAX_SCREENSHOTS) return jsonError(`Maximum ${MAX_SCREENSHOTS} screenshots`);

    // Validate each file
    const errors: string[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        errors.push(`Invalid type: ${file.name} (${file.type}). Use PNG, JPEG, or WebP.`);
      }
      if (file.size > MAX_SCREENSHOT_SIZE) {
        errors.push(`Too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB, max 2MB)`);
      }
    }
    if (errors.length > 0) return jsonError(errors.join('; '));

    // Delete existing screenshots
    await DB.prepare(`DELETE FROM skin_screenshots WHERE skin_id = ?`).bind(skin.id).run();

    // Insert new screenshots
    for (let i = 0; i < files.length; i++) {
      const buf = await files[i].arrayBuffer();
      await DB.prepare(
        `INSERT INTO skin_screenshots (skin_id, image_data, content_type, file_size, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(skin.id, new Uint8Array(buf), files[i].type, files[i].size, i).run();
    }

    return jsonOk({ success: true, count: files.length });
  } catch (e) {
    console.error('Screenshot upload error:', e);
    return jsonError(`Upload failed: ${e instanceof Error ? e.message : 'unknown'}`, 500);
  }
};
