export async function onRequestGet(context) {
    try {
        const activities = [];
        const rudyPrefix = 'RUDY_METER::';
        const chickMilestonePrefix = 'CHICK_MILESTONE::';

        // Get recent eggs
        const eggs = await context.env.DB.prepare(`
            SELECT e.date, c.name as chicken_name, c.egg_color, e.notes
            FROM eggs e
            JOIN chickens c ON e.chicken_id = c.id
            ORDER BY e.date DESC, e.created_at DESC
            LIMIT 10
        `).all();

        eggs.results.forEach(egg => {
            activities.push({
                type: '🥚 Egg Laid',
                details: `${egg.chicken_name} laid an egg${egg.notes ? `: ${egg.notes}` : ''}`,
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
            // Format duration as H:MM
            const hours = Math.floor(fr.duration_minutes / 60);
            const mins = fr.duration_minutes % 60;
            const durationFormatted = `${hours}:${mins.toString().padStart(2, '0')}`;
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

        // Get recent notes
        const notes = await context.env.DB.prepare(`
            SELECT date, content
            FROM notes
            ORDER BY date DESC, created_at DESC
            LIMIT 10
        `).all();

        notes.results.forEach(note => {
            if (note.content.startsWith(rudyPrefix)) {
                try {
                    const payload = JSON.parse(note.content.slice(rudyPrefix.length));
                    const score = Number(payload.score);
                    const labels = {
                        0: 'True Gentleman',
                        1: 'Annoying',
                        2: 'Pushy',
                        3: 'Asshole',
                        4: 'Spur of the Moment',
                        5: 'Full Rooster Assault'
                    };
                    const taglines = {
                        0: 'Low menace and surprisingly civilized today.',
                        1: 'Mild nonsense, but still manageable.',
                        2: 'Crowding you and testing boundaries.',
                        3: 'Fully committed to being difficult.',
                        4: 'Considering an ankle-based decision.',
                        5: 'Talons, rage, and no respect.'
                    };

                    if (labels[score]) {
                        activities.push({
                            type: '🐓 Rudy Meter',
                            details: `${score}/5 - ${labels[score]}: ${taglines[score]}${payload.notes ? ` Notes: ${payload.notes}` : ''}`,
                            date: note.date
                        });
                        return;
                    }
                } catch {
                    // Fall through and treat malformed entries as normal notes.
                }
            }

            if (note.content.startsWith(chickMilestonePrefix)) {
                try {
                    const payload = JSON.parse(note.content.slice(chickMilestonePrefix.length));
                    const score = Number(payload.score);
                    const labels = {
                        0: 'Hatchling Bubble',
                        1: 'Following Mama',
                        2: 'Backyard Peeking',
                        3: 'Short Solo Missions',
                        4: 'Confident Explorers',
                        5: 'Little Coop Citizens'
                    };
                    const taglines = {
                        0: 'Freshly hatched and mostly tucked in close.',
                        1: 'Shadowing mom closely and learning the basics.',
                        2: 'Starting to notice the wider world in short bursts.',
                        3: 'Taking quick little detours before circling back.',
                        4: 'Covering more ground and acting noticeably bolder.',
                        5: 'Fully engaged in flock life with plenty of independence.'
                    };

                    if (labels[score]) {
                        activities.push({
                            type: '🐥 Chick Milestone',
                            details: `${score}/5 - ${labels[score]}: ${taglines[score]}${payload.notes ? ` Notes: ${payload.notes}` : ''}`,
                            date: note.date
                        });
                        return;
                    }
                } catch {
                    // Fall through and treat malformed chick entries as normal notes.
                }
            }

            activities.push({
                type: '📝 Note',
                details: note.content,
                date: note.date
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
