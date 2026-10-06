# Issuer portal

Vue portal for creating OpenID4VCI credential offers through the walt.id Issuer API v2.

It loads profiles from `GET /issuer2/profiles` and creates single- or multi-credential offers with `POST /issuer2/credential-offers`. The UI supports pre-authorized and authorization-code flows, by-reference and by-value delivery, expiry, transaction codes, issuer-state mode, and runtime overrides.

## Development

Start the issuer API on port 7005, then run `npm install` and `npm run dev`. Vite proxies `/issuer-api` to `ISSUER_API_URL` or `http://localhost:7005`.

## Docker Compose

From the repository root run `docker compose --profile identity up --build`, then open <http://localhost:7107>.
