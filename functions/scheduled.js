// Scheduled task to log daily weather
// Runs at 11:55pm CST (5:55am UTC) via cron trigger
// Checks if any activity occurred today and logs weather if so

import { fetchDailyWeather } from './api/_weather-data.js';

export async function onScheduled(event) {
    try {
        const env = event.env;
        const db = env.DB;

        // Get today's date in Central Time (YYYY-MM-DD format)
        const today = new Date().toLocaleDateString('en-US', {
            timeZone: 'America/Chicago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).split('/').reverse().join('-').replace(/(\d{4})-(\d{2})-(\d{2})/, '$1-$2-$3');

        console.log(`[Weather Cron] Running for date: ${today}`);

        // Check if weather already logged for today
        const existingWeather = await db.prepare(
            'SELECT id FROM weather_logs WHERE date = ?'
        ).bind(today).first();

        if (existingWeather) {
            console.log(`[Weather Cron] Weather already logged for ${today}, skipping`);
            return;
        }

        // Check if there was any activity today
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
            console.log(`[Weather Cron] No activity for ${today}, skipping weather logging`);
            return;
        }

        console.log(`[Weather Cron] Found ${totalActivity} activities for ${today}, logging weather`);

        // Fetch weather data from Open-Meteo
        const weatherData = await fetchDailyWeather(today);

        // Insert weather log
        await db.prepare(`
            INSERT INTO weather_logs (
                date,
                temp_high_f,
                temp_low_f,
                humidity,
                wind_max_mph,
                precipitation_inches,
                pressure_mb,
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
            weatherData.pressure_mb,
            weatherData.conditions,
            weatherData.daylight_hours
        ).run();

        console.log(`[Weather Cron] Successfully logged weather for ${today}`);
    } catch (error) {
        console.error('[Weather Cron] Error:', error.message);
        console.error('[Weather Cron] Stack:', error.stack);
        // Don't throw - cron jobs should complete even if they fail
    }
}
