# Ooman NFT

10,000 on-chain SVG NFTs with Merkle verification. Free to mint.

## Quick Start

### 1. Install & Build
```bash
cd contract
./setup.sh
```

### 2. Deploy

**Test on Optimism (cheap ~$10):**
```bash
forge script script/Deploy.s.sol --ledger --broadcast --rpc-url https://mainnet.optimism.io
```

**Real deploy on Ethereum:**
```bash
forge script script/Deploy.s.sol --ledger --broadcast --rpc-url https://ethereum.reth.rs/rpc
```

Copy the contract address and update `js/app.js`:
```javascript
const CONTRACT_CONFIG = {
  ADDRESS: "0xYourAddressHere",
  // ...
};
```

### 3. Test Minting
1. Open `index.html` in browser
2. Connect wallet
3. Click any Ooman → Click "Claim"
4. Confirm in wallet

## Contract Details

- **Merkle Root:** `0x5aaf1b777148b194b3638f59a4d213d92a150e5c4a50e8fd5eb7a88c4343249e`
- **Max Supply:** 10,000
- **Mint Cost:** Free (gas only)

**Functions:**
- `mint(tokenId, svg, attributes, proof)` - Mint with Merkle proof
- `isMinted(tokenId)` - Check if minted
- `tokenURI(tokenId)` - Get metadata

## Testing Kill Switch

The contract has a `kill()` function for testing on Optimism. **Remove before mainnet:**

```solidity
// In src/Ooman.sol, DELETE these lines before mainnet:
address public deployer;                    // Line ~34
bool public killed;                         // Line ~35
constructor(...) { deployer = msg.sender; } // Line ~42
function kill() external { ... }            // Lines ~46-51
modifier notKilled() { ... }                // Lines ~53-56
// And remove "notKilled" from mint() function
```

**To kill test contract:**
```bash
cast send <CONTRACT_ADDRESS> "kill()" --rpc-url https://mainnet.optimism.io --ledger
```

## Troubleshooting

**"Contract not configured"** → Set `ADDRESS` in `js/app.js`

**"Invalid proof"** → Check merkle root matches contract

**Transaction fails** → Check gas and network

## License

MIT
