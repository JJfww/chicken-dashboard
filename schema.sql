-- Chickens table: stores information about each chicken
CREATE TABLE IF NOT EXISTS chickens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    egg_color TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Eggs table: tracks daily egg production
CREATE TABLE IF NOT EXISTS eggs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chicken_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chicken_id) REFERENCES chickens(id)
);

-- Feeding table: tracks treats and scraps
CREATE TABLE IF NOT EXISTS feeding (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    feed_type TEXT NOT NULL, -- 'treat' or 'scrap'
    description TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Free range table: tracks free range sessions
CREATE TABLE IF NOT EXISTS free_range (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Health observations table: tracks health notes
CREATE TABLE IF NOT EXISTS health_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chicken_id INTEGER,
    date TEXT NOT NULL,
    observation_type TEXT NOT NULL, -- 'molting', 'sneezing', 'behavior', 'other'
    description TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chicken_id) REFERENCES chickens(id)
);

-- Photos table: tracks uploaded photos
CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    filename TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    caption TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Weather logs table: tracks daily weather data
CREATE TABLE IF NOT EXISTS weather_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    temp_high_f REAL NOT NULL,
    temp_low_f REAL NOT NULL,
    humidity INTEGER NOT NULL,
    wind_max_mph REAL NOT NULL,
    precipitation_inches REAL NOT NULL,
    pressure_mb REAL NOT NULL,
    conditions TEXT NOT NULL,
    daylight_hours REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Feed purchases table: tracks feed/food purchases
CREATE TABLE IF NOT EXISTS feed_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    item TEXT NOT NULL,
    quantity TEXT,
    cost REAL NOT NULL,
    supplier TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Medication table: tracks medication purchases and administration
CREATE TABLE IF NOT EXISTS medication (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    medication_name TEXT NOT NULL,
    chicken_id INTEGER,
    quantity TEXT,
    cost REAL NOT NULL,
    purpose TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chicken_id) REFERENCES chickens(id)
);

-- Supplies table: tracks general supplies purchases
CREATE TABLE IF NOT EXISTS supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    item TEXT NOT NULL,
    cost REAL NOT NULL,
    category TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Insert the chickens
INSERT INTO chickens (name, egg_color) VALUES
    ('Mamma Mia', 'brown-olive'),
    ('Brown Betty', 'green'),
    ('Madame Pompadour', 'eggshell'),
    ('Rudy', 'N/A');
