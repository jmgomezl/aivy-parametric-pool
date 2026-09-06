// Run all three oracle services at once, each with its own account and key.
import { spawn } from 'node:child_process';
import { load } from '../src/registry.js';
import { NETWORK, operator } from '../src/config.js';
import { SOURCE_KEYS } from '../src/oracle/sources.js';

const reg = load(NETWORK);
if (!reg.oracleAccountIds) throw new Error('Run: npm run provision:oracles');
const agent = operator();

SOURCE_KEYS.forEach((source, i) => {
  const child = spawn(process.execPath, ['src/oracle/service.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SOURCE: source,
      PORT: String(8801 + i),
      ORACLE_ACCOUNT_ID: reg.oracleAccountIds[i],
      ORACLE_PRIVATE_KEY: reg.oraclePrivateKeys[i],
      // The facilitator pays gas so the oracle never needs HBAR of its own.
      X402_FEE_PAYER_ID: agent.id.toString(),
      X402_FEE_PAYER_KEY: process.env.HEDERA_OPERATOR_KEY,
    },
  });
  process.on('SIGINT', () => child.kill('SIGINT'));
});
