-- Confirmed by Jen on October 13, 2026. Safe to re-run without duplicating this entry.
INSERT INTO chickens (name, egg_color)
SELECT 'Peppercorn', 'orangish'
WHERE NOT EXISTS (SELECT 1 FROM chickens WHERE name = 'Peppercorn');

INSERT INTO eggs (chicken_id, date, count, notes, time)
SELECT id, '2026-10-13', 1,
    'Small and sort of orangish. Identified as Peppercorn''s because Jen found her in the nesting box that morning. Laid between 7:00 and 7:35 a.m. Central.',
    NULL
FROM chickens
WHERE name = 'Peppercorn'
    AND NOT EXISTS (
        SELECT 1 FROM eggs
        WHERE chicken_id = chickens.id AND date = '2026-10-13'
    );

INSERT INTO notes (date, content)
SELECT '2026-10-13',
    'Peppercorn is a confirmed egg layer! Her first confirmed egg was small and sort of orangish, identified because Jen found her in the nesting box this morning. Laid between 7:00 and 7:35 a.m. Central. Jen is concerned that future eggs may be difficult to distinguish from Salty''s. Do not assume which hen laid an egg from color alone; Salty''s laying is not yet confirmed.'
WHERE NOT EXISTS (
    SELECT 1 FROM notes
    WHERE date = '2026-10-13' AND content LIKE 'Peppercorn is a confirmed egg layer!%'
);
