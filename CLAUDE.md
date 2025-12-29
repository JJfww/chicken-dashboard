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

This is a Cloudflare Pages application with a vanilla JavaScript frontend and Cloudflare Workers-based API backend. It tracks backyard chicken activities including egg production, feeding, health observations, photos, expenses (feed, medication, supplies), and blog posts.

### Tech Stack
- **Frontend**: Vanilla JavaScript (no framework), HTML, CSS, Marked.js (markdown parsing)
- **Backend**: Cloudflare Pages Functions (Workers)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (for photos)
- **External APIs**: US National Weather Service (weather data), OpenRouter (AI chat and blog generation via Google Gemini models)

### Key Bindings (wrangler.toml)
- `DB`: D1 database binding for chicken-dashboard-db
- `PHOTOS`: R2 bucket binding for chicken-photos
- `OPENROUTER_API_KEY`: Environment variable for AI chat and blog generation (set via Cloudflare dashboard)
- `WEATHER_LOG_TOKEN`: Bearer token for protected weather logging endpoint
- `ADMIN_PASSWORD`: Password for admin dashboard authentication (set via Cloudflare dashboard or `wrangler secret put ADMIN_PASSWORD`)

### Database Schema
The D1 database contains these tables:
- `chickens`: Four chickens (Mamma Mia, Brown Betty, Madame Pompadour, and Rudy the rooster) with egg color info
- `eggs`: Egg production logs linked to chickens
- `feeding`: Feeding activity (treats, scraps)
- `free_range`: Free range time tracking
- `health_observations`: Health notes per chicken or general observations (types: molting, sneezing, behavior, other)
- `photos`: Photo metadata (actual files stored in R2)
- `weather_logs`: Daily weather data (temp high/low, humidity, wind, precipitation, pressure, conditions, daylight hours)
- `feed_purchases`: Feed/food purchase records (date, item, quantity, cost, supplier, notes)
- `medication`: Medication purchases and administration (linked to chickens table via chicken_id)
- `supplies`: General supplies purchases (categories: bedding, equipment, coop-maintenance, other)
- `blog_posts`: Blog entries with `is_auto_generated` flag to distinguish manual vs AI-generated posts

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
- `/api/free-range` - POST to log free range time, GET to retrieve recent records
- `/api/health` - POST to log health observations, GET to retrieve recent observations
- `/api/photos` - POST to upload (stores in R2 + DB), GET to list photos
- `/api/photos/[id]` - Dynamic route to retrieve individual photos from R2

#### Expenses Tracking
- `/api/feed-purchases` - POST to log feed purchases, GET to retrieve recent 50 records
- `/api/medication` - POST to log medication purchases/administration, GET to retrieve records (joined with chicken names)
- `/api/supplies` - POST to log supplies purchases, GET to retrieve recent 50 records

#### Blog System
- `/api/blog` - POST to create blog posts, GET to retrieve posts with pagination
  - Query params: `limit` (default 5), `offset` (default 0)
  - Returns `{ posts, total, hasMore }` for pagination support
- `/api/blog/generate` - POST to auto-generate blog posts using AI
  - Gathers daily activity from eggs, feeding, free_range, health_observations, photos, and weather
  - Uses OpenRouter API with Google Gemini 3 Flash Preview model
  - Returns error if no activity found for specified date
  - Sets `is_auto_generated` flag to 1

#### Status & Aggregation
- `/api/status` - GET current chicken status
  - Whether each hen laid an egg today
  - Last egg date for each chicken
  - Recent health concerns (last 7 days)
  - Rudy's random personality status (28 different emoji + text combinations)
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
| `/api/eggs`, `/api/feeding`, `/api/health`, `/api/free-range` | Public | Protected |
| `/api/photos` | Public | Protected |
| `/api/blog` | Public | Protected |
| `/api/blog/generate` | - | Protected |
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
- **Photos**: Photo upload and gallery
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
  - Shows Rudy's random personality status
  - Auto-refreshes every 60 seconds
  - CSS uses `word-spacing: 100vw` on chicken names to force two-line display for alignment across cards
- **`/blog.html`**: Public blog viewing page
  - Displays blog posts and activity history
  - Navigation to status page and admin dashboard

### Chicken Avatars
Each chicken has an associated avatar image:
- Rudy → `/images/rudy.png`
- Mamma Mia → `/images/mamma-mia.png`
- Brown Betty → `/images/brown-betty.png`
- Madame Pompadour → `/images/madame-pompadour.png`

### Egg Images
Each hen has a specific egg image matching her egg color:
- Mamma Mia → `/images/egg_mamma_mia.png` (brown-olive)
- Brown Betty → `/images/egg_brown_betty.png` (green)
- Madame Pompadour → `/images/egg_madame_pompadour.png` (eggshell)

These are used:
- On the status page as small icons next to egg color text
- Inline in blog posts when mentioning eggs (rendered text-sized via CSS `img[src*="egg_"]`)

