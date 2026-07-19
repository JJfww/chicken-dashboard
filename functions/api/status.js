const CHICK_MILESTONE_PREFIX = 'CHICK_MILESTONE::';
const RUDY_CAPTION = 'Part of Hensington Palace from May 2025 to May 2026. Rehomed to a farm on May 31, 2026 for the betterment of him and his hens, and presumably living his best life.';

const chickMilestoneLabels = {
    0: 'Hatchling Bubble',
    1: 'Following Mama',
    2: 'Backyard Peeking',
    3: 'Short Solo Missions',
    4: 'Confident Explorers',
    5: 'Little Coop Citizens'
};

const chickMilestoneDescriptions = {
    0: 'Freshly hatched and mostly tucked in close.',
    1: 'Shadowing mom closely and learning the basics.',
    2: 'Starting to notice the wider world in short bursts.',
    3: 'Taking quick little detours before circling back.',
    4: 'Covering more ground and acting noticeably bolder.',
    5: 'Fully engaged in flock life with plenty of independence.'
};

function getTodayCST() {
    const now = new Date();
    const cstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const year = cstDate.getFullYear();
    const month = String(cstDate.getMonth() + 1).padStart(2, '0');
    const day = String(cstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseChickMilestone(row) {
    if (!row?.content?.startsWith(CHICK_MILESTONE_PREFIX)) return null;

    try {
        const payload = JSON.parse(row.content.slice(CHICK_MILESTONE_PREFIX.length));
        const score = Number(payload.score);
        if (!Object.prototype.hasOwnProperty.call(chickMilestoneLabels, score)) return null;

        return {
            score,
            label: chickMilestoneLabels[score],
            description: chickMilestoneDescriptions[score],
            notes: payload.notes || null,
            date: row.date
        };
    } catch {
        return null;
    }
}

export async function onRequestGet(context) {
    try {
        const activeFlock = [];

        const { results: chickenList } = await context.env.DB.prepare(`
            SELECT id, name, egg_color
            FROM chickens
            ORDER BY id
        `).all();

        const today = getTodayCST();

        const latestChickMilestoneRow = await context.env.DB.prepare(`
            SELECT content, date
            FROM notes
            WHERE content LIKE ?
            ORDER BY date DESC, created_at DESC
            LIMIT 1
        `).bind(`${CHICK_MILESTONE_PREFIX}%`).first();

        const latestChickMilestone = parseChickMilestone(latestChickMilestoneRow);

        const activeChickenList = chickenList.filter(chicken => chicken.name !== 'Rudy');
        if (!activeChickenList.some(chicken => chicken.name === 'Velma')) {
            activeChickenList.push({
                id: 5,
                name: 'Velma',
                egg_color: null,
                is_placeholder: true
            });
        }

        for (const chicken of activeChickenList) {
            const isRooster = chicken.name === 'Velma';
            const status = {
                id: chicken.id,
                name: chicken.name,
                display_name: chicken.name === 'Velma' ? 'Velma/Vinnie' : chicken.name,
                egg_color: chicken.egg_color,
                is_placeholder: Boolean(chicken.is_placeholder),
                is_pullet: false,
                is_rooster: isRooster,
                role_label:
                    chicken.name === 'Madame Pompadour'
                        ? 'Queen of the Coop'
                        : chicken.name === 'Mamma Mia'
                            ? 'Mom of the chicks'
                            : chicken.name === 'Velma'
                                ? 'King of the Coop contender'
                            : null
            };

            if (!chicken.is_placeholder) {
                const { results: todayEggs } = await context.env.DB.prepare(`
                    SELECT COUNT(*) as count
                    FROM eggs
                    WHERE chicken_id = ? AND date = ?
                `).bind(chicken.id, today).all();

                status.laid_today = todayEggs[0].count > 0;

                const { results: lastEgg } = await context.env.DB.prepare(`
                    SELECT date
                    FROM eggs
                    WHERE chicken_id = ?
                    ORDER BY date DESC
                    LIMIT 1
                `).bind(chicken.id).all();

                status.last_egg_date = lastEgg.length > 0 ? lastEgg[0].date : null;

                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                const oneDayAgoStr = oneDayAgo.toISOString().split('T')[0];

                const { results: healthConcerns } = await context.env.DB.prepare(`
                    SELECT observation_type, description, date
                    FROM health_observations
                    WHERE chicken_id = ? AND date >= ?
                    ORDER BY date DESC
                    LIMIT 1
                `).bind(chicken.id, oneDayAgoStr).all();

                status.health_concern = healthConcerns.length > 0 ? healthConcerns[0] : null;
            } else {
                status.laid_today = false;
                status.last_egg_date = null;
                status.health_concern = null;
            }

            activeFlock.push(status);
        }

        activeFlock.sort((a, b) => {
            if (a.role_label && !b.role_label) return -1;
            if (!a.role_label && b.role_label) return 1;
            return a.id - b.id;
        });

        const response = {
            activeFlock,
            chickGroup: {
                name: 'The Chicks',
                hatch_summary: 'Three growing chicks, each with her—or his—own look now.',
                milestone: latestChickMilestone,
                summary: 'All three are considerably bigger now, though still a little smaller than Mamma Mia—and they still tuck under her wings whenever they can.',
                lineage_note: 'Rudy and Madame Pompadour are the chicks\' biological parents. Mamma Mia is the acting mom who hatched them and is caring for them.',
                chicks: [
                    {
                        name: 'Peppercorn',
                        avatar: 'Girl #1',
                        label: 'Young pullet',
                        detail: 'Glossy black feathers, a little black Crevecœur-like puffball crest, and no red comb.'
                    },
                    {
                        name: 'Salty',
                        avatar: 'Girl #2',
                        label: 'Young pullet · last to hatch',
                        detail: 'The white-and-yellow girl with a matching little white puffball crest.'
                    },
                    {
                        name: 'Gomez',
                        avatar: 'Gomez',
                        label: 'Young rooster',
                        detail: 'The black slug hunter with a developing red crown and still-subtle wattles. Future rehoming will be needed.'
                    }
                ]
            },
            formerFlock: [
                {
                    name: 'Rudy',
                    caption: RUDY_CAPTION
                }
            ]
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
