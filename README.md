# Ooman NFT

10,000 fully on-chain SVG NFTs with Merkle verification. Cheap deployment, users claim with proofs.

## How It Works

1. **You deploy** the contract with just the **Merkle root** (cheap! ~50k gas)
2. **Users claim** by providing: token ID, image data, attributes, and Merkle proof
3. **Contract verifies** the proof against the root, then mints the token

**Benefits:**
- ✅ One contract for all 10,000 tokens
- ✅ Cheap deployment (no storing all data upfront)
- ✅ Each claim is separate (no gas limit issues)
- ✅ Fully on-chain verification

## Quick Start

### 1. Install & Build
```bash
cd contract
./setup.sh
forge build
```

### 2. Get API Key

**Optimistic Etherscan API Key:** https://optimistic.etherscan.io → API Keys → Add

**Etherscan API Key (mainnet):** https://etherscan.io → API Keys → Add

### 3. Setup Ledger

1. Connect Ledger via USB
2. Open Ethereum app
3. Enable blind signing in settings
4. Keep Ledger unlocked during deployment

## Deployment

### Deploy to OP Mainnet (Test)

```bash

cd contract
MAX_SUPPLY=10 forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.optimism.io \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_KEY \
  --ledger
```

**Gas cost:** ~50,000 gas (super cheap!)

### Deploy to Ethereum Mainnet

```bash

MAX_SUPPLY=10000 forge script script/Deploy.s.sol \
  --rpc-url https://eth.llamarpc.com \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_KEY \
  --ledger
```

## Claiming Tokens

Users need to provide 4 things when claiming:
1. **tokenId** - Which token (0-9999)
2. **image** - The SVG image data (data URI format)
3. **attributes** - JSON attributes array
4. **proof** - Array of hashes from the merkle tree

### Where to Find Proof Data

Token data and proofs are in your metadata files:
- `data/Ooman_metadata_1.json` (tokens 0-999)
- `data/Ooman_metadata_2.json` (tokens 1000-1999)
- `data/Ooman_metadata_3.json` (tokens 2000-2999)
- ... etc (10 files total)

Each token entry contains:
```json
{
  "name": "Ooman #0",
  "description": "10k onchain Ooman SVGs!",
  "image": "data:image/svg+xml;utf8,%3Csvg%20...",
  "attributes": "[{"trait_type":"Background","value":"mint"},
    {"trait_type": "Type","value":"human"},...]",
  "merkle_root": "",
  "merkle_proof": [
    "0xabc...",
    "0xdef...",
    "..."
  ],
  "token_id": 0
}
```

**Note:** The contract expects the field name `proof` but the JSON files use `merkle_proof`. The frontend maps these automatically.

### Example Claim

```javascript
// From the metadata JSON file for token #42:
const tokenData = {
  token_id: 42,
  image: "data:image/svg+xml;utf8,%3Csvg%20...",  // Full SVG data URI
  attributes: [{"trait_type":"Type","value":"human"}, ...],  // Array
  merkle_proof: [
    "0xabc123...",
    "0xdef456...",
    // ... rest of proof hashes
  ]
};

// Claim the token (convert attributes to JSON string)
await ooman.claim(
  tokenData.token_id,
  tokenData.image,
  JSON.stringify(tokenData.attributes),
  tokenData.merkle_proof
);
```

### Frontend Integration

