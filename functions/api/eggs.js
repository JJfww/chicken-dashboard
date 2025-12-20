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

export async function onRequestPost(context) {
    console.log('[EGGS POST] Request received');

    try {
        const requestBody = await context.request.json();
        console.log('[EGGS POST] Request body:', JSON.stringify(requestBody));

        const { chicken_id, date, notes, time } = requestBody;

        // Validate required fields
        if (!chicken_id || !date) {
            console.log('[EGGS POST] Validation failed - missing required fields');
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                    'Access-Control-Allow-Credentials': 'true'
                }
            });
        }

        console.log('[EGGS POST] Inserting into database - chicken_id:', chicken_id, 'date:', date, 'time:', time);

        // Insert egg record
        const result = await context.env.DB.prepare(
            'INSERT INTO eggs (chicken_id, date, notes, time) VALUES (?, ?, ?, ?)'
        ).bind(chicken_id, date, notes, time || null).run();

        console.log('[EGGS POST] Insert successful - row_id:', result.meta.last_row_id);

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    } catch (error) {
        console.error('[EGGS POST] Error occurred:', error.message);
        console.error('[EGGS POST] Error stack:', error.stack);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }
}

export async function onRequestGet(context) {
    try {
        // Get recent eggs with chicken names
        const { results } = await context.env.DB.prepare(`
            SELECT
                e.id,
                e.date,
                e.time,
                e.count,
                e.notes,
                c.name as chicken_name,
                c.egg_color
            FROM eggs e
            JOIN chickens c ON e.chicken_id = c.id
            ORDER BY e.date DESC, e.time DESC, e.created_at DESC
            LIMIT 50
        `).all();

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }
}
