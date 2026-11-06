import { requireSession } from './_auth.js';
import { getTodayCST, jsonResponse } from './_flock.js';

export const BLOTTER_OUTCOMES = ['Fled the scene', 'Still at large', 'Apprehended', 'Warning issued', 'Case closed'];

// GET /api/blotter[?limit=N] -> { entries, report } where report is this year's Palace Security Report
export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const limit = Math.min(Number(new URL(context.request.url).searchParams.get('limit')) || 50, 200);
        const yearStart = `${getTodayCST().slice(0, 4)}-01-01`;
        const [entries, report, residents] = await Promise.all([
            db.prepare('SELECT * FROM blotter ORDER BY date DESC, time DESC, id DESC LIMIT ?').bind(limit).all(),
            db.prepare(`
                SELECT COUNT(*) AS incidents,
                    COALESCE(SUM(outcome = 'Apprehended'), 0) AS arrests,
                    COALESCE(SUM(outcome = 'Still at large'), 0) AS at_large
                FROM blotter WHERE date >= ?
            `).bind(yearStart).first(),
            db.prepare("SELECT COUNT(*) AS count FROM chickens WHERE status = 'active'").first()
        ]);
        return jsonResponse({
            entries: entries.results,
            report: { year: yearStart.slice(0, 4), ...report, unconcerned_residents: residents.count },
            outcomes: BLOTTER_OUTCOMES
        });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

// POST /api/blotter { date, time?, suspect?, description, outcome? } adds an entry; { id, delete: true } removes one
export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;
    try {
        const body = await context.request.json();
        const db = context.env.DB;
        if (body.id && body.delete) {
            await db.prepare('DELETE FROM blotter WHERE id = ?').bind(body.id).run();
            return jsonResponse({ success: true });
        }
        const description = String(body.description || '').trim();
        if (!body.date || !description) return jsonResponse({ error: 'Date and what happened are required' }, 400);
        const clean = value => (String(value || '').trim() || null);
        const result = await db.prepare(`
            INSERT INTO blotter (date, time, suspect, description, outcome) VALUES (?, ?, ?, ?, ?)
        `).bind(body.date, clean(body.time), clean(body.suspect), description, BLOTTER_OUTCOMES.includes(body.outcome) ? body.outcome : null).run();
        return jsonResponse({ success: true, id: result.meta.last_row_id });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
