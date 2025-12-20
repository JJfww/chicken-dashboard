import { fetchDailyWeather } from './_weather-data.js';

function getTodayCST() {
    const date = new Date().toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    // toLocaleDateString returns MM/DD/YYYY, convert to YYYY-MM-DD
    const [month, day, year] = date.split('/');
    return `${year}-${month}-${day}`;
}

function getBearerToken(request) {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice('Bearer '.length).trim();
}

function parseDateParam(request) {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');

    if (!date) {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { error: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    return { value: date };
}

export async function onRequestPost(context) {
    try {
        const token = getBearerToken(context.request);

        if (!context.env.WEATHER_LOG_TOKEN) {
            return new Response(JSON.stringify({ error: 'Server not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!token || token !== context.env.WEATHER_LOG_TOKEN) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const dateParam = parseDateParam(context.request);
        if (dateParam?.error) {
            return new Response(JSON.stringify({ error: dateParam.error }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const today = dateParam?.value || getTodayCST();
        const db = context.env.DB;

        const existingWeather = await db.prepare(
            'SELECT id FROM weather_logs WHERE date = ?'
        ).bind(today).first();

        if (existingWeather) {
            return new Response(JSON.stringify({ status: 'skipped', reason: 'already_logged', date: today }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const hasEggs = await db.prepare(
            'SELECT COUNT(*) as count FROM eggs WHERE date = ?'
        ).bind(today).first();

        const hasFeeding = await db.prepare(
            'SELECT COUNT(*) as count FROM feeding WHERE date = ?'
        ).bind(today).first();

        const hasFreeRange = await db.prepare(
            'SELECT COUNT(*) as count FROM free_range WHERE date = ?'
        ).bind(today).first();

        const hasHealth = await db.prepare(
            'SELECT COUNT(*) as count FROM health_observations WHERE date = ?'
        ).bind(today).first();

        const hasPhotos = await db.prepare(
            'SELECT COUNT(*) as count FROM photos WHERE date = ?'
        ).bind(today).first();

        const totalActivity =
            (hasEggs?.count || 0) +
            (hasFeeding?.count || 0) +
            (hasFreeRange?.count || 0) +
            (hasHealth?.count || 0) +
            (hasPhotos?.count || 0);

        if (totalActivity === 0) {
            return new Response(JSON.stringify({ status: 'skipped', reason: 'no_activity', date: today }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const weatherData = await fetchDailyWeather(today);

        await db.prepare(`
            INSERT INTO weather_logs (
                date,
                temp_high_f,
                temp_low_f,
                humidity,
                wind_max_mph,
                precipitation_inches,
                pressure_inhg,
                conditions,
                daylight_hours
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            today,
            weatherData.temp_high_f,
            weatherData.temp_low_f,
            weatherData.humidity,
            weatherData.wind_max_mph,
            weatherData.precipitation_inches,
            weatherData.pressure_inhg,
            weatherData.conditions,
            weatherData.daylight_hours
        ).run();

        return new Response(JSON.stringify({ status: 'logged', date: today }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to log weather' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
