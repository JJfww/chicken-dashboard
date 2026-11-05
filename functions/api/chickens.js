import { requireSession } from './_auth.js';
import { CHICKEN_PROFILE_FIELDS, jsonResponse, loadChickens } from './_flock.js';

// GET /api/chickens[?status=active|former] -> chicken profiles
export async function onRequestGet(context) {
    try {
        const status = new URL(context.request.url).searchParams.get('status');
        const chickens = await loadChickens(context.env.DB, {
            status: ['active', 'former'].includes(status) ? status : undefined
        });
        return jsonResponse(chickens);
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

// POST /api/chickens { id, ...profileFields } updates a profile.
// POST /api/chickens { name, egg_color, ...profileFields } (no id) adds a chicken.
export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const body = await context.request.json();
        const fields = CHICKEN_PROFILE_FIELDS.filter(field => field in body);
        const values = fields.map(field => {
            const value = body[field];
            if (field === 'is_rooster') return value ? 1 : 0;
            if (field === 'sort_order') return Number.isFinite(Number(value)) ? Number(value) : 100;
            if (field === 'status') return value === 'former' ? 'former' : 'active';
            return typeof value === 'string' && value.trim() === '' ? null : value;
        });

        if (body.id) {
            if (!fields.length) return jsonResponse({ error: 'Nothing to update' }, 400);
            if (fields.includes('egg_color') && !values[fields.indexOf('egg_color')]) {
                return jsonResponse({ error: 'Egg color cannot be blank (use "pending" or "N/A")' }, 400);
            }
            await context.env.DB.prepare(
                `UPDATE chickens SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`
            ).bind(...values, body.id).run();
            return jsonResponse({ success: true, id: body.id });
        }

        const name = String(body.name || '').trim();
        if (!name) return jsonResponse({ error: 'Name is required' }, 400);
        const insertFields = ['name', ...fields.filter(field => field !== 'egg_color'), 'egg_color'];
        const insertValues = [
            name,
            ...values.filter((_, index) => fields[index] !== 'egg_color'),
            String(body.egg_color || 'pending').trim() || 'pending'
        ];
        const result = await context.env.DB.prepare(
            `INSERT INTO chickens (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`
        ).bind(...insertValues).run();
        return jsonResponse({ success: true, id: result.meta.last_row_id });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
