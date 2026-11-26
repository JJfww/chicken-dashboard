import { jsonResponse, shiftDate } from '../_flock.js';
import { generateDispatch, editionStart } from './generate.js';

// POST /api/blog/scheduled?date=YYYY-MM-DD, called at 9:30 PM Central by the chicken-scheduler
// Worker (scheduler/) with the SCHEDULER_TOKEN bearer token, or by hand through the
// scheduled-updates workflow with WEATHER_LOG_TOKEN. Publishes the automatic editions:
//   Wednesday: the midweek edition (Monday-Wednesday)
//   Sunday: the Sunday edition (Thursday-Sunday, plus a Week in Review of Monday-Sunday)
// Skips a date that already has a post, so reruns never double-post.
export async function onRequestPost(context) {
    const { request, env } = context;
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/, '').trim();
    const accepted = [env.SCHEDULER_TOKEN, env.WEATHER_LOG_TOKEN].filter(Boolean);
    if (!token || !accepted.includes(token)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const date = new URL(request.url).searchParams.get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
        return jsonResponse({ error: 'date=YYYY-MM-DD is required' }, 400);
    }
    const from = editionStart(date);
    if (!from) {
        return jsonResponse({ error: 'Automatic editions run on Wednesdays and Sundays only' }, 400);
    }

    try {
        const existing = await env.DB.prepare('SELECT id FROM blog_posts WHERE date = ? LIMIT 1').bind(date).first();
        if (existing) return jsonResponse({ status: 'skipped', reason: 'A post already exists for this date', id: existing.id });

        const dispatch = await generateDispatch(env, date, { from });
        if (!dispatch) return jsonResponse({ status: 'no_activity', date });

        const result = await env.DB.prepare(
            'INSERT INTO blog_posts (date, title, content, is_auto_generated) VALUES (?, ?, ?, 1)'
        ).bind(date, dispatch.title, dispatch.content).run();
        return jsonResponse({ status: 'published', id: result.meta.last_row_id, date, title: dispatch.title });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
