# x402 facilitator on Hedera — probe results (2026-09-04)

Probed live because the Hedera "AI & Agentic Payments" track ($6,000) requires
hosting a **live** x402-gated service, and that is the single largest prize on
the board for this project.

## What is actually reachable

`https://api.blocky402.com/supported` -> HTTP 200:

```json
{"kinds":[{"x402Version":2,"scheme":"exact","network":"hedera:mainnet",
           "extra":{"feePayer":"0.0.10571514"}}],
 "extensions":[],"signers":{"hedera:*":["0.0.10571514"]}}
```

- `blocky402.com` (marketing site): 200
- `api.blocky402.com`: 200, the facilitator API
- `testnet.blocky402.com`, `api-testnet.blocky402.com`: DNS failure

## The finding

**The reachable facilitator advertises `hedera:mainnet` only.** Secondary sources
claim "Hedera testnet V1" support; the live `/supported` endpoint does not.
Scheme is `exact`: the client partially signs, the facilitator adds the fee-payer
signature and submits, so the facilitator pays gas.

## Open decision (JuanMa's call — involves real money)

1. **Run the x402 leg on mainnet** with sub-cent oracle-query payments. Strongest
   for the demo ("these are real payments, on mainnet") and unambiguous for the
   track requirement. Needs a small amount of real HBAR.
2. **Self-host the BlockyDevs facilitator** against testnet. It is open source.
   More work, and using the ecosystem facilitator reads better than running our own.
3. **Split**: insurance flows on testnet, x402 oracle payments on mainnet.
   Slightly odd, cheap, defensible.

Recommendation: (1) or (3). The amounts are fractions of a cent per query.

## Hosting

The oracle services must be publicly reachable to count as "live". The AivyLabs
VPS already runs nginx + pm2 + certbot and serves `*.aivylabs.xyz`, so a
subdomain per oracle is the path. Check `df -h /` and `free -h` before deploying:
the box runs ~12 unrelated production services and disk has been tight.
