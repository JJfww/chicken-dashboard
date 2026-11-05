-- Jen confirmed on November 4, 2026: Salty is laying. Her eggs are a lighter
-- peach than Peppercorn's; she has laid two double yolks and some odd shapes.
UPDATE chickens
SET egg_color = 'light peach',
    role_label = 'Young Layer',
    bio = 'White-and-yellow feathers with a matching little white puffball crest. Last to hatch. Her early eggs have included two double yolks and some wonderfully odd shapes.'
WHERE id = 11 AND name = 'Salty';

UPDATE eggs
SET notes = 'First egg from Salty, dated October 20, 2026 per Jen.'
WHERE id = 541 AND chicken_id = 11 AND notes LIKE 'Presumed first egg from Salty%';
