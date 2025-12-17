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

## Your Flock

- **Mamma Mia** - Brown-olive eggs
- **Brown Betty** - Green eggs
- **Madame Pompadour** - Eggshell-colored eggs
- **Rudy** - Rooster (doesn't lay eggs, but equally important!)

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

# Run locally
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
