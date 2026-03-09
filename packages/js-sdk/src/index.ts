export { 
    startStdioServer,
    createServerConnections,
    ServerType,
    type ServerConnection 
} from './server/stdio/start-stdio-server.js';

export { proxyServer } from './server/stdio/proxy-server.js';

// Hedera network configuration
export {
    HEDERA_NETWORKS,
    SUPPORTED_HEDERA_NETWORKS,
    DEFAULT_HEDERA_NETWORK,
    HEDERA_FACILITATOR_URL,
    getHashScanUrl,
    getHCSTopicUrl,
    type HederaNetworkName,
} from './networks/hedera.js';

// Re-export commonly used types from dependencies
export type { Account } from 'viem';
export type { Client } from '@modelcontextprotocol/sdk/client/index.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
