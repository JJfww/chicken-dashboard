import { computeStreak, getTodayCST, isLayer, jsonResponse, loadChickens, shiftDate } from './_flock.js';

const HEATMAP_DAYS = 182;
const TREND_WEEKS = 26;
const HEADLINE_DAYS = 2; // the note's date and the day after
const LATITUDE = 38.9717; // Lawrence, KS
const CARTON_SIZE = 12;

// Sunrise-to-sunset hours from latitude and date (includes the standard -0.83° refraction correction).
function daylightHours(dateString) {
    const date = new Date(`${dateString}T12:00:00Z`);
    const dayOfYear = Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);
    const rad = Math.PI / 180;
    const declination = 23.44 * rad * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear));
    const latitude = LATITUDE * rad;
    const cosHourAngle = (Math.sin(-0.83 * rad) - Math.sin(latitude) * Math.sin(declination))
        / (Math.cos(latitude) * Math.cos(declination));
    return (2 * Math.acos(Math.min(1, Math.max(-1, cosHourAngle)))) / rad / 15;
}

// GET /api/stats[?chicken=ID] -> egg totals, streaks, heatmap, trends, cost per egg, headline note
export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const today = getTodayCST();
        const chickenId = Number(new URL(context.request.url).searchParams.get('chicken')) || null;
        const chickenFilter = chickenId ? 'AND chicken_id = ?' : '';
        const bindChicken = (...params) => (chickenId ? [...params, chickenId] : params);

        const heatmapStart = shiftDate(today, -(HEATMAP_DAYS - 1));

        const [
            chickens, totals, perChicken, recentEggDates, daily, bestDay,
            expenses, freeRangeWeek, headline, cartonRows, outdoorRows, weatherRows, photoCounts
        ] = await Promise.all([
            loadChickens(db, { status: 'active' }),
            db.prepare(`
                SELECT
                    COALESCE(SUM(count), 0) AS all_time,
                    COALESCE(SUM(CASE WHEN date = ? THEN count END), 0) AS today,
                    COALESCE(SUM(CASE WHEN date > ? THEN count END), 0) AS this_week,
                    COALESCE(SUM(CASE WHEN date > ? AND date <= ? THEN count END), 0) AS last_week,
                    MIN(date) AS since
                FROM eggs WHERE 1 = 1 ${chickenFilter}
            `).bind(...bindChicken(today, shiftDate(today, -7), shiftDate(today, -14), shiftDate(today, -7))).first(),
            db.prepare(`
                SELECT chicken_id,
                    COALESCE(SUM(count), 0) AS total,
                    COALESCE(SUM(CASE WHEN date > ? THEN count END), 0) AS last_30,
                    MIN(date) AS first_egg_date,
                    MAX(date) AS last_egg_date,
                    ROUND(AVG(weight_g), 1) AS avg_weight_g,
                    MAX(weight_g) AS max_weight_g,
                    COUNT(weight_g) AS weighed
                FROM eggs GROUP BY chicken_id
            `).bind(shiftDate(today, -30)).all(),
            db.prepare(`SELECT DISTINCT chicken_id, date FROM eggs WHERE date > ?`).bind(shiftDate(today, -120)).all(),
            db.prepare(`
                SELECT date, SUM(count) AS count FROM eggs
                WHERE date >= ? ${chickenFilter}
                GROUP BY date
            `).bind(...bindChicken(heatmapStart)).all(),
            db.prepare(`
                SELECT date, SUM(count) AS count FROM eggs WHERE 1 = 1 ${chickenFilter}
                GROUP BY date ORDER BY count DESC, date DESC LIMIT 1
            `).bind(...bindChicken()).first(),
            db.prepare(`
                SELECT
                    (SELECT COALESCE(SUM(cost), 0) FROM feed_purchases) +
                    (SELECT COALESCE(SUM(cost), 0) FROM medication) +
                    (SELECT COALESCE(SUM(cost), 0) FROM supplies) AS total
            `).first(),
            db.prepare(`SELECT COALESCE(SUM(duration_minutes), 0) AS minutes FROM free_range WHERE date > ?`)
                .bind(shiftDate(today, -7)).first(),
            db.prepare(`
                SELECT id, date, content FROM notes
                WHERE is_headline = 1 AND date >= ?
                ORDER BY date DESC, created_at DESC LIMIT 1
            `).bind(shiftDate(today, -(HEADLINE_DAYS - 1))).first(),
            // Most recent egg rows, newest first; enough to fill the current carton.
            db.prepare(`
                SELECT e.date, e.count, COALESCE(c.display_name, c.name) AS name, c.egg_image_url
                FROM eggs e LEFT JOIN chickens c ON c.id = e.chicken_id
                WHERE 1 = 1 ${chickenFilter.replace('chicken_id', 'e.chicken_id')}
                ORDER BY e.date DESC, e.id DESC LIMIT ?
            `).bind(...(chickenId ? [chickenId, CARTON_SIZE] : [CARTON_SIZE])).all(),
            db.prepare(`
                SELECT date, SUM(duration_minutes) AS minutes FROM free_range
                WHERE date >= ? AND duration_minutes IS NOT NULL GROUP BY date
            `).bind(heatmapStart).all(),
            db.prepare(`
                SELECT date, temp_high_f, precipitation_inches, conditions FROM weather_logs WHERE date >= ?
            `).bind(heatmapStart).all(),
            db.prepare(`
                SELECT c.id, COALESCE(c.display_name, c.name) AS name, c.avatar_url, c.status, COUNT(*) AS photos
                FROM photo_chickens p JOIN chickens c ON c.id = p.chicken_id
                GROUP BY c.id ORDER BY photos DESC, c.sort_order
            `).all()
        ]);

        const datesByChicken = new Map();
        for (const row of recentEggDates.results) {
            if (!datesByChicken.has(row.chicken_id)) datesByChicken.set(row.chicken_id, []);
            datesByChicken.get(row.chicken_id).push(row.date);
        }
        const statsByChicken = new Map(perChicken.results.map(row => [row.chicken_id, row]));

        const hens = chickens
            .filter(chicken => isLayer(chicken) || statsByChicken.has(chicken.id))
            .map(chicken => {
                const stats = statsByChicken.get(chicken.id) || {};
                return {
                    id: chicken.id,
                    name: chicken.name,
                    display_name: chicken.display_name,
                    egg_image_url: chicken.egg_image_url,
                    total: stats.total || 0,
                    last_30: stats.last_30 || 0,
                    first_egg_date: stats.first_egg_date || null,
                    last_egg_date: stats.last_egg_date || null,
                    streak: computeStreak(datesByChicken.get(chicken.id) || [], today),
                    avg_weight_g: stats.avg_weight_g ?? null,
                    max_weight_g: stats.max_weight_g ?? null,
                    weighed: stats.weighed || 0
                };
            })
            .filter(hen => !chickenId || hen.id === chickenId);

        // Weekly eggs alongside average daylight, oldest first, weeks ending today.
        const dailyCounts = new Map(daily.results.map(row => [row.date, row.count]));
        const weekly = [];
        for (let week = TREND_WEEKS - 1; week >= 0; week -= 1) {
            const end = shiftDate(today, -week * 7);
            let eggs = 0;
            let light = 0;
            for (let day = 0; day < 7; day += 1) {
                const date = shiftDate(end, -day);
                eggs += dailyCounts.get(date) || 0;
                light += daylightHours(date);
            }
            weekly.push({ week_end: end, eggs, avg_daylight_hours: Math.round((light / 7) * 10) / 10 });
        }

        // Carton #N holds eggs (N-1)*12+1 .. N*12; a just-completed carton shows full.
        const filled = totals.all_time % CARTON_SIZE || (totals.all_time ? CARTON_SIZE : 0);
        const cartonEggs = [];
        for (const row of cartonRows.results) {
            for (let i = 0; i < row.count && cartonEggs.length < filled; i += 1) {
                cartonEggs.push({ date: row.date, name: row.name, egg_image_url: row.egg_image_url });
            }
        }
        const carton = {
            number: Math.max(1, Math.ceil(totals.all_time / CARTON_SIZE)),
            filled,
            size: CARTON_SIZE,
            eggs: cartonEggs.reverse()
        };

        // One entry per day, so days spent inside still show their weather.
        const outdoorMinutes = new Map(outdoorRows.results.map(row => [row.date, row.minutes]));
        const weatherByDate = new Map(weatherRows.results.map(row => [row.date, row]));
        const outdoors = [];
        if (!chickenId) {
            for (let date = heatmapStart; date <= today; date = shiftDate(date, 1)) {
                const weather = weatherByDate.get(date) || {};
                outdoors.push({
                    date,
                    minutes: outdoorMinutes.get(date) || 0,
                    temp_high_f: weather.temp_high_f ?? null,
                    precipitation_inches: weather.precipitation_inches ?? null,
                    conditions: weather.conditions ?? null
                });
            }
        }

        const allTimeFlockEggs = chickenId ? null : totals.all_time;
        return jsonResponse({
            today,
            totals: {
                today: totals.today,
                this_week: totals.this_week,
                last_week: totals.last_week,
                all_time: totals.all_time,
                since: totals.since
            },
            best_day: bestDay ? { date: bestDay.date, count: bestDay.count } : null,
            hens,
            heatmap: {
                start: heatmapStart,
                end: today,
                days: daily.results.map(row => ({ date: row.date, count: row.count }))
            },
            weekly,
            cost_per_egg: allTimeFlockEggs
                ? { total_spent: Math.round(expenses.total * 100) / 100, per_egg: Math.round((expenses.total / allTimeFlockEggs) * 100) / 100 }
                : null,
            free_range_minutes_this_week: freeRangeWeek.minutes,
            headline: headline || null,
            carton,
            outdoors,
            photo_counts: chickenId ? [] : photoCounts.results
        }, 200, { 'Cache-Control': 'public, max-age=60' });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
