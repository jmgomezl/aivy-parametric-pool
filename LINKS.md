# On-chain artifacts

Every account, token, schedule and transaction this project produced, recorded as
it was produced. Network: Hedera **testnet**.

## D1 — 2026-09-04 — pool, share token, 1:1 deposit
- pool account `0.0.10368678` (key = and(agent, 2-of-3 oracles)) — https://hashscan.io/testnet/account/0.0.10368678
- share token `0.0.10368679` (ARPS) — https://hashscan.io/testnet/token/0.0.10368679
- lp account `0.0.10368680` — https://hashscan.io/testnet/account/0.0.10368680
- atomic deposit 20 HBAR -> 20 ARPS — https://hashscan.io/testnet/transaction/0.0.7231440@1788555565.178629657
- schedule `0.0.10368695` — agent + 2 oracles, **self-executed** — https://hashscan.io/testnet/schedule/0.0.10368695
- schedule `0.0.10368699` — all 3 oracles, agent absent, **never executed** — https://hashscan.io/testnet/schedule/0.0.10368699

## D2 — 2026-09-04 — policy NFT, terms on HCS, atomic premium
- policy terms topic `0.0.10368891` seq 1 — https://hashscan.io/testnet/topic/0.0.10368891
- policy collection `0.0.10368893` serial 1 (non-transferable) — https://hashscan.io/testnet/token/0.0.10368893
- atomic premium split buyer/pool/broker — https://hashscan.io/testnet/transaction/0.0.7231440@1788556806.548458583
