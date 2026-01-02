import { requireSession } from './_auth.js';

// Calculate duration in minutes from start and end times (HH:MM format)
function calculateDurationMinutes(timeStart, timeEnd) {
    const [startHours, startMins] = timeStart.split(':').map(Number);
    const [endHours, endMins] = timeEnd.split(':').map(Number);
    const startTotal = startHours * 60 + startMins;
    const endTotal = endHours * 60 + endMins;
    return endTotal - startTotal;
}

// Format minutes as H:MM
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
        const { date, time_start, time_end, notes } = await context.request.json();

        // Validate required fields
        if (!date || !time_start || !time_end) {
            return new Response(JSON.stringify({ error: 'Missing required fields (date, time_start, time_end)' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                    'Access-Control-Allow-Credentials': 'true'
                }
            });
        }

        // Calculate duration from start and end times
        const duration_minutes = calculateDurationMinutes(time_start, time_end);

        if (duration_minutes <= 0) {
            return new Response(JSON.stringify({ error: 'End time must be after start time' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                    'Access-Control-Allow-Credentials': 'true'
                }
            });
        }

        // Insert free range record
        const result = await context.env.DB.prepare(
            'INSERT INTO free_range (date, time_start, time_end, duration_minutes, notes) VALUES (?, ?, ?, ?, ?)'
        ).bind(date, time_start, time_end, duration_minutes, notes || null).run();

        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    } catch (error) {
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

export async function onRequestGet(context) {
    try {
        // Get recent free range records
        const { results } = await context.env.DB.prepare(`
            SELECT id, date, time_start, time_end, duration_minutes, notes, created_at
            FROM free_range
            ORDER BY date DESC, time_start DESC, created_at DESC
            LIMIT 50
        `).all();

        // Add formatted duration to each result
        const formattedResults = results.map(r => ({
            ...r,
            duration_formatted: formatDuration(r.duration_minutes)
        }));

        return new Response(JSON.stringify(formattedResults), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    } catch (error) {
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
