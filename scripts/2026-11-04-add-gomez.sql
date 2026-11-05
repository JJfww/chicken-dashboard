-- Adds Gomez as a former flock member so photos can be tagged with him.
-- Run only AFTER the flock-profiles release is live: the previous status.js treats
-- every chicken row except Rudy as active and would show him as a current hen.
-- npx wrangler d1 execute chicken-dashboard-db --remote --file scripts/2026-11-04-add-gomez.sql
INSERT INTO chickens (name, egg_color, status, is_rooster, avatar_url, tagline, departed_date, departure_note, sort_order)
SELECT 'Gomez', 'N/A', 'former', 1, '/images/gomez.png', 'Young cockerel', '2026-07-29',
    'Officially rehomed on July 29, 2026. Gomez is heading to the country to lead his own flock—and he has big work ahead.', 100
WHERE NOT EXISTS (SELECT 1 FROM chickens WHERE name = 'Gomez');

INSERT OR IGNORE INTO photo_chickens (photo_id, chicken_id, source)
SELECT p.id, c.id, 'caption'
FROM photos p
JOIN chickens c ON c.name = 'Gomez'
WHERE p.caption LIKE '%gomez%';
