import { METERS, describeMeterEntry } from './_meters.js';

export async function onRequestGet(context) {
    try {
        const activities = [];
        const rudyPrefix = 'RUDY_METER::';
        const chickMilestonePrefix = 'CHICK_MILESTONE::';

        // Get recent eggs
        const eggs = await context.env.DB.prepare(`
            SELECT e.date, c.name as chicken_name, COALESCE(c.display_name, c.name) as display_name, c.egg_color, e.notes, e.weight_g
            FROM eggs e
            JOIN chickens c ON e.chicken_id = c.id
            ORDER BY e.date DESC, e.created_at DESC
            LIMIT 10
        `).all();

        eggs.results.forEach(egg => {
            activities.push({
                type: '🥚 Egg Laid',
                details: `${egg.display_name} laid an egg${egg.weight_g ? ` (${egg.weight_g} g)` : ''}${egg.notes ? `: ${egg.notes}` : ''}`,
                date: egg.date,
                chicken_name: egg.chicken_name,
                egg_color: egg.egg_color
            });
        });

        // Get recent feeding
        const feeding = await context.env.DB.prepare(`
            SELECT date, feed_type, description
            FROM feeding
            ORDER BY date DESC, created_at DESC
            LIMIT 10
        `).all();

        feeding.results.forEach(feed => {
            const type = feed.feed_type === 'treat' ? '🍪 Treats' : '🥬 Scraps';
            activities.push({
                type: type,
                details: feed.description,
                date: feed.date
            });
        });

        // Get recent free range
        const freeRange = await context.env.DB.prepare(`
            SELECT date, time_start, time_end, duration_minutes, notes
            FROM free_range
            ORDER BY date DESC, time_start DESC, created_at DESC
            LIMIT 10
        `).all();

        freeRange.results.forEach(fr => {
            // Format duration as H:MM; sessions without an end time are still in progress
            const hours = Math.floor(fr.duration_minutes / 60);
            const mins = fr.duration_minutes % 60;
            const durationFormatted = fr.duration_minutes === null
                ? (fr.time_start ? `Out since ${fr.time_start}` : 'In progress')
                : `${hours}:${mins.toString().padStart(2, '0')}`;
            activities.push({
                type: '🌿 Free Range',
                details: `${durationFormatted}${fr.notes ? ` - ${fr.notes}` : ''}`,
                date: fr.date,
                time_start: fr.time_start,
                time_end: fr.time_end
            });
        });

        // Get recent health observations
        const health = await context.env.DB.prepare(`
            SELECT h.date, h.observation_type, h.description, c.name as chicken_name
            FROM health_observations h
            LEFT JOIN chickens c ON h.chicken_id = c.id
            ORDER BY h.date DESC, h.created_at DESC
            LIMIT 10
        `).all();

        health.results.forEach(obs => {
            const chicken = obs.chicken_name ? ` (${obs.chicken_name})` : '';
            activities.push({
                type: '🏥 Health Note',
                details: `${obs.observation_type}${chicken}: ${obs.description}`,
                date: obs.date
            });
        });

        // Get recent photos and videos
        const photos = await context.env.DB.prepare(`
            SELECT id, date, caption, media_type
            FROM photos
            ORDER BY date DESC, created_at DESC
            LIMIT 10
        `).all();

        photos.results.forEach(photo => {
            const isVideo = photo.media_type === 'video';
            activities.push({
                type: isVideo ? '🎬 Video' : '📸 Photo',
                details: photo.caption || (isVideo ? 'New video uploaded' : 'New photo uploaded'),
                date: photo.date,
                photo_id: photo.id,
                media_type: photo.media_type
            });
        });

        // Get recent notes (meter entries used to be stored as prefixed notes; they live in meter_entries now)
        const notes = await context.env.DB.prepare(`
            SELECT date, content, is_headline
            FROM notes
            WHERE content NOT LIKE ? AND content NOT LIKE ?
            ORDER BY date DESC, created_at DESC
            LIMIT 10
        `).bind(`${rudyPrefix}%`, `${chickMilestonePrefix}%`).all();

        notes.results.forEach(note => {
            activities.push({
                type: note.is_headline ? '📰 Headline' : '📝 Note',
                details: note.content,
                date: note.date
            });
        });

        const meterEntries = await context.env.DB.prepare(`
            SELECT id, meter, date, score, notes, created_at
            FROM meter_entries
            ORDER BY date DESC, created_at DESC
            LIMIT 10
        `).all();

        meterEntries.results.forEach(row => {
            const entry = describeMeterEntry(row.meter, row);
            if (!entry) return;
            const meter = METERS[row.meter];
            activities.push({
                type: `${meter.emoji} ${meter.title}`,
                details: `${entry.score}/5 - ${entry.label}: ${entry.description}${entry.notes ? ` Notes: ${entry.notes}` : ''}`,
                date: entry.date
            });
        });

        // Sort all activities by date
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Return top 30 activities
        return new Response(JSON.stringify(activities.slice(0, 30)), {
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
