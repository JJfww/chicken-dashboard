export async function onRequestPost(context) {
    try {
        const { date, chicken_id, observation_type, description, notes, time } = await context.request.json();

        // Validate required fields
        if (!date || !observation_type || !description) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                    'Access-Control-Allow-Credentials': 'true'
                }
            });
        }

        // Insert health observation record
        const result = await context.env.DB.prepare(
            'INSERT INTO health_observations (date, chicken_id, observation_type, description, notes, time) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(date, chicken_id, observation_type, description, notes, time || null).run();

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
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

export async function onRequestGet(context) {
    try {
        // Get recent health observations with chicken names
        const { results } = await context.env.DB.prepare(`
            SELECT
                h.id,
                h.date,
                h.time,
                h.observation_type,
                h.description,
                h.notes,
                h.created_at,
                c.name as chicken_name
            FROM health_observations h
            LEFT JOIN chickens c ON h.chicken_id = c.id
            ORDER BY h.date DESC, h.time DESC, h.created_at DESC
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
