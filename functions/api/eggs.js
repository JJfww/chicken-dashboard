export async function onRequestPost(context) {
    try {
        const { chicken_id, date, notes } = await context.request.json();

        // Validate required fields
        if (!chicken_id || !date) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Insert egg record
        const result = await context.env.DB.prepare(
            'INSERT INTO eggs (chicken_id, date, notes) VALUES (?, ?, ?)'
        ).bind(chicken_id, date, notes).run();

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
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
                e.count,
                e.notes,
                c.name as chicken_name,
                c.egg_color
            FROM eggs e
            JOIN chickens c ON e.chicken_id = c.id
            ORDER BY e.date DESC, e.created_at DESC
            LIMIT 50
        `).all();

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
