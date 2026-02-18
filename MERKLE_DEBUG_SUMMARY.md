# Merkle Tree Implementation Issues - Debugging Summary

## Overview
This document summarizes the critical issues discovered while debugging the Ooman NFT minting system, focusing on the merkle tree implementation and data handling.

## Key Issues Identified

### 1. **Contract-Generator Mismatch**
**Problem:** The Solidity contract and JavaScript merkle tree generator use different algorithms to create leaf hashes.

**Contract (Ooman.sol):**
```solidity
bytes32 leaf = keccak256(abi.encodePacked(tokenId, image, attributes));
// Uses raw strings directly
```

**Generator (makeLeaf):**
```javascript
const attrsHash = keccak256Str(JSON.stringify(attributesArray)); // hashes the array
const svgHash = keccak256Str(svgString);
// Then does double-hash: keccak256(abi.encodePacked(tokenId, svgHash, attrsHash))
// Then: keccak256(innerHash)
```

**Fix Applied:** Updated contract to match generator's double-hash pattern:
```solidity
bytes32 imageHash = keccak256(bytes(image));
bytes32 attributesHash = keccak256(bytes(attributes));
bytes32 innerHash = keccak256(abi.encodePacked(tokenId, imageHash, attributesHash));
bytes32 leaf = keccak256(abi.encodePacked(innerHash));
```

### 2. **Attributes String Extraction Bug**
**Problem:** Frontend regex extracted wrong token's attributes due to JSON structure.

**Root Cause:** Searching by `token_id` which appears at the END of each object:
```javascript
// WRONG - finds token N but includes token N+1 data
const itemStart = rawText.indexOf('"token_id": ' + item.token_id);
```

**Fix Applied:** Search by `name` field instead (appears at START of object):
```javascript
const namePattern = '"name": "' + item.name + '"';
const itemStart = rawText.indexOf(namePattern);
```

### 3. **Proof Verification Failure**
**Problem:** Manual proof verification shows computed root doesn't match expected root.

**Debug Output:**
```
Computed root: 0xcefc6059422eed59a11cb9e047911e0c5b1f6701ac5aac94c5133b4df6e187b9
Expected root: 0x2f1ab5629e2d2a4d2786090857cd73e81247735bd56b435c1bbfff1ddeb1f1d5
Match: false
```

**Suspected Causes:**
- Custom merkle tree generator may use different sorting/structure than OpenZeppelin standard
- Tree structure mismatch between custom generator and OpenZeppelin's MerkleProof library
- Possible off-by-one errors in tree construction

## Recommended Solution

### Regenerate Merkle Tree Using Official Library
The custom merkle tree implementation should be replaced with OpenZeppelin's official library:

```bash
npm install @openzeppelin/merkle-tree
```

Example implementation:
```javascript
const { StandardMerkleTree } = require('@openzeppelin/merkle-tree');

// Build tree with proper structure
const tree = StandardMerkleTree.of(
  leaves.map(leaf => [leaf.tokenId, leaf.image, leaf.attributes]),
  ['uint256', 'string', 'string']
);

const root = tree.root;
const proof = tree.getProof(0); // for token 0
```

### Alternative: Match Custom Generator Exactly
If keeping custom generator, ensure it matches OpenZeppelin's `Hashes.commutativeKeccak256`:

1. **Sort pairs before hashing:**
   ```javascript
   function hashPair(a, b) {
     return a < b ? keccak256(a + b) : keccak256(b + a);
   }
   ```

2. **Tree construction order:** Ensure leaves are added in the same order as OpenZeppelin expects

## Data Format Requirements

### Metadata Structure
```json
{
  "name": "Ooman #0",
  "description": "10k onchain Ooman SVGs!",
  "image": "data:image/svg+xml;utf8,%3Csvg%20...",
  "attributes": "[{\"trait_type\":\"Background\",\"value\":\"peach\"}...]",
  "merkle_root": "0x2f1ab5629e2d2a4d2786090857cd73e81247735bd56b435c1bbfff1ddeb1f1d5",
  "merkle_proof": ["0x...", "0x..."],
  "token_id": 0
}
```

### Critical Requirements
- `attributes` must be a JSON **string** (not array) in metadata files
- The string must match exactly what was hashed in the merkle tree
- `JSON.stringify(array)` produces: `[{"trait_type":"Background","value":"peach"}]` (no spaces)

## Testing Checklist

Before deploying:
- [ ] Regenerate merkle tree with official library
- [ ] Verify leaf hashes match between JS and Solidity
- [ ] Verify proof verification works manually in browser
- [ ] Test minting on testnet first
- [ ] Verify all 10,000 tokens have valid proofs

## Files Modified

1. **`contract/src/Ooman.sol`** - Updated `claim()` function to use double-hash pattern
2. **`js/app.js`** - Fixed attributes extraction to use name-based search
3. **`js/workers/metadata_worker.js`** - Same fix as app.js

## Current Contract Address
Optimism Mainnet: `0x4C8AEdF2Dc5Fae766AE740Da24a1C0B8cf16cE78`

Note: This contract may need to be redeployed after fixing the merkle tree generation.

## Next Steps

1. Regenerate merkle tree using @openzeppelin/merkle-tree library
2. Update metadata files with new proofs
3. Redeploy contract with new root
4. Update frontend contract address
5. Test minting on testnet
6. Deploy to mainnet

## Debug Commands

Browser console test:
```javascript
// Get item
const item = state.metadata.find(m => m.token_id === 0);

// Compute leaf
const imageHash = ethers.keccak256(ethers.toUtf8Bytes(item.image));
const attrsHash = ethers.keccak256(ethers.toUtf8Bytes(item.attributes));
const tokenIdHex = BigInt(0).toString(16).padStart(64, '0');
const packed = '0x' + tokenIdHex + imageHash.slice(2) + attrsHash.slice(2);
const innerHash = ethers.keccak256(packed);
const leaf = ethers.keccak256(innerHash);
console.log("Leaf:", leaf);

// Verify proof
let computed = leaf;
for (const p of item.proof) {
    computed = computed < p ? 
        ethers.keccak256(ethers.concat([computed, p])) :
        ethers.keccak256(ethers.concat([p, computed]));
}
console.log("Computed root:", computed);
console.log("Expected: 0x2f1ab5629e2d2a4d2786090857cd73e81247735bd56b435c1bbfff1ddeb1f1d5");
```

---
**Date:** 2026-02-18  
**Status:** Proof verification failing - needs merkle tree regeneration
