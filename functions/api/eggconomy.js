import { generateJson } from './_ai.js';
import { computeStreak, getTodayCST, isLayer, jsonResponse, loadChickens, shiftDate } from './_flock.js';

// Real egg counts under satirical economic labels. Indicators use rolling 7-day windows;
// the market report is written once a week on Friday and covers the seven days before it (Friday-Thursday).

const MOLT_HALT_DAYS = 21;
const NEW_LISTING_DAYS = 21;

// Most recent Friday on or before the date (the report's publication day, stored as week_start).
function reportDateFor(date) {
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    return shiftDate(date, -((dayOfWeek + 2) % 7));
}

function sumBetween(rows, from, to) {
    return rows.filter(row => row.date >= from && row.date <= to).reduce((sum, row) => sum + row.count, 0);
}

function rating({ halted, newListing, current, previous }) {
    if (halted) return 'TRADING HALTED';
    if (newListing) return 'NEW LISTING';
    if (!current) return previous ? 'UNDER INVESTIGATION' : 'DORMANT';
    if (current > previous) return 'BUY';
    if (current === previous) return 'HOLD';
    return 'WATCH';
}

function percentChange(current, previous) {
    return previous ? Math.round(((current - previous) / previous) * 100) : null;
}

// Eggs on hand: the latest stock count, plus eggs laid after that day, minus eggs out after the count
// (later days, or the same day but logged after the count).
async function nationalReserves(db) {
    const stock = await db.prepare(`
        SELECT id, date, count FROM egg_outflows WHERE kind = 'stock' ORDER BY date DESC, id DESC LIMIT 1
    `).first();
    if (!stock) return null;
    const [laid, out] = await Promise.all([
        db.prepare('SELECT COALESCE(SUM(count), 0) AS total FROM eggs WHERE date > ?').bind(stock.date).first(),
        db.prepare(`
            SELECT COALESCE(SUM(count), 0) AS total FROM egg_outflows
            WHERE kind != 'stock' AND (date > ? OR (date = ? AND id > ?))
        `).bind(stock.date, stock.date, stock.id).first()
    ]);
    return { on_hand: Math.max(0, stock.count + laid.total - out.total), counted_on: stock.date };
}

async function outflowTotals(db, from, to) {
    const { results } = await db.prepare(`
        SELECT kind, SUM(count) AS total FROM egg_outflows WHERE kind != 'stock' AND date >= ? AND date <= ? GROUP BY kind
    `).bind(from, to).all();
    const totals = { eaten: 0, given: 0, dogs: 0 };
    results.forEach(row => { totals[row.kind] = row.total; });
    return totals;
}

