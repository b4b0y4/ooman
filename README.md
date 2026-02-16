# Ooman NFT - Complete Documentation

Immutable ERC721 with on-chain SVG storage and Merkle verification. No owner, no controls - fully decentralized.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Contract Details](#contract-details)
- [Frontend Integration](#frontend-integration)
- [Deployment](#deployment)
- [File Structure](#file-structure)
- [Troubleshooting](#troubleshooting)

## Overview

- **Name**: Ooman
- **Symbol**: OOMAN  
- **Supply**: 10,000
- **Mint Cost**: FREE (user pays gas only)
- **Storage**: Full SVG + metadata stored on-chain after mint
- **Verification**: Merkle proof required to mint valid tokens
- **Immutability**: No owner, no pause, no upgrades

## Quick Start

### 1. Install Dependencies

```bash
cd contract
./setup.sh          # Install dependencies and build
```

### 2. Deploy Contract

**Testnet (Optimism Sepolia):**
```bash
forge script script/Deploy.s.sol --rpc-url op_sepolia --broadcast --verify
```

**Mainnet:**
```bash
forge script script/Deploy.s.sol --rpc-url mainnet --broadcast --verify
```

Copy the deployed contract address!

### 3. Configure Frontend

Edit `js/app.js` and update the contract address:

```javascript
const CONTRACT_CONFIG = {
  ADDRESS: "0xYourContractAddressHere",  // <-- UPDATE THIS
  // ... rest stays the same
};
```

### 4. Test Minting

1. Open frontend in browser
2. Connect wallet (MetaMask)
3. Click on any Ooman
4. Click "Claim"
5. Confirm transaction
6. ✅ See minted badge appear!

## Contract Details

### Merkle Root

```
0x09e5a9f1167148a867bbc5392bc18dbcb6752c3dc09225eab32704aa04df34e6
```

### Contract Functions

**View Functions:**
- `MERKLE_ROOT` - The merkle root (immutable)
- `tokenURI(tokenId)` - Returns base64 metadata JSON
- `getSVG(tokenId)` - Get raw SVG data
- `getAttributes(tokenId)` - Get raw attributes JSON
- `isMinted(tokenId)` - Check if token is minted
- `totalMinted()` - Count of minted tokens

**Write Functions:**
- `mint(tokenId, svg, attributes, merkleProof)` - Mint a token (free, requires proof)

### Gas Costs

- **Deployment**: ~2M gas
- **Mint**: 200k-600k gas (depends on SVG size)
  - Base: ~50k gas
  - SVG storage: ~20 gas per byte
  - Proof verification: ~2k gas per proof element

Example: Ooman #42 (SVG ~6KB) = ~208k gas

## Frontend Integration

### Configuration

The frontend is already configured to:
- Load metadata and proofs from chunked JSON files in `data/`
- Handle wallet connections via dappkit
- Mint tokens with automatic proof retrieval
- Show minted status badges

### Features

**Mint Button:**
- Opens wallet to confirm transaction
- Shows loading states
- Tracks transaction status
- Displays success/error notifications

**Minted Status:**
- "✓ Minted" badge on cards
- Green border on minted cards
- Modal shows minted status
- Auto-checks when wallet connects

### User Flow

1. User browses gallery
2. User clicks on an Ooman
3. Modal opens showing details
4. User clicks "Claim"
5. Wallet opens for confirmation
6. Transaction submitted
7. User waits for confirmation
8. Success! Badge appears on card

## Deployment

### Pre-Deployment Checklist

- [ ] Test contract locally: `forge test`
- [ ] Get test ETH for Optimism Sepolia
- [ ] Review contract one more time

### Testnet Deployment

1. Run: `./setup.sh`
2. Set PRIVATE_KEY in `.env`
3. Deploy: `forge script script/Deploy.s.sol --rpc-url op_sepolia --broadcast`
4. Copy contract address
5. Verify: `forge verify-contract --chain op_sepolia <ADDRESS> src/Ooman.sol:Ooman`
6. Update `js/app.js` with testnet address
7. Test mint 1-3 tokens

### Mainnet Deployment

1. Have sufficient ETH for deployment (~$100-200)
2. Deploy: `forge script script/Deploy.s.sol --rpc-url mainnet --broadcast`
3. Copy contract address
4. Verify on Etherscan
5. Update `js/app.js` with mainnet address
6. Test frontend on mainnet

### Post-Deployment

- [ ] Test frontend on mainnet
- [ ] Document contract address
- [ ] Share with community!

**Contract Address Log:**
- **Optimism Sepolia:** `0x...`
- **Ethereum Mainnet:** `0x...`

## File Structure

```
/Users/ju/code/ooman/
├── contract/              # Smart contract
│   ├── src/Ooman.sol     # Contract source
│   ├── script/Deploy.s.sol
│   ├── test/Ooman.t.sol
│   ├── foundry.toml
│   └── setup.sh
├── data/                 # Chunked metadata + proofs
│   ├── Ooman_merkle_proofs_1.json
│   ├── Ooman_merkle_proofs_2.json
│   └── ... (10 files total)
├── js/
│   ├── app.js           # Main frontend
│   ├── libs/
│   │   ├── dappkit.js   # Wallet connection
│   │   └── ethers.min.js
│   └── workers/
│       └── metadata_worker.js
├── index.html
└── README.md            # This file
```

## How It Works

1. **Pre-computation**: Hash each token's data (ID + SVG + attributes)
2. **Merkle Tree**: Build a tree of all 10,000 hashes
3. **Root Storage**: Store only the 32-byte root in the contract
4. **Verification**: Minters provide proof that their token is in the tree
5. **On-Chain Storage**: After verification, store SVG + metadata permanently

## Security

- **Immutable**: Contract has no owner, cannot be paused or upgraded
- **Verified**: Only valid metadata from the Merkle tree can be minted
- **Permanent**: Once minted, metadata lives forever on-chain
- **Trustless**: No external dependencies (IPFS, APIs, etc.)

## Troubleshooting

### "Contract not configured"
→ Set CONTRACT_ADDRESS in js/app.js

### "Private key not found"
Make sure you've created `.env` file:
```bash
echo "PRIVATE_KEY=0x..." > .env
```

### Transaction fails
→ Check browser console
→ Verify you're on correct network
→ Check wallet has ETH for gas

### Minted badge not showing
→ Must connect wallet first
→ Check CONTRACT_ADDRESS is correct

### "RPC URL not found"
Add RPC endpoints to `foundry.toml` or use command-line flags:
```bash
forge script script/Deploy.s.sol --rpc-url https://sepolia.optimism.io --broadcast
```

## License

MIT
