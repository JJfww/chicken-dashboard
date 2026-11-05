-- Flock profiles, egg weights, headline notes, photo tags, and generic meters.
-- Additive only: safe to run while the previous site version is live.
-- Run once: npx wrangler d1 execute chicken-dashboard-db --remote --file scripts/2026-11-04-flock-profiles.sql

-- Chicken profile fields (previously hard-coded in functions/api/status.js)
ALTER TABLE chickens ADD COLUMN display_name TEXT;
ALTER TABLE chickens ADD COLUMN role_label TEXT;
ALTER TABLE chickens ADD COLUMN bio TEXT;
ALTER TABLE chickens ADD COLUMN tagline TEXT;
ALTER TABLE chickens ADD COLUMN status TEXT DEFAULT 'active'; -- 'active' or 'former'
ALTER TABLE chickens ADD COLUMN departed_date TEXT;
ALTER TABLE chickens ADD COLUMN departure_note TEXT;
ALTER TABLE chickens ADD COLUMN avatar_url TEXT;
ALTER TABLE chickens ADD COLUMN egg_image_url TEXT;
ALTER TABLE chickens ADD COLUMN hatch_date TEXT;
ALTER TABLE chickens ADD COLUMN sort_order INTEGER DEFAULT 100;
ALTER TABLE chickens ADD COLUMN is_rooster INTEGER DEFAULT 0;

UPDATE chickens SET role_label = 'Biological mom of the chicks', avatar_url = '/images/MadamePompadour26.png',
    egg_image_url = '/images/egg_madame_pompadour.png', sort_order = 1
WHERE id = 3;

UPDATE chickens SET role_label = 'Mom of the chicks', avatar_url = '/images/mamma-mia.png',
    egg_image_url = '/images/egg_mamma_mia.png', sort_order = 2,
    bio = 'Hatched and raised Peppercorn, Salty, and Gomez from Madame Pompadour''s eggs.'
WHERE id = 1;

UPDATE chickens SET avatar_url = '/images/brown-betty.png', egg_image_url = '/images/egg_brown_betty.png', sort_order = 3
WHERE id = 2;

UPDATE chickens SET display_name = 'Vinnie', role_label = 'King (almost) of the Coop', is_rooster = 1,
    avatar_url = '/images/Vinnie.png', sort_order = 0,
    tagline = 'A young cockerel taking his duties seriously as protector and leader of the flock—while he is still developing smoother moves.'
WHERE id = 9;

UPDATE chickens SET role_label = 'Young Layer', avatar_url = '/images/girl-1.png',
    egg_image_url = '/images/egg_peppercorn.png', sort_order = 4,
    bio = 'Glossy black feathers, a little black Crevecœur-like puffball crest, and no red comb.'
WHERE id = 10;

UPDATE chickens SET role_label = 'Presumed Layer', avatar_url = '/images/girl-2.png', sort_order = 5,
    bio = 'White-and-yellow feathers with a matching little white puffball crest. Last to hatch.'
WHERE id = 11;

UPDATE chickens SET status = 'former', is_rooster = 1, avatar_url = '/images/rudy.png',
    tagline = 'Rooster and chick dad', departed_date = '2026-05-31',
    departure_note = 'Part of Hensington Palace from May 2025 to May 2026. Rehomed to a farm on May 31, 2026 for the betterment of him and his hens, and presumably living his best life.'
WHERE id = 4;

-- Optional egg weight, for curious days
ALTER TABLE eggs ADD COLUMN weight_g REAL;

-- Front-page headline notes
ALTER TABLE notes ADD COLUMN is_headline INTEGER DEFAULT 0;

-- Photo tagging
CREATE TABLE IF NOT EXISTS photo_chickens (
    photo_id INTEGER NOT NULL,
    chicken_id INTEGER NOT NULL,
    source TEXT DEFAULT 'manual', -- 'manual' or 'caption' (auto-suggested from caption text)
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (photo_id, chicken_id),
    FOREIGN KEY (photo_id) REFERENCES photos(id),
    FOREIGN KEY (chicken_id) REFERENCES chickens(id)
);
CREATE INDEX IF NOT EXISTS idx_photo_chickens_chicken ON photo_chickens(chicken_id);

INSERT OR IGNORE INTO photo_chickens (photo_id, chicken_id, source)
SELECT p.id, c.id, 'caption'
FROM photos p
JOIN chickens c ON
    (c.id = 1 AND p.caption LIKE '%mamma%')
    OR (c.id = 2 AND p.caption LIKE '%betty%')
    OR (c.id = 3 AND (p.caption LIKE '%pompadour%' OR p.caption LIKE '%pompy%'))
    OR (c.id = 4 AND p.caption LIKE '%rudy%')
    OR (c.id = 9 AND (p.caption LIKE '%vinnie%' OR p.caption LIKE '%velma%'))
    OR (c.id = 10 AND p.caption LIKE '%peppercorn%')
    OR (c.id = 11 AND p.caption LIKE '%salty%');

-- Generic meters (Rudy meter, chick milestones, and any future meter)
CREATE TABLE IF NOT EXISTS meter_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meter TEXT NOT NULL, -- key from functions/api/_meters.js
    date TEXT NOT NULL,
    score INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (meter, date)
);

INSERT OR IGNORE INTO meter_entries (meter, date, score, notes, created_at)
SELECT 'rudy', date,
    CAST(json_extract(substr(content, length('RUDY_METER::') + 1), '$.score') AS INTEGER),
    json_extract(substr(content, length('RUDY_METER::') + 1), '$.notes'),
    created_at
FROM notes
WHERE content LIKE 'RUDY_METER::%' AND json_valid(substr(content, length('RUDY_METER::') + 1))
ORDER BY created_at DESC;

INSERT OR IGNORE INTO meter_entries (meter, date, score, notes, created_at)
SELECT 'chicks', date,
    CAST(json_extract(substr(content, length('CHICK_MILESTONE::') + 1), '$.score') AS INTEGER),
    json_extract(substr(content, length('CHICK_MILESTONE::') + 1), '$.notes'),
    created_at
FROM notes
WHERE content LIKE 'CHICK_MILESTONE::%' AND json_valid(substr(content, length('CHICK_MILESTONE::') + 1))
ORDER BY created_at DESC;

-- Today's "Madame Pompadour is molting" note, logged as a health observation so her card shows it
INSERT INTO health_observations (chicken_id, date, observation_type, description, notes)
SELECT 3, '2026-11-04', 'molting', 'Madame Pompadour is molting', 'Copied from the general note logged the same day.'
WHERE NOT EXISTS (
    SELECT 1 FROM health_observations WHERE chicken_id = 3 AND date = '2026-11-04' AND observation_type = 'molting'
);
