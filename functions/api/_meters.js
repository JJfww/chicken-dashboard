// Meter definitions. Add a new meter here and it can be logged from the admin
// dashboard and read from /api/meters?meter=<key> with no schema change.
export const METERS = {
    rudy: {
        title: 'Rudy Meter',
        emoji: '🐓',
        active: false,
        levels: [
            { score: 0, label: 'True Gentleman', description: 'Low menace. Surprisingly civilized today.' },
            { score: 1, label: 'Annoying', description: 'Mild nonsense, but still manageable.' },
            { score: 2, label: 'Pushy', description: 'Crowding you and testing boundaries.' },
            { score: 3, label: 'Asshole', description: 'Fully committed to being difficult.' },
            { score: 4, label: 'Spur of the Moment', description: 'Considering an ankle-based decision.' },
            { score: 5, label: 'Full Rooster Assault', description: 'Talons, rage, and no respect.' }
        ]
    },
    chicks: {
        title: 'Chick Milestone',
        emoji: '🐥',
        active: false,
        levels: [
            { score: 0, label: 'Hatchling Bubble', description: 'Freshly hatched and mostly tucked in close.' },
            { score: 1, label: 'Following Mama', description: 'Shadowing mom closely and learning the basics.' },
            { score: 2, label: 'Backyard Peeking', description: 'Starting to notice the wider world in short bursts.' },
            { score: 3, label: 'Short Solo Missions', description: 'Taking quick little detours before circling back.' },
            { score: 4, label: 'Confident Explorers', description: 'Covering more ground and acting noticeably bolder.' },
            { score: 5, label: 'Little Coop Citizens', description: 'Fully engaged in flock life with plenty of independence.' }
        ]
    }
};

export function describeMeterEntry(meterKey, row) {
    const meter = METERS[meterKey];
    const level = meter?.levels.find(item => item.score === Number(row.score));
    if (!level) return null;

    return {
        id: row.id,
        meter: meterKey,
        date: row.date,
        score: level.score,
        label: level.label,
        description: level.description,
        notes: row.notes || null,
        created_at: row.created_at
    };
}

export async function getMeterEntries(db, meterKey, { date, limit = 30 } = {}) {
    if (date) {
        const row = await db.prepare(`
            SELECT id, date, score, notes, created_at
            FROM meter_entries
            WHERE meter = ? AND date = ?
        `).bind(meterKey, date).first();
        return row ? [describeMeterEntry(meterKey, row)].filter(Boolean) : [];
    }

    const { results } = await db.prepare(`
        SELECT id, date, score, notes, created_at
        FROM meter_entries
        WHERE meter = ?
        ORDER BY date DESC, created_at DESC
        LIMIT ?
    `).bind(meterKey, limit).all();
    return results.map(row => describeMeterEntry(meterKey, row)).filter(Boolean);
}

// One entry per meter per day: logging again on the same date replaces it.
export async function saveMeterEntry(db, meterKey, { date, score, notes }) {
    const meter = METERS[meterKey];
    const numericScore = Number(score);
    if (!meter || !date || !meter.levels.some(item => item.score === numericScore)) {
        return null;
    }

    await db.prepare(`
        INSERT INTO meter_entries (meter, date, score, notes)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (meter, date) DO UPDATE SET
            score = excluded.score,
            notes = excluded.notes,
            created_at = datetime('now')
    `).bind(meterKey, date, numericScore, notes || null).run();

    const row = await db.prepare(`
        SELECT id, date, score, notes, created_at FROM meter_entries WHERE meter = ? AND date = ?
    `).bind(meterKey, date).first();
    return describeMeterEntry(meterKey, row);
}
