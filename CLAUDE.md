# CLAUDE.md

**This project uses production deployments. Commands that affect data should target production unless the user says 'local' or 'development'.**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Database Operations

When running database commands or migrations, ALWAYS use the `--remote` flag to target the production database unless explicitly told otherwise. Never run database operations locally by default.

## Debugging Guidelines

Before concluding that a feature 'isn't deployed' or 'isn't working', first ask the user to confirm - they may have context about previous deployments that contradicts your analysis.

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

This is a Cloudflare Pages application with a vanilla JavaScript frontend and Cloudflare Workers-based API backend. It tracks backyard chicken activities including egg production, feeding, health observations, photos/videos, expenses (feed, medication, supplies), and blog posts.

### Tech Stack
- **Frontend**: Vanilla JavaScript (no framework), HTML, CSS, Marked.js (markdown parsing)
- **Backend**: Cloudflare Pages Functions (Workers)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (for photos and videos)
- **External APIs**: US National Weather Service (weather data), OpenRouter (AI chat and blog generation via Google Gemini models)

### Key Bindings (wrangler.toml)
- `DB`: D1 database binding for chicken-dashboard-db
- `PHOTOS`: R2 bucket binding for chicken-photos
- `OPENROUTER_API_KEY`: Environment variable for AI chat and blog generation (set via Cloudflare dashboard)
- `WEATHER_LOG_TOKEN`: Bearer token for protected weather logging endpoint
- `ADMIN_PASSWORD`: Password for admin dashboard authentication (set via Cloudflare dashboard or `wrangler secret put ADMIN_PASSWORD`)

### Database Schema
The D1 database contains these tables:
- `chickens`: Chicken records plus public profile fields (`display_name`, `role_label`, `bio`, `tagline`, `status` active/former, `departed_date`, `departure_note`, `avatar_url`, `egg_image_url`, `hatch_date`, `sort_order`, `is_rooster`). Edited from the admin **Flock** tab; the public site reads everything from here (no hard-coded flock data). Velma's display name is Vinnie. An egg color containing "(provisional)" renders as an "unconfirmed" badge.
- `eggs`: Egg production logs linked to chickens (optional `time`, optional `weight_g`)
- `feeding`: Feeding activity (treats, scraps)
- `free_range`: Free range time tracking (time_start, time_end, duration_minutes - all nullable for partial entries, duration calculated automatically when both times present, displayed as H:MM)
- `health_observations`: Health notes per chicken or general observations (types: molting, sneezing, behavior, other)
- `photos`: Photo and video metadata (actual files stored in R2, media_type column distinguishes 'photo' vs 'video')
- `weather_logs`: Daily weather data (temp high/low, humidity, wind, precipitation, pressure, conditions, daylight hours)
- `feed_purchases`: Feed/food purchase records (date, item, quantity, cost, supplier, notes)
- `medication`: Medication purchases and administration (linked to chickens table via chicken_id)
- `supplies`: General supplies purchases (categories: bedding, equipment, coop-maintenance, other)
- `blog_posts`: Blog entries with `is_auto_generated` flag to distinguish manual vs AI-generated posts
- `notes`: General daily notes (date, content, `is_headline` — a headline note shows as a front-page banner for 2 days: its date and the day after)
- `photo_chickens`: Photo tags (photo_id, chicken_id, source 'manual' or 'caption' for tags auto-suggested from captions)
- `blotter`: The Palace Blotter, short incident reports (date, optional time, suspect, description, outcome such as 'Fled the scene' or 'Apprehended'); filed from the admin Log tab and included in that day's dispatch
- `page_visits`: Raw daily visit counts for the public site (date, visits); no visitor details are stored
- `egg_outflows`: Where eggs went (date, kind `eaten`/`given`/`dogs`, count, notes), plus `stock` rows that record eggs on hand. National Reserves = latest stock count + eggs laid after that day − eggs out logged after the count. Logged from the admin Log tab (Eggs Out card)
- `market_reports`: Weekly Eggconomy market report (one row per `week_start`, which holds the Friday it was published; covers the seven days before it, Friday-Thursday). Hens' stock symbols live in `chickens.ticker`
- `recipes`: Weekly egg recipe for "Clucky's Kitchen" (one row per `week_start`, Monday, Central time; `ingredients`/`steps` are JSON arrays)
- `meter_entries`: Generic daily meters (meter key, date, score 0-5, notes). Meter definitions live in `functions/api/_meters.js` (Rudy meter and chick milestones are retired; set `active: true` on a new meter to show its form in admin). Older meter entries were stored as `RUDY_METER::`/`CHICK_MILESTONE::` prefixed notes; those rows remain but are filtered out of notes everywhere.

