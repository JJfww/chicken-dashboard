import { requireSession } from './_auth.js';

// Calculate duration in minutes from start and end times (HH:MM format)
function calculateDurationMinutes(timeStart, timeEnd) {
    const [startHours, startMins] = timeStart.split(':').map(Number);
    const [endHours, endMins] = timeEnd.split(':').map(Number);
    const startTotal = startHours * 60 + startMins;
    const endTotal = endHours * 60 + endMins;
    return endTotal - startTotal;
}

// Format minutes as H:MM (returns null for incomplete sessions)
function formatDuration(minutes) {
    if (minutes === null || minutes === undefined) {
        return null;
    }
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

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://chicken-dashboard.pages.dev',
        'Access-Control-Allow-Credentials': 'true'
    };

    try {
        const { date, time_start, time_end, notes } = await context.request.json();

        // Validate date is provided
        if (!date) {
            return new Response(JSON.stringify({ error: 'Missing required field: date' }), {
                status: 400,
                headers
            });
        }

        // Must have at least one time
        if (!time_start && !time_end) {
            return new Response(JSON.stringify({ error: 'Must provide at least start time or end time' }), {
                status: 400,
                headers
            });
        }

        // Case 1: Both times provided - insert complete record
        if (time_start && time_end) {
            const duration_minutes = calculateDurationMinutes(time_start, time_end);

            if (duration_minutes <= 0) {
                return new Response(JSON.stringify({ error: 'End time must be after start time' }), {
                    status: 400,
                    headers
                });
            }

            const result = await context.env.DB.prepare(
                'INSERT INTO free_range (date, time_start, time_end, duration_minutes, notes) VALUES (?, ?, ?, ?, ?)'
            ).bind(date, time_start, time_end, duration_minutes, notes || null).run();

            return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id, action: 'created' }), {
                status: 200,
                headers
            });
        }

        // Case 2: Only start time - create new incomplete record
        if (time_start && !time_end) {
            const result = await context.env.DB.prepare(
                'INSERT INTO free_range (date, time_start, time_end, duration_minutes, notes) VALUES (?, ?, NULL, NULL, ?)'
            ).bind(date, time_start, notes || null).run();

            return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id, action: 'started' }), {
                status: 200,
                headers
            });
        }

        // Case 3: Only end time - find and complete today's incomplete record
        if (!time_start && time_end) {
            // Find the most recent incomplete record for this date
            const incomplete = await context.env.DB.prepare(
                'SELECT id, time_start FROM free_range WHERE date = ? AND time_end IS NULL ORDER BY created_at DESC LIMIT 1'
            ).bind(date).first();

            if (!incomplete) {
                return new Response(JSON.stringify({ error: 'No incomplete free range session found for this date' }), {
                    status: 400,
                    headers
                });
            }

            const duration_minutes = calculateDurationMinutes(incomplete.time_start, time_end);

            if (duration_minutes <= 0) {
                return new Response(JSON.stringify({ error: 'End time must be after start time' }), {
                    status: 400,
                    headers
                });
            }

            // Update the incomplete record with end time and duration
            await context.env.DB.prepare(
                'UPDATE free_range SET time_end = ?, duration_minutes = ?, notes = COALESCE(?, notes) WHERE id = ?'
            ).bind(time_end, duration_minutes, notes || null, incomplete.id).run();

            return new Response(JSON.stringify({ success: true, id: incomplete.id, action: 'completed' }), {
                status: 200,
                headers
            });
        }
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
