# VLayer Web Proof Integration

This module provides web proof generation and parsing functionality for MCP servers using the VLayer web prover service.

## Features

- **Fetch Wrapper**: Automatically generates web proofs for HTTP requests
- **Web Proof Parser**: Extracts and parses web proof data from hex blobs
- **Response Analysis**: Convenient functions to extract request/response data from proofs
- **TypeScript Support**: Full type safety and IntelliSense support

## Quick Start

### Basic Usage

```typescript
import { VLayer } from './index.js';
import { extractResponseJson, extractRequestData } from './webproof-parser.js';

// Create a fetch wrapper that generates web proofs
const proofedFetch = VLayer.createFetchWrapper();

// Use it like regular fetch
const result = await proofedFetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'test' })
});

console.log('Response status:', result.response.status);

if (result.proof) {
  console.log('Web proof generated:', result.proof.presentation);
  
  // Extract data from the proof
  const requestData = extractRequestData(result.response, result.proof.presentation);
  const responseData = extractResponseJson(result.response, result.proof.presentation);
  
  console.log('Request URL:', requestData?.url);
  console.log('Response data:', responseData);
}
```

### MCP Server Integration

```typescript
import { VLayer } from './index.js';

// For MCP server requests with Hedera x402 payment headers
const result = await proofedFetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-vlayer-enabled': 'true',
    'x-payment': '<base64-encoded x402 payment header>',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'hbar_account_balance', arguments: { accountId: '0.0.6514537' } }
  })
});
```

### Parsing Existing Web Proofs

```typescript
import { parseWebProofHex } from './webproof-parser.js';

// Parse a hex proof blob returned by vlayer
const proofHex = "<hex string from vlayer proof response>";
const parsed = parseWebProofHex(proofHex);

console.log('Request headers:', parsed.request?.headers);
console.log('Response body JSON:', parsed.response?.bodyJson);
console.log('Response headers:', parsed.response?.headers);
```

## API Reference

### VLayer Class

#### `VLayer.createFetchWrapper(originalFetch?: typeof fetch)`

Creates a fetch wrapper that automatically generates web proofs for requests.

**Parameters:**
- `originalFetch` (optional): The original fetch function to wrap. Defaults to global `fetch`.

**Returns:**
- A function that behaves like `fetch` but returns a `ProofedResponse` with web proof data.

#### `VLayer.generateWebProof(request: WebProofRequest)`

Generates a web proof for a given request.

**Parameters:**
- `request`: The web proof request object containing URL, method, headers, and body.

**Returns:**
- Promise resolving to a `WebProofResponse` with the proof presentation.

#### `VLayer.validateWebProof(webProof: WebProofResponse)`

Validates a web proof presentation.

**Parameters:**
- `webProof`: The web proof response to validate.

**Returns:**
- Boolean indicating if the proof is valid.

### Web Proof Parser Functions

#### `parseWebProofHex(hex: string)`

Parses a vlayer web proof hex blob and extracts request/response data.

**Parameters:**
- `hex`: The hex string containing the web proof.

**Returns:**
- `ParsedWebProof` object with request and response data.

#### `extractWebProofData(response: Response, proofPresentation?: string)`

Extracts web proof data from a Response object and its associated proof.

**Parameters:**
- `response`: The Response object.
- `proofPresentation`: The proof presentation string.

**Returns:**
- `ParsedWebProof` object or `null` if extraction fails.

#### `extractResponseJson(response: Response, proofPresentation?: string)`

Extracts JSON data from a Response object using web proof.

**Parameters:**
- `response`: The Response object.
- `proofPresentation`: The proof presentation string.

**Returns:**
- Parsed JSON object or `null`.

#### `extractResponseHeaders(response: Response, proofPresentation?: string)`

Extracts headers from a Response object using web proof.

**Parameters:**
- `response`: The Response object.
- `proofPresentation`: The proof presentation string.

**Returns:**
- Headers object or `null`.

#### `extractRequestData(response: Response, proofPresentation?: string)`

Extracts request data from a Response object using web proof.

**Parameters:**
- `response`: The Response object.
- `proofPresentation`: The proof presentation string.

**Returns:**
- Request data object or `null`.

## Types

### `WebProofRequest`
```typescript
interface WebProofRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: string[];
  body?: string;
}
```

### `WebProofResponse`
```typescript
interface WebProofResponse {
  presentation: string;
}
```

### `ProofedResponse`
```typescript
interface ProofedResponse {
  response: Response;
  proof?: WebProofResponse;
}
```

### `ParsedWebProof`
```typescript
interface ParsedWebProof {
  url: string | null;
  request: ParsedRequest | null;
  response: ParsedResponse | null;
  notaryPubKey?: string | null;
}
```

## Error Handling

The module includes comprehensive error handling:

- Web proof generation failures are logged as warnings and don't interrupt the fetch
- Parsing errors are caught and handled gracefully
- Invalid proofs return `null` instead of throwing errors
- All functions include proper TypeScript error types

## Dependencies

- `jmespath`: For JSON path querying
- `@types/jmespath`: TypeScript definitions for jmespath

## Security Notes

⚠️ **Important**: This module performs no cryptographic verification. The web proofs are generated by the VLayer service, but for trust-minimized use cases, you should verify proofs on-chain or via vlayer precompiles.

The module is designed for:
- Off-chain analysis and debugging
- Building reputation systems
- Quality scoring for MCP servers
- Development and testing workflows

For production use requiring cryptographic guarantees, implement proper verification mechanisms.
