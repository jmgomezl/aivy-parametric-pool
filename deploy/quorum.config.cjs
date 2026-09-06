// Dedicated testnet service; secrets and the mutable policy book stay outside Git.
module.exports = { apps: [{
  name: 'aivy-quorum', cwd: '/opt/aivy-quorum', script: 'src/server.js',
  instances: 1, exec_mode: 'fork', max_memory_restart: '250M',
  env: { NODE_ENV: 'production', HEDERA_NETWORK: 'testnet', HOST: '127.0.0.1', PORT: '8792', TRUST_PROXY: '1' },
}] };
