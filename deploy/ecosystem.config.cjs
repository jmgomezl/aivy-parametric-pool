// One process per catalogue, with separate accounts and signing keys.
// These demo processes are operated together; isolation is not operator independence.
const shared = { cwd: '/opt/aivy-oracles', script: 'src/oracle/service.js',
  instances: 1, exec_mode: 'fork', max_memory_restart: '180M',
  env: { NODE_ENV: 'production', HEDERA_NETWORK: 'testnet' } };

const oracle = (source, port) => ({
  ...shared,
  name: `aivy-oracle-${source}`,
  env: {
    ...shared.env,
    SOURCE: source,
    PORT: String(port),
    PUBLIC_URL: `https://${source}.aivylabs.xyz`,
    ORACLE_ACCOUNT_ID: process.env[`ORACLE_${source.toUpperCase()}_ACCOUNT_ID`],
    ORACLE_PRIVATE_KEY: process.env[`ORACLE_${source.toUpperCase()}_PRIVATE_KEY`],
  },
});

module.exports = { apps: [oracle('usgs', 8811), oracle('emsc', 8812), oracle('geofon', 8813)] };
