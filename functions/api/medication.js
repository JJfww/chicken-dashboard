export async function onRequestPost(context) {
    try {
        const { date, medication_name, chicken_id, quantity, cost, purpose, notes } = await context.request.json();

        // Validate required fields
        if (!date || !medication_name || cost === undefined) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Insert medication record
        const result = await context.env.DB.prepare(
            'INSERT INTO medication (date, medication_name, chicken_id, quantity, cost, purpose, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(date, medication_name, chicken_id || null, quantity || null, cost, purpose || null, notes || null).run();

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
        // Get recent medication records with chicken names
        const { results } = await context.env.DB.prepare(`
            SELECT
                m.id,
                m.date,
                m.medication_name,
                m.chicken_id,
                c.name as chicken_name,
                m.quantity,
                m.cost,
                m.purpose,
                m.notes,
                m.created_at
            FROM medication m
            LEFT JOIN chickens c ON m.chicken_id = c.id
            ORDER BY m.date DESC, m.created_at DESC
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
