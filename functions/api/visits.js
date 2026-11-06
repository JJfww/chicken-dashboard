import { isAuthenticated } from './_auth.js';
import { getTodayCST, jsonResponse } from './_flock.js';

async function totals(db) {
    const today = getTodayCST();
    return db.prepare(`
        SELECT COALESCE(SUM(visits), 0) AS total,
            COALESCE(SUM(CASE WHEN date = ? THEN visits END), 0) AS today,
            MIN(date) AS since
        FROM page_visits
    `).bind(today).first();
}

// GET /api/visits -> { total, today, since }
export async function onRequestGet(context) {
    try {
        return jsonResponse(await totals(context.env.DB));
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

// POST /api/visits counts one visit for today. The page sends it at most once per browser per day
// and never from a browser the site owner has marked; logged-in admin sessions are skipped here too.
export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        if (!(await isAuthenticated(context.request, context.env))) {
            await db.prepare(`
                INSERT INTO page_visits (date, visits) VALUES (?, 1)
                ON CONFLICT(date) DO UPDATE SET visits = visits + 1
            `).bind(getTodayCST()).run();
        }
        return jsonResponse(await totals(db));
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