async function loadReportContext(db, weekStart, chickens) {
    const from = shiftDate(weekStart, -7);
    const to = shiftDate(weekStart, -1);
    const priorFrom = shiftDate(weekStart, -14);
    const [eggs, notes, health, blotter, freeRange, outflows] = await Promise.all([
        db.prepare('SELECT chicken_id, date, count, notes FROM eggs WHERE date >= ? AND date <= ?').bind(priorFrom, to).all(),
        db.prepare(`SELECT content FROM notes WHERE date >= ? AND date <= ? AND content NOT LIKE 'RUDY_METER::%' AND content NOT LIKE 'CHICK_MILESTONE::%'`).bind(from, to).all(),
        db.prepare(`
            SELECT COALESCE(c.display_name, c.name) AS name, h.observation_type, h.description
            FROM health_observations h LEFT JOIN chickens c ON c.id = h.chicken_id WHERE h.date >= ? AND h.date <= ?
        `).bind(from, to).all(),
        db.prepare('SELECT suspect, description, outcome FROM blotter WHERE date >= ? AND date <= ?').bind(from, to).all(),
        db.prepare('SELECT COALESCE(SUM(duration_minutes), 0) AS minutes FROM free_range WHERE date >= ? AND date <= ?').bind(from, to).first(),
        outflowTotals(db, from, to)
    ]);

    const lines = [`Reporting week: ${from} to ${to}.`];
    const weekRows = eggs.results.filter(row => row.date >= from);
    const total = sumBetween(eggs.results, from, to);
    const prior = sumBetween(eggs.results, priorFrom, shiftDate(from, -1));
    lines.push(`National output (GDP): ${total} eggs, versus ${prior} the week before (${percentChange(total, prior) ?? 'n/a'}% change).`);
    for (const chicken of chickens) {
        if (chicken.is_rooster) {
            lines.push(`${chicken.display_name}: rooster, lays no eggs (privately held, not publicly traded).`);
            continue;
        }
        const own = eggs.results.filter(row => row.chicken_id === chicken.id);
        const current = sumBetween(own, from, to);
        const previous = sumBetween(own, priorFrom, shiftDate(from, -1));
        const streak = computeStreak(own.map(row => row.date), to);
        lines.push(`${chicken.display_name}${chicken.ticker ? ` (${chicken.ticker})` : ''}: ${current} eggs (prior week ${previous})${streak >= 3 ? `, laying streak ${streak} days` : ''}.`);
    }
    const eggNotes = weekRows.map(row => row.notes).filter(Boolean);
    if (eggNotes.length) lines.push(`Egg notes: ${eggNotes.join(' | ')}`);
    if (health.results.length) lines.push(`Health: ${health.results.map(row => `${row.name || 'flock'} ${row.observation_type}${row.description ? ` (${row.description})` : ''}`).join('; ')}`);
    if (blotter.results.length) lines.push(`Security incidents: ${blotter.results.map(row => `${row.suspect || 'unknown suspect'}: ${row.description}${row.outcome ? ` (${row.outcome})` : ''}`).join('; ')}`);
    if (notes.results.length) lines.push(`Palace notes: ${notes.results.map(row => row.content).join(' | ')}`);
    if (outflows.eaten || outflows.given || outflows.dogs) {
        lines.push(`Eggs out: ${outflows.eaten} eaten at the palace (domestic consumption), ${outflows.given} given away (exports), ${outflows.dogs} lost to the dogs (write-offs).`);
    }
    lines.push(`Free-range time: ${Math.round(freeRange.minutes / 6) / 10} hours.`);
    return { text: lines.join('\n'), hasEggs: total > 0 || prior > 0 };
}

