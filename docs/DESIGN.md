# Design: understand first, inspect deeper

<table>
<tr>
<td width="50%"><img src="media/01-atlas.png" alt="The atlas: every recorded shallow M6+ earthquake since 1970"></td>
<td width="50%"><img src="media/quorum-story.gif" alt="Current six-scene mainnet replay: choose, commit, confirm, release, verify and protect"></td>
</tr>
<tr>
<td><b>The atlas.</b> Nothing here is drawn. The fault lines emerge from plotting
6,311 real shallow M6+ events, so the map is the evidence rather than a picture of it.</td>
<td><b>How it works.</b> Six scenes over one real mainnet settlement — choose,
commit, confirm, release, verify, protect — labelled as a recording, not live.</td>
</tr>
</table>

**Cover → Policies → Swap → How it works.** Four destinations. Network roles are
visible on arrival; technical evidence stays one disclosure away.

| Visual | What it teaches |
| --- | --- |
| **World map + geographic NFTs** | Where cover applies; worldwide search and Mexico/California/Tokyo demos. |
| **Interactive premium history** | Beside the map, below the location estimate: a fixed **$800 modeled payout**, interactive year selection and red/green annual change. [View the layout](media/08-explore-history.png). |
| **LP contribution + two outcomes** | Premium share and principal at risk, explicitly labeled as a preview. |
| **Hedera → Axelar → Uniswap** | Native cover, cross-chain transport and EVM liquidity have distinct roles. Two action steps sit beside labeled testnet examples. |
| **Signatures → transfer → receipt** | Who signed, why execution happened or was blocked, and where to verify it. |
| **Responsive disclosures** | Minimal main copy, mobile stacking, keyboard focus and reduced motion; 320px through desktop reviewed. |

## Design improvements
| Improvement | What the visitor sees / why it matters |
| --- | --- |
| Global discovery | City labels resize for phones, avoid overlaps and zoom controls, and give the selected location priority. Debounced Photon/OpenStreetMap city and municipality search, keyboard selection, coordinate entry, map pinning, zoom/pan, and Mexico, California and Tokyo demos. Unaccented “Medellin” was verified. Search coverage depends on the upstream catalogue. |
| Geographic NFT identity | Aivy Quorum branding, local map, approximate 100 km protected area, terms, payout and network replace abstract artwork. Cover NFTs and proposed LP receipts remain visually distinct. |
| Understandable pricing history | A full-width **Explore data +** row aligns with the other options in the right-hand panel and opens the chart directly under the selected location’s estimate. On phones/tablets, it stacks below the map and opens at the location details. The premium-over-time chart holds the modeled payout at **$800**, with the selected year and red/green annual variation. Click, tap or drag the chart—or use the keyboard/timeline—to choose a year. Historical exploration cannot change issued terms; returning to Cover restores the current M6+ quote. |
| Visual funding preview | Contribution slider, premium share and two claim outcomes show how capital might participate. The policy term leads the preview; the annual comparison stays in its assumptions. Premiums are before claims/costs, and contributed principal can be used for a payout. One model/limitations disclosure holds the assumptions; claim/no-claim bars align even when labels wrap. Preview/unminted labels remain visible. |
| A clearer six-scene story | Geographic terms → capital commitment → named signatures → transfer animation → NFT/receipts → blocked authorization control. Direct step links and previous/next controls keep the recorded mainnet demonstration navigable. Mobile shows debit and credit side by side. |
| Explicit signature evidence | Old circular diagrams were replaced with **agent key AND oracle threshold → observed result**. “3 signed · 2 required” avoids ambiguous counts. Missing agent signature explains the blocked control; unknown ledger status remains unverified. |
| Quiet blockchain visibility | Optional Onchain/Verify panel and contextual receipt links expose NFT mint/delivery, transfers, agent/oracle actions and x402 evidence. Testnet, recorded mainnet, live API quotes and proposed funding are labeled separately. Three compact catalogue results expand into full verdicts, x402 payments and signatures. Unknown or invalid policies do not borrow another policy's receipts. |
| Discoverable Uniswap execution | A main-nav Swap page separates Bridge and Swap, preserves in-progress form state between steps and shows example receipts beside the actions. Quote/policy links lead here directly. Mainnet price previews remain separate, collapsed and fetched only on demand. Expiring reviews and labeled latest receipts keep preparation distinct from completed transactions. |
| Funding decisions | Existing holders see ARPS and percentage of issued shares before pool totals; the deposit action states that withdrawals and LP income are unavailable. The percentage is a holding share, never an APY. The account’s Pool shares link goes directly to this position. |
| Recovery and navigation | Saved request IDs, interrupted-request review, honest loading/refusal/offline states and retry links. Budget/duration precede purchase; expired swap/LP reviews request a refresh. Popups close without discarding the quote behind them. Location persists on refresh, gallery filters survive detail round trips, invalid routes offer recovery, and “Created here” means this browser—not wallet ownership. |
| Responsive and accessible controls | Mobile policy views lead with the location and status; layouts stack and story navigation remains accessible; maps/charts have text descriptions, controls support keyboard use, focus is visible for keyboard interaction, and reduced-motion preferences are respected. Recent reviews covered 320 px mobile through desktop without horizontal overflow in the checked flows. |

The [implementation audit](../AUDIT-IMPLEMENTATION.md) records the delivered changes
and checks; the [current readiness review](qa/READINESS-REVIEW.md) covers
Cover, Policies, NFT/LP, historical chart, story and the direct Swap journey. The
[September 6 review](FINAL-UX-REVIEW.md) preserves the earlier recording baseline. Legacy ring components in
unrouted source files are not used by the active app. These are documented
browser checks, not a claim of exhaustive device or accessibility certification.
The [history sidebar review](qa/EXPLORE-SIDEBAR.md) covers responsive placement,
playback, pointer/touch/keyboard selection and returning to the current quote.