Schema changes are applied with SQL scripts in `scripts/` (e.g. `scripts/2026-11-04-flock-profiles.sql`); `schema.sql` is the original baseline only.

### API Architecture Pattern
All API endpoints follow Cloudflare Pages Functions conventions:
- Located in `functions/api/`
- Export `onRequestGet()` and/or `onRequestPost()` functions
- Access bindings via `context.env.DB`, `context.env.PHOTOS`, `context.env.OPENROUTER_API_KEY`, `context.env.WEATHER_LOG_TOKEN`
- Return `Response` objects with JSON bodies

### API Endpoints

#### Core Activity Tracking
- `/api/eggs` - POST to log eggs, GET to retrieve recent eggs
- `/api/feeding` - POST to log feeding, GET to retrieve recent feeding records
- `/api/free-range` - POST to log free range time, GET to retrieve recent records with H:MM formatted duration
  - Supports partial entries: submit start time only when chickens go out, end time only to complete the session
  - Start time only: creates incomplete record (time_end and duration_minutes NULL)
  - End time only: finds today's incomplete record and completes it with calculated duration
  - Both times: creates complete record with calculated duration
- `/api/health` - POST to log health observations, GET to retrieve recent observations
- `/api/photos` - POST to upload photos or videos (stores in R2 + DB; optional `chicken_ids` comma list tags it), GET to list media with `media_type` and `chickens` tags. Query params: `limit` (max 100), `offset`, `chicken=ID`, `untagged=1`
- `/api/photos/[id]` - GET retrieves the photo/video from R2; POST `{ chicken_ids, caption }` (protected) updates tags/caption
- `/api/notes` - POST to log general notes (`is_headline` optional; `{ id, is_headline }` toggles an existing note), GET to retrieve recent 50 notes
- `/api/chickens` - GET chicken profiles (`?status=active|former`), POST to update a profile (`{ id, ...fields }`) or add a chicken (no id)
- `/api/stats` - GET egg totals (today, 7-day, prior 7-day, all-time), per-hen streaks/30-day counts/weights, 6-month daily heatmap, 26 weekly egg totals with computed daylight hours, cost per egg, current headline, the current egg carton (eggs since the last full dozen), daily free-range minutes with that day's weather (`outdoors`), and photo counts per chicken. `?chicken=ID` scopes to one hen.
- `/api/meters` - GET meter definitions, `?meter=key` for entries; POST `{ meter, date, score, notes }` (protected). `/api/rudy-meter` and `/api/chick-milestone` are legacy wrappers.

- `/api/recipe` - GET this week's recipe (written by AI on the first request of the week from last week's egg count, the season, and past titles to avoid repeats), `?week=YYYY-MM-DD` for a past week, `?archive=1` for the list; POST (protected) swaps this week's recipe for a new one (admin Blog tab)

