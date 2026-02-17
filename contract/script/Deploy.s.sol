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
        // Try multiple possible paths
        string[] memory paths = new string[](2);
        paths[0] = string.concat(vm.projectRoot(), "/../data/Ooman_merkle_root.json");
        paths[1] = "./../data/Ooman_merkle_root.json";
        
        for (uint i = 0; i < paths.length; i++) {
            try vm.readFile(paths[i]) returns (string memory json) {
                console.log("Successfully read merkle root from:", paths[i]);
                return abi.decode(vm.parseJson(json, ".merkle_root"), (bytes32));
            } catch {
                continue;
            }
        }
        
        // Fallback to hardcoded if file read fails
        console.log("Warning: Could not read merkle root from any path");
        console.log("Tried:");
        for (uint i = 0; i < paths.length; i++) {
            console.log("  -", paths[i]);
        }
        console.log("Using hardcoded root - verify this is correct!");
        console.log("Make sure data/Ooman_merkle_root.json exists with the correct root");
        revert("Could not read merkle root from file");
    }
}