async function generateReport(env, weekStart, chickens) {
    const context = await loadReportContext(env.DB, weekStart, chickens);
    const month = new Date(`${weekStart}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    const report = await generateJson(env, {
        title: 'Hensington Palace - Eggconomy',
        system: `You are the Financial Desk of The Clucking Times, covering "the Eggconomy" of Hensington Palace, a backyard chicken flock in Lawrence, Kansas, treated as a small nation whose GDP is eggs. It is ${month}.

Write this week's market report in the deadpan language of serious financial news (markets, earnings, analysts, labor, monetary policy) applied to chickens.
- Use ONLY the figures and events in the data. Never invent numbers, events, or hen behavior.
- Headline: one financial-news headline, under 12 words, reflecting the week's real direction (rally, slump, flat, new entrant, halted trading, etc.).
- Body: 2-3 short paragraphs, under 130 words total. Start with "HENSINGTON PALACE —". Name specific hens and their numbers.
- Roosters lay no eggs; treat them as privately held companies, never as producers.
- Eggs eaten at the palace are domestic consumption, eggs given away are exports, eggs lost to the dogs are write-offs (canine-related losses).
- Molting is a temporary trading halt, not a failure. Shorter autumn days can be blamed by "palace economists".
- At most one egg pun. No exclamation marks.

Respond with only a JSON object: {"headline": string, "body": string} with paragraphs in body separated by a blank line.`,
        user: context.text,
        maxTokens: 800
    });
    if (!report.headline || !report.body) throw new Error('Market report was missing a headline or body');
    return { headline: String(report.headline), body: String(report.body) };
}

// GET /api/eggconomy -> { indicators, exchange, unlisted, report }
export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const today = getTodayCST();
        const thisFrom = shiftDate(today, -6);
        const prevFrom = shiftDate(today, -13);
        const prevTo = shiftDate(today, -7);

        const [chickens, eggs, molts] = await Promise.all([
            loadChickens(db, { status: 'active' }),
            db.prepare(`
                SELECT chicken_id, date, SUM(count) AS count FROM eggs WHERE date >= ? GROUP BY chicken_id, date
            `).bind(prevFrom).all(),
            db.prepare(`
                SELECT DISTINCT chicken_id FROM health_observations WHERE observation_type = 'molting' AND date >= ?
            `).bind(shiftDate(today, -MOLT_HALT_DAYS)).all()
        ]);
        const firstEggs = await db.prepare('SELECT chicken_id, MIN(date) AS first_date FROM eggs GROUP BY chicken_id').all();
        const firstEggByChicken = new Map(firstEggs.results.map(row => [row.chicken_id, row.first_date]));
        const molting = new Set(molts.results.map(row => row.chicken_id));

        const layers = chickens.filter(chicken => isLayer(chicken));
        const exchange = layers.map(chicken => {
            const own = eggs.results.filter(row => row.chicken_id === chicken.id);
            const current = sumBetween(own, thisFrom, today);
            const previous = sumBetween(own, prevFrom, prevTo);
            const halted = molting.has(chicken.id);
            const newListing = (firstEggByChicken.get(chicken.id) || '') >= shiftDate(today, -NEW_LISTING_DAYS);
            return {
                id: chicken.id,
                ticker: chicken.ticker || chicken.display_name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(),
                name: chicken.display_name,
                egg_image_url: chicken.egg_image_url,
                current,
                previous,
                change: current - previous,
                rating: rating({ halted, newListing, current, previous }),
                halted_reason: halted ? 'Molting' : null
            };
        }).sort((a, b) => b.current - a.current || a.name.localeCompare(b.name));

        const gdp = sumBetween(eggs.results, thisFrom, today);
        const gdpPrevious = sumBetween(eggs.results, prevFrom, prevTo);
        const employed = exchange.filter(row => row.current > 0).length;

        // Market volatility: spread of daily flock output over the last 14 days.
        const daily = [];
        for (let date = prevFrom; date <= today; date = shiftDate(date, 1)) {
            daily.push(sumBetween(eggs.results, date, date));
        }
        const mean = daily.reduce((sum, value) => sum + value, 0) / daily.length;
        const spread = Math.sqrt(daily.reduce((sum, value) => sum + (value - mean) ** 2, 0) / daily.length);
        const volatility = mean ? spread / mean : 0;

        const [reserves, flows] = await Promise.all([nationalReserves(db), outflowTotals(db, thisFrom, today)]);

        const eggflation = percentChange(gdp, gdpPrevious);
        const indicators = {
            gdp,
            gdp_previous: gdpPrevious,
            eggflation,
            sentiment: eggflation === null ? 'Steady' : eggflation >= 5 ? 'Bullish' : eggflation <= -5 ? 'Bearish' : 'Steady',
            eggployment: { employed, workforce: layers.length, rate: layers.length ? Math.round((employed / layers.length) * 100) : 0 },
            productivity: layers.length ? Math.round((gdp / layers.length) * 10) / 10 : 0,
            volatility: volatility < 0.35 ? 'Low' : volatility < 0.7 ? 'Moderate' : 'High',
            reserves,
            consumption: flows.eaten,
            exports: flows.given,
            write_offs: flows.dogs,
            // Positive = more eggs left the palace than were laid this week
            trade_deficit: flows.eaten + flows.given + flows.dogs - gdp
        };

        // Weekly market report, written on the first request on or after Friday.
        const weekStart = reportDateFor(today);
        let report = await db.prepare('SELECT week_start, headline, body FROM market_reports WHERE week_start = ?').bind(weekStart).first();
        if (!report) {
            try {
                const generated = await generateReport(context.env, weekStart, chickens);
                await db.prepare('INSERT OR IGNORE INTO market_reports (week_start, headline, body) VALUES (?, ?, ?)')
                    .bind(weekStart, generated.headline, generated.body).run();
                report = await db.prepare('SELECT week_start, headline, body FROM market_reports WHERE week_start = ?').bind(weekStart).first();
            } catch (error) {
                report = null;
            }
        }

        return jsonResponse({
            today,
            indicators,
            exchange,
            unlisted: chickens.filter(chicken => chicken.is_rooster).map(chicken => chicken.display_name),
            report
        }, 200, { 'Cache-Control': 'public, max-age=60' });
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
