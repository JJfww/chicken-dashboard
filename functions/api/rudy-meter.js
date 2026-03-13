import { requireSession } from './_auth.js';

const RUDY_PREFIX = 'RUDY_METER::';

const rudyMeterLevels = [
    { score: 0, label: 'Gentleman', description: 'Surprisingly civilized today.' },
    { score: 1, label: 'Annoying', description: 'Mild nonsense, but still manageable.' },
    { score: 2, label: 'Pushy', description: 'Crowding you and testing boundaries.' },
    { score: 3, label: 'Asshole', description: 'Fully committed to being difficult.' },
    { score: 4, label: 'Spur of the Moment', description: 'Considering an ankle-based decision.' },
    { score: 5, label: 'Full Rooster Assault', description: 'Talons, rage, and no respect.' }
];

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
            'Access-Control-Allow-Credentials': 'true'
        }
    });
}

function parseRudyEntry(row) {
    if (!row?.content?.startsWith(RUDY_PREFIX)) return null;

    try {
        const payload = JSON.parse(row.content.slice(RUDY_PREFIX.length));
        const score = Number(payload.score);
        const level = rudyMeterLevels.find(item => item.score === score);
        if (!level) return null;

        return {
            id: row.id,
            date: row.date,
            score,
            label: level.label,
            description: level.description,
            notes: payload.notes || null,
            created_at: row.created_at
        };
    } catch {
        return null;
    }
}

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

export async function onRequestGet(context) {
    try {
        const url = new URL(context.request.url);
        const date = url.searchParams.get('date');

        if (date) {
            const row = await context.env.DB.prepare(`
                SELECT id, date, content, created_at
                FROM notes
                WHERE date = ? AND content LIKE ?
                ORDER BY created_at DESC
                LIMIT 1
            `).bind(date, `${RUDY_PREFIX}%`).first();

            return jsonResponse({ entry: parseRudyEntry(row) });
        }

        const { results } = await context.env.DB.prepare(`
            SELECT id, date, content, created_at
            FROM notes
            WHERE content LIKE ?
            ORDER BY date DESC, created_at DESC
            LIMIT 30
        `).bind(`${RUDY_PREFIX}%`).all();

        return jsonResponse({ entries: results.map(parseRudyEntry).filter(Boolean) });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}

export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const { date, score, notes } = await context.request.json();
        const numericScore = Number(score);
        const level = rudyMeterLevels.find(item => item.score === numericScore);

        if (!date || !level) {
            return jsonResponse({ error: 'Invalid Rudy meter payload' }, 400);
        }

        const content = `${RUDY_PREFIX}${JSON.stringify({
            score: numericScore,
            notes: notes || null
        })}`;

        await context.env.DB.prepare(`
            DELETE FROM notes
            WHERE date = ? AND content LIKE ?
        `).bind(date, `${RUDY_PREFIX}%`).run();

        const result = await context.env.DB.prepare(`
            INSERT INTO notes (date, content)
            VALUES (?, ?)
        `).bind(date, content).run();

        return jsonResponse({
            success: true,
            id: result.meta.last_row_id,
            entry: {
                date,
                score: numericScore,
                label: level.label,
                description: level.description,
                notes: notes || null
            }
        });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
