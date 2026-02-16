// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Ooman.sol";

contract OomanTest is Test {
    Ooman public ooman;
    
    // Test merkle root - you'll need to replace this with your actual root
    bytes32 constant MERKLE_ROOT = 0x09e5a9f1167148a867bbc5392bc18dbcb6752c3dc09225eab32704aa04df34e6;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    function setUp() public {
        ooman = new Ooman(MERKLE_ROOT);
    }
    
    function test_Constructor() public {
        assertEq(ooman.MERKLE_ROOT(), MERKLE_ROOT);
        assertEq(ooman.name(), "Ooman");
        assertEq(ooman.symbol(), "OOMAN");
    }
    
    function test_MintWithValidProof() public {
        // This test will need the actual proof data from merkle_proofs.json
        // For now, we test the basic minting flow
        
        // Example: To test with real data, load the proof from the JSON file
        // and use it here. For deployment testing, you can use the deploy.js
        // script to get the actual proof data.
        
        vm.prank(alice);
        // ooman.mint(tokenId, svg, attributes, proof);
        // assertEq(ooman.ownerOf(tokenId), alice);
    }
    
    function test_RevertMintInvalidTokenId() public {
        vm.expectRevert("Ooman: invalid token ID");
        ooman.mint(10000, "svg", "[]", new bytes32[](0));
    }
    
    function test_RevertMintTwice() public {
        // First mint would succeed with valid proof
        // Second mint should revert
        
        // vm.expectRevert("Ooman: already minted");
        // ooman.mint(tokenId, svg, attributes, proof);
    }
    
    function test_RevertInvalidProof() public {
        vm.expectRevert("Ooman: invalid proof");
        
        // Try to mint with empty proof
        ooman.mint(0, "test_svg", "[]", new bytes32[](0));
    }
    
    function test_TokenURI() public {
        // Test that tokenURI returns valid data after mint
        // Requires minting first
    }
    
    function test_GetSVG() public {
        // Test SVG retrieval
    }
    
    function test_GetAttributes() public {
        // Test attributes retrieval
    }
    
    function test_TotalMinted() public {
        assertEq(ooman.totalMinted(), 0);
        // After minting, should increase
    }
}
