// LP share token (HTS fungible).
//
// Treasury is the POOL AGENT, not the pool account. If the pool account were the
// treasury, minting shares to a depositor would be a transfer out of the pool,
// which requires the full and(agent, 2-of-3) key — so every deposit would need
// the oracle quorum online. Separating them keeps capital custody under the
// quorum while share issuance stays a routine agent operation.
import {
  TokenCreateTransaction, TokenType, TokenSupplyType, TokenMintTransaction,
  TransferTransaction, TokenAssociateTransaction,
} from '@hiero-ledger/sdk';

export const SHARE_DECIMALS = 8; // matches tinybar, so 1 HBAR deposited = 1 share at 1:1

export async function createShareToken(client, treasuryId, agentKey) {
  const tx = await new TokenCreateTransaction()
    .setTokenName('Aivy Risk Pool Share')
    .setTokenSymbol('ARPS')
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setDecimals(SHARE_DECIMALS)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyKey(agentKey.publicKey)   // agent alone can mint/burn shares
    .setAdminKey(agentKey.publicKey)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  return { tokenId: receipt.tokenId, txId: tx.transactionId.toString() };
}

export async function associate(client, accountId, accountKey, tokenId) {
  const tx = await (await new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([tokenId])
    .freezeWith(client)).sign(accountKey);
  const res = await tx.execute(client);
  await res.getReceipt(client);
  return res.transactionId.toString();
}

/** Mint `units` shares into the treasury, then move them to `toId`. */
export async function mintTo(client, tokenId, treasuryId, toId, units) {
  const mint = await new TokenMintTransaction()
    .setTokenId(tokenId).setAmount(units).execute(client);
  await mint.getReceipt(client);

  const move = await new TransferTransaction()
    .addTokenTransfer(tokenId, treasuryId, -units)
    .addTokenTransfer(tokenId, toId, units)
    .execute(client);
  await move.getReceipt(client);

  return { mintTxId: mint.transactionId.toString(), transferTxId: move.transactionId.toString() };
}

/**
 * The demo settlement unit.
 *
 * Named "Aivy Demo Dollar (unbacked)" on purpose: it is a dollar-denominated
 * accounting unit for a demonstration, not a claim on anything. Real USDC is
 * supported and preferred wherever there is enough of it — see src/asset.js.
 */
export async function createDemoUnit(client, treasuryId, agentKey) {
  const { TokenCreateTransaction, TokenType, TokenSupplyType } = await import('@hiero-ledger/sdk');
  const tx = await new TokenCreateTransaction()
    .setTokenName('Aivy Demo Dollar (unbacked)')
    .setTokenSymbol('aUSDd')
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setDecimals(6)
    .setInitialSupply(1_000_000 * 1e6)
    .setTreasuryAccountId(treasuryId)
    .setSupplyKey(agentKey.publicKey)
    .setAdminKey(agentKey.publicKey)
    .setTokenMemo('Unbacked demo unit. Not a stablecoin. Not redeemable.')
    .execute(client);
  const receipt = await tx.getReceipt(client);
  return { tokenId: receipt.tokenId, txId: tx.transactionId.toString() };
}
