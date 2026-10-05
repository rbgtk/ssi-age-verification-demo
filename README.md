# Privacy-preserving 18+ verification

This proof of concept uses the walt.id Community Stack to demonstrate an adults-only gate without collecting identity documents, payment details, a name, a birth date, or an exact age. The relying site requests one selectively disclosed claim from a DID-bound SD-JWT:

```json
{ "age_over_18": true }
```

The protected page contains no adult material.

## Start the demo

Requirements: Docker Compose, `curl`, and `jq`.

```bash
docker compose --profile identity up --build
```

Wait for the APIs, then open:

- Adult site: <http://localhost:8080>
- Web wallet: <http://localhost:7104> (this repository's Vue application)
- Issuer API: <http://localhost:7005/swagger>
- Verifier API: <http://localhost:7004/swagger>
- Wallet API: <http://localhost:7006/swagger>

The password `changeme` and the issuer signing key committed under `config/` are strictly demo defaults.

## Create Alice and Bob

Register both accounts. Registration creates their account and initial wallet; use the wallet UI if an already-created account makes either request return a conflict.

```bash
curl --fail-with-body -X POST http://localhost:7006/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"changeme"}'

curl --fail-with-body -X POST http://localhost:7006/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.com","password":"changeme"}'
```

For each user, sign in at <http://localhost:7104>. Open **Keys**, generate an Ed25519 key, then create a `did:jwk`. This lets the holder use the DID/key for proof of possession when claiming an offer.

For API inspection, authenticate and use the bearer token returned by the login endpoint:

```bash
curl --fail-with-body -X POST http://localhost:7006/auth/emailpass \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"changeme"}'
```

Copy its token into `ALICE_TOKEN`, then list the account wallets and their DIDs:

```bash
curl --fail-with-body http://localhost:7006/auth/account/wallets \
  -H "Authorization: Bearer $ALICE_TOKEN"

curl --fail-with-body http://localhost:7006/wallet/ALICE_WALLET_ID/dids \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

Repeat with Bob. The Swagger page documents the exact token response for the configured image if it differs between walt.id versions.

## Issue the credentials

The birth dates are used only to decide the boolean at issuance time. They are deliberately absent from the credentials:

- Alice, born 1991-01-01 → `age_over_18: true`
- Bob, born 2014-12-31 → `age_over_18: false`

Create an offer for Alice:

```bash
curl --fail-with-body -X POST http://localhost:7005/issuer2/credential-offers \
  -H 'Content-Type: application/json' \
  -d '{
    "profileId": "ageCredential",
    "authMethod": "PRE_AUTHORIZED",
    "expiresInSeconds": 3600,
    "runtimeOverrides": { "credentialData": { "age_over_18": true } }
  }' | tee /tmp/alice-age-offer.json
```

Create Bob's offer:

```bash
curl --fail-with-body -X POST http://localhost:7005/issuer2/credential-offers \
  -H 'Content-Type: application/json' \
  -d '{
    "profileId": "ageCredential",
    "authMethod": "PRE_AUTHORIZED",
    "expiresInSeconds": 3600,
    "runtimeOverrides": { "credentialData": { "age_over_18": false } }
  }' | tee /tmp/bob-age-offer.json
```

Sign in to the matching account in the web wallet. Open **Offers**, copy the `credentialOffer` value from its JSON file, paste it into the offer field, and accept it. Do not claim Alice's offer while logged in as Bob or vice versa.

Verify the result from **Settings → DIDs** and the wallet home screen, or through the API:

```bash
curl --fail-with-body 'http://localhost:7006/wallet/ALICE_WALLET_ID/credentials?showDeleted=false&showPending=false' \
  -H "Authorization: Bearer $ALICE_TOKEN"
```

The wallet should contain one credential whose VCT ends in `/openid4vci/AgeCredential`. Repeat for Bob.

## Walk through verification

1. Sign into the web wallet as Alice.
2. Open <http://localhost:8080>, choose **Verify privately**, then create a verification request.
3. Scan its QR code with any compatible OpenID4VP wallet, use **Open in a wallet**, or copy the request URL. For this repository's web wallet, paste the URL into **Present**.
4. Inspect the consent screen: it must request only `age_over_18`. Approve it.
5. Alice is redirected to the dummy members area. Refresh works until **End private session** is selected or the browser session ends.
6. Log into the wallet as Bob and repeat. Bob's valid credential returns `false`, so access is denied.

The adult-site backend owns the Verifier API session and issues only an opaque, HTTP-only, same-site browser cookie after a verified boolean `true`. Raw credentials, VP tokens, DIDs, and claims are not returned by the adult-site API or written to its logs.

## Reset

The following deletes the demo database volume and all accounts and credentials:

```bash
docker compose --profile identity down --volumes
```

Then run the startup and provisioning steps again. This is destructive but limited to this Compose project's volumes.

## Production boundary

This is a local demonstration. A real service also needs HTTPS, strong passwords, CSRF and rate-limit controls, durable/expiring server-side sessions, trusted issuer and verifier configuration, revocation checks, managed signing keys with rotation, audited data retention, and a deployment-specific privacy review.
