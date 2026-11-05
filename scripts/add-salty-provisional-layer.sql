-- Jen's preliminary identification on October 21, 2026.
-- Safe to re-run. This adds a logging option, not a dated egg record.
INSERT INTO chickens (name, egg_color)
SELECT 'Salty', 'cream (provisional)'
WHERE NOT EXISTS (SELECT 1 FROM chickens WHERE name = 'Salty');

UPDATE chickens
SET egg_color = 'warm tan'
WHERE id = 10 AND name = 'Peppercorn' AND egg_color = 'orangish';

INSERT INTO notes (date, content)
SELECT '2026-10-21',
    'Salty is a suspected new layer and has been added to the egg tracker provisionally. In Jen''s comparison photo, the bottom-left two eggs are tentatively attributed to Salty and described as cream; the other eggs are Peppercorn''s and described as warm tan, replacing her current orangish color label. Salty''s laying and the color distinction are preliminary. Jen hopes to collect an egg from both hens on the same day to verify. Do not treat Salty as a confirmed layer or assign uncertain eggs by color alone. No laying dates were supplied for the pictured eggs, so no egg records were added or reassigned.'
WHERE NOT EXISTS (
    SELECT 1 FROM notes
    WHERE date = '2026-10-21'
        AND content LIKE 'Salty is a suspected new layer and has been added to the egg tracker provisionally.%'
);
