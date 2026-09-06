# Deploying the oracles

Three services, one per catalogue, each with its own Hedera account and its own
key. They run as separate processes for isolation. This demo still operates all three;
separate processes do not establish independent oracle operators.

Live at:

| | |
|---|---|
| https://usgs.aivylabs.xyz | USGS ComCat · United States Geological Survey |
| https://emsc.aivylabs.xyz | EMSC · European-Mediterranean Seismological Centre |
| https://geofon.aivylabs.xyz | GEOFON · GFZ Potsdam |

`GET /` is free and says what the oracle is and what it charges.
`POST /attest` and `POST /attest-and-sign` are paid, over x402.

## What is on the server

```
/opt/aivy-oracles/          src/, package.json, .env (0600), ecosystem.config.cjs
/etc/nginx/sites-available/ usgs.aivylabs, emsc.aivylabs, geofon.aivylabs
pm2                         aivy-oracle-{usgs,emsc,geofon}, saved
```

**Only testnet keys are on the server.** The mainnet key stays on the laptop, in
a gitignored file, and nothing in this deployment can reach it.

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
