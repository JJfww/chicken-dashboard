# Hensington Palace

A mobile-friendly app to track your backyard chickens!

## Features

- Track daily egg production by chicken
- Log feeding activities (treats, scraps, etc.)
- Record free range time
- Health observations and notes
- Photo uploads with comments
- Automatic weather data for Lawrence, KS (66044)
- AI chat assistant powered by GPT-4

## The Flock

- **Mamma Mia** - Brown-olive eggs
- **Brown Betty** - Green eggs
- **Madame Pompadour** - Eggshell-colored eggs
- **Velma** - Young pullet
- **Peppercorn** - All-black pullet with a black puffball crest
- **Salty** - White/yellow pullet with a white puffball crest, last to hatch
- **Gomez** - Young black rooster

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Cloudflare Pages Functions
- Database: Cloudflare D1
- Storage: Cloudflare R2
- Weather: Open-Meteo API
- AI: OpenRouter (GPT-4)

## Development

```bash
# Install dependencies
npm install

# Run locally (put secrets in .dev.vars, which is git-ignored)
npx wrangler pages dev public

# Deploy
npx wrangler pages deploy
```

## Project Structure

```
chicken-dashboard/
├── public/           # Frontend files (HTML, CSS, JS)
├── functions/        # Backend API endpoints
│   └── api/         # API routes
├── wrangler.toml    # Cloudflare configuration
└── package.json     # Node dependencies
```

## Secrets

Set these with `npx wrangler pages secret put <NAME>` (or in `.dev.vars` for local development). Never commit them.

- `ADMIN_PASSWORD` - dashboard login, also used to sign session cookies
- `OPENROUTER_API_KEY` - AI chat, poetry, and blog features
- `WEATHER_LOG_TOKEN` - bearer token for the daily weather-logging GitHub Action

## License

[MIT](LICENSE)
