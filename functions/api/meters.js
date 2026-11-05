import { requireSession } from './_auth.js';
import { METERS, getMeterEntries, saveMeterEntry } from './_meters.js';

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

// GET /api/meters                 -> meter definitions
// GET /api/meters?meter=rudy      -> recent entries for one meter (optional &date=YYYY-MM-DD)
export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const meterKey = url.searchParams.get('meter');

        if (!meterKey) {
            return jsonResponse({
                meters: Object.entries(METERS).map(([key, meter]) => ({ key, ...meter }))
            });
        }

        if (!METERS[meterKey]) {
            return jsonResponse({ error: 'Unknown meter' }, 404);
        }

        const entries = await getMeterEntries(context.env.DB, meterKey, {
            date: url.searchParams.get('date')
        });
        return jsonResponse({ meter: meterKey, entries });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const { meter, date, score, notes } = await context.request.json();
        const entry = await saveMeterEntry(context.env.DB, meter, { date, score, notes });
        if (!entry) {
            return jsonResponse({ error: 'Invalid meter entry' }, 400);
        }
        return jsonResponse({ success: true, entry });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
