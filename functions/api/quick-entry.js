import { requireSession } from './_auth.js';

const HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
    'Access-Control-Allow-Credentials': 'true'
};

const OBSERVATION_TYPES = ['molting', 'sneezing', 'behavior', 'injury', 'other'];

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value) {
    return value === null || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}

function normalizeAction(action, chickens) {
    if (!action || typeof action !== 'object' || !validDate(action.date)) return null;

    if (action.type === 'egg') {
        const chickenIds = Array.isArray(action.chicken_ids)
            ? [...new Set(action.chicken_ids.map(Number))]
            : [];
        if (!chickenIds.length || chickenIds.some(id => !chickens.some(chicken => Number(chicken.id) === id))) return null;
        if (chickenIds.some(id => {
            const chicken = chickens.find(item => Number(item.id) === id);
            return ['vinnie', 'gomez', 'rudy'].includes(String(chicken?.name || '').toLowerCase())
                || ['n/a', 'pending'].includes(String(chicken?.egg_color || '').toLowerCase());
        })) return null;
        if (!validTime(action.time ?? null)) return null;
        return {
            type: 'egg',
            date: action.date,
            chicken_ids: chickenIds,
            chicken_names: chickenIds.map(id => chickens.find(chicken => Number(chicken.id) === id)?.name || `Chicken ${id}`),
            time: action.time || null,
            notes: typeof action.notes === 'string' ? action.notes.slice(0, 500) : null
        };
    }

    if (action.type === 'feeding') {
        if (!['treat', 'scrap'].includes(action.feed_type) || typeof action.description !== 'string' || !action.description.trim()) return null;
        if (!validTime(action.time ?? null)) return null;
        return {
            type: 'feeding',
            date: action.date,
            feed_type: action.feed_type,
            description: action.description.trim().slice(0, 300),
            notes: typeof action.notes === 'string' ? action.notes.slice(0, 500) : null,
            time: action.time || null
        };
    }

    if (action.type === 'free_range') {
        if (!validTime(action.time_start) || !validTime(action.time_end) || !action.time_start || !action.time_end || action.time_end <= action.time_start) return null;
        return {
            type: 'free_range',
            date: action.date,
            time_start: action.time_start,
            time_end: action.time_end,
            notes: typeof action.notes === 'string' ? action.notes.slice(0, 500) : null
        };
    }

    if (action.type === 'health') {
        const chickenId = action.chicken_id === null || action.chicken_id === undefined ? null : Number(action.chicken_id);
        if (chickenId !== null && !chickens.some(chicken => Number(chicken.id) === chickenId)) return null;
        if (!OBSERVATION_TYPES.includes(action.observation_type) || typeof action.description !== 'string' || !action.description.trim()) return null;
        if (!validTime(action.time ?? null)) return null;
        return {
            type: 'health',
            date: action.date,
            chicken_id: chickenId,
            chicken_name: chickenId === null ? null : chickens.find(chicken => Number(chicken.id) === chickenId)?.name || null,
            observation_type: action.observation_type,
            description: action.description.trim().slice(0, 1000),
            notes: typeof action.notes === 'string' ? action.notes.slice(0, 500) : null,
            time: action.time || null
        };
    }

    if (action.type === 'note' && typeof action.content === 'string' && action.content.trim()) {
        return { type: 'note', date: action.date, content: action.content.trim().slice(0, 2000) };
    }

    return null;
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            ...HEADERS,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}

export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const { message, today } = await context.request.json();
        if (typeof message !== 'string' || !message.trim() || message.length > 1000 || !validDate(today)) {
            return jsonResponse({ error: 'Enter an update of 1,000 characters or fewer.' }, 400);
        }

        const { results: chickens } = await context.env.DB.prepare(
            "SELECT id, COALESCE(display_name, name) AS name, egg_color, COALESCE(status, 'active') AS status FROM chickens ORDER BY id"
        ).all();

        const currentChickens = chickens.filter(chicken => chicken.status === 'active');
        const chickenContext = currentChickens.map(chicken => `${chicken.id}: ${chicken.name} (${chicken.egg_color})`).join('\n');
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${context.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://chicken-dashboard.pages.dev',
                'X-Title': 'Chicken Dashboard Quick Entry'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                response_format: { type: 'json_object' },
                temperature: 0,
                messages: [
                    {
                        role: 'system',
                        content: `Convert the user's flock update into exactly one JSON object. Today's local date is ${today}. Available chickens (use their numeric IDs):\n${chickenContext}\n\nSupported types and fields:\n- egg: {"type":"egg","date":"YYYY-MM-DD","chicken_ids":[number],"time":"HH:MM" or null,"notes":string or null}. Only select named hens explicitly stated to have laid; if the chicken is unclear, ask.\n- feeding: {"type":"feeding","date":"YYYY-MM-DD","feed_type":"treat" or "scrap","description":string,"time":"HH:MM" or null,"notes":string or null}. If treat vs kitchen scraps is unclear, ask.\n- free_range: {"type":"free_range","date":"YYYY-MM-DD","time_start":"HH:MM","time_end":"HH:MM","notes":string or null}. Require both start and end times; otherwise ask for the missing time.\n- health: {"type":"health","date":"YYYY-MM-DD","chicken_id":number or null,"observation_type":"molting"|"sneezing"|"behavior"|"injury"|"other","description":string,"time":"HH:MM" or null,"notes":string or null}.\n- note: {"type":"note","date":"YYYY-MM-DD","content":string}. Use for a general flock note that is not one of the types above.\nIf the date is omitted, use today. If time is omitted, use null. Do not invent details. If required information is missing, output {"ready":false,"clarification":"one concise question"}. Otherwise output {"ready":true,"action":{...}}. Return valid JSON only. Do not create multiple actions.`
                    },
                    { role: 'user', content: message.trim() }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI service error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content);
        if (parsed.ready === false) {
            return jsonResponse({ ready: false, clarification: String(parsed.clarification || 'Could you add a little more detail?').slice(0, 300) });
        }

        const action = normalizeAction(parsed.action, currentChickens);
        if (!action) {
            return jsonResponse({ ready: false, clarification: 'I could not confidently identify all the details. Please rephrase the update with the chicken or activity and any needed times.' });
        }

        return jsonResponse({ ready: true, action });
    } catch (error) {
        console.error('Quick entry parsing error:', error.message);
        return jsonResponse({ error: 'I could not prepare that entry. Please try again.' }, 500);
    }
}
