export async function onRequestPost(context) {
    try {
        const { question } = await context.request.json();

        if (!question) {
            return new Response(JSON.stringify({ error: 'No question provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get recent data to provide context to the AI
        const contextData = await gatherContext(context.env.DB);

        // Build the system prompt with context
        const systemPrompt = `You are a helpful assistant for a backyard chicken keeper. You have access to their chicken tracking data and can answer questions about their flock.

The user has 3 chickens:
- Mamma Mia (lays brown-olive eggs)
- Brown Betty (lays green eggs)
- Madame Pompadour (lays eggshell-colored eggs)

Recent data:
${contextData}

Answer questions helpfully and conversationally. When referencing data, be specific (e.g., dates, chicken names). If you don't have enough data to answer accurately, say so.`;

        // Call OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${context.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://chicken-dashboard.pages.dev',
                'X-Title': 'Chicken Dashboard'
            },
            body: JSON.stringify({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: question }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error:', errorText);
            throw new Error('Failed to get AI response');
        }

        const data = await response.json();
        const answer = data.choices[0].message.content;

        return new Response(JSON.stringify({ answer }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Chat error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function gatherContext(db) {
    const context = [];

    // Recent eggs
    const eggs = await db.prepare(`
        SELECT e.date, c.name, e.notes
        FROM eggs e
        JOIN chickens c ON e.chicken_id = c.id
        ORDER BY e.date DESC
        LIMIT 20
    `).all();

    if (eggs.results.length > 0) {
        context.push('Recent eggs:');
        eggs.results.forEach(egg => {
            context.push(`- ${egg.date}: ${egg.name}${egg.notes ? ' (' + egg.notes + ')' : ''}`);
        });
    }

    // Recent feeding
    const feeding = await db.prepare(`
        SELECT date, feed_type, description
        FROM feeding
        ORDER BY date DESC
        LIMIT 10
    `).all();

    if (feeding.results.length > 0) {
        context.push('\nRecent feeding:');
        feeding.results.forEach(feed => {
            context.push(`- ${feed.date}: ${feed.description} (${feed.feed_type})`);
        });
    }

    // Recent free range
    const freeRange = await db.prepare(`
        SELECT date, duration_minutes
        FROM free_range
        ORDER BY date DESC
        LIMIT 10
    `).all();

    if (freeRange.results.length > 0) {
        context.push('\nRecent free range:');
        freeRange.results.forEach(fr => {
            context.push(`- ${fr.date}: ${fr.duration_minutes} minutes`);
        });
    }

    // Recent health observations
    const health = await db.prepare(`
        SELECT h.date, h.observation_type, h.description, c.name
        FROM health_observations h
        LEFT JOIN chickens c ON h.chicken_id = c.id
        ORDER BY h.date DESC
        LIMIT 10
    `).all();

    if (health.results.length > 0) {
        context.push('\nRecent health observations:');
        health.results.forEach(obs => {
            const chicken = obs.name ? obs.name : 'General';
            context.push(`- ${obs.date}: ${chicken} - ${obs.observation_type}: ${obs.description}`);
        });
    }

    return context.join('\n');
}
