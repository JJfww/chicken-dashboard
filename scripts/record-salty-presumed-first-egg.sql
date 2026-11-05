-- Jen clarified on October 21, 2026: today's egg is Peppercorn's;
-- yesterday's existing egg is Salty's presumed first. Do not add another egg.
UPDATE eggs
SET chicken_id = 11,
    notes = 'Presumed first egg from Salty, dated October 20, 2026 per Jen. Cream-colored; identification remains preliminary pending an egg from both Salty and Peppercorn on the same day.'
WHERE id = 541 AND chicken_id = 10 AND date = '2026-10-20' AND count = 1;

UPDATE chickens
SET egg_color = 'peachy'
WHERE id = 10 AND name = 'Peppercorn' AND egg_color IN ('warm tan', 'orangish');

UPDATE notes
SET content = 'Salty is a suspected new layer and has been added to the egg tracker provisionally with cream (provisional) eggs. Jen identified October 20, 2026 as Salty''s presumed first egg; the existing egg for that date was reassigned from Peppercorn to Salty with a presumed-identification note. Today''s October 21 egg remains Peppercorn''s. Peppercorn''s current egg color is peachy. Salty''s laying and the color distinction remain preliminary pending an egg from both hens on the same day. Do not treat the presumed identification as confirmed or assign uncertain eggs by color alone.'
WHERE id = 157 AND date = '2026-10-21'
    AND content LIKE 'Salty is a suspected new layer%';
