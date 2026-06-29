import { requireSession } from './_auth.js';

const CHICK_MILESTONE_PREFIX = 'CHICK_MILESTONE::';

const chickMilestoneLevels = [
    { score: 0, label: 'Hatchling Bubble', description: 'Freshly hatched and mostly tucked in close.' },
    { score: 1, label: 'Following Mama', description: 'Shadowing mom closely and learning the basics.' },
    { score: 2, label: 'Backyard Peeking', description: 'Starting to notice the wider world in short bursts.' },
    { score: 3, label: 'Short Solo Missions', description: 'Taking quick little detours before circling back.' },
    { score: 4, label: 'Confident Explorers', description: 'Covering more ground and acting noticeably bolder.' },
    { score: 5, label: 'Little Coop Citizens', description: 'Fully engaged in flock life with plenty of independence.' }
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

function parseChickMilestoneEntry(row) {
    if (!row?.content?.startsWith(CHICK_MILESTONE_PREFIX)) return null;

    try {
        const payload = JSON.parse(row.content.slice(CHICK_MILESTONE_PREFIX.length));
        const score = Number(payload.score);
        const level = chickMilestoneLevels.find(item => item.score === score);
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
            `).bind(date, `${CHICK_MILESTONE_PREFIX}%`).first();

            return jsonResponse({ entry: parseChickMilestoneEntry(row) });
        }

        const { results } = await context.env.DB.prepare(`
            SELECT id, date, content, created_at
            FROM notes
            WHERE content LIKE ?
            ORDER BY date DESC, created_at DESC
            LIMIT 30
        `).bind(`${CHICK_MILESTONE_PREFIX}%`).all();

        return jsonResponse({ entries: results.map(parseChickMilestoneEntry).filter(Boolean) });
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
        const level = chickMilestoneLevels.find(item => item.score === numericScore);

        if (!date || !level) {
            return jsonResponse({ error: 'Invalid chick milestone payload' }, 400);
        }

        const content = `${CHICK_MILESTONE_PREFIX}${JSON.stringify({
            score: numericScore,
            notes: notes || null
        })}`;

        await context.env.DB.prepare(`
            DELETE FROM notes
            WHERE date = ? AND content LIKE ?
        `).bind(date, `${CHICK_MILESTONE_PREFIX}%`).run();

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
