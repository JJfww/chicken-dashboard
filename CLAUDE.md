# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run locally with Wrangler dev server
npx wrangler pages dev public

# Deploy to Cloudflare Pages
npx wrangler pages deploy

# Access D1 database console locally
npx wrangler d1 execute chicken-dashboard-db --local --command "SELECT * FROM chickens"

# Access D1 database console remotely
npx wrangler d1 execute chicken-dashboard-db --command "SELECT * FROM chickens"
```

## Architecture Overview

This is a Cloudflare Pages application with a vanilla JavaScript frontend and Cloudflare Workers-based API backend. It tracks backyard chicken activities including egg production, feeding, health observations, and photos.

### Tech Stack
- **Frontend**: Vanilla JavaScript (no framework), HTML, CSS
- **Backend**: Cloudflare Pages Functions (Workers)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (for photos)
- **External APIs**: Open-Meteo (weather), OpenRouter (AI chat via Google Gemini 2.5 Flash Lite)

### Key Bindings (wrangler.toml)
- `DB`: D1 database binding for chicken-dashboard-db
- `PHOTOS`: R2 bucket binding for chicken-photos
- `OPENROUTER_API_KEY`: Environment variable for AI chat (set via Cloudflare dashboard)

### Database Schema
The D1 database contains these tables:
- `chickens`: Four chickens (Mamma Mia, Brown Betty, Madame Pompadour, and Rudy the rooster) with egg color info
- `eggs`: Egg production logs linked to chickens
- `feeding`: Feeding activity (treats, scraps)
- `free_range`: Free range time tracking
- `health_observations`: Health notes per chicken or general observations
- `photos`: Photo metadata (actual files stored in R2)
- `weather_logs`: Daily weather data (temp high/low, humidity, wind, precipitation, pressure, conditions, daylight hours)

### API Architecture Pattern
All API endpoints follow Cloudflare Pages Functions conventions:
- Located in `functions/api/`
- Export `onRequestGet()` and/or `onRequestPost()` functions
- Access bindings via `context.env.DB`, `context.env.PHOTOS`, `context.env.OPENROUTER_API_KEY`
- Return `Response` objects with JSON bodies

Example endpoints:
- `/api/eggs` - POST to log eggs, GET to retrieve recent eggs
- `/api/photos` - POST to upload (stores in R2 + DB), GET to list
- `/api/photos/[id]` - Dynamic route to retrieve individual photos from R2
- `/api/chat` - POST to interact with AI assistant (uses gatherContext() to provide recent data)
- `/api/activity` - GET aggregates all activity types sorted by date
- `/api/weather` - GET fetches current weather for Lawrence, KS (66044)

### Frontend Architecture
Single-page app in `public/`:
- `index.html`: Tab-based interface (Eggs, Feeding, Free Range, Health, Photos, Chat, History)
- `app.js`: Event handlers, form submissions, API calls, tab switching
- `style.css`: Mobile-first responsive styles

Frontend uses tab switching without page reloads. The History tab shows aggregated activity feed from all tracking categories.

### AI Chat Context System
The `/api/chat` endpoint gathers recent context before calling OpenRouter:
1. `gatherContext()` queries the last 10-20 records from eggs, feeding, free_range, and health_observations
2. Formats data into a text summary for the system prompt
3. Provides AI with chicken names, egg colors, and recent activity
4. Uses Google Gemini 2.5 Flash Lite model via OpenRouter API

### Photo Storage Flow
1. Frontend uploads photo as FormData to `/api/photos`
2. Backend generates unique filename: `timestamp.extension`
3. Stores file in R2 at `photos/timestamp.extension`
4. Saves metadata (date, filename, r2_key, caption) to D1
5. `/api/photos/[id]` retrieves photo from R2 by looking up r2_key in D1

### Weather Logging System
The app automatically logs daily weather data using a Cloudflare Cron Trigger:
1. **Scheduled Task**: `functions/scheduled.js` runs daily at 11:55pm CST (5:55am UTC)
2. **Activity Check**: Queries all activity tables (eggs, feeding, free_range, health_observations, photos) for today's date
3. **Weather Logging**: If any activity occurred today, fetches weather data from Open-Meteo API and stores in `weather_logs` table
4. **Data Captured**: Temperature high/low (°F), humidity (%), wind max (mph), precipitation (inches), barometric pressure (mb), conditions description, daylight hours
5. **Utility**: `functions/api/_weather-data.js` provides `fetchDailyWeather(date)` function for fetching weather data
6. **One Record Per Day**: The `date` field is UNIQUE, ensuring only one weather record per day

The cron trigger configuration is in `wrangler.toml` under `[triggers]`.

## Important Notes

- The app is specific to four chickens: three hens with hardcoded names and egg colors, plus Rudy the rooster
- Weather is hardcoded to Lawrence, KS coordinates (38.9717°N, 95.2353°W)
- All dates use ISO format (YYYY-MM-DD)
- Frontend is intentionally vanilla JS with no build step
- R2 keys use `photos/` prefix for organization