- `/api/blotter` - GET `{ entries, report }` (report = this year's incidents, arrests, and active flock as "unconcerned residents"); POST (protected) adds an entry, `{ id, delete: true }` removes one
- `/api/visits` - GET `{ total, today, since }`; POST counts a visit (skipped for logged-in admin sessions). The public page posts at most once per browser per day and never from a browser that has opened admin or visited `/blog.html?notme`

- `/api/egg-outflows` - GET recent eggs-out entries and stock counts; POST (protected) `{ date, kind, count, notes }` adds one, `{ id, delete: true }` removes one
- `/api/eggconomy` - GET satirical economic indicators from real egg counts (GDP = eggs in the last 7 days, eggflation = % change vs the prior 7 days, eggployment = share of layers who laid, productivity = eggs per hen, volatility, national reserves, domestic consumption/exports/write-offs from `egg_outflows`, trade deficit), the Hensington Stock Eggchange (per-hen 7-day output and change, ratings BUY/HOLD/WATCH/NEW LISTING/TRADING HALTED for molting/UNDER INVESTIGATION/DORMANT), and the weekly AI market report (written on the first request on or after Friday)

#### Expenses Tracking
- `/api/feed-purchases` - POST to log feed purchases, GET to retrieve recent 50 records
- `/api/medication` - POST to log medication purchases/administration, GET to retrieve records (joined with chicken names)
- `/api/supplies` - POST to log supplies purchases, GET to retrieve recent 50 records

#### Blog System
- `/api/blog` - POST to create blog posts, GET to retrieve posts with pagination
  - Query params: `limit` (default 5), `offset` (default 0)
  - Returns `{ posts, total, hasMore }` for pagination support
- `/api/blog/generate` - POST to auto-generate blog posts using AI
  - Gathers daily activity from eggs, feeding, free_range, health_observations, photos, notes, and weather
  - Uses OpenRouter API with Google Gemini 3 Flash Preview model
  - Returns error if no activity found for specified date
  - Sets `is_auto_generated` flag to 1
- `/api/blog/scheduled` - POST `?date=YYYY-MM-DD` (Bearer `SCHEDULER_TOKEN` or `WEATHER_LOG_TOKEN`) publishes an automatic edition: Wednesday = midweek edition (Monday-Wednesday), Sunday = Sunday edition (Thursday-Sunday plus a Week in Review of Monday-Sunday). Skips dates that already have a post. Called by the `chicken-scheduler` Worker
- `/api/blog` POST `{ id, delete: true }` removes a post (Delete button in the admin Blog tab)
- `/api/blog/rss` - GET returns RSS 2.0 XML feed of the 20 most recent blog posts
  - Public endpoint (no auth required)
  - Content-Type: `application/rss+xml`
  - Auto-discoverable via `<link>` tag in blog.html

#### Status & Aggregation
- `/api/status` - GET current chicken status
  - Whether each hen laid an egg today
  - Last egg date for each chicken
  - Recent health concerns (last 7 days)
- `/api/activity` - GET aggregates all activity types sorted by date

#### Weather
- `/api/weather` - GET fetches current weather for Lawrence, KS using NWS API
- `/api/weather-log` - POST endpoint for logging daily weather (requires Bearer token authentication via `WEATHER_LOG_TOKEN`)
  - Accepts optional `?date=YYYY-MM-DD` query parameter
  - Checks if weather already logged for date
  - Checks if any activity occurred that day before logging
  - Uses `fetchDailyWeather()` from `_weather-data.js`

#### AI Chat
- `/api/chat` - POST to interact with AI assistant (protected)
  - Uses `gatherContext()` to provide recent activity data
  - Includes chicken names, egg colors, and recent records from multiple tables

#### Authentication
- `/api/login` - POST with `{ password }` to authenticate, sets session cookie
- `/api/logout` - POST to clear session cookie
- `/api/auth-check` - GET to check if current session is valid, returns `{ authenticated: boolean }`

### Authentication System
The admin dashboard uses session-based cookie authentication:

#### How It Works
1. User visits `/admin.html` → redirected to `/login.html` if not authenticated
2. User enters password → validated against `ADMIN_PASSWORD` environment variable
3. Server creates signed session token (HMAC-SHA256) with 24-hour expiry
4. Token stored in httpOnly, Secure, SameSite=Strict cookie
5. All protected API endpoints validate session cookie before processing

#### Auth Middleware
- `functions/api/_auth.js` - Shared authentication utilities
  - `createSession(env)` - Creates signed session token
  - `requireSession(request, env)` - Middleware that returns 401 if not authenticated
  - `isAuthenticated(request, env)` - Returns boolean for auth status

#### Protected vs Public Endpoints
| Endpoint | GET | POST |
|----------|-----|------|
| `/api/eggs`, `/api/feeding`, `/api/health`, `/api/free-range`, `/api/notes` | Public | Protected |
| `/api/photos` | Public | Protected |
| `/api/blog` | Public | Protected |
| `/api/blog/generate` | - | Protected |
| `/api/blog/rss` | Public | - |
| `/api/chat` | - | Protected |
| `/api/feed-purchases`, `/api/medication`, `/api/supplies` | Public | Protected |
| `/api/status`, `/api/activity`, `/api/weather` | Public | - |

#### Protected Pages
- `/admin.html` - Requires authentication, redirects to login if not authenticated
- `/login.html` - Login page with password form

#### Public Pages (no auth required)
- `/` - Landing page
- `/blog.html` - Public blog
- `/status.html` - Public chicken status

### Frontend Architecture

#### Admin Interface
- `admin.html`: Protected admin dashboard (requires login)
- `login.html`: Login page with password authentication

Tab-based interface:
- **Log**: Consolidated interface for Eggs, Feeding, Free Range, and Health Observations
- **Photos**: Photo and video upload and gallery
- **Expenses**: Expense tracking summary with floating action button (FAB) for quick logging
  - Displays three expense cards: Feed Purchases, Medication, Supplies
  - FAB menu with options: Feed (🌾), Medication (💊), Supplies (🛠️)
  - Modal forms for each expense type
- **Blog**: Blog post creation and viewing
  - Manual entry form (date, title optional, content)
  - "Auto-Generate" button for AI-generated posts
  - Activity feed display of blog posts
- **AI Chat**: Chat interface with AI assistant
- **History**: Aggregated activity feed from all tracking categories

Main JavaScript files:
- `app.js`: Event handlers, form submissions, API calls, tab switching (916 lines)
- `blog.js`: Separate module for public blog pages
- `style.css`: Mobile-first responsive styles

Frontend uses tab switching without page reloads and Marked.js (v11.1.1) for markdown parsing in blog posts.

#### Public Pages
- **`/` (index.html in root)**: Landing page with links to status, blog, and admin dashboard
- **`/status.html`**: Public chicken status page
  - Displays chicken cards with avatars from `/images/[chicken-name].png`
  - Shows if each hen laid an egg today
  - Shows last egg date with relative time (Today, Yesterday, X days ago)
  - Shows recent health concerns with warning styling
  - Auto-refreshes every 60 seconds
  - CSS uses `word-spacing: 100vw` on chicken names to force two-line display for alignment across cards
- **`/blog.html`**: The main public site (`/` redirects here), loaded via `status-page-vN.js` → `blog.js` cache-busting redirects in `_redirects`
  - Hash-routed tabs: `#today` (headline banner, latest dispatch, stat tiles, egg carton, recipe teaser, Palace Security Report, photo strip, flock cards, egg calendar), `#blog` (Palace Blotter, then dispatches), `#photos` (gallery with per-chicken filter + lightbox), `#eggconomy` (indicators, stock exchange, weekly market report), `#recipes` (this week's recipe and archive; `#recipes/<week_start>` for a past one), `#flock` (profiles, egg leaderboard, cost per egg, camera favorites, eggs-vs-daylight chart, time-outside-vs-weather chart with weekends highlighted, flock history), `#history`, `#poetry`
  - `#hen/<id>` opens a chicken profile: bio, stats, personal egg calendar, tagged photos
  - Old `#status` links land on `#today`

### Chicken Avatars and Egg Images
Avatar and egg image paths are stored per chicken (`chickens.avatar_url`, `chickens.egg_image_url`) and edited in the admin Flock tab. `/images/3Chicks.png` is the "Remember when" image of Peppercorn, Salty, and Gomez as chicks. (`public/status.html` is a legacy standalone page that still has its own hard-coded avatar map.)

These are used:
- On the status page as small icons next to egg color text
- Inline in blog posts when mentioning eggs (rendered text-sized via CSS `img[src*="egg_"]`)

### AI Chat Tool Calling System
The `/api/chat` endpoint uses Gemini function calling to query the database on demand:

**How it works:**
1. User asks a question
2. AI receives tool definitions and decides which queries to run
3. Backend executes tool calls against D1 database
4. Results returned to AI, which formulates a response with real data
5. Loop continues until AI provides final answer (max 5 iterations)

**Available tools:**
- `get_eggs` - Individual egg records with optional chicken filter
- `get_egg_totals` - Aggregated egg counts, supports `group_by` (day/week/month)
- `get_feeding` - Feeding records, supports `group_by`
- `get_free_range` - Free range sessions, supports `group_by`
- `get_health_observations` - Health records with optional chicken filter
- `get_expenses` - Expenses across all categories, supports `group_by` and category filter
- `get_weather` - Weather log data
- `get_chicken_info` - Static chicken information

**Features:**
- `group_by` parameter enables tabular data (e.g., eggs by chicken per week)
- AI formats results as markdown tables when appropriate
- All queries are read-only with parameterized SQL
- Uses Google Gemini 2.0 Flash model via OpenRouter API

### Blog Generation System
The `/api/blog/generate` endpoint creates AI-generated blog posts:
1. Accepts a date parameter (defaults to today)
2. Gathers all activity for that date: eggs (with time and egg color), feeding (with time), free_range, health_observations, photos/videos (with media type labels)
3. Fetches weather data for the date from weather_logs table
4. Compiles activity into a detailed context summary including logged times
5. Sends to OpenRouter API with Google Gemini 3 Flash Preview model (temperature 0.9 for creativity)
6. AI generates a blog title and markdown-formatted content
7. If media exists for the date, randomly selects one and prepends it (photos as markdown image, videos as HTML video element)
8. Stores in `blog_posts` table with `is_auto_generated=1` flag
9. Returns error if no activity found for the date

The public blog is branded as "The Clucking Times" - the official publication covering Hensington Palace. The AI blogger persona "Clucky" is the royal correspondent filing dispatches:
- Writes in first person as a reporter narrating the flock's day at Hensington Palace
- Uses chicken puns sparingly (one or two per post)
- Converts free range minutes to hours when > 60 minutes
- **CRITICAL: Only writes about activities actually in the data - never invents hen activities**
- **Uses logged times** from the data - does not make up times of day
- **Uses hen-specific egg images inline** with markdown syntax (e.g., `![egg](/images/egg_brown_betty.png)`) - these render text-sized in the blog and show the egg color visually. The list of images comes from `chickens.egg_image_url` for active chickens, so a new layer only needs her image set in the Flock tab
- **Does NOT mention egg color in text** - the hen-specific egg image conveys the color (e.g., "Brown Betty gifted us a lovely ![egg](/images/egg_brown_betty.png)")
- Post length scales with data volume (75-150 words for light days, 150-250 for busy days)
- Ends with: "Reporting live from Hensington Palace, this is Clucky for The Clucking Times."
- **Sunday posts include a "Week in Review"** with egg totals by chicken, total free range hours, treat count, and any health notes

### Photo/Video Storage Flow
1. Frontend uploads photo or video as FormData to `/api/photos`
2. Upload button shows "Uploading..." and is disabled to prevent double-submissions
3. Backend detects media type from MIME type (video/* = 'video', else 'photo')
4. Backend generates unique filename: `timestamp.extension`
5. Stores file in R2 at `photos/timestamp.extension`
6. Saves metadata (date, filename, r2_key, caption, media_type) to D1
7. `/api/photos/[id]` retrieves photo/video from R2 by looking up r2_key in D1

### Weather Logging System
The app automatically logs daily weather data via a GitHub Actions cron workflow:
1. **Scheduled Task**: `.github/workflows/daily-weather.yml` runs each morning at 12:00 UTC and logs the *previous* day (GitHub delays scheduled runs by hours, so a late-night run used to slip past midnight and skip every day as "no_activity")
2. **Mechanism**: Calls `POST /api/weather-log?date=<yesterday in America/Chicago>` with Bearer token authentication
3. **Activity Check**: The endpoint queries all activity tables (eggs, feeding, free_range, health_observations, photos) for that date
4. **Weather Logging**: If any activity occurred that day, fetches weather data from NWS API and stores in `weather_logs` table
5. **Data Captured**: Temperature high/low (°F), humidity (%), wind max (mph), precipitation (inches), barometric pressure (inHg), conditions description, daylight hours
6. **Utility**: `functions/api/_weather-data.js` provides `fetchDailyWeather(date)` function for fetching NWS weather data
7. **One Record Per Day**: The `date` field is UNIQUE, ensuring only one weather record per day
8. **API Source**: US National Weather Service (api.weather.gov) - no API key required
9. **Backfill**: `scripts/backfill-weather.js` uses the Open-Meteo archive API to backfill historical gaps

The `WEATHER_LOG_TOKEN` secret must be set in both Cloudflare (environment variable) and GitHub (repository secret).

### Automatic Publishing Schedule
The `chicken-scheduler` Cloudflare Worker (`scheduler/`, deploy with `npx wrangler deploy` from that folder) calls the site on cron triggers. GitHub scheduled workflows started 6-8 hours late, so they are not used for timing. Times Central (each job has a CDT and a CST trigger; the Worker acts only on the one that lands on the intended hour):
- **Sunday 9:30 PM**: Sunday edition of the blog (Thursday-Sunday + Week in Review)
- **Monday 6 AM**: requests `/api/recipe` so the week's recipe is written
- **Wednesday 9:30 PM**: midweek edition of the blog (Monday-Wednesday)
- **Friday 6 AM**: requests `/api/eggconomy` so the market report is written
The Worker authenticates to `/api/blog/scheduled` with the `SCHEDULER_TOKEN` secret, set on both the Worker and the Pages project. Daily logs (eggs, blotter, photos, notes) update the site live. The admin Auto-Generate button still drafts a single-day post for review. To post a missed edition, run the `scheduled-updates.yml` workflow by hand with a date (it uses `WEATHER_LOG_TOKEN`).

### Expenses Tracking System
Three expense categories are tracked:
1. **Feed Purchases**: Feed/food items with quantity, cost, and supplier
2. **Medication**: Medication name, optional chicken association, quantity, cost, and purpose
3. **Supplies**: General supplies with optional category (bedding, equipment, coop-maintenance, other)

The Expenses tab aggregates totals from all three categories and displays a unified expense list. A floating action button (FAB) provides quick access to log any expense type via modal forms.

## Important Notes

- The app is specific to the current flock and chicks, with some historical records still present in the database
- Weather is hardcoded to Lawrence, KS coordinates (38.9717°N, 95.2353°W)
- All dates use ISO format (YYYY-MM-DD)
- Frontend is intentionally vanilla JS with no build step
- R2 keys use `photos/` prefix for organization
- Chicken avatars are stored at `/images/[chicken-name].png`
- Blog posts support markdown rendering via Marked.js library
- The `/api/weather-log` endpoint requires Bearer token authentication for security
- Weather data comes from the US National Weather Service API (requires User-Agent header with contact email)
- Admin dashboard requires `ADMIN_PASSWORD` environment variable to be set in Cloudflare
- Session cookies are signed using HMAC-SHA256 with the admin password as the secret
- All POST endpoints (except login/logout) require valid session authentication
