export async function onRequestPost(context) {
    try {
        const { date, feed_type, description, notes } = await context.request.json();

        // Validate required fields
        if (!date || !feed_type || !description) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Insert feeding record
        const result = await context.env.DB.prepare(
            'INSERT INTO feeding (date, feed_type, description, notes) VALUES (?, ?, ?, ?)'
        ).bind(date, feed_type, description, notes).run();

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
        // Get recent feeding records
        const { results } = await context.env.DB.prepare(`
            SELECT id, date, feed_type, description, notes, created_at
            FROM feeding
            ORDER BY date DESC, created_at DESC
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
