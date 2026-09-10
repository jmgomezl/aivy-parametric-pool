# Development, pricing and recovery

## Pricing and capacity

![Current Tokyo quote: modeled premium, conditional payout, testnet amount and pricing controls beside the map](media/02-quote.png)

*Tokyo: the panel pairs the modeled premium with its conditional
30-day payout and testnet token amount. Pricing comes from the USGS catalogue
for that point; inspect the source under "Coverage & pricing details".*

A first-order Poisson model estimates shallow M6+ frequency over a 300 km
reference region, scales to the fixed 100 km trigger circle, and adds uncertainty
loading. It is reproducible, not actuarial-grade. A location without qualifying
historical data is declined; no record does not establish zero risk.

The payout requires M6+, distance ≤100 km, depth ≤70 km, and an event inside the
coverage window. Damage alone does not qualify. Terms last 7–62 days; late event
reporting or missing oracle service can prevent timely signatures.

The local issuance book reserves aggregate promised payouts before ledger writes,
under an exclusive filesystem lock. Issuance is refused when existing promises
plus the request exceed available capital. These are off-ledger reservations:
funds are not individually escrowed per schedule, and external spending can
invalidate capacity. Multiple instances must share the same book and lock;
independent disks are unsupported. Issuance admission limits are persisted in the
shared private journal; restarting the process does not reset them.

## Interrupted requests

The browser saves a random request identifier before creation. Policies checks
`GET /api/requests/:id`; completed requests resolve to the issued policy and
interrupted requests remain visible for review. Replaying an identifier never
creates another policy. Issuance checkpoints retain public ledger identifiers.

A failed issuance retains its capital reservation. All writers hold an OS `flock`
on a permanent `.artifacts/issuance-<scope>.lock.guard` file for the entire operation.
The OS releases that lock on process death. The next holder can safely remove a
valid `.lock` owner marker only when its process is provably gone. Live owners,
malformed markers and uncertain ownership refuse work. **Never delete a `.guard`
file while writers can run.**

Recovering a lock does not replay a transaction or release its reserved capital.
An operator must inspect HCS, NFT, premium, schedule or EVM receipt checkpoints
and reconcile the original request. Never blindly delete reservations or signed
transaction journals. See the [upgrade and recovery procedure](AGENT-SECURITY.md#kernel-locking-and-recovery).

## Verification

```sh
npm test                 # offline pricing, authorization, payment and issuance tests
npm --prefix ui run build
```

The reusable plugin has its own tests in the sibling repository:

```sh
cd ../hak-scheduled-settlement
npm test
npm run typecheck
npm run build
```

`d1`, `d2`, `d3`, and `verify-quorum.js` are controlled HBAR ledger demonstrations,
not offline tests. They spend network assets and update `.artifacts` and
`LINKS.md`. They are separate from the current app's token issuance flow; d3
submits controlled signatures rather than verifying a real earthquake. Run in an
isolated checkout with separate demo accounts if reproducing the historical run.
The UI's frozen mainnet record is not replaced automatically.
