import { requireSession } from './_auth.js';
import { attachPhotoTags, setPhotoTags } from './_photo-tags.js';

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function onRequestPost(context) {
    // Require authentication
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const formData = await context.request.formData();
        const file = formData.get('photo');
        const caption = formData.get('caption');
        const date = formData.get('date');
        const chickenIds = String(formData.get('chicken_ids') || '')
            .split(',')
            .map(Number)
            .filter(Boolean);

        if (!file) {
            return new Response(JSON.stringify({ error: 'No file provided' }), {
                status: 400,
                headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
            });
        }

        // Determine media type from file MIME type
        const mediaType = file.type.startsWith('video/') ? 'video' : 'photo';

        // Generate unique filename
        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        const filename = `${timestamp}.${extension}`;
        const r2Key = `photos/${filename}`;

        // Upload to R2
        await context.env.PHOTOS.put(r2Key, file.stream(), {
            httpMetadata: {
                contentType: file.type
            }
        });

        // Save media metadata to database
        const result = await context.env.DB.prepare(
            'INSERT INTO photos (date, filename, r2_key, caption, media_type) VALUES (?, ?, ?, ?, ?)'
        ).bind(date, filename, r2Key, caption || null, mediaType).run();
        await setPhotoTags(context.env.DB, result.meta.last_row_id, chickenIds);

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }
}

export async function onRequestGet(context) {
    try {
        // Get recent photos and videos, optionally only those tagged with one chicken
        // (?chicken=ID) or not yet tagged at all (?untagged=1)
        const url = new URL(context.request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
        const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
        const chickenId = Number(url.searchParams.get('chicken')) || null;
        const untagged = url.searchParams.get('untagged') === '1';
        const where = chickenId
            ? 'WHERE id IN (SELECT photo_id FROM photo_chickens WHERE chicken_id = ?)'
            : untagged
                ? 'WHERE id NOT IN (SELECT photo_id FROM photo_chickens)'
                : '';
        const { results: rows } = await context.env.DB.prepare(`
            SELECT id, date, filename, caption, media_type, created_at
            FROM photos
            ${where}
            ORDER BY date DESC, created_at DESC
            LIMIT ? OFFSET ?
        `).bind(...(chickenId ? [chickenId] : []), limit, offset).all();
        const results = await attachPhotoTags(context.env.DB, rows);

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }
}
