import { requireSession } from '../_auth.js';

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

        // Build the AI prompt for blog generation
        const systemPrompt = `You are Clucky, the witty chicken dashboard blogger. Write a fun, engaging blog post about today's chicken activities.

Guidelines:
- Write in first person as if you're narrating the day in the life of the flock
- Use chicken puns liberally (but tastefully)
- Keep it between 150-300 words
- Be conversational and entertaining
- Include specific details from the activities (chicken names, what they did, etc.)
- End with a fun sign-off like "Cluck you later!" or "Winging it till tomorrow!" - be creative and make up your own.
- Format as plain text paragraphs (no markdown headers)
- Convert minutes (free range time) to hours when more than 60 minutes. Eg, 120 minutes would convert to 2 hours.
- Pay attention to what time things happened, when time is logged, to be true to what the chickens' day was like.
- It's ok to throw in things about Rudy randomly since we don't collect as much info about him - Rudy watched his flock closely, Rudy was "randy" all day, Rudy chased squirrels because he didn't want to share. He's also chased robins, doves, and rabbits. He usually starts crowing at 5:30 am. Those are just ideas - you can take it from there to make it fun and keep with the theme.

Activity data for ${date}:
${activityData.summary}

Write a delightful blog post about this day!`;

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
                model: 'google/gemini-3-flash-preview',
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
        const blogContent = data.choices[0].message.content;

        // Auto-generate a title from the first sentence or use a default
        const title = generateTitle(blogContent, date);

        return new Response(JSON.stringify({
            title,
            content: blogContent,
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
        summary: []
    };

    // Get eggs for this date
    const eggs = await db.prepare(`
        SELECT c.name, e.notes
        FROM eggs e
        JOIN chickens c ON e.chicken_id = c.id
        WHERE e.date = ?
    `).bind(date).all();

    if (eggs.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('Eggs laid:');
        eggs.results.forEach(egg => {
            activity.summary.push(`- ${egg.name}${egg.notes ? ' (' + egg.notes + ')' : ''}`);
        });
    }

    // Get feeding for this date
    const feeding = await db.prepare(`
        SELECT feed_type, description, notes
        FROM feeding
        WHERE date = ?
    `).bind(date).all();

    if (feeding.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('\nFeeding:');
        feeding.results.forEach(feed => {
            activity.summary.push(`- ${feed.description} (${feed.feed_type})${feed.notes ? ' - ' + feed.notes : ''}`);
        });
    }

    // Get free range for this date
    const freeRange = await db.prepare(`
        SELECT duration_minutes, notes
        FROM free_range
        WHERE date = ?
    `).bind(date).all();

    if (freeRange.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push('\nFree Range:');
        freeRange.results.forEach(fr => {
            activity.summary.push(`- ${fr.duration_minutes} minutes${fr.notes ? ' - ' + fr.notes : ''}`);
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

    // Get photos for this date
    const photos = await db.prepare(`
        SELECT caption
        FROM photos
        WHERE date = ?
    `).bind(date).all();

    if (photos.results.length > 0) {
        activity.hasActivity = true;
        activity.summary.push(`\nPhotos: ${photos.results.length} photo(s) taken`);
        photos.results.forEach(photo => {
            if (photo.caption) {
                activity.summary.push(`- ${photo.caption}`);
            }
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
        summary: activity.summary.join('\n')
    };
}

function generateTitle(content, date) {
    // Try to extract a catchy first sentence or phrase
    const firstSentence = content.split(/[.!?]/)[0].trim();

    // If the first sentence is short enough, use it as the title
    if (firstSentence.length <= 60) {
        return firstSentence;
    }

    // Otherwise, create a generic fun title
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    const titles = [
        `${dayOfWeek}'s Coop Chronicles`,
        `Another Egg-citing Day in the Coop`,
        `Tales from the Henhouse`,
        `Clucking Around on ${dayOfWeek}`,
        `Feathered Adventures: ${dayOfWeek} Edition`
    ];

    // Use the date to pick a consistent title for the same date
    const index = dateObj.getDate() % titles.length;
    return titles[index];
}
