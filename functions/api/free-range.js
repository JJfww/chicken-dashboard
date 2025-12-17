export async function onRequestPost(context) {
    try {
        const { date, duration_minutes, notes } = await context.request.json();

        // Validate required fields
        if (!date || !duration_minutes) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Insert free range record
        const result = await context.env.DB.prepare(
            'INSERT INTO free_range (date, duration_minutes, notes) VALUES (?, ?, ?)'
        ).bind(date, duration_minutes, notes).run();

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
        // Get recent free range records
        const { results } = await context.env.DB.prepare(`
            SELECT id, date, duration_minutes, notes, created_at
            FROM free_range
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
