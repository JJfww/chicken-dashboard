import { jsonResponse, shiftDate } from '../_flock.js';
import { generateDispatch } from './generate.js';

// POST /api/blog/scheduled?date=YYYY-MM-DD, called by the scheduled-updates workflow with the
// WEATHER_LOG_TOKEN bearer token. Publishes the automatic editions:
//   Wednesday: the midweek edition (Monday-Wednesday)
//   Sunday: the Sunday edition (Thursday-Sunday, plus a Week in Review of Monday-Sunday)
// Skips a date that already has a post, so reruns never double-post.
const EDITIONS = {
    3: date => shiftDate(date, -2),
    0: date => shiftDate(date, -3)
};

export async function onRequestPost(context) {
    const { request, env } = context;
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/, '').trim();
    if (!env.WEATHER_LOG_TOKEN || token !== env.WEATHER_LOG_TOKEN) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const date = new URL(request.url).searchParams.get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
        return jsonResponse({ error: 'date=YYYY-MM-DD is required' }, 400);
    }
    const editionFrom = EDITIONS[new Date(`${date}T12:00:00Z`).getUTCDay()];
    if (!editionFrom) {
        return jsonResponse({ error: 'Automatic editions run on Wednesdays and Sundays only' }, 400);
    }

    try {
        const existing = await env.DB.prepare('SELECT id FROM blog_posts WHERE date = ? LIMIT 1').bind(date).first();
        if (existing) return jsonResponse({ status: 'skipped', reason: 'A post already exists for this date', id: existing.id });

        const dispatch = await generateDispatch(env, date, { from: editionFrom(date) });
        if (!dispatch) return jsonResponse({ status: 'no_activity', date });

        const result = await env.DB.prepare(
            'INSERT INTO blog_posts (date, title, content, is_auto_generated) VALUES (?, ?, ?, 1)'
        ).bind(date, dispatch.title, dispatch.content).run();
        return jsonResponse({ status: 'published', id: result.meta.last_row_id, date, title: dispatch.title });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
