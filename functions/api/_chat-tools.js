// Tool definitions for AI chat function calling

export const TOOL_DEFINITIONS = [
    {
        type: "function",
        function: {
            name: "get_eggs",
            description: "Query individual egg records for a date range. Returns each egg with date, time, chicken name, egg color, and notes.",
            parameters: {
                type: "object",
                properties: {
                    start_date: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format"
                    },
                    end_date: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format"
                    },
                    chicken_name: {
                        type: "string",
                        description: "Optional: Filter to specific chicken (Mamma Mia, Brown Betty, Madame Pompadour, or Vinnie)"
                    }
                },
                required: ["start_date", "end_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_egg_totals",
            description: "Get aggregated egg counts by chicken for a date range. Use group_by to break down by day, week, or month for tables/trends.",
            parameters: {
                type: "object",
                properties: {
                    start_date: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format"
                    },
                    end_date: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format"
                    },
                    group_by: {
                        type: "string",
                        enum: ["day", "week", "month"],
                        description: "Optional: Group results by day, week, or month for trend analysis"
                    }
                },
                required: ["start_date", "end_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_feeding",
            description: "Query feeding/treat records for a date range. Use group_by to get counts by period.",
            parameters: {
                type: "object",
                properties: {
                    start_date: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format"
                    },
                    end_date: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format"
                    },
                    group_by: {
                        type: "string",
                        enum: ["day", "week", "month"],
                        description: "Optional: Group results by day, week, or month"
                    }
                },
                required: ["start_date", "end_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_free_range",
            description: "Query free range sessions for a date range. Returns session times and durations. Use group_by for totals by period.",
            parameters: {
                type: "object",
                properties: {
                    start_date: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format"
                    },
                    end_date: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format"
                    },
                    group_by: {
                        type: "string",
                        enum: ["day", "week", "month"],
                        description: "Optional: Group results by day, week, or month"
                    }
                },
                required: ["start_date", "end_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_health_observations",
            description: "Query health observation records for a date range. Can filter by specific chicken.",
            parameters: {
                type: "object",
                properties: {
                    start_date: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format"
                    },
                    end_date: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format"
                    },
                    chicken_name: {
                        type: "string",
                        description: "Optional: Filter to specific chicken"
                    }
                },
                required: ["start_date", "end_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_expenses",
            description: "Query expense records (feed, medication, supplies) for a date range. Use group_by for spending trends by period.",
            parameters: {
                type: "object",
                properties: {
                    start_date: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format"
                    },
                    end_date: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format"
                    },
                    category: {
                        type: "string",
                        enum: ["feed", "medication", "supplies", "all"],
                        description: "Optional: Filter to specific expense category (default: all)"
                    },
                    group_by: {
                        type: "string",
                        enum: ["day", "week", "month"],
                        description: "Optional: Group results by day, week, or month"
                    }
                },
                required: ["start_date", "end_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_weather",
            description: "Query weather log data for a date range. Returns temperature, conditions, precipitation.",
            parameters: {
                type: "object",
                properties: {
                    start_date: {
                        type: "string",
                        description: "Start date in YYYY-MM-DD format"
                    },
                    end_date: {
                        type: "string",
                        description: "End date in YYYY-MM-DD format"
                    }
                },
                required: ["start_date", "end_date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_chicken_info",
            description: "Get information about the chickens (names, display names, egg colors, rooster flag, active vs former status, role, bio). Velma's display name is Vinnie. No parameters needed.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    }
];

// Execute a tool call and return results
export async function executeTool(db, toolName, params) {
    switch (toolName) {
        case 'get_eggs':
            return await queryEggs(db, params);
        case 'get_egg_totals':
            return await queryEggTotals(db, params);
        case 'get_feeding':
            return await queryFeeding(db, params);
        case 'get_free_range':
            return await queryFreeRange(db, params);
        case 'get_health_observations':
            return await queryHealthObservations(db, params);
        case 'get_expenses':
            return await queryExpenses(db, params);
        case 'get_weather':
            return await queryWeather(db, params);
        case 'get_chicken_info':
            return await queryChickenInfo(db);
        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}

// Helper: Get the Monday of a given date's week (for week grouping)
function getWeekStart(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
}

// Helper: Get the first of month (for month grouping)
function getMonthStart(dateStr) {
    return dateStr.substring(0, 7); // YYYY-MM
}

// Query: Individual egg records
async function queryEggs(db, params) {
    const { start_date, end_date, chicken_name } = params;

    let query = `
        SELECT e.date, e.time, c.name as chicken_name, c.egg_color, e.notes
        FROM eggs e
        JOIN chickens c ON e.chicken_id = c.id
        WHERE e.date BETWEEN ? AND ?
    `;
    const bindings = [start_date, end_date];

    if (chicken_name) {
        query += ` AND c.name = ?`;
        bindings.push(chicken_name);
    }

    query += ` ORDER BY e.date DESC, e.time DESC`;

    const result = await db.prepare(query).bind(...bindings).all();
    return result.results;
}

// Query: Egg totals with optional grouping
async function queryEggTotals(db, params) {
    const { start_date, end_date, group_by } = params;

    if (!group_by) {
        // Simple totals by chicken
        const result = await db.prepare(`
            SELECT c.name, COUNT(*) as count
            FROM eggs e
            JOIN chickens c ON e.chicken_id = c.id
            WHERE e.date BETWEEN ? AND ?
            GROUP BY c.name
            ORDER BY count DESC
        `).bind(start_date, end_date).all();

        const by_chicken = {};
        let total = 0;
        result.results.forEach(r => {
            by_chicken[r.name] = r.count;
            total += r.count;
        });

        return { by_chicken, total };
    }

    // Grouped totals
    const result = await db.prepare(`
        SELECT e.date, c.name, COUNT(*) as count
        FROM eggs e
        JOIN chickens c ON e.chicken_id = c.id
        WHERE e.date BETWEEN ? AND ?
        GROUP BY e.date, c.name
        ORDER BY e.date
    `).bind(start_date, end_date).all();

    // Aggregate by period
    const by_period = {};
    const totals_by_chicken = {};
    let grand_total = 0;

    result.results.forEach(r => {
        let period;
        if (group_by === 'day') {
            period = r.date;
        } else if (group_by === 'week') {
            period = getWeekStart(r.date);
        } else if (group_by === 'month') {
            period = getMonthStart(r.date);
        }

        if (!by_period[period]) {
            by_period[period] = {};
        }
        by_period[period][r.name] = (by_period[period][r.name] || 0) + r.count;
        totals_by_chicken[r.name] = (totals_by_chicken[r.name] || 0) + r.count;
        grand_total += r.count;
    });

    return { by_period, totals_by_chicken, grand_total };
}

// Query: Feeding records with optional grouping
async function queryFeeding(db, params) {
    const { start_date, end_date, group_by } = params;

    if (!group_by) {
        const result = await db.prepare(`
            SELECT date, time, feed_type, description, notes
            FROM feeding
            WHERE date BETWEEN ? AND ?
            ORDER BY date DESC, time DESC
        `).bind(start_date, end_date).all();

        return result.results;
    }

    // Grouped counts
    const result = await db.prepare(`
        SELECT date, feed_type, COUNT(*) as count
        FROM feeding
        WHERE date BETWEEN ? AND ?
        GROUP BY date, feed_type
        ORDER BY date
    `).bind(start_date, end_date).all();

    const by_period = {};
    let total_count = 0;

    result.results.forEach(r => {
        let period;
        if (group_by === 'day') {
            period = r.date;
        } else if (group_by === 'week') {
            period = getWeekStart(r.date);
        } else if (group_by === 'month') {
            period = getMonthStart(r.date);
        }

        if (!by_period[period]) {
            by_period[period] = { count: 0, types: new Set() };
        }
        by_period[period].count += r.count;
        by_period[period].types.add(r.feed_type);
        total_count += r.count;
    });

    // Convert Sets to arrays
    Object.keys(by_period).forEach(period => {
        by_period[period].types = Array.from(by_period[period].types);
    });

    return { by_period, total_count };
}

// Query: Free range sessions with optional grouping
async function queryFreeRange(db, params) {
    const { start_date, end_date, group_by } = params;

    if (!group_by) {
        const result = await db.prepare(`
            SELECT date, time_start, time_end, duration_minutes, notes
            FROM free_range
            WHERE date BETWEEN ? AND ?
            ORDER BY date DESC, time_start DESC
        `).bind(start_date, end_date).all();

        const total_minutes = result.results.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);

        return { sessions: result.results, total_minutes };
    }

    // Grouped totals
    const result = await db.prepare(`
        SELECT date, COUNT(*) as session_count, SUM(duration_minutes) as total_minutes
        FROM free_range
        WHERE date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date
    `).bind(start_date, end_date).all();

    const by_period = {};
    let total_sessions = 0;
    let total_minutes = 0;

    result.results.forEach(r => {
        let period;
        if (group_by === 'day') {
            period = r.date;
        } else if (group_by === 'week') {
            period = getWeekStart(r.date);
        } else if (group_by === 'month') {
            period = getMonthStart(r.date);
        }

        if (!by_period[period]) {
            by_period[period] = { sessions: 0, total_minutes: 0 };
        }
        by_period[period].sessions += r.session_count;
        by_period[period].total_minutes += r.total_minutes || 0;
        total_sessions += r.session_count;
        total_minutes += r.total_minutes || 0;
    });

    return { by_period, total_sessions, total_minutes };
}

// Query: Health observations
async function queryHealthObservations(db, params) {
    const { start_date, end_date, chicken_name } = params;

    let query = `
        SELECT h.date, c.name as chicken_name, h.observation_type, h.description
        FROM health_observations h
        LEFT JOIN chickens c ON h.chicken_id = c.id
        WHERE h.date BETWEEN ? AND ?
    `;
    const bindings = [start_date, end_date];

    if (chicken_name) {
        query += ` AND c.name = ?`;
        bindings.push(chicken_name);
    }

    query += ` ORDER BY h.date DESC`;

    const result = await db.prepare(query).bind(...bindings).all();
    return result.results;
}

// Query: Expenses with optional grouping
async function queryExpenses(db, params) {
    const { start_date, end_date, category, group_by } = params;
    const cat = category || 'all';

    // Build queries for each category
    const queries = [];

    if (cat === 'all' || cat === 'feed') {
        queries.push({
            category: 'feed',
            query: `SELECT date, item, cost, 'feed' as category FROM feed_purchases WHERE date BETWEEN ? AND ?`,
            bindings: [start_date, end_date]
        });
    }

    if (cat === 'all' || cat === 'medication') {
        queries.push({
            category: 'medication',
            query: `SELECT date, medication_name as item, cost, 'medication' as category FROM medication WHERE date BETWEEN ? AND ?`,
            bindings: [start_date, end_date]
        });
    }

    if (cat === 'all' || cat === 'supplies') {
        queries.push({
            category: 'supplies',
            query: `SELECT date, item, cost, 'supplies' as category FROM supplies WHERE date BETWEEN ? AND ?`,
            bindings: [start_date, end_date]
        });
    }

    // Execute all queries and combine
    const allItems = [];
    for (const q of queries) {
        const result = await db.prepare(q.query).bind(...q.bindings).all();
        allItems.push(...result.results);
    }

    // Sort by date
    allItems.sort((a, b) => b.date.localeCompare(a.date));

    if (!group_by) {
        // Calculate totals by category
        const totals = { feed: 0, medication: 0, supplies: 0 };
        allItems.forEach(item => {
            totals[item.category] += item.cost || 0;
        });
        const grand_total = totals.feed + totals.medication + totals.supplies;

        return { items: allItems, totals, grand_total };
    }

    // Grouped totals
    const by_period = {};
    const totals_by_category = { feed: 0, medication: 0, supplies: 0 };

    allItems.forEach(item => {
        let period;
        if (group_by === 'day') {
            period = item.date;
        } else if (group_by === 'week') {
            period = getWeekStart(item.date);
        } else if (group_by === 'month') {
            period = getMonthStart(item.date);
        }

        if (!by_period[period]) {
            by_period[period] = { feed: 0, medication: 0, supplies: 0, total: 0 };
        }
        by_period[period][item.category] += item.cost || 0;
        by_period[period].total += item.cost || 0;
        totals_by_category[item.category] += item.cost || 0;
    });

    const grand_total = totals_by_category.feed + totals_by_category.medication + totals_by_category.supplies;

    return { by_period, totals_by_category, grand_total };
}

// Query: Weather logs
async function queryWeather(db, params) {
    const { start_date, end_date } = params;

    const result = await db.prepare(`
        SELECT date, temp_high_f, temp_low_f, conditions, precipitation_inches, humidity_percent
        FROM weather_logs
        WHERE date BETWEEN ? AND ?
        ORDER BY date DESC
    `).bind(start_date, end_date).all();

    return result.results;
}

// Query: Chicken info
async function queryChickenInfo(db) {
    const result = await db.prepare(`
        SELECT id, name, COALESCE(display_name, name) AS display_name, egg_color,
            COALESCE(is_rooster, 0) AS is_rooster, COALESCE(status, 'active') AS status,
            role_label, bio, departed_date
        FROM chickens
        ORDER BY COALESCE(status, 'active'), sort_order, id
    `).all();

    return result.results;
}
