# Interactive business flows

## Participants

| Role | Action | Real testnet result |
| --- | --- | --- |
| Buyer | Start demo account; choose cover; pay premium | Account tokens fund the policy beneficiary's premium payment; beneficiary receives frozen NFT and scheduled payout. |
| Liquidity provider | Deposit 1–100 aUSDd into shared pool | Atomic token deposit and fungible ARPS delivery. Demo share issuance is 1:1, not NAV pricing. |
| Broker | Share account's referral link/code | 15% of referred premium reaches broker; 85% reaches pool, atomically. No referral means 100% to pool. |
| Oracle services | Verify published conditions when requested | Paid x402 access is separate from the policy-bound signature decision. |

Start under **Your demo account**. The service sponsors 1,000 unbacked testnet
aUSDd and network fees. This is a real Hedera account with service-held keys;
its browser-held random capability authorizes the constrained demo actions.
Clearing browser storage loses access. No production wallet custody is claimed.

The funding gallery has a real **Deposit into shared pool** action. Individual
policy cards show economics only: they do not create isolated policy vaults or
LP NFTs. Term, 30-day and annual scenarios assume constant-rate renewals without
compounding; a first-term claim consumes capital and stops further income.
Withdrawals, NAV-priced shares and automatic premium distributions remain
unimplemented and are labeled before a deposit. There is no guaranteed yield.

## New service boundaries

- Testnet registered unbacked token only; no public mainnet account/deposit path.
- Capability tokens require 256 bits of random browser-generated material;
  server journals store SHA-256 digests, never the bearer token.
- Durable starter limits: 3 accounts/IP/rolling day, 100 total/day. Each starter
  gets 1,000 aUSDd. Repeating a session does not fund it again.
- Durable action limits: 12 actions/account/day and 200 total/day. Existing
  issuance capital and daily exposure guards remain mandatory.
- All account/deposit mutations and policy writes serialize with the existing
  issuance lock. Submitted operations remain pending on uncertainty; operators
  must reconcile before another action. Deposit identifiers are checkpointed.
- Exact deposit fields, amount bounds, sufficient ledger balance, registered
  broker codes, no self-referrals, and no client-selected beneficiary or keys.
- Session journal and custody keys remain in private `.artifacts` files.

## Verification

`npm test` includes capabilities, persisted account quotas, replay/mismatched
request protection, pending-action blocking, broker validation and multi-period
scenarios. `npm --prefix ui run build` checks the browser implementation.
