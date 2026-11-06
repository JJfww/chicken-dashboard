-- The Eggconomy: stock tickers for the Hensington Stock Eggchange and a
-- weekly AI market report (one row per week, Monday start, Central time).
ALTER TABLE chickens ADD COLUMN ticker TEXT;
UPDATE chickens SET ticker = 'PMPY' WHERE id = 3 AND name = 'Madame Pompadour';
UPDATE chickens SET ticker = 'MMIA' WHERE id = 1 AND name = 'Mamma Mia';
UPDATE chickens SET ticker = 'BBTY' WHERE id = 2 AND name = 'Brown Betty';
UPDATE chickens SET ticker = 'PEPR' WHERE id = 10 AND name = 'Peppercorn';
UPDATE chickens SET ticker = 'SLTY' WHERE id = 11 AND name = 'Salty';

CREATE TABLE IF NOT EXISTS market_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL UNIQUE,
    headline TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Where eggs go after collection. kind: 'eaten', 'given' (given away),
-- 'dogs' (lost to the dogs), or 'stock' (a count of eggs on hand, which
-- resets National Reserves: that count + eggs laid after it - eggs out after it).
CREATE TABLE IF NOT EXISTS egg_outflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    count INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_egg_outflows_date ON egg_outflows(date);
