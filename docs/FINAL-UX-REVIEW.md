# Final recording-readiness review · September 6, 2026

Verdict: the verified demo flow is ready to record. This is a hackathon prototype;
submission eligibility and the finished video still need the owner's review.

| Journey / requirement | Current evidence |
| --- | --- |
| Discover a location | Live search for unaccented “Medellin” returned Medellín, Antioquia and disambiguated worldwide names; keyboard selection opened the right quote. Global shortcuts and the three featured geographic NFTs remain visible. |
| Understand historical pricing | $800 fixed-payout graph retained; keyboard selection changed history and quote to 2025 together; red/green yearly comparison remained visible. Return action restored current cover. |
| Create and inspect cover | Browser created funded testnet policy #27. Mint, NFT delivery and premium transfer independently returned SUCCESS from the Hedera mirror. Agent signature is present; oracle count is correctly 0/2. |
| Find the new policy | Created here showed #27 in this browser. Global demos remained the three curated Tokyo, California and Mexico records. |
| Understand funding | Mobile LP slider moved to 100%; Tokyo outcome showed 114.78 aUSDd if no payout versus 4 aUSDd after capital is used. Preview status, gross rate and full-capital risk were visible. |
| Understand Uniswap | Both mainnet chains were verified in the preceding integration audit; real quote IDs/routes are committed in evidence/uniswap-quotes.json. The optional conversion remains on cover quotes and policy detail; no redemption or execution is implied. |
| Understand the mechanism | All six story steps navigated at 320px, with distinct headings, intact evidence links and no horizontal overflow. Testnet, recorded mainnet, live Uniswap API, and proposed LP scope are separated in the disclosure. |
| Verify paid oracle activity | x402 panel showed the real 0.001 aUSDd testnet receipt, facilitator/network label and distinction between payment and claim approval. |
| Recover from an invalid policy | Missing-policy page offered recovery; verification panel contained zero unrelated receipts. Previously it could fall back to the latest policy. |
| Keyboard navigation | Skip-to-content focuses main without changing story hash. Story arrow shortcuts no longer consume keys inside a policy dropdown. |
| Responsive layout | Inspected cover, policy, funding and gallery at 320px; all story steps at 320px; scope/control checks at 768px; desktop gallery at 1440px. No horizontal overflow in these checks. Earlier Uniswap audit includes its mobile conversion layout. |
| Build and regression checks | Production build and all 32 tests pass. Existing large-bundle warning remains; it did not block the tested navigation. |

## Final changes from this review

- Prevented unrelated receipts from appearing under an invalid policy URL.
- Kept story shortcuts out of dropdowns and editable content.
- Added a keyboard-only skip link, without extra visual clutter.
- Included Uniswap in the scope disclosure and the timed recording guide.

## Recording boundaries

Show real testnet cover issuance, recorded mainnet settlement, live Uniswap
market quotes, and proposed per-policy funding as distinct capabilities.
Earthquake oracle checks are manually requested; the demo does not prove
independent oracle operators. No new mainnet transfer or swap was submitted in
this review. Only funded testnet policy #27 was created for the end-to-end check.

Follow docs/SUBMISSION.md for the 3:15 recording path and the official video
requirements. This review does not mean a video has been recorded or a dashboard
submission has been made.
