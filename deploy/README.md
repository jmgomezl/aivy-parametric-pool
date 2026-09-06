# Deploying Quorum

Three services, one per catalogue, each with its own Hedera account and its own
key. They run as separate processes for isolation. This demo still operates all three;
separate processes do not establish independent oracle operators.

Live at:

| | |
|---|---|
| https://quorum.aivylabs.xyz | the app, and the underwriting agent under `/api` |
| https://usgs.aivylabs.xyz | USGS ComCat · United States Geological Survey |
| https://emsc.aivylabs.xyz | EMSC · European-Mediterranean Seismological Centre |
| https://geofon.aivylabs.xyz | GEOFON · GFZ Potsdam |

`GET /` is free and says what the oracle is and what it charges.
`POST /attest` and `POST /attest-and-sign` are paid, over x402.

## What is on the server

```
/opt/aivy-oracles/          src/, package.json, .env (0600), ecosystem.config.cjs
/opt/aivy-oracles/.artifacts/registry-testnet.json   ids only, no key material
/var/www/quorum/            the built UI
/etc/nginx/sites-available/ quorum, usgs, emsc, geofon .aivylabs
pm2                         aivy-oracle-{usgs,emsc,geofon}, quorum-agent, saved
```

The agent and the oracles share one checkout, so the 775 MB of node_modules is
installed once.

**Only testnet keys are on the server.** The mainnet key stays on the laptop, in
a gitignored file, and nothing in this deployment can reach it. The registry
copied up is filtered: anything whose name ends in `Key` or `Keys` is stripped,
so `oraclePrivateKeys` and `x402PayerKey` never leave the laptop either.

## The UI

```bash
cd ui && VITE_AGENT_URL=https://quorum.aivylabs.xyz npm run build
# then copy dist/ to /var/www/quorum
```

nginx serves it and proxies `/api/` to the agent on 8814, so the app and its
agent share an origin and the browser needs no CORS.

## Deploy

```bash
tar czf /tmp/oracles.tgz src package.json package-lock.json
scp /tmp/oracles.tgz root@$VPS:/tmp/
ssh root@$VPS 'cd /opt/aivy-oracles && tar xzf /tmp/oracles.tgz && npm install --omit=dev'
ssh root@$VPS 'cd /opt/aivy-oracles && set -a && . ./.env && set +a && pm2 restart ecosystem.config.cjs --update-env && pm2 save'
```

The config file must be named `ecosystem.config.cjs`. pm2 treats a bare
`ecosystem.cjs` as a script to run rather than a config to read, and starts one
process called "ecosystem" instead of three oracles.

## The box

1.9 GB of RAM running about fourteen other services, so check before deploying:

```bash
ssh root@$VPS 'df -h /; free -h'
```

Each oracle sits around 50 MB and `max_memory_restart` is 180 MB.

## TLS

```bash
certbot --nginx -d usgs.aivylabs.xyz -d emsc.aivylabs.xyz -d geofon.aivylabs.xyz --redirect
```

One certificate covers all three. DNS is at Porkbun — when adding records there,
leave **"Do not delete existing records"** checked. Unchecking it replaces every
record on aivylabs.xyz, which would take down a dozen unrelated services.

## Signing request binding

`POST /attest-and-sign` takes `scheduleId` and `termsPointer` (`hcs://topic/sequence`).
Caller-supplied trigger specifications are ignored for signing. Deploy the public
pool registry containing `poolAccountId` and `termsTopicId` in
`.artifacts/registry-<network>.json`; never copy private demo keys into that registry.
The service loads its own signing key from its environment. Policies must use
version 1 terms and the bound memo hash; older recordings require manual review.
A policy-binding rejection returns 422 before charging for an attestation.

The services are request-driven. No background earthquake monitor is included.
Automatic execution occurs only after the required signatures reach Hedera.
The HTTP listeners default to localhost for the nginx proxy.

## Quorum website

`quorum.aivylabs.xyz` uses `/var/www/quorum` and a dedicated
`quorum-agent` PM2 process in `/opt/aivy-oracles` on `127.0.0.1:8814`. Port 8791 belongs to a separate
checkout service on this VPS. Use `quorum.config.cjs` and `nginx-quorum.conf`.
Build the UI locally, then deploy the committed source plus `ui/dist`; record
its Git SHA in `REVISION` on the server. Keep `.env`, `.artifacts`, and dependencies
out of Git. The server needs only the testnet operator environment, a public
`registry-testnet.json` with private keys removed, and the current policy book.
Never replace an existing VPS policy book during a routine code deployment.

The website A record points to `167.172.152.172`; `104.248.108.201` is the
reserved IP reaching the same VPS. TLS is installed with certbot.
Verify `/api/health`, `/api/pool`, `/api/policies`, SPA deep links, and hashed
assets after deployment. Preserve the previous source and UI as a rollback.
The local and VPS issuer must not write concurrently against separate copies
of the same pool's book; use the VPS as the single issuer after migration.
