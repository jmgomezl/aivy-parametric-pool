// Every id on screen resolves to HashScan. Transactions are addressed by their
// consensus timestamp where we have one (unambiguous for scheduled executions,
// which share a transaction id with the ScheduleCreate that made them) and by
// the `0.0.x@seconds.nanos` id otherwise.
//
// The story is a mainnet run; the live agent issues on testnet. Every link
// carries its network explicitly so the two never get mixed up.
export type Kind = 'account' | 'token' | 'topic' | 'schedule' | 'transaction';
export type Network = 'mainnet' | 'testnet';

export function hashscan(kind: Kind, id: string, network: Network = 'mainnet'): string {
  return `https://hashscan.io/${network}/${kind}/${id}`;
}

export const hsNft = (tokenId: string, serial: number, network: Network = 'mainnet') => `https://hashscan.io/${network}/token/${tokenId}/${serial}`;
// HashScan has no per-message route; the topic page lists every message with its sequence number.
export const hsTopicMessage = (topicId: string, _seq: number, network: Network = 'mainnet') => `https://hashscan.io/${network}/topic/${topicId}`;
/** `hcs://0.0.x/seq` -> the topic page. */
export const hsPointer = (pointer: string, network: Network) => hsTopicMessage(pointer.replace(/^hcs:\/\//, '').split('/')[0], 0, network);
