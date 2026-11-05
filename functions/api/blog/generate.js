import { requireSession } from '../_auth.js';
import { METERS, describeMeterEntry } from '../_meters.js';

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        }
    });
}

export async function onRequestPost(context) {
    // Require authentication
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;

    try {
        const { date } = await context.request.json();

        if (!date) {
            return new Response(JSON.stringify({ error: 'Date is required' }), {
                status: 400,
                headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
            });
        }

        // Gather all activity for the specified date
        const activityData = await gatherDailyActivity(context.env.DB, date);

        if (!activityData.hasActivity) {
            return new Response(JSON.stringify({
                error: 'No activity found for this date',
                suggestion: 'Try selecting a different date with logged activities.'
            }), {
                status: 404,
                headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
            });
        }

        // Check if it's Sunday for weekly recap
        const dateObj = new Date(date + 'T12:00:00');
        const isSunday = dateObj.getDay() === 0;

        // Build the AI prompt for blog generation
        const systemPrompt = `You are Clucky, the royal correspondent for The Clucking Times, filing dispatches from Hensington Palace. Write a vivid, witty daily dispatch about the flock's activities.

CRITICAL RULES:
- ONLY write about activities that are explicitly listed in the data below. Do NOT invent or assume activities that aren't recorded.
- If there's no free range time in the data, do NOT mention free range time.
- In this app, "free range" means time outside the run. Time spent inside the run or inside the coop does NOT count as free range.
- If there's no feeding data, do NOT mention treats or snacks.
- Match your post length to the amount of data: light data days = shorter posts (75-150 words), busy days = longer posts (150-250 words).

Voice and style:
- Write in first person as a reporter narrating the day at Hensington Palace
- Sound lively, specific, and lightly gossipy rather than generic or summary-like
- Use sharp phrasing, distinct observations, and a little attitude when the data supports it
- Favor colorful sentences over bland recap language
- Use chicken puns sparingly - one or two is enough
- Be conversational and entertaining while staying factual to the data
- Include specific details from the activities (chicken names, what they did, etc.)
- If Chick Milestone data is present, treat it as an important factual detail of the day and weave it in naturally
- When mentioning a hen laying an egg, use her specific egg image inline with markdown (the image shows the egg color, so don't mention the color in text):
  - Mamma Mia: ![egg](/images/egg_mamma_mia.png)
  - Brown Betty: ![egg](/images/egg_brown_betty.png)
  - Madame Pompadour: ![egg](/images/egg_madame_pompadour.png)
  - Peppercorn: ![egg](/images/egg_peppercorn.png). Preserve logged size and identification notes when relevant.
  - Example: "Mamma Mia gifted us a lovely ![egg](/images/egg_mamma_mia.png) this morning"
- Use the logged times provided in the data - don't make up times of day
- End with: "Reporting live from Hensington Palace, this is Clucky for The Clucking Times."
- Format as plain text paragraphs (no markdown headers)
- Convert minutes (free range time) to hours when more than 60 minutes
- Do NOT start with "Extra! Extra!" or similar newspaper clichés - jump straight into the story
- Avoid sounding like an AI summary or neutral report; this should read like an actual Clucking Times dispatch

Chick rules:
- Peppercorn is now a confirmed egg layer. Her first confirmed egg was October 13, 2026, small and orangish, identified when Jen found her in the nesting box that morning. Mention this milestone only when it belongs to the requested day's activity data. Salty's laying is not yet confirmed; do not assign uncertain eggs to either hen by color alone.
- Madame Pompadour is the biological mother of Peppercorn, Salty, and Gomez: she laid their eggs. Mamma Mia hatched and raised them and is their mom. Preserve both mothers' roles when discussing the chicks; this family background is not a new activity for the day.
- If Chick Milestone data is present, mention the chicks in a way that reflects that logged score/label/tagline/notes
- NEVER invent chick milestone details when a Chick Milestone entry exists; use the logged details instead
- NEVER make up activities for the hens

Structure guidance:
- Lead with the most vivid or consequential detail from the day rather than a generic scene-setting sentence
- If two major developments are present, give each its own paragraph so the post has shape
- If the day includes a flock change or notable social shift, treat that as real news, not a passing aside

${isSunday ? `SUNDAY SPECIAL - Weekly Recap:
Since it's Sunday, include a brief "Week in Review" section summarizing the week's egg production totals and any notable events from the weekly data provided below.

Weekly summary:
${activityData.weeklySummary || 'No weekly data available'}
` : ''}
Activity data for ${date}:
${activityData.summary}

Write a delightful dispatch about this day!`;

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
                model: 'google/gemini-2.5-flash-lite',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Write the blog post!' }
                ],
                temperature: 0.9, // Higher creativity for fun blog posts
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const blogContent = data?.choices?.[0]?.message?.content?.trim();

        if (!blogContent) {
            throw new Error('OpenRouter returned an empty blog response');
        }

        // Generate a headline from the dispatch topics and date.
        const title = generateTitle(blogContent, date);

        // Include photo/video in content if one was taken that day
        let finalContent = blogContent;
        if (activityData.photoId) {
            if (activityData.photoMediaType === 'video') {
                finalContent = `<video controls playsinline style="max-width:100%;border-radius:8px;margin-bottom:1rem;"><source src="/api/photos/${activityData.photoId}" type="video/mp4"></video>\n\n${blogContent}`;
            } else {
                finalContent = `![Photo from the day](/api/photos/${activityData.photoId})\n\n${blogContent}`;
            }
        }

        return new Response(JSON.stringify({
            title,
            content: finalContent,
            date,
            is_auto_generated: true
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    } catch (error) {
        console.error('Blog generation error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }
}

async function gatherDailyActivity(db, date) {
    const activity = {
        hasActivity: false,
        summary: [],
        weeklySummary: null
    };

    // Check if it's Sunday - if so, gather weekly recap
    const dateObj = new Date(date + 'T12:00:00');
    if (dateObj.getDay() === 0) {
        activity.weeklySummary = await gatherWeeklySummary(db, date);
    }

    // Get eggs for this date (include time and egg color)
    const eggs = await db.prepare(`
        SELECT COALESCE(c.display_name, c.name) AS name, c.egg_color, e.notes, e.time, e.weight_g
        FROM eggs e
        JOIN chickens c ON e.chicken_id = c.id
        WHERE e.date = ?
    `).bind(date).all();

    if (eggs.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('Eggs laid:');
        activity.eggLayers = []; // Track which chickens laid eggs
        eggs.results.forEach(egg => {
            const timeInfo = egg.time ? ` at ${egg.time}` : '';
            activity.summary.push(`- ${egg.name} (${egg.egg_color} egg)${timeInfo}${egg.weight_g ? `, weighed ${egg.weight_g} g` : ''}${egg.notes ? ' - ' + egg.notes : ''}`);
            if (!activity.eggLayers.includes(egg.name)) {
                activity.eggLayers.push(egg.name);
            }
        });
    }

    // Get feeding for this date (include time)
    const feeding = await db.prepare(`
        SELECT feed_type, description, notes, time
        FROM feeding
        WHERE date = ?
    `).bind(date).all();

    if (feeding.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('\nFeeding:');
        feeding.results.forEach(feed => {
            const timeInfo = feed.time ? ` at ${feed.time}` : '';
            activity.summary.push(`- ${feed.description} (${feed.feed_type})${timeInfo}${feed.notes ? ' - ' + feed.notes : ''}`);
        });
    }

    // Get free range for this date
    const freeRange = await db.prepare(`
        SELECT time_start, time_end, duration_minutes, notes
        FROM free_range
        WHERE date = ?
    `).bind(date).all();

    if (freeRange.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('\nFree Range:');
        freeRange.results.forEach(fr => {
            // Format duration as H:MM
            const hours = Math.floor(fr.duration_minutes / 60);
            const mins = fr.duration_minutes % 60;
            const durationFormatted = `${hours}:${mins.toString().padStart(2, '0')}`;
            activity.summary.push(`- ${durationFormatted} (${fr.time_start} to ${fr.time_end})${fr.notes ? ' - ' + fr.notes : ''}`);
        });
    }

    // Get health observations for this date
    const health = await db.prepare(`
        SELECT h.observation_type, h.description, c.name
        FROM health_observations h
        LEFT JOIN chickens c ON h.chicken_id = c.id
        WHERE h.date = ?
    `).bind(date).all();

    if (health.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('\nHealth Observations:');
        health.results.forEach(obs => {
            const chicken = obs.name ? obs.name : 'General';
            activity.summary.push(`- ${chicken}: ${obs.observation_type} - ${obs.description}`);
        });
    }

    // Get photos/videos for this date
    const photos = await db.prepare(`
        SELECT p.id, p.caption, p.media_type,
            (SELECT GROUP_CONCAT(COALESCE(c.display_name, c.name), ', ')
             FROM photo_chickens pc JOIN chickens c ON c.id = pc.chicken_id
             WHERE pc.photo_id = p.id) AS featuring
        FROM photos p
        WHERE p.date = ?
    `).bind(date).all();

    if (photos.results.length > 0) {
        activity.hasActivity = true;
        const photoCount = photos.results.filter(p => p.media_type === 'photo').length;
        const videoCount = photos.results.filter(p => p.media_type === 'video').length;
        const mediaParts = [];
        if (photoCount > 0) mediaParts.push(`${photoCount} photo${photoCount !== 1 ? 's' : ''}`);
        if (videoCount > 0) mediaParts.push(`${videoCount} video${videoCount !== 1 ? 's' : ''}`);
        activity.summary.push(`\nMedia: ${mediaParts.join(' and ')} captured`);
        photos.results.forEach(photo => {
            const typeLabel = photo.media_type === 'video' ? '[video]' : '[photo]';
            const featuring = photo.featuring ? ` (featuring ${photo.featuring})` : '';
            activity.summary.push(`- ${typeLabel}${photo.caption ? ` ${photo.caption}` : ''}${featuring}`);
        });
        // Pick a random photo/video to include in the blog post
        const randomIndex = Math.floor(Math.random() * photos.results.length);
        activity.photoId = photos.results[randomIndex].id;
        activity.photoMediaType = photos.results[randomIndex].media_type;
    }

    // Get meter entries (e.g. chick milestones) for this date
    const meterEntries = await db.prepare(`
        SELECT id, meter, date, score, notes, created_at
        FROM meter_entries
        WHERE date = ?
    `).bind(date).all();

    meterEntries.results.forEach(row => {
        const entry = describeMeterEntry(row.meter, row);
        if (!entry) return;
        activity.hasActivity = true;
        activity.summary.push(`\n${METERS[row.meter].title}:`);
        activity.summary.push(`- ${entry.score}/5 - ${entry.label}`);
        activity.summary.push(`- Tagline: ${entry.description}`);
        if (entry.notes) {
            activity.summary.push(`- Notes: ${entry.notes}`);
        }
    });

    // Get notes for this date (meter entries used to be stored as prefixed notes)
    const notes = await db.prepare(`
        SELECT content
        FROM notes
        WHERE date = ? AND content NOT LIKE 'RUDY_METER::%' AND content NOT LIKE 'CHICK_MILESTONE::%'
    `).bind(date).all();

    if (notes.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('\nNotes:');
        notes.results.forEach(note => {
            activity.summary.push(`- ${note.content}`);
        });
    }

    // Get weather for this date
    const weather = await db.prepare(`
        SELECT temp_high_f, temp_low_f, conditions, precipitation_inches
        FROM weather_logs
        WHERE date = ?
    `).bind(date).all();

    if (weather.results.length > 0) {
        const w = weather.results[0];
        activity.summary.push(`\nWeather: ${w.conditions}, High: ${w.temp_high_f}°F, Low: ${w.temp_low_f}°F${w.precipitation_inches > 0 ? ', Rain: ' + w.precipitation_inches + '"' : ''}`);
    }

    return {
        hasActivity: activity.hasActivity,
        summary: activity.summary.join('\n'),
        photoId: activity.photoId || null,
        photoMediaType: activity.photoMediaType || null,
        weeklySummary: activity.weeklySummary,
        eggLayers: activity.eggLayers || []
    };
}

async function gatherWeeklySummary(db, sundayDate) {
    // Calculate the start of the week (Monday before this Sunday)
    const sunday = new Date(sundayDate + 'T12:00:00');
    const monday = new Date(sunday);
    monday.setDate(sunday.getDate() - 6);

    const startDate = monday.toISOString().split('T')[0];
    const endDate = sundayDate;

    const summary = [];

    // Weekly egg totals by chicken
    const eggs = await db.prepare(`
        SELECT c.name, COUNT(*) as count
        FROM eggs e
        JOIN chickens c ON e.chicken_id = c.id
        WHERE e.date BETWEEN ? AND ?
        GROUP BY c.name
        ORDER BY count DESC
    `).bind(startDate, endDate).all();

    if (eggs.results.length > 0) {
        const totalEggs = eggs.results.reduce((sum, e) => sum + e.count, 0);
        summary.push(`Total eggs this week: ${totalEggs}`);
        eggs.results.forEach(e => {
            summary.push(`- ${e.name}: ${e.count} egg${e.count !== 1 ? 's' : ''}`);
        });
    }

    // Total free range time
    const freeRange = await db.prepare(`
        SELECT SUM(duration_minutes) as total_minutes
        FROM free_range
        WHERE date BETWEEN ? AND ?
    `).bind(startDate, endDate).all();

    if (freeRange.results[0]?.total_minutes) {
        const totalMins = freeRange.results[0].total_minutes;
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const formatted = `${hours}:${mins.toString().padStart(2, '0')}`;
        summary.push(`Total free range time: ${formatted}`);
    }

    // Count of treats/feeding events
    const feeding = await db.prepare(`
        SELECT COUNT(*) as count
        FROM feeding
        WHERE date BETWEEN ? AND ?
    `).bind(startDate, endDate).all();

    if (feeding.results[0]?.count > 0) {
        summary.push(`Treat sessions this week: ${feeding.results[0].count}`);
    }

    // Any health observations
    const health = await db.prepare(`
        SELECT h.observation_type, h.description, c.name, h.date
        FROM health_observations h
        LEFT JOIN chickens c ON h.chicken_id = c.id
        WHERE h.date BETWEEN ? AND ?
    `).bind(startDate, endDate).all();

    if (health.results.length > 0) {
        summary.push(`Health notes: ${health.results.length} observation(s)`);
        health.results.forEach(h => {
            const chicken = h.name || 'General';
            summary.push(`- ${chicken}: ${h.observation_type}`);
        });
    }

    return summary.length > 0 ? summary.join('\n') : null;
}

function generateTitle(content, date) {
    // Strip common newspaper intros before matching headline topics.
    const cleanContent = content
        .replace(/^Extra[!,]*\s*Extra[!,]*\s*/i, '')
        .replace(/^Extra[!,]*\s*/i, '')
        .trim();

    const normalized = cleanContent.toLowerCase();
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    const titleBuckets = [];

    if (normalized.includes('chick milestone') || normalized.includes('the chicks')) {
        titleBuckets.push([
            `Tiny Milestones at Hensington Palace`,
            `The Chicks Tested Their Wings on ${dayOfWeek}`,
            `Small Adventures from the Brooder Beat`,
            `The Youngest Residents Had News Today`,
            `A Chick Dispatch from ${dayOfWeek}`
        ]);
    }

    if (normalized.includes('egg') || normalized.includes('/images/egg_')) {
        titleBuckets.push([
            `Egg Diplomacy at Hensington Palace`,
            `Shells, Scandals, and Supper Talk`,
            `A Productive Day in the Nesting Department`,
            `The Ladies Delivered Again`,
            `${dayOfWeek}'s Egg Bulletin`
        ]);
    }

    if (normalized.includes('free range') || normalized.includes('yard')) {
        titleBuckets.push([
            `Yard Hours and Other Developments`,
            `Dispatches from the Free-Range Beat`,
            `Patrols, Pecking, and Open-Air Affairs`,
            `The Yard Was Busy Today`,
            `Field Notes from ${dayOfWeek}`
        ]);
    }

    if (normalized.includes('health') || normalized.includes('observation') || normalized.includes('injury') || normalized.includes('sneezing')) {
        titleBuckets.push([
            `Medical Notes from the Coop Desk`,
            `A Watchful Day at Hensington Palace`,
            `Health, Drama, and Daily Proceedings`,
            `The Coop Infirmary Report`,
            `${dayOfWeek}'s Health Bulletin`
        ]);
    }

    if (normalized.includes('photo') || normalized.includes('video') || normalized.includes('/api/photos/')) {
        titleBuckets.push([
            `Today's Feathered Photo Evidence`,
            `Scenes from Inside the Palace Grounds`,
            `A Well-Documented Day in the Coop`,
            `Witness Accounts and Visual Proof`,
            `The Camera Caught Everything`
        ]);
    }

    if (normalized.includes('weather') || normalized.includes('rain') || normalized.includes('wind') || normalized.includes('sun')) {
        titleBuckets.push([
            `Weather, Wings, and Daily Affairs`,
            `Forecast: Clucking with a Chance of Drama`,
            `${dayOfWeek}'s Conditions and Consequences`,
            `The Flock Under Today's Skies`,
            `A Weather-Touched Day at the Palace`
        ]);
    }

    titleBuckets.push([
        `${dayOfWeek}'s Palace Dispatch`,
        `The Clucking Times: ${dayOfWeek} Edition`,
        `News from the Henhouse Desk`,
        `Another Day of Coop Affairs`,
        `The Daily Pecking Order Report`,
        `Matters from the Yard`,
        `Hensington Palace: The Latest`,
        `Feathers, Fuss, and Field Notes`
    ]);

    const flattened = titleBuckets.flat();
    const hashSeed = Array.from(`${date}|${cleanContent.slice(0, 120)}`)
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);

    return flattened[hashSeed % flattened.length];
}
