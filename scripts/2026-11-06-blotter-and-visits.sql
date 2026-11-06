-- The Palace Blotter: short police-blotter entries for minor incidents
-- (predators, escapes, egg thefts) that don't need a full dispatch.
CREATE TABLE IF NOT EXISTS blotter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT,
    suspect TEXT,
    description TEXT NOT NULL,
    outcome TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blotter_date ON blotter(date);

-- Raw daily visit counts for the public site (no visitor details stored).
CREATE TABLE IF NOT EXISTS page_visits (
    date TEXT PRIMARY KEY,
    visits INTEGER NOT NULL DEFAULT 0
);
