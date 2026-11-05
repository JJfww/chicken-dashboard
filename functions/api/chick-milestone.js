import { requireSession } from './_auth.js';
import { getMeterEntries, saveMeterEntry } from './_meters.js';

// Kept for older clients; entries now live in meter_entries (see /api/meters).
const METER_KEY = 'chicks';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestGet(context) {
    try {
        const date = new URL(context.request.url).searchParams.get('date');
        const entries = await getMeterEntries(context.env.DB, METER_KEY, { date });
        return jsonResponse(date ? { entry: entries[0] || null } : { entries });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const { date, score, notes } = await context.request.json();
        const entry = await saveMeterEntry(context.env.DB, METER_KEY, { date, score, notes });
        if (!entry) {
            return jsonResponse({ error: 'Invalid meter entry' }, 400);
        }
        return jsonResponse({ success: true, id: entry.id, entry });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
