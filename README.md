# Tome

Read web fiction on your e-ink device.

Tome is a web fiction proxy that scrapes content from various sources and presents it in a simplified, e-ink-friendly format optimized for devices like Kindle and Kobo.

## Supported Sources

- **Royal Road** - Western web fiction platform
- *Patreon* - Coming soon
- *Chinese/Korean novel sites* - Planned

## Supported Devices

- Kindle (all models with Experimental Browser)
- Kobo (via built-in browser)
- Other e-ink devices with web browsers

## Features

- **E-ink Optimized** - High contrast, large touch targets, no animations
- **Offline-First** - Aggressive caching for low-bandwidth situations
- **Reader Mode** - Paginated chapter view with tap navigation
- **Session Sync** - Uses your source cookies to sync reading progress
- **Background Caching** - Pre-caches your follows and reading lists
- **Basic Auth** - Protect your instance with username/password

## Requirements

- [Bun](https://bun.sh) runtime (v1.0+)
- Chromium (installed automatically by Playwright)

## Installation

```bash
# Clone the repository
git clone https://github.com/nmessias/tome.git
cd tome

# Install dependencies
bun install

# Install Playwright browsers (first time only)
bunx playwright install chromium
```

## Configuration

Create a `.env` file:

```bash
# Server port (default: 3000)
PORT=3000

# Basic Auth (required for production)
AUTH_USERNAME=your-username
AUTH_PASSWORD=your-password
```

## Usage

```bash
# Start the server
bun run start

# Development mode (with auto-reload)
bun run dev
```

Access Tome from your e-ink device's browser:
```
http://<your-server-ip>:3000
```

## Setup

1. Navigate to `/setup` on Tome
2. Copy your session cookies from your browser:
   - For Royal Road: `.AspNetCore.Identity.Application`
   - Optional: `cf_clearance` (for Cloudflare)
3. Paste them into the setup form
4. Click "Save Cookies"

Your reading progress will now sync with the source.

## Deployment

Tome includes Docker support for easy deployment to Railway, Fly.io, or any Docker host.

### Railway

1. Push to GitHub
2. Create new project on [Railway](https://railway.app)
3. Connect your repo
4. Add environment variables: `AUTH_USERNAME`, `AUTH_PASSWORD`
5. Add a volume mounted at `/app/data`
6. Deploy

See `railway.toml` for configuration.

## Project Structure

```
tome/
├── public/              # Static assets (CSS, JS, fonts)
│   ├── css/
│   ├── fonts/
│   └── js/
├── src/
│   ├── config.ts        # Configuration
│   ├── index.ts         # Entry point
│   ├── server.ts        # HTTP utilities
│   ├── types.ts         # TypeScript types
│   ├── routes/          # Route handlers
│   ├── services/        # Business logic
│   │   ├── cache.ts     # SQLite cache
│   │   ├── jobs.ts      # Background jobs
│   │   └── scraper.ts   # Playwright scraper
│   └── templates/       # HTML templates
├── data/                # SQLite database (created on first run)
├── Dockerfile           # Docker build
└── railway.toml         # Railway config
```

## E-ink Tips

- Use **tap zones** (top/bottom 15%) to toggle the UI
- Use **left/right zones** (40% each side) to navigate pages
- Uses **ES5 JavaScript** for maximum device compatibility
- Consider **desktop mode** in your device's browser for better rendering

## License

MIT License - See [LICENSE](LICENSE) for details.

## Disclaimer

This project is not affiliated with Royal Road, Patreon, or any other content platform. Use responsibly and in accordance with each platform's Terms of Service.
