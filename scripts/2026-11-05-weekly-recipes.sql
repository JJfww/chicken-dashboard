-- Weekly egg recipe ("Clucky's Kitchen"). One row per week, generated on the
-- first request of the week (Monday start, Central time) or swapped from admin.
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    intro TEXT,
    servings TEXT,
    total_time TEXT,
    eggs_used INTEGER,
    ingredients TEXT NOT NULL, -- JSON array of strings
    steps TEXT NOT NULL,       -- JSON array of strings
    tip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
