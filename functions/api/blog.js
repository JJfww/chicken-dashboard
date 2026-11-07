import { requireSession } from './_auth.js';

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
        const { id, delete: remove, date, title, content, is_auto_generated } = await context.request.json();

        // { id, delete: true } removes a post (e.g. an automatic edition that missed the mark)
        if (id && remove) {
            await context.env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
            });
        }

        // Validate required fields
        if (!date || !content) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
            });
        }

        // Insert blog post record
        const result = await context.env.DB.prepare(
            'INSERT INTO blog_posts (date, title, content, is_auto_generated) VALUES (?, ?, ?, ?)'
        ).bind(date, title || null, content, is_auto_generated ? 1 : 0).run();

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
        const url = new URL(context.request.url);
        const limit = parseInt(url.searchParams.get('limit')) || 5;
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        // Get blog posts with pagination
        const { results } = await context.env.DB.prepare(`
            SELECT
                id,
                date,
                title,
                content,
                is_auto_generated,
                created_at
            FROM blog_posts
            ORDER BY date DESC, created_at DESC
            LIMIT ? OFFSET ?
        `).bind(limit, offset).all();

        // Get total count for pagination
        const countResult = await context.env.DB.prepare(
            'SELECT COUNT(*) as total FROM blog_posts'
        ).first();
        const total = countResult.total;
        const hasMore = offset + results.length < total;

        return new Response(JSON.stringify({ posts: results, total, hasMore }), {
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
