export async function onRequestGet(context) {
    try {
        const chickens = [];

        // Get all chickens from database
        const { results: chickenList } = await context.env.DB.prepare(`
            SELECT id, name, egg_color
            FROM chickens
            ORDER BY id
        `).all();

        // Get today's date in ISO format
        const today = new Date().toISOString().split('T')[0];

        for (const chicken of chickenList) {
            const status = {
                id: chicken.id,
                name: chicken.name,
                egg_color: chicken.egg_color
            };

            // Skip egg tracking for Rudy (id 4)
            if (chicken.id === 4) {
                // Rudy gets a random funny status
                const rudyStatuses = [
                    { emoji: '😎', text: 'Feeling Randy' },
                    { emoji: '😌', text: "He's Chill" },
                    { emoji: '🪞', text: 'Basking in the Mirror' },
                    { emoji: '🎺', text: 'Cock-a-doodle-doing' },
                    { emoji: '💪', text: 'Flexing for the Ladies' },
                    { emoji: '🕺', text: 'Strutting His Stuff' },
                    { emoji: '👑', text: 'King of the Coop' },
                    { emoji: '🎩', text: 'Looking Dapper' }
                ];

                // Use a pseudo-random selection based on the date
                const dateNum = new Date().getDate();
                const randomStatus = rudyStatuses[dateNum % rudyStatuses.length];

                status.rudy_status = randomStatus;
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

            // Check for recent health observations (within last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

            const { results: healthConcerns } = await context.env.DB.prepare(`
                SELECT observation_type, description, date
                FROM health_observations
                WHERE chicken_id = ? AND date >= ?
                ORDER BY date DESC
                LIMIT 1
            `).bind(chicken.id, sevenDaysAgoStr).all();

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
