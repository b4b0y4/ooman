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

**Recommended Workflow:**
1. **Test on Optimism** (cheap, fast) - verify everything works
2. **Deploy to Ethereum Mainnet** (expensive, permanent) - the real deal

#### Step 1: Test Deploy on Optimism

Cheap test run (~$10-20) to verify your contract and minting works:

**Ledger:**
```bash
cd contract
forge script script/Deploy.s.sol --ledger --broadcast --rpc-url https://mainnet.optimism.io
```

**Private Key:**
```bash
cd contract
cp .env.example .env
# Edit .env and add your PRIVATE_KEY
forge script script/Deploy.s.sol --rpc-url https://mainnet.optimism.io --broadcast --verify
```

#### Step 2: Real Deploy on Ethereum Mainnet

Once tested, deploy for real (~$100-200 depending on gas):

**Ledger:**
```bash
forge script script/Deploy.s.sol --ledger --broadcast --rpc-url https://ethereum.reth.rs/rpc
```

**Private Key:**
```bash
forge script script/Deploy.s.sol --rpc-url https://ethereum.reth.rs/rpc --broadcast --verify
```

Copy the deployed contract address!

**Note:** 
- The `--ledger` flag uses your hardware wallet for signing. Ensure your Ledger is unlocked and the Ethereum app is open.
- Test first on Optimism - it's cheap enough to verify everything works before spending $100+ on mainnet.

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
2. Connect wallet
3. Click on any Ooman
4. Click "Claim"
5. Confirm transaction

## Contract Details

### Merkle Root

```
0x5aaf1b777148b194b3638f59a4d213d92a150e5c4a50e8fd5eb7a88c4343249e
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
- [ ] Have ~$10-20 worth of ETH on Optimism for testing
- [ ] Have ~$100-200 worth of ETH on Ethereum mainnet for real deployment
- [ ] Review contract one more time

### Step 1: Test on Optimism (Cheap)

1. Run: `./setup.sh`
2. **Ledger:** Connect and unlock your Ledger, open Ethereum app
   **OR** Set PRIVATE_KEY in `.env` for non-Ledger deployment
3. Deploy:
   - **Ledger:** `forge script script/Deploy.s.sol --ledger --broadcast --rpc-url https://mainnet.optimism.io`
   - **Private key:** `forge script script/Deploy.s.sol --rpc-url https://mainnet.optimism.io --broadcast --verify`
4. Copy contract address
5. Verify: `forge verify-contract --chain optimism <ADDRESS> src/Ooman.sol:Ooman`
6. Update `js/app.js` with the Optimism address
7. Test mint 1-3 tokens (~$0.50-1 each on Optimism)
8. **Make sure everything works!**

### Step 2: Deploy to Ethereum Mainnet (Real)

1. **Ledger:** Connect and unlock your Ledger
2. Deploy:
   - **Ledger:** `forge script script/Deploy.s.sol --ledger --broadcast --rpc-url https://ethereum.reth.rs/rpc`
   - **Private key:** `forge script script/Deploy.s.sol --rpc-url https://ethereum.reth.rs/rpc --broadcast --verify`
3. Copy contract address
4. Verify: `forge verify-contract --chain mainnet <ADDRESS> src/Ooman.sol:Ooman`
5. Update `js/app.js` with the mainnet address
6. Launch!

### Post-Deployment

- [ ] Test frontend on mainnet
- [ ] Document contract address
- [ ] Share with community!

**Contract Address Log:**
- **Optimism Mainnet (Test):** `0x...` (Your test deployment)
- **Ethereum Mainnet (Real):** `0x...` (Your production deployment)

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
**Optimism Mainnet:**
```bash
forge script script/Deploy.s.sol --rpc-url https://mainnet.optimism.io --broadcast
```

**Ethereum Mainnet:**
```bash
forge script script/Deploy.s.sol --rpc-url https://ethereum.reth.rs/rpc --broadcast
```

Other RPC options:
- Optimism: `https://mainnet.optimism.io` (public), `https://rpc.ankr.com/optimism`
- Ethereum: `https://eth.llamarpc.com`, `https://rpc.ankr.com/eth`

### Ledger connection issues
- Ensure Ledger is unlocked and Ethereum app is open
- Try unplugging and replugging the Ledger
- Make sure you have the latest Ledger firmware
- Verify the derivation path if using a specific account

## License

MIT
