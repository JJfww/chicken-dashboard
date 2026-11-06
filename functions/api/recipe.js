import { requireSession } from './_auth.js';
import { getTodayCST, jsonResponse, shiftDate } from './_flock.js';

const RECIPE_MODEL = 'google/gemini-2.5-flash';

// Weeks start on Monday (Central time).
function weekStartFor(date) {
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    return shiftDate(date, -((dayOfWeek + 6) % 7));
}

function presentRecipe(row) {
    return {
        ...row,
        ingredients: JSON.parse(row.ingredients || '[]'),
        steps: JSON.parse(row.steps || '[]')
    };
}

async function generateRecipe(env, weekStart) {
    if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');

    const db = env.DB;
    const [eggs, pastTitles, layers] = await Promise.all([
        db.prepare('SELECT COALESCE(SUM(count), 0) AS total FROM eggs WHERE date >= ? AND date < ?')
            .bind(shiftDate(weekStart, -7), weekStart).first(),
        db.prepare('SELECT title FROM recipes ORDER BY week_start DESC LIMIT 30').all(),
        db.prepare(`
            SELECT COALESCE(display_name, name) AS name FROM chickens
            WHERE status = 'active' AND is_rooster = 0 ORDER BY sort_order
        `).all()
    ]);
    const month = new Date(`${weekStart}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

    const systemPrompt = `You write the weekly recipe for "Clucky's Kitchen" in The Clucking Times, the newspaper of Hensington Palace, a backyard flock in Lawrence, Kansas (hens: ${layers.results.map(row => row.name).join(', ')}).

Write one egg-centric recipe that a home cook can make with fresh backyard eggs.
- Eggs must be the star of the dish, not a binder. Vary widely across cuisines and meal types (breakfast, lunch, dinner, baking, dessert, sauces, snacks).
- Use a well-established, reliable recipe with correct quantities, temperatures, and times. Do not invent untested techniques.
- Follow food safety: cook eggs until set unless the dish traditionally uses runny or raw eggs, and say so in the tip if so.
- Fit the season: it is ${month} in Kansas. Use ingredients that are in season then or are pantry staples; no out-of-season produce.
- The flock laid ${eggs.total} eggs last week; mention that number in the intro and use it to pitch the recipe.
- US measurements, ingredients written plainly ("6 large eggs"). 6-12 ingredients, 4-8 steps, each step one or two sentences.
- Intro: 2-3 sentences, under 60 words, in Clucky's warm, lightly witty voice; at most one egg pun. No invented hen behavior.
- Steps must be physically consistent (don't reuse a pan or sheet that is still in use).
- Do NOT repeat any of these past recipes: ${pastTitles.results.map(row => row.title).join('; ') || 'none yet'}.

Respond with only a JSON object, no markdown:
{"title": string, "intro": string, "servings": string, "total_time": string, "eggs_used": number, "ingredients": [string], "steps": [string], "tip": string}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://chicken-dashboard.pages.dev',
            'X-Title': 'Hensington Palace - Recipes'
        },
        body: JSON.stringify({
            model: RECIPE_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: "Write this week's recipe." }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.9,
            max_tokens: 1500
        })
    });
    if (!response.ok) throw new Error(`OpenRouter API error (${response.status}): ${await response.text()}`);

    const data = await response.json();
    const content = (data?.choices?.[0]?.message?.content || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const recipe = JSON.parse(content);
    if (!recipe.title || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) {
        throw new Error('Recipe response was missing a title, ingredients, or steps');
    }
    return {
        title: String(recipe.title),
        intro: recipe.intro ? String(recipe.intro) : null,
        servings: recipe.servings ? String(recipe.servings) : null,
        total_time: recipe.total_time ? String(recipe.total_time) : null,
        eggs_used: Number.isFinite(Number(recipe.eggs_used)) ? Number(recipe.eggs_used) : null,
        ingredients: JSON.stringify(recipe.ingredients.map(String)),
        steps: JSON.stringify(recipe.steps.map(String)),
        tip: recipe.tip ? String(recipe.tip) : null
    };
}

async function saveRecipe(db, weekStart, recipe, { replace = false } = {}) {
    await db.prepare(`
        INSERT ${replace ? 'OR REPLACE' : 'OR IGNORE'} INTO recipes
            (week_start, title, intro, servings, total_time, eggs_used, ingredients, steps, tip)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        weekStart, recipe.title, recipe.intro, recipe.servings, recipe.total_time,
        recipe.eggs_used, recipe.ingredients, recipe.steps, recipe.tip
    ).run();
}

const findRecipe = (db, weekStart) => db.prepare('SELECT * FROM recipes WHERE week_start = ?').bind(weekStart).first();

// GET /api/recipe -> this week's recipe (written on the first request of the week)
// GET /api/recipe?week=YYYY-MM-DD -> a past week's recipe
// GET /api/recipe?archive=1 -> list of past recipes
export async function onRequestGet(context) {
    const db = context.env.DB;
    const params = new URL(context.request.url).searchParams;
    try {
        if (params.get('archive')) {
            const { results } = await db.prepare(`
                SELECT week_start, title, eggs_used FROM recipes ORDER BY week_start DESC LIMIT 104
            `).all();
            return jsonResponse(results, 200, { 'Cache-Control': 'public, max-age=300' });
        }

        const currentWeek = weekStartFor(getTodayCST());
        const week = /^\d{4}-\d{2}-\d{2}$/.test(params.get('week') || '') ? weekStartFor(params.get('week')) : currentWeek;
        let row = await findRecipe(db, week);
        if (!row && week === currentWeek) {
            await saveRecipe(db, week, await generateRecipe(context.env, week));
            row = await findRecipe(db, week);
        }
        if (!row) return jsonResponse({ error: 'No recipe for that week' }, 404);
        return jsonResponse(presentRecipe(row), 200, { 'Cache-Control': 'public, max-age=300' });
    } catch (error) {
        return jsonResponse({ error: 'The kitchen is closed right now', details: error.message }, 503);
    }
}

// POST /api/recipe (protected) -> replace this week's recipe with a new one
export async function onRequestPost(context) {
    const authError = await requireSession(context.request, context.env);
    if (authError) return authError;
    try {
        const week = weekStartFor(getTodayCST());
        await saveRecipe(context.env.DB, week, await generateRecipe(context.env, week), { replace: true });
        return jsonResponse(presentRecipe(await findRecipe(context.env.DB, week)));
    } catch (error) {
        return jsonResponse({ error: error.message }, 500);
    }
}
