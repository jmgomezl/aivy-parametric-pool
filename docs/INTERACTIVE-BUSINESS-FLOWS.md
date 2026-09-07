# Interactive business flows

## Participants

| Role | Action | Real testnet result |
| --- | --- | --- |
| Buyer | Start demo account; choose cover; pay premium | Account tokens fund the policy beneficiary's premium payment; beneficiary receives frozen NFT and scheduled payout. |
| Liquidity provider | Deposit 1–100 aUSDd into shared pool | Atomic token deposit and fungible ARPS delivery. Demo share issuance is 1:1, not NAV pricing. |
| Broker | Share account's referral link/code | 15% of referred premium reaches broker; 85% reaches pool, atomically. No referral means 100% to pool. |
| Policyholder / oracle services | Policy → Check for earthquakes | Up to 0.003 test aUSDd pays three x402 queries; each service verifies the recorded policy before any signature. Payment and claim approval remain separate. |

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

## Verified September 7, 2026

- UI account 0.0.10408106 received 1,000 real aUSDd; deposited 25 and received
  25 ARPS, then paid a 4 aUSDd premium. Displayed balance: 971 aUSDd.
- Policy #29: NFT mint/delivery and premium transfer succeeded. Broker
  0.0.10408125 received 0.60 aUSDd; pool received 3.40 aUSDd.
- A separate 1 aUSDd deposit replay returned the same receipt, without a second
  charge. Unauthorized deposit, oversized amount and self-referral checks were
  refused without changing balances or the action journal.
- 46 offline tests and production build pass. Desktop funding/purchase/broker
  panels and 320px account/scenario layouts reviewed; no horizontal overflow.
- Referral parameter survives city selection. Broker shortcut opens the account
  disclosure. UI balance polling uses stable subscriptions and free mirror reads.

[Machine-readable receipt evidence](evidence/business-flows.json).

The remaining business work is NAV share accounting, withdrawal/claim-loss
allocation and income distribution, independent oracle custody, and production
customer authentication. These are disclosed limitations, not working buttons
or promised LP payouts. The current fee model routes premium to pool/broker;
no separate platform fee is collected.

## Terminology and decision review

Plain labels now connect insurance and blockchain concepts: Cover active
(previously Committed), Cover receipt (NFT), Funding estimate (previously LP
preview), and pool-share tokens (ARPS). Premium, payout, pool and broker are
defined beside the money-flow diagram. Deposit restrictions explain that users
cannot withdraw or collect investment income in this demo; acronym-only NAV
wording was replaced with an explanation of the share-pricing limitation.

The annual first-claim bar now represents first-term income only, matching the
scenario amount. Previously it incorrectly drew full-year income. Explicitly
refused deposit requests (400/401/429) unlock editing; uncertain submissions
retain their identifier for reconciliation. Desktop/320px checks verified the
funding-estimate-to-deposit handoff, visible definitions and no horizontal overflow.

### Account panel: judge-first scan

The account panel prioritizes balance, pool shares and referral earnings. A visual **Share link → Buyer pays → 15% for you** flow leads to one copy-link action. Commission terms, testing instructions, transaction receipts and custody details expand on demand. Testnet / no cash value and service-managed custody remain visible. Clipboard failure exposes a selectable link.

Verified at 320px and desktop: no horizontal overflow; referral copy feedback, disclosure controls, close button and home broker shortcut work. No ledger writes are required for this presentation change.

### Depositor position

The funding page shows the connected demo account’s ARPS balance, percentage of issued ARPS (balance ÷ live token supply, using token decimals), account verification and latest completed deposit receipt. This is a token holding percentage, not APY, asset ownership or distributed earnings. Missing supply renders an unavailable percentage. Investment income distributions and withdrawals remain unimplemented and are visibly labeled.