### AI Chat Context System
The `/api/chat` endpoint gathers recent context before calling OpenRouter:
1. `gatherContext()` queries the last 10-20 records from eggs, feeding, free_range, health_observations
2. Also queries recent expenses: feed_purchases, medication, supplies (10 records each)
3. Calculates expense summary: total eggs, total spent by category, grand total, and cost per egg
4. Formats data into a text summary for the system prompt
5. Provides AI with chicken names, egg colors, recent activity, and financial data
6. Uses Google Gemini model via OpenRouter API

### Blog Generation System
The `/api/blog/generate` endpoint creates AI-generated blog posts:
1. Accepts a date parameter (defaults to today)
2. Gathers all activity for that date: eggs (with time and egg color), feeding (with time), free_range, health_observations, photos
3. Fetches weather data for the date from weather_logs table
4. Compiles activity into a detailed context summary including logged times
5. Sends to OpenRouter API with Google Gemini 3 Flash Preview model (temperature 0.9 for creativity)
6. AI generates a blog title and markdown-formatted content
7. If photos exist for the date, randomly selects one and prepends it as a markdown image
8. Stores in `blog_posts` table with `is_auto_generated=1` flag
9. Returns error if no activity found for the date

The public blog is branded as "The Clucking Times" - the official publication covering Hensington Palace. The AI blogger persona "Clucky" is the royal correspondent filing dispatches:
- Writes in first person as a reporter narrating the flock's day at Hensington Palace
- Uses chicken puns sparingly (one or two per post)
- Converts free range minutes to hours when > 60 minutes
- **CRITICAL: Only writes about activities actually in the data - never invents hen activities**
- **Uses logged times** from the data - does not make up times of day
- **Uses hen-specific egg images inline** with markdown syntax (e.g., `![egg](/images/egg_brown_betty.png)`) - these render text-sized in the blog
- **Always mentions egg color** when describing a hen's egg (e.g., "Brown Betty's gorgeous green egg")
- Post length scales with data volume (75-150 words for light days, 150-250 for busy days)
- Rudy anecdotes are optional (roughly 1 in 3 posts) - crowing between 5:30-7:30am, chasing squirrels/robins/doves/rabbits, being "randy", watching over his flock
- Ends with: "Reporting live from Hensington Palace, this is Clucky for The Clucking Times."
- **Sunday posts include a "Week in Review"** with egg totals by chicken, total free range hours, treat count, and any health notes

### Photo Storage Flow
1. Frontend uploads photo as FormData to `/api/photos`
2. Upload button shows "Uploading..." and is disabled to prevent double-submissions
3. Backend generates unique filename: `timestamp.extension`
4. Stores file in R2 at `photos/timestamp.extension`
5. Saves metadata (date, filename, r2_key, caption) to D1
6. `/api/photos/[id]` retrieves photo from R2 by looking up r2_key in D1

### Weather Logging System
The app automatically logs daily weather data using a Cloudflare Cron Trigger:
1. **Scheduled Task**: `functions/scheduled.js` runs daily at 11:55pm CST (5:55am UTC)
2. **Activity Check**: Queries all activity tables (eggs, feeding, free_range, health_observations, photos) for today's date
3. **Weather Logging**: If any activity occurred today, fetches weather data from NWS API and stores in `weather_logs` table
4. **Data Captured**: Temperature high/low (°F), humidity (%), wind max (mph), precipitation (inches), barometric pressure (inHg), conditions description, daylight hours
5. **Utility**: `functions/api/_weather-data.js` provides `fetchDailyWeather(date)` function for fetching NWS weather data
6. **One Record Per Day**: The `date` field is UNIQUE, ensuring only one weather record per day
7. **API Source**: US National Weather Service (api.weather.gov) - no API key required

The cron trigger configuration is in `wrangler.toml` under `[triggers]`.

### Expenses Tracking System
Three expense categories are tracked:
1. **Feed Purchases**: Feed/food items with quantity, cost, and supplier
2. **Medication**: Medication name, optional chicken association, quantity, cost, and purpose
3. **Supplies**: General supplies with optional category (bedding, equipment, coop-maintenance, other)

The Expenses tab aggregates totals from all three categories and displays a unified expense list. A floating action button (FAB) provides quick access to log any expense type via modal forms.

## Important Notes

- The app is specific to four chickens: three hens with hardcoded names and egg colors, plus Rudy the rooster
- Rudy has 28 different random personality statuses that appear on the status page and cycle randomly on each page refresh
- Weather is hardcoded to Lawrence, KS coordinates (38.9717°N, 95.2353°W)
- All dates use ISO format (YYYY-MM-DD)
- Frontend is intentionally vanilla JS with no build step
- R2 keys use `photos/` prefix for organization
- Chicken avatars are stored at `/images/[chicken-name].png` (e.g., `/images/rudy.png`)
- Blog posts support markdown rendering via Marked.js library
- The `/api/weather-log` endpoint requires Bearer token authentication for security
- Weather data comes from the US National Weather Service API (requires User-Agent header with contact email)
- Admin dashboard requires `ADMIN_PASSWORD` environment variable to be set in Cloudflare
- Session cookies are signed using HMAC-SHA256 with the admin password as the secret
- All POST endpoints (except login/logout) require valid session authentication
