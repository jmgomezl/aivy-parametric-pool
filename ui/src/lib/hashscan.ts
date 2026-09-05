// Every id on screen resolves to HashScan. Transactions are addressed by their
// consensus timestamp where we have one (unambiguous for scheduled executions,
// which share a transaction id with the ScheduleCreate that made them) and by
// the `0.0.x@seconds.nanos` id otherwise.
export type Kind = 'account' | 'token' | 'topic' | 'schedule' | 'transaction';

const NETWORK = 'mainnet';

export function hashscan(kind: Kind, id: string): string {
  return `https://hashscan.io/${NETWORK}/${kind}/${id}`;
}

export const hsAccount = (id: string) => hashscan('account', id);
export const hsToken = (id: string) => hashscan('token', id);
export const hsTopic = (id: string) => hashscan('topic', id);
export const hsSchedule = (id: string) => hashscan('schedule', id);
export const hsTx = (idOrConsensus: string) => hashscan('transaction', idOrConsensus);
export const hsNft = (tokenId: string, serial: number) => `https://hashscan.io/${NETWORK}/token/${tokenId}/${serial}`;
// HashScan has no per-message route; the topic page lists every message with its sequence number.
export const hsTopicMessage = (topicId: string, _seq: number) => `https://hashscan.io/${NETWORK}/topic/${topicId}`;
