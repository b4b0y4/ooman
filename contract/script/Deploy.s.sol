// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Ooman.sol";

/**
 * @notice Deploy Ooman with Merkle root
 * @dev Uses Ledger hardware wallet
 * @dev Set MAX_SUPPLY env var (default: 10000)
 * @dev Reads merkle root from data files
 * @dev Example: MAX_SUPPLY=10000 forge script ... --ledger
 */
contract DeployScript is Script {
    function run() external {
        uint256 maxSupply = vm.envOr("MAX_SUPPLY", uint256(10000));
        require(maxSupply > 0 && maxSupply <= 10000, "MAX_SUPPLY must be 1-10000");

        console.log("Deploying Ooman with Merkle verification...");
        console.log("Max Supply:", maxSupply);
        console.log("");
        
        // Read merkle root from first merkle proofs file
        // All files should have the same root for the full collection
        bytes32 merkleRoot = readMerkleRoot();
        
        console.log("Merkle Root:", vm.toString(merkleRoot));
        console.log("");
        console.log("Connect your Ledger and open Ethereum app...");
        console.log("Review transaction on device and confirm to deploy.\n");

        vm.startBroadcast();

        Ooman ooman = new Ooman(merkleRoot, maxSupply);

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("DEPLOYED!");
        console.log("========================================");
        console.log("Contract Address:", address(ooman));
        console.log("Max Supply:", ooman.MAX_SUPPLY());
        console.log("Merkle Root:", vm.toString(ooman.MERKLE_ROOT()));
        console.log("\nUsers need to provide proof when claiming!");
        console.log("They can find proofs in data/Ooman_metadata_*.json");
    }
    
    function readMerkleRoot() internal view returns (bytes32) {
        string memory path = string.concat(
            vm.projectRoot(),
            "/../data/Ooman_merkle_root.json"
        );
        
        try vm.readFile(path) returns (string memory json) {
            return abi.decode(vm.parseJson(json, ".merkle_root"), (bytes32));
        } catch {
            // Fallback to hardcoded if file read fails
            console.log("Warning: Could not read merkle root from file");
            console.log("Using hardcoded root - verify this is correct!");
            return 0x1b63306dd23173f53434bc807715e8ac1a2dc41f60011d8ba972f56590fa526d;
        }
    }
}
