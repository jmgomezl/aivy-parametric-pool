// LP deposit. D1 issues shares 1:1 with HBAR; D5 will price them at NAV.
//
// The HBAR leg and the share leg are ONE atomic TransferTransaction, so an LP can
// never pay into the pool without receiving shares in the same consensus event.
// This is the same multi-party atomic primitive the premium split will use later
// (buyer -> pool + broker in a single transaction).
import { TransferTransaction, Hbar, TokenMintTransaction } from '@hiero-ledger/sdk';
import { SHARE_DECIMALS } from './shares.js';

export const sharesFor = (hbar) => Math.round(hbar * 10 ** SHARE_DECIMALS); // 1:1 at D1

export async function deposit(client, { tokenId, treasuryId, poolId, lpId, lpKey, hbarAmount }) {
  const units = sharesFor(hbarAmount);

  // Shares must exist in the treasury before the atomic swap can move them.
  const mint = await new TokenMintTransaction()
    .setTokenId(tokenId).setAmount(units).execute(client);
  await mint.getReceipt(client);

  const tx = await (await new TransferTransaction()
    .addHbarTransfer(lpId, new Hbar(-hbarAmount))
    .addHbarTransfer(poolId, new Hbar(hbarAmount))
    .addTokenTransfer(tokenId, treasuryId, -units)
    .addTokenTransfer(tokenId, lpId, units)
    .freezeWith(client)).sign(lpKey);

  const res = await tx.execute(client);
  await res.getReceipt(client);

  return { units, mintTxId: mint.transactionId.toString(), depositTxId: res.transactionId.toString() };
}