```javascript
// Load proof data from your server or IPFS
async function claimToken(tokenId) {
  // Fetch metadata for this token
  const chunkNum = Math.floor(tokenId / 1000) + 1;
  const response = await fetch(`data/Ooman_metadata_${chunkNum}.json`);
  const data = await response.json();
  
  // Find the specific token
  const tokenData = data.find(item => item.token_id === tokenId);
  
  // Claim
  const tx = await ooman.claim(
    tokenData.token_id,
    tokenData.image,
    JSON.stringify(tokenData.attributes),
    tokenData.merkle_proof
  );
  
  await tx.wait();
  console.log(`Claimed Ooman #${tokenId}!`);
}
```

## Data Files

### Merkle Root

The merkle root is stored in:
- `data/Ooman_merkle_root.json`

```json
{
  "merkle_root": "0x1b63306dd23173f53434bc807715e8ac1a2dc41f60011d8ba972f56590fa526d",
  "total_supply": 10000
}
```

### Metadata Files

You have 9 metadata files with token data and proofs:
- `Ooman_metadata_1.json` - Tokens 0-999
- `Ooman_metadata_2.json` - Tokens 1000-1999
- `Ooman_metadata_3.json` - Tokens 2000-2999
- `Ooman_metadata_4.json` - Tokens 3000-3999
- `Ooman_metadata_5.json` - Tokens 4000-4999
- `Ooman_metadata_6.json` - Tokens 5000-5999
- `Ooman_metadata_7.json` - Tokens 6000-6999
- `Ooman_metadata_8.json` - Tokens 7000-7999
- `Ooman_metadata_9.json` - Tokens 8000-9999

Each file is an array of token objects containing:
- `name` - Token name (e.g., "Ooman #0")
- `description` - Description
- `image` - SVG data URI
- `attributes` - Array of trait objects
- `merkle_root` - Root hash
- `merkle_proof` - Proof array
- `token_id` - Token ID

## Contract Details

- **MERKLE_ROOT**: Immutable root hash of all token data
- **MAX_SUPPLY**: 10,000 (set at deployment)
- **isMinted**: Tracks which tokens are taken

**Functions:**
- `claim(tokenId, image, attributes, proof)` - Claim with Merkle proof
- `tokenURI(tokenId)` - Get metadata (only works after claimed)
- `isMinted(tokenId)` - Check if token is taken
- `getSVG(tokenId)` - Get SVG data (only works after claimed)
- `getAttributes(tokenId)` - Get attributes (only works after claimed)

## How Merkle Proofs Work

1. All 10,000 tokens are hashed: `keccak256(tokenId + image + attributes)`
2. These hashes form a Merkle tree
3. Root hash is stored in contract (cheap!)
4. To claim, user provides:
   - Their token's data
   - A "proof" (path through the tree)
5. Contract verifies the proof matches the stored root
6. If valid → token is minted

**Security:**
- Users can only claim tokens with valid proofs
- Proofs are generated from your original data files
- No one can forge a proof (cryptographically impossible)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MAX_SUPPLY` | Total tokens (1-10000) | Yes |
| `ETHERSCAN_KEY` | For contract verification (works on all networks) | Yes |

## Gas Costs

| Operation | Gas | OP Mainnet Cost* | Mainnet Cost** |
|-----------|-----|------------------|----------------|
| Deploy | ~50k | ~$0.002 | ~$3 |
| Claim | ~200k-500k | ~$0.01-0.03 | ~$12-30 |

\* at 0.001 gwei  
\** at 20 gwei, $3000 ETH

## Testing

### Test on OP Mainnet First
```bash
# Deploy (cheap!)
MAX_SUPPLY=10000 forge script script/Deploy.s.sol \
  --rpc-url https://mainnet.optimism.io \
  --broadcast --verify \
  --etherscan-api-key $ETHERSCAN_KEY \
  --ledger

# Try claiming a token
# Use the proof from data/Ooman_metadata_1.json token 0
```

### Verify Contract Works
1. Check contract on Optimistic Etherscan
2. Try claiming token #0 with proof from metadata file
3. Verify tokenURI() returns correct metadata

## Troubleshooting

**"InvalidProof"** → Proof doesn't match merkle root. Check:
- Token ID is correct
- Image data matches exactly (data URI format)
- Attributes JSON string matches exactly
- All proof hashes are included in correct order

**"AlreadyMinted"** → Token was already claimed by someone

**"InvalidTokenId"** → Token ID >= MAX_SUPPLY

**Where to get proofs?** → `data/Ooman_metadata_*.json` files

## License

MIT
