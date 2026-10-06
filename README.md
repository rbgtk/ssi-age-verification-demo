# SSI age verification demo

This project demonstrates how self-sovereign identity (SSI) can be used for privacy-preserving age verification in practice. A trusted authority issues an age credential to a person's wallet, and an age-restricted website asks the wallet to prove only that the holder is at least 18.

The relying site does **not** need to collect an identity document, name, birth date, exact age, address, or payment details. It receives one selectively disclosed claim:

```json
{ "age_over_18": true }
```

The demo implements issuance, wallet storage, presentation, cryptographic verification, and access control. The one intentionally missing trust-policy component is a registry or allowlist of trusted issuers. In a real deployment, the verifier must accept age credentials only from authorized issuers—for example, municipalities—and not merely any issuer capable of signing a structurally valid credential. See [Trust boundary](#trust-boundary).

The protected page is a harmless placeholder and contains no adult material.

## What the demo shows

1. An issuer determines whether a person is over 18 and issues an `AgeCredential` through OpenID for Verifiable Credential Issuance (OpenID4VCI).
2. The holder accepts the offer and stores the credential in their wallet. The credential is bound to a holder-controlled DID and key.
3. An age-restricted website creates an OpenID for Verifiable Presentations (OpenID4VP) request.
4. The wallet shows what is requested and asks for the holder's consent.
5. The holder presents only the selectively disclosed `age_over_18` claim from the SD-JWT credential.
6. The verifier validates the presentation and the website grants access only when the verified claim is `true`.

```text
┌─────────────────┐   OpenID4VCI offer   ┌─────────────────┐
│ Issuer portal   │ ───────────────────▶ │ Holder wallet   │
│ + Issuer API    │   signed credential  │ + Wallet API    │
└─────────────────┘                      └────────┬────────┘
                                                │
                                      OpenID4VP │ selective disclosure
                                                ▼
┌─────────────────┐   verified result   ┌─────────────────┐
│ Age-restricted  │ ◀────────────────── │ Verifier API    │
│ website         │                    │                 │
└─────────────────┘                    └─────────────────┘
```

## Components

| Component | Purpose | Local URL |
| --- | --- | --- |
| `issuer-portal` | Creates and shares credential offers | <http://localhost:7107> |
| `wallet-app` | Manages holders, DIDs, keys, offers, and presentations | <http://localhost:7104> |
| `adult-site` | Example relying party and protected page | <http://localhost:8080> |
| walt.id Issuer API | Issues SD-JWT credentials through OpenID4VCI | <http://localhost:7005/swagger> |
| walt.id Wallet API | Stores wallets, DIDs, keys, and credentials | <http://localhost:7006/swagger> |
| walt.id Verifier API | Creates and validates OpenID4VP sessions | <http://localhost:7004/swagger> |
| PostgreSQL | Persists wallet data | `localhost:5432` |

The three web applications are Vue 3/Vite frontends. Small Node.js servers connect them to the APIs and serve their production builds. The identity services come from the [walt.id Community Stack](https://docs.walt.id/community-stack/).

## Requirements

- Docker with Docker Compose
- `curl` and `jq` for the optional API examples
- A modern browser

For frontend development outside Docker, use Node.js `^22.18.0` or `>=24.12.0`.

## Quick start

Start the entire stack from the repository root:

```bash
docker compose --profile identity up --build
```

Docker Compose also reads `COMPOSE_PROFILES=identity` from `.env`, so this is normally equivalent:

```bash
docker compose up --build
```

Wait for the services to start, then open:

- Issuer portal: <http://localhost:7107>
- Holder wallet: <http://localhost:7104>
- Age-restricted site: <http://localhost:8080>

The password `changeme`, database credentials, and issuer signing key committed under `config/` are demo defaults. Do not reuse them outside a local demonstration.

## End-to-end walkthrough

The easiest way to show both outcomes is to create two holders:

- Alice receives `age_over_18: true`.
- Bob receives `age_over_18: false`.

The issuer may use a birth date or another authoritative source to determine the boolean, but that source data is not included in this credential.

### 1. Create holder wallets

Open <http://localhost:7104>, register Alice, and then repeat for Bob:

```text
alice@example.com / changeme
bob@example.com   / changeme
```

Registration can also be done through the API:

```bash
curl --fail-with-body -X POST http://localhost:7006/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"changeme"}'

curl --fail-with-body -X POST http://localhost:7006/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.com","password":"changeme"}'
```

For each account, sign in and use the wallet UI to generate an Ed25519 key and create a `did:jwk`. This DID and key provide holder binding and proof of possession when an offer is claimed.

### 2. Issue age credentials

Open <http://localhost:7107> and:

1. Select **18+ Age Credential** (`ageCredential`).
2. Set **Age over 18** to `true` for Alice.
3. Keep the pre-authorized flow and create the offer.
4. Copy the resulting credential-offer URL.
5. Sign in to Alice's wallet, open **Offers**, paste the URL, and accept it.
6. Repeat for Bob with **Age over 18** set to `false`.

Make sure each offer is accepted while signed in to the intended account.

The same offers can be created through the API:

```bash
# Alice
curl --fail-with-body -X POST http://localhost:7005/issuer2/credential-offers \
  -H 'Content-Type: application/json' \
  -d '{
    "profileId": "ageCredential",
    "authMethod": "PRE_AUTHORIZED",
    "expiresInSeconds": 3600,
    "runtimeOverrides": { "credentialData": { "age_over_18": true } }
  }'

# Bob
curl --fail-with-body -X POST http://localhost:7005/issuer2/credential-offers \
  -H 'Content-Type: application/json' \
  -d '{
    "profileId": "ageCredential",
    "authMethod": "PRE_AUTHORIZED",
    "expiresInSeconds": 3600,
    "runtimeOverrides": { "credentialData": { "age_over_18": false } }
  }'
```

### 3. Prove the age claim

1. Sign in to the wallet as Alice.
2. Open <http://localhost:8080> and choose **Verify privately**.
3. Create a verification request.
4. Use **Open in a wallet**, scan the QR code with a compatible OpenID4VP wallet, or copy the request URL. In this repository's wallet, paste the URL into **Present**.
5. Check the consent screen. It should request only `age_over_18`.
6. Approve the presentation.

Alice is admitted to the placeholder members area. Access is represented by an opaque, HTTP-only, same-site session cookie until **End private session** is selected or the server restarts.

Repeat the flow as Bob. His credential is valid, but its claim is `false`, so access is denied.

## Privacy and security properties

- The credential contains the age-threshold result, not the holder's birth date or exact age.
- SD-JWT selective disclosure lets the wallet reveal only `age_over_18`.
- The wallet asks for consent before presenting the claim.
- The credential is holder-bound through a DID and proof-of-possession key.
- The relying-party backend communicates with the Verifier API and interprets its verified result.
- Verification sessions are short-lived, single-use, and tied to an opaque browser cookie.
- The age site's API does not return or log raw credentials, VP tokens, holder DIDs, or identity claims.
- A successful result creates only an opaque server-side access session.

The access and verification session stores in `adult-site/server.mjs` are intentionally in memory. Restarting that container clears them.

## Trust boundary

Cryptographic validity answers: “Was this credential signed correctly, and was this presentation authorized by its holder?” It does not by itself answer: “Is the signer authorized to attest age?”

This demo requests the configured `AgeCredential` type and validates the signed presentation, but it does **not** maintain or enforce a trusted-issuer list. That is the one deliberately unimplemented part of the SSI trust model in this project.

A production version should establish a trust registry or allowlist containing the identifiers and verification material of approved issuers—for example, municipalities authorized to issue identity credentials. During verification it should:

1. Extract the credential issuer identifier.
2. Resolve and validate the issuer's current verification material.
3. Require the issuer to be active in the registry for the relevant credential type.
4. Apply status, revocation, expiry, and key-rotation policies.
5. Reject credentials from unknown, suspended, or unauthorized issuers even when their signatures are otherwise valid.

Without that policy, anyone operating an issuer could potentially mint an age credential that is technically well-formed. The trusted-issuer registry is therefore required before this can be treated as a real-world authorization system.

## Repository layout

```text
.
├── adult-site/       Example relying party and protected route
├── issuer-portal/    Credential-offer administration UI
├── wallet-app/       Holder wallet UI
├── waltid-issuer/    Issuer API configuration and credential profiles
├── waltid-verifier/  Verifier API configuration
├── waltid-wallet/    Wallet API configuration
├── docker-compose.yaml
└── .env              Ports, image version, and demo database settings
```

The age profile is defined in `waltid-issuer/config/issuer2-profiles.conf`. The relying party's DCQL request in `adult-site/server.mjs` asks for an SD-JWT with the configured age-credential VCT and only the `age_over_18` claim.

## Local frontend development

Start the backing APIs and database:

```bash
docker compose --profile services up
```

Then run an application in a separate terminal:

```bash
cd wallet-app       # or issuer-portal / adult-site
npm install
npm run dev
```

Useful commands in each application:

```bash
npm run build       # type-check and production build
npm run lint        # lint and apply supported fixes
```

The age-restricted site also has backend tests:

```bash
cd adult-site
npm test
```

Vite development proxies are configured in each application's `vite.config.ts`. The containerized setup remains the recommended way to run the integrated demo.

## Configuration

Ports and Docker image versions are set in `.env`. Service-specific walt.id configuration lives in:

- `waltid-issuer/config/`
- `waltid-verifier/config/`
- `waltid-wallet/config/`

Compose profiles:

| Profile | Starts |
| --- | --- |
| `services` | Issuer, verifier, wallet APIs, and PostgreSQL |
| `apps` | Issuer portal, wallet app, age site, and PostgreSQL |
| `identity` | All APIs, apps, and PostgreSQL |
| `all` | All services currently defined in this repository |

## Reset the demo

Stop the stack while preserving wallet data:

```bash
docker compose --profile identity down
```

Delete the demo database volume, including all accounts and credentials:

```bash
docker compose --profile identity down --volumes
```

The second command is destructive, but its scope is limited to this Compose project's volumes.

## Production considerations

The trusted-issuer registry is the missing SSI feature called out above. A public deployment would also need normal production hardening around this demo: HTTPS, secure secret and signing-key management, key rotation, durable expiring sessions, CSRF protection, rate limiting, audit controls, monitoring, backups, and a deployment-specific security and privacy review.

These operational controls do not change the demonstrated SSI flow; they make the surrounding service safe to operate beyond a local proof of concept.
