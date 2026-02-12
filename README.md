# Moon Phase API (Zuplo sample)

A small, deployable Zuplo API you can connect to Git and monetize with API keys + plans.

## Endpoints

- GET `/health` (public)
- GET `/openapi` (public OpenAPI spec)
- GET `/v1/moon-phase?date=YYYY-MM-DD`
- GET `/v1/moon-phase/today`
- GET `/v1/moon-phase/{date}`
- GET `/v1/moon-calendar?month=YYYY-MM`

## Auth

All `/v1/*` routes require a Zuplo API key:
- Header: `Authorization: Bearer YOUR_KEY`

Auth is handled by Zuplo's API Key service policy (config/policies.json).
Rate limiting is per authenticated user (60 requests/minute).

## Deploy on Zuplo (Git-based)

1. Create a Git repo from this folder and push to GitHub.
2. In Zuplo Portal: create a new project, choose "Connect Git repository", select this repo.
3. Deploy.

## Create keys + monetize

1. In Zuplo Portal: Settings → API Key Consumers → Add a consumer → copy its key.
2. Use the key to call the API.
3. In Zuplo Portal: Monetization (or Plans/Billing area) create tiers (Free/Pro/etc),
   and assign consumers to plans (often via consumer metadata, depending on your setup).

Tip: You can attach metadata to a consumer (e.g. plan=pro). The handlers can read it
via `request.user.data.plan` after API key auth succeeds.
