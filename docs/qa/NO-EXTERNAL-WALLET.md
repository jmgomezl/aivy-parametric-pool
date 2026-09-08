# Public demo: no external-wallet branch

The old native ETH → test USDC form could reappear when the browser had saved
`quorum.swap.wallet-mode=own`. It requested an extension even though judges
were meant to use funded demo wallets.

The public app now has one signing path: its isolated, service-managed demo
wallet. The mode selector, external bridge/swap forms and external LP controls
were removed from the browser code. Navigation, policy conversion, the story,
network links and the starter shortcut all enter the same funded flow. The
native ETH operator adapter and recorded receipts remain available in the repo.
Old personal-wallet transaction journals are preserved; they are never retried
or cleared by the managed flow.

## Browser regression

18 checks passed against the local UI and current deployed API. The browser was
seeded with the old `own` preference and old pending journals. An injected
`ethereum` getter counted access and threw immediately; it was never accessed.

- A live managed swap quote reached **Swap on Sepolia** without an extension.
- LP controls opened the funded demo account and closed correctly.
- Reload retained the managed flow and preserved old journals.
- Main navigation, Uniswap/Axelar network links, starter shortcut, policy
  conversion and the story all reached the managed page.
- Forms fit 320, 375, 620, 768, 1024 and 1280px without horizontal overflow.
- No browser runtime errors. No ledger transaction was submitted by these checks.

The production build contains no injected-wallet connection or signing calls.
`npm test`: 89 passing; UI production build passes. README instructions and UI
screenshots now show the single funded flow.
