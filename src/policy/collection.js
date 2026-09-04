// Policy NFT collection.
//
// Policies are NON-TRANSFERABLE by design. The payout is a Scheduled Transaction
// with the recipient written into it at purchase, so if a policy changed hands the
// payout would still go to the original buyer. Rather than leave that trap open,
// the holder's account is frozen for this token once the policy is delivered.
import {
  TokenCreateTransaction, TokenType, TokenSupplyType, TokenMintTransaction,
  TokenFreezeTransaction, TransferTransaction,
} from '@hashgraph/sdk';

export async function createPolicyCollection(client, treasuryId, agentKey) {
  const res = await new TokenCreateTransaction()
    .setTokenName('Aivy Parametric Policy')
    .setTokenSymbol('APOL')
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Infinite)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyKey(agentKey.publicKey)
    .setAdminKey(agentKey.publicKey)
    .setFreezeKey(agentKey.publicKey) // used to make delivered policies non-transferable
    .execute(client);
  const receipt = await res.getReceipt(client);
  return { tokenId: receipt.tokenId, txId: res.transactionId.toString() };
}

/** Mint one policy whose metadata is the HCS pointer to its terms. */
export async function mintPolicy(client, tokenId, hcsPointer) {
  const bytes = Buffer.from(hcsPointer, 'utf8');
  if (bytes.length > 100) throw new Error(`metadata ${bytes.length}B exceeds the 100B NFT limit`);
  const res = await new TokenMintTransaction()
    .setTokenId(tokenId).setMetadata([bytes]).execute(client);
  const receipt = await res.getReceipt(client);
  return { serial: receipt.serials[0].toString(), txId: res.transactionId.toString(), metadataBytes: bytes.length };
}

/** Deliver the policy and freeze it in place. */
export async function deliverAndFreeze(client, tokenId, serial, fromId, toId) {
  const move = await new TransferTransaction()
    .addNftTransfer(tokenId, serial, fromId, toId).execute(client);
  await move.getReceipt(client);
  const freeze = await new TokenFreezeTransaction()
    .setTokenId(tokenId).setAccountId(toId).execute(client);
  await freeze.getReceipt(client);
  return { transferTxId: move.transactionId.toString(), freezeTxId: freeze.transactionId.toString() };
}
