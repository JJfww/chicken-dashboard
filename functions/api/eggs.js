export async function onRequestPost(context) {
    console.log('[EGGS POST] Request received');

    try {
        const requestBody = await context.request.json();
        console.log('[EGGS POST] Request body:', JSON.stringify(requestBody));

        const { chicken_id, date, notes } = requestBody;

        // Validate required fields
        if (!chicken_id || !date) {
            console.log('[EGGS POST] Validation failed - missing required fields');
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('[EGGS POST] Inserting into database - chicken_id:', chicken_id, 'date:', date);

        // Insert egg record
        const result = await context.env.DB.prepare(
            'INSERT INTO eggs (chicken_id, date, notes) VALUES (?, ?, ?)'
        ).bind(chicken_id, date, notes).run();

        console.log('[EGGS POST] Insert successful - row_id:', result.meta.last_row_id);

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[EGGS POST] Error occurred:', error.message);
        console.error('[EGGS POST] Error stack:', error.stack);
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
