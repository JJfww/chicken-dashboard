import { requireSession } from './_auth.js';
import { jsonResponse } from './_flock.js';

export const OUTFLOW_KINDS = {
    eaten: 'Eaten',
    given: 'Given away',
    dogs: 'Lost to the dogs',
    stock: 'Stock count (eggs on hand)'
};

// GET /api/egg-outflows -> recent entries
export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare(
            'SELECT * FROM egg_outflows ORDER BY date DESC, id DESC LIMIT 30'
        ).all();
        return jsonResponse(results.map(row => ({ ...row, kind_label: OUTFLOW_KINDS[row.kind] || row.kind })));
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

// POST /api/egg-outflows { date, kind, count, notes? } adds an entry; { id, delete: true } removes one
export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;
    try {
        const body = await context.request.json();
        const db = context.env.DB;
        if (body.id && body.delete) {
            await db.prepare('DELETE FROM egg_outflows WHERE id = ?').bind(body.id).run();
            return jsonResponse({ success: true });
        }
        const count = Math.round(Number(body.count));
        if (!body.date || !(body.kind in OUTFLOW_KINDS) || !Number.isFinite(count) || count < 0 || (count === 0 && body.kind !== 'stock')) {
            return jsonResponse({ error: 'A date, where they went, and a count are required' }, 400);
        }
        const result = await db.prepare('INSERT INTO egg_outflows (date, kind, count, notes) VALUES (?, ?, ?, ?)')
            .bind(body.date, body.kind, count, String(body.notes || '').trim() || null).run();
        return jsonResponse({ success: true, id: result.meta.last_row_id });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
