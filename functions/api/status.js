import { getTodayCST, isLayer, jsonResponse, loadChickens, shiftDate } from './_flock.js';

// Molts run for weeks, so they stay on a hen's card longer than other observations.
const HEALTH_WINDOW_DAYS = { molting: 21, default: 7 };

export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const today = getTodayCST();
        const [active, former] = await Promise.all([
            loadChickens(db, { status: 'active' }),
            loadChickens(db, { status: 'former' })
        ]);

        const [eggStats, healthRows, trackingStart] = await Promise.all([
            db.prepare(`
                SELECT chicken_id,
                    MAX(date) AS last_egg_date,
                    MIN(date) AS first_egg_date,
                    SUM(CASE WHEN date = ? THEN 1 ELSE 0 END) AS today_count
                FROM eggs
                GROUP BY chicken_id
            `).bind(today).all(),
            db.prepare(`
                SELECT chicken_id, observation_type, description, date
                FROM health_observations
                WHERE chicken_id IS NOT NULL AND date >= ?
                ORDER BY date DESC, id DESC
            `).bind(shiftDate(today, -HEALTH_WINDOW_DAYS.molting)).all(),
            db.prepare('SELECT MIN(date) AS first_date FROM eggs').first()
        ]);

        const statsByChicken = new Map(eggStats.results.map(row => [row.chicken_id, row]));
        // A hen's "first egg" is only meaningful if she started laying after tracking began.
        const firstEggCutoff = trackingStart?.first_date ? shiftDate(trackingStart.first_date, 30) : today;

        const firstEggIds = active
            .filter(chicken => (statsByChicken.get(chicken.id)?.first_egg_date || '') > firstEggCutoff)
            .map(chicken => chicken.id);
        const firstEggNotes = new Map();
        for (const chickenId of firstEggIds) {
            const row = await db.prepare(`
                SELECT notes FROM eggs WHERE chicken_id = ? ORDER BY date, id LIMIT 1
            `).bind(chickenId).first();
            firstEggNotes.set(chickenId, row?.notes || null);
        }

        const activeFlock = active.map(chicken => {
            const stats = statsByChicken.get(chicken.id);
            const layer = isLayer(chicken);
            const healthConcern = healthRows.results.find(row => {
                const windowDays = HEALTH_WINDOW_DAYS[row.observation_type] || HEALTH_WINDOW_DAYS.default;
                return row.chicken_id === chicken.id && row.date >= shiftDate(today, -windowDays);
            });
            const status = {
                ...chicken,
                is_placeholder: false,
                is_pullet: !chicken.is_rooster && !layer,
                profile_detail: chicken.bio,
                laid_today: Boolean(stats?.today_count),
                last_egg_date: stats?.last_egg_date || null,
                health_concern: healthConcern
                    ? { observation_type: healthConcern.observation_type, description: healthConcern.description, date: healthConcern.date }
                    : null
            };

            if (chicken.is_rooster) {
                status.rooster_update = chicken.tagline;
            }

            if (firstEggNotes.has(chicken.id)) {
                const notes = firstEggNotes.get(chicken.id);
                status.first_egg_date = stats.first_egg_date;
                status.first_egg_notes = notes;
                status.first_egg_presumed = /^presumed\b/i.test(notes || '');
            }

            return status;
        });

        const formerFlock = former.map(chicken => ({
            ...chicken,
            caption: chicken.departure_note,
            eyebrow: chicken.tagline || 'Former flock member'
        }));

        return jsonResponse({ today, activeFlock, formerFlock });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
