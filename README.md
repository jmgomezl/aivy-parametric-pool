# Aivy Parametric Pool

Parametric catastrophe cover that settles **without a smart contract and without a
keeper**. The payout is a Hedera Scheduled Transaction, pre-signed when the policy
is bought. Its trigger condition is signature collection: when a quorum of
independent oracle agents signs, the network executes the transfer itself.

No Solidity anywhere. Native Hedera services only.

> **Status: prototype on Hedera testnet.** Not an insurance product, not offered
> to the public. See [Regulatory position](#regulatory-position).

---

## The problem

A $4 earthquake policy does not exist, anywhere. Not because the risk is
unpriceable — because the human labour to sell it, price it, and settle it costs
more than the premium. The product is killed by its own overhead.

Agents collapse that overhead. This repo is the settlement rail that lets them.

## The mechanism

The pool account's key is an **AND** of two branches:

```
KeyList[                        <- no threshold => every branch required
  poolAgentKey,                 <- signs ONCE, at policy purchase
  KeyList[o1, o2, o3] (2)       <- 2-of-3 oracles, sign at trigger time
]
```

The naive design puts the oracle keys directly on the pool account. That makes
the same quorum able to sign *any* transaction out of the treasury — the oracles
become custodians. Nesting them under an AND means:

- the agent commits at purchase, so **nothing of ours has to be awake later**;
- at trigger time the only missing signatures are the oracles';
- **the oracle quorum alone can never move a tinybar.**

## Verified on testnet, day 1

Both directions of that claim are proved on-chain, not asserted:

| | schedule | result |
|---|---|---|
| agent + 1 oracle | [0.0.10368695](https://hashscan.io/testnet/schedule/0.0.10368695) | pending — quorum not met |
| agent + 2 oracles | [0.0.10368695](https://hashscan.io/testnet/schedule/0.0.10368695) | **executed itself**, nobody submitted it |
| all 3 oracles, agent never signed | [0.0.10368699](https://hashscan.io/testnet/schedule/0.0.10368699) | never executed — drain blocked |

Reproduce: `npm run d1 && node scripts/verify-quorum.js`

## Pricing

Premiums come from the live USGS ComCat catalogue, not from a constant. A Poisson
rate is estimated as a **density over a wide reference region** and scaled to the
trigger circle, because counting inside the trigger circle alone rests on n=1 and
swings the price 12x with the radius. Every input travels with the quote so
anyone can recompute it.

```
Armenia, Quindio        n= 12  lambda=0.0235/yr  P30d=0.193%   $3.09
Pasto, Narino           n= 17  lambda=0.0333/yr  P30d=0.273%   $4.37
Bucaramanga, Santander  n=  4  lambda=0.0078/yr  P30d=0.064%   $1.03
Tokyo, Japan            n=103  lambda=0.2019/yr  P30d=1.645%  $26.32
```
*(30-day cover, $800 payout, 50% target loss ratio — `node scripts/quote.js`)*

Bucaramanga prices low despite its famous seismic nest because the nest is deep
and the `depth < 70km` filter excludes it. The model is picking up real physics.

This is a transparent, reproducible **first-order** model. It ignores time
dependence (aftershock clustering, seismic gaps) and understates the tail. It is
not actuarial-grade and is not presented as such.

---

## Prior work boundary (CONTINUITY track)

**Everything in this repository was written during ETHOnline 2026 (from
2026-09-04).** The repo has no pre-event commits.

What existed before the event, and does **not** count as new work:

- **[aivy-studio](https://github.com/jmgomezl/aivy-studio)** — the multi-agent
  orchestration canvas this project is built to run on. Existing HCS-10 transport,
  HTS escrow, workflow schema, canvas rendering.
- **[jmgomezl/aivy](https://github.com/jmgomezl/aivy)** — earlier APEX-hackathon app.
- **hak-saucerswap-plugin, hak-pyth-plugin** — endorsed third-party plugins in the
  Hedera Agent Kit docs.
- **hak-uniswap-plugin** — Uniswap Trading API plugin with allowance handling and a
  Ledger threshold gate, proven on Sepolia. Reused here for cross-asset settlement.
- **Aivy Settlement Layer (ETHGlobal Lisbon, July 2026)** — a prior continuity
  build on aivy-studio that also used HTS pools and Scheduled Transactions. The
  overlap is the *substrate*; what is new here is stated below.

What is **new**, built during this event:

1. **Signature-gated conditional settlement** — payout as a pre-signed Scheduled
   Transaction whose trigger is oracle-quorum signature accumulation, with the
   nested `and(agent, k-of-n)` key that makes it safe. Extracted as a reusable
   Hedera Agent Kit plugin, not left inside the app.
2. **A hazard-priced underwriting agent** — premiums derived live from the USGS
   catalogue for any lat/lon on earth, with published inputs.
3. **A solvency guard** enforcing `exposure <= capital` as a permanent invariant.
4. **Atomic premium settlement with an open broker channel** — buyer, pool and an
   arbitrary per-sale broker settled in one multi-party transaction.
5. **x402-gated oracle services** — the oracle agents are the paid service, not
   just consumers of one.

## How this differs from Etherisc

[Etherisc](https://etherisc.com/) has run decentralized parametric insurance since
2016 and, with ACRE Africa, covers 22,000 Kenyan farmers. The space is not empty
and pretending otherwise would be dishonest.

The difference is mechanical, not cosmetic: **Etherisc is a Solidity protocol
where a keeper calls a contract to release a payout. Here there is no contract and
no keeper.** Settlement is a ledger primitive — the transaction is already signed
and waiting, and it runs when the quorum completes. That is what makes the
per-policy overhead small enough for a $4 premium.

## Regulatory position

This is infrastructure, not a product. The regulated act is *selling a policy to a
consumer*; the settlement rail is not that. The production path is **fronting** —
a licensed insurer issues the cover and carries the regulatory risk while this
provides the rail — which is the same route Etherisc took with ACRE Africa. There
is no jurisdictional loophole here and none is claimed.

## Known limits

- **Basis risk.** A M5.8 that destroys your house pays nothing. The product pays
  on a threshold, not on damage.
- **Scheduled Transactions expire at 62 days**, so cover is scoped to 30 days.
  Re-scheduling is deliberately not implemented: it would reintroduce a keeper.
- **Correlated risk.** Policies in one zone all fire together. Capital is sized to
  the probable maximum loss of a single event, not to aggregate exposure.

## Layout

```
src/pool/keys.js        the AND(agent, k-of-n) key structure — the load-bearing decision
src/pool/shares.js      HTS share token; treasury is the agent, not the pool
src/pool/deposit.js     atomic HBAR-in / shares-out
src/pricing/hazard.js   Poisson rate density over the USGS catalogue
scripts/d1-bootstrap.js pool + token + deposit, end to end
scripts/verify-quorum.js the two adversarial proofs above
research/               live probe results: x402 facilitator, hazard model
LINKS.md                every on-chain artifact produced, as it was produced
```

MIT.
