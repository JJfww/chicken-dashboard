export const CHICKEN_PROFILE_FIELDS = [
    'display_name', 'role_label', 'bio', 'tagline', 'status', 'departed_date', 'departure_note',
    'avatar_url', 'egg_image_url', 'hatch_date', 'sort_order', 'is_rooster', 'egg_color'
];

export function getTodayCST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

export function shiftDate(dateString, days) {
    const date = new Date(`${dateString}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

// 'cream (provisional)' -> { color: 'cream', provisional: true }
export function parseEggColor(eggColor) {
    const raw = String(eggColor || '').trim();
    if (!raw || ['pending', 'n/a'].includes(raw.toLowerCase())) {
        return { color: null, provisional: false };
    }
    const provisional = /\(provisional\)/i.test(raw);
    return { color: raw.replace(/\s*\(provisional\)\s*/i, '').trim(), provisional };
}

export function isLayer(chicken) {
    return !chicken.is_rooster && Boolean(parseEggColor(chicken.egg_color).color);
}

export function presentChicken(row) {
    const egg = parseEggColor(row.egg_color);
    return {
        id: row.id,
        name: row.name,
        display_name: row.display_name || row.name,
        egg_color: row.egg_color,
        egg_color_label: egg.color,
        egg_color_provisional: egg.provisional,
        role_label: row.role_label || null,
        bio: row.bio || null,
        tagline: row.tagline || null,
        status: row.status || 'active',
        departed_date: row.departed_date || null,
        departure_note: row.departure_note || null,
        avatar_url: row.avatar_url || '/images/default.png',
        egg_image_url: row.egg_image_url || null,
        hatch_date: row.hatch_date || null,
        sort_order: row.sort_order ?? 100,
        is_rooster: Boolean(row.is_rooster)
    };
}

export async function loadChickens(db, { status } = {}) {
    const { results } = status
        ? await db.prepare(`SELECT * FROM chickens WHERE COALESCE(status, 'active') = ? ORDER BY sort_order, id`).bind(status).all()
        : await db.prepare(`SELECT * FROM chickens ORDER BY COALESCE(status, 'active'), sort_order, id`).all();
    return results.map(presentChicken);
}

// Consecutive days ending today (or yesterday, if today has no egg yet) with at least one egg.
export function computeStreak(eggDates, today) {
    const dates = new Set(eggDates);
    let cursor = dates.has(today) ? today : shiftDate(today, -1);
    let streak = 0;
    while (dates.has(cursor)) {
        streak += 1;
        cursor = shiftDate(cursor, -1);
    }
    return streak;
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders }
    });
}
