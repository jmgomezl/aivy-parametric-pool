# Deploying Quorum

Node **22+**, nginx and PM2 host one agent and three catalogue services. The
processes have different keys but share a VPS and administrator; this is not
independent oracle custody.

| Host | Service / loopback port |
| --- | --- |
| `quorum.aivylabs.xyz` | UI and `/api` → agent on 8814 |
| `usgs.aivylabs.xyz` | USGS oracle on 8811 |
| `emsc.aivylabs.xyz` | EMSC oracle on 8812 |
| `geofon.aivylabs.xyz` | GEOFON oracle on 8813 |

`GET /` on an oracle is free. `POST /attest` and `/attest-and-sign` use the
hosted Blocky402 testnet facilitator. Its URL and fee payer are pinned in
`src/x402/blocky.js`; no facilitator key or API key is required. Preserve
`.artifacts/blocky-payments-testnet/` with the other journals. Checks are request-driven; no background
earthquake monitor is deployed. Hedera executes once the required signatures exist.

## Files and custody

| Location | Contents |
| --- | --- |
| `/opt/aivy-oracles` | Committed source, dependencies, `REVISION` |
| `.env` (0600) | Agent, individual oracle, demo-wallet and Sepolia sponsor configuration |
| `.artifacts/` (0700; private files 0600) | Public registry, authoritative policy book, budgets, request journals and private managed wallets |
| `/var/www/quorum` | Built UI and `REVISION` |
| nginx sites | TLS and loopback reverse proxies |

The public registry contains IDs and public keys, never signing keys. Services
load their own keys from private configuration. Testnet managed-wallet keys and
recovery journals stay on this host. Mainnet recording keys are not deployed.
Never copy private `.env` or `.artifacts` files into Git, the web root or logs.

## Build a candidate

Use the committed lockfiles and the same Node major as the running services.
`fs-ext` builds a native kernel-lock binding; Linux needs its normal C/C++ build
toolchain and Python. Do not reuse a macOS `node_modules` directory on the VPS.

```sh
npm ci
npm test
cd ui
npm ci
npm run build
```

Install and test in an isolated release directory first. `npm ci` includes peer
dependencies: the lockfile aliases the Uniswap plugin's legacy `hedera-agent-kit`
peer name to the app's current `@hashgraph/hedera-agent-kit@4.1.0`. This avoids
installing an unused legacy kit/PDF tree. Quorum calls that plugin's quote tool
directly; the alias does not claim that every legacy plugin interface is migrated.

## Upgrade an existing deployment

1. Check `/api/health`, `/api/pool` and `/api/guardrails`, disk and memory. Resolve
   pending ledger requests and wallet funding before deployment; do not clear them.
2. Back up committed source, the dependency target, UI and `REVISION`. Keep private
   operational backups access-restricted and outside the public release archive.
3. Drain and stop `quorum-agent`, then drain and stop `aivy-oracle-usgs`,
   `aivy-oracle-emsc` and `aivy-oracle-geofon`. Every writer must use one authoritative
   book and the same lock implementation.
4. Replace committed source and switch to the tested Linux dependencies. Preserve
   `.env`, `.artifacts`, budgets and all journals **in place**. Never unlink a
   `.lock.guard` file or replace its inode; do not run old and new writers together.
5. Copy `ui/dist` to `/var/www/quorum`, assets before `index.html`. Record the commit
   SHA as `REVISION` in both roots. Keep earlier hashed assets for open browsers.
6. Restart the three oracle processes, then `quorum-agent`, and `pm2 save`. Existing
   services use `ecosystem.config.cjs` and `quorum.config.cjs`; retain their configured
   Node interpreter and private environment.
7. Verify health, pool, policies, assets, SPA deep links and a bounded testnet action.
   Reconcile its original request ID if interrupted. Roll back source/dependencies/UI
   if necessary; never restore an older ledger journal over newer transactions.

A failed health check leaves the release incomplete. The current public UI proxies
`/api` on the same origin. Local Vite proxies to 8791; that local tunnel reaches
VPS 8814, not the unrelated VPS service on 8791.

## First install and TLS

The `nginx-{usgs,emsc,geofon}.conf` files are initial HTTP templates. Check syntax
with `nginx -t` before enabling them; let certbot add HTTPS after DNS resolves.
`nginx-quorum.conf` serves the SPA and proxies the agent.

```sh
certbot --nginx -d usgs.aivylabs.xyz -d emsc.aivylabs.xyz -d geofon.aivylabs.xyz --redirect
```

The current host IP is `167.172.152.172`; reserved IP `104.248.108.201` reaches the
same VPS. Preserve unrelated DNS records and services when provisioning.

## Signing request binding

`/attest-and-sign` requires `scheduleId` and an `hcs://topic/sequence` terms pointer.
It loads the configured public registry and derives conditions from authenticated
HCS terms. It checks the schedule's exact asset, amount, beneficiary, policy hash
and issuer signature. Caller-provided trigger specifications cannot authorize a
signature. A binding rejection returns 422 before payment. Older mainnet recordings
are evidence, not requests to replay through the current policy API.

[Security and locking protocol](../docs/AGENT-SECURITY.md) ·
[Managed demo wallet operations](../docs/MANAGED-DEMO-WALLETS.md)

## Take Studio is deployed separately

The creator tool has moved to
[jmgomezl/aivy-take-studio](https://github.com/jmgomezl/aivy-take-studio).
Its source is `/opt/take-studio` and its public release symlink is
`/var/www/take-studio`, outside Quorum's source and web directories.

The VPS serves `/demo-video/studio/` through its own nginx location snippet.
That keeps the existing browser origin, IndexedDB and saved recordings intact.
The optional include in `nginx-quorum.conf` allows a fresh Quorum deployment
without installing the creator tool. Quorum's rehearsal page links to the
hosted studio; it does not bundle the application.

Follow the [studio deployment guide](https://github.com/jmgomezl/aivy-take-studio/blob/main/deploy/README.md)
for its releases. A Quorum deployment must not overwrite `/opt/take-studio`,
`/var/www/take-studio-releases` or the studio nginx snippet.
