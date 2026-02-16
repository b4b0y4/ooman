// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Ooman.sol";

contract DeployScript is Script {
    // Merkle root - replace with your actual root from merkle_proofs.json
    bytes32 constant MERKLE_ROOT = 0x09e5a9f1167148a867bbc5392bc18dbcb6752c3dc09225eab32704aa04df34e6;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        Ooman ooman = new Ooman(MERKLE_ROOT);
        
        vm.stopBroadcast();
        
        console.log("Ooman NFT deployed at:", address(ooman));
        console.log("Merkle Root:", MERKLE_ROOT);
    }
}
