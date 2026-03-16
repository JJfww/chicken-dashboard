export async function onRequestGet(context) {
    try {
        const chickens = [];
        const rudyPrefix = 'RUDY_METER::';
        const rudyLabels = {
            0: 'Gentleman',
            1: 'Annoying',
            2: 'Pushy',
            3: 'Asshole',
            4: 'Spur of the Moment',
            5: 'Full Rooster Assault'
        };
        const rudyEmoji = {
            0: '🎩',
            1: '🙂',
            2: '🛡️',
            3: '🍹',
            4: '😤',
            5: '💥'
        };

        // Get all chickens from database
        const { results: chickenList } = await context.env.DB.prepare(`
            SELECT id, name, egg_color
            FROM chickens
            ORDER BY id
        `).all();

        // Get today's date in CST timezone
        const now = new Date();
        const cstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        const year = cstDate.getFullYear();
        const month = String(cstDate.getMonth() + 1).padStart(2, '0');
        const day = String(cstDate.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const latestRudyRow = await context.env.DB.prepare(`
            SELECT content, date
            FROM notes
            WHERE content LIKE ?
            ORDER BY date DESC, created_at DESC
            LIMIT 1
        `).bind(`${rudyPrefix}%`).first();

        let latestRudyMeter = null;
        if (latestRudyRow?.content?.startsWith(rudyPrefix)) {
            try {
                const payload = JSON.parse(latestRudyRow.content.slice(rudyPrefix.length));
                const score = Number(payload.score);
                if (Object.prototype.hasOwnProperty.call(rudyLabels, score)) {
                    latestRudyMeter = {
                        score,
                        label: rudyLabels[score],
                        emoji: rudyEmoji[score],
                        notes: payload.notes || null,
                        date: latestRudyRow.date
                    };
                }
            } catch {
                // Ignore malformed Rudy meter data and fall back to the default Rudy status.
            }
        }

        for (const chicken of chickenList) {
            const status = {
                id: chicken.id,
                name: chicken.name,
                egg_color: chicken.egg_color
            };

            // Skip egg tracking for Rudy (id 4)
            if (chicken.id === 4) {
                status.rudy_status = latestRudyMeter || {
                    emoji: '🐓',
                    text: 'No Rudy Meter entry yet'
                };
                status.rudy_meter = latestRudyMeter;
                chickens.push(status);
                continue;
            }

            // Check if this chicken laid an egg today
            const { results: todayEggs } = await context.env.DB.prepare(`
                SELECT COUNT(*) as count
                FROM eggs
                WHERE chicken_id = ? AND date = ?
            `).bind(chicken.id, today).all();

            status.laid_today = todayEggs[0].count > 0;

            // Get the most recent egg date
            const { results: lastEgg } = await context.env.DB.prepare(`
                SELECT date
                FROM eggs
                WHERE chicken_id = ?
                ORDER BY date DESC
                LIMIT 1
            `).bind(chicken.id).all();

            status.last_egg_date = lastEgg.length > 0 ? lastEgg[0].date : null;

            // Check for recent health observations (within last 1 day)
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            const oneDayAgoStr = oneDayAgo.toISOString().split('T')[0];

            const { results: healthConcerns } = await context.env.DB.prepare(`
                SELECT observation_type, description, date
                FROM health_observations
                WHERE chicken_id = ? AND date >= ?
                ORDER BY date DESC
                LIMIT 1
            `).bind(chicken.id, oneDayAgoStr).all();

            status.health_concern = healthConcerns.length > 0 ? healthConcerns[0] : null;

            chickens.push(status);
        }

        return new Response(JSON.stringify(chickens), {
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
