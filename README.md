# Awin Advertisers

A minimal, modern Next.js app that connects to the [Awin](https://www.awin.com/) API and displays the advertisers (merchants/stores) your **publisher** account has joined.

Built with **Next.js (App Router)**, **TypeScript**, and **Tailwind CSS**. Awin credentials stay server-side; the browser only ever talks to your own API routes.

---

## Features

- 🔒 Server-side Awin integration — API token and Publisher ID never reach the client
- 🔐 Admin login — simple username/password authentication with signed JWT session cookies
- 🗂️ `/api/advertisers` route returns normalised advertiser data (id, name, logo, status, commission, region…)
- 🔎 Search + filter by name, region, and status (joined / pending)
- 💅 Clean, responsive UI (Inter font, neutral palette, one accent colour)
- ⏳ Skeleton loaders and friendly error states
- ⏰ Scaffolded Vercel Cron job (`/api/cron/sync-advertisers`) protected by a secret, ready to extend for syncing offers/deals

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable            | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `AWIN_API_TOKEN`    | Your Awin OAuth2 API token (bearer token)                          |
| `AWIN_PUBLISHER_ID` | Your numeric Awin Publisher ID                                     |
| `CRON_SECRET`       | Any long random string — protects the cron route                   |
| `DEFAULT_COUNTRY`   | Fallback 2-letter ISO country when IP geolocation fails (default `US`) |
| `ADMIN_USERNAME`    | Username for admin login (server-side only)                        |
| `ADMIN_PASSWORD`    | Password for admin login (server-side only)                        |
| `AUTH_SECRET`       | Random secret used to sign session JWT tokens                      |

#### Where to get your Awin token & publisher ID

1. Log in at [ui.awin.com](https://ui.awin.com).
2. Go to **Toolbox → API credentials** (sometimes under **Account settings → API Credentials**).
3. Generate/copy your **OAuth2 token** → `AWIN_API_TOKEN`.
4. Your **Publisher ID** is the numeric account ID shown in your dashboard (and in the dashboard URL) → `AWIN_PUBLISHER_ID`.

Generate secrets with:

```bash
# Cron secret
openssl rand -hex 32

# Auth secret (for signing session tokens)
openssl rand -base64 32
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API routes

### `GET /api/advertisers?relationship=joined`

Fetches programmes/advertisers from Awin and returns normalised JSON:

```json
{
  "count": 2,
  "advertisers": [
    {
      "id": 12345,
      "name": "Example Store",
      "logoUrl": "https://…",
      "status": "active",
      "relationship": "joined",
      "region": "United Kingdom",
      "countryCode": "GB",
      "currencyCode": "GBP",
      "commission": "5–10%",
      "url": "https://…"
    }
  ]
}
```

Query params (all optional, combinable): `search`, `region`, `relationship`, `country` (2-letter ISO, e.g. `PK`), `page`, `pageSize`. Filtering + pagination happen server-side, so the browser only ever receives one page. The response also includes `facets` (`regions`, `relationships`, `countries`) for populating the filter controls.

### `GET /api/geo`

Detects the visitor's country and returns e.g. `{ "country": "PK", "source": "vercel" }`.

Detection order (see `src/lib/geo.ts` → `getUserCountry`):

1. **`x-vercel-ip-country`** header (present in production on Vercel).
2. **ip-api.com** free lookup — covers local dev / non-Vercel hosts. In local dev the client IP is localhost, so we query ip-api without an IP and it geolocates the dev machine's own connection.
3. **`DEFAULT_COUNTRY`** env var (or `US`) if everything else fails.

The homepage calls `/api/geo` on load, applies the detected country as the default region filter, and shows a pill — *"Showing advertisers for 🇵🇰 Pakistan"* — with a dropdown to override. A manual override is persisted in `localStorage` (`awin_country`) and takes precedence over detection on the next visit.

> **Region field:** advertisers are matched on `countryCode`, derived from Awin's `primaryRegion.countryCode`. If your account's programmes don't expose reliable region data, the intended fallback is to cross-reference the Awin **Offers API** (`regionCodes` filter) — a good extension point in `src/lib/awin.ts`.

Under the hood it calls:

```
GET https://api.awin.com/publishers/{AWIN_PUBLISHER_ID}/programmes?relationship=joined
Authorization: Bearer {AWIN_API_TOKEN}
```

### `GET /api/cron/sync-advertisers`

Placeholder background sync. Re-fetches joined advertisers and logs a summary. **Protected** — the request must include either:

- `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends automatically), or
- `?secret=<CRON_SECRET>` (handy for manual testing).

Test it locally:

```bash
curl "http://localhost:3000/api/cron/sync-advertisers?secret=YOUR_CRON_SECRET"
```

---

## How the cron works

`vercel.json` registers a daily cron:

```json
{
  "crons": [{ "path": "/api/cron/sync-advertisers", "schedule": "0 3 * * *" }]
}
```

- Runs every day at **03:00 UTC**.
- Vercel automatically sends `Authorization: Bearer $CRON_SECRET`, so make sure `CRON_SECRET` is set in your Vercel project's environment variables.
- Adjust the [cron expression](https://vercel.com/docs/cron-jobs) as needed.

The route is intentionally a stub. Extend it later to persist advertisers/offers to a database or cache and to sync the Awin **Offers/Deals** API.

---

## Deploying to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Add the environment variables (`AWIN_API_TOKEN`, `AWIN_PUBLISHER_ID`, `CRON_SECRET`) under **Settings → Environment Variables**.
4. Deploy. The cron in `vercel.json` is registered automatically (Vercel Cron is available on eligible plans).

---

## Authentication

The app is protected behind a simple admin login. All routes under `/dashboard` (and the root `/`) require authentication. The `/login` page provides a username/password form.

### How it works

1. User visits any protected route → middleware checks for a valid `session` cookie.
2. If no valid session → redirected to `/login`.
3. User submits credentials → `POST /api/auth/login` validates against `ADMIN_USERNAME` / `ADMIN_PASSWORD` from env.
4. On success, a signed JWT (HS256, 7-day expiry) is set as an `httpOnly`, `secure`, `sameSite: strict` cookie.
5. Logout clears the cookie via `POST /api/auth/logout`.

No database is needed — this is designed for a single admin user.

---

## Project structure

```
src/
├─ app/
│  ├─ api/
│  │  ├─ advertisers/route.ts            # GET advertisers (server-side Awin fetch)
│  │  ├─ auth/
│  │  │  ├─ login/route.ts               # POST login (validates credentials, sets cookie)
│  │  │  └─ logout/route.ts              # POST logout (clears cookie)
│  │  ├─ cron/sync-advertisers/route.ts  # Protected cron placeholder
│  │  └─ geo/route.ts                    # GET visitor geolocation
│  ├─ dashboard/
│  │  └─ page.tsx                        # Protected advertisers dashboard
│  ├─ login/
│  │  └─ page.tsx                        # Login form
│  ├─ globals.css
│  ├─ layout.tsx                         # Inter font, root layout
│  └─ page.tsx                           # Redirects to /dashboard
├─ components/
│  ├─ AdvertiserCard.tsx
│  ├─ FilterBar.tsx
│  ├─ Pagination.tsx
│  ├─ RegionSelector.tsx
│  └─ SkeletonGrid.tsx
├─ lib/
│  ├─ auth.ts                            # JWT session helpers (jose)
│  ├─ awin.ts                            # Typed Awin client + normalisation
│  ├─ countries.ts                       # Country code → name mapping
│  └─ geo.ts                             # IP geolocation utilities
└─ middleware.ts                          # Route protection (session validation)
```

---

## Extending

- Add the Awin **Offers/Deals** endpoints in `src/lib/awin.ts` and expose new routes under `src/app/api/`.
- Swap the cron placeholder for real persistence (Postgres, KV, etc.).
- Add pagination or server-side filtering if your account has many programmes.
