// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title Ooman
 * @notice Fully on-chain SVG NFT collection with Merkle verification
 * @dev Users prove they own a token via Merkle proof
 * @dev Cheap deployment (just merkle root), users provide data when claiming
 */
contract Ooman is ERC721 {
    using Strings for uint256;

    bytes32 public immutable MERKLE_ROOT;
    uint256 public immutable MAX_SUPPLY;
    
    mapping(uint256 => bool) public isMinted;
    
    // On-chain storage: tokenId => SVG data (stored when claimed)
    mapping(uint256 => string) private _tokenSVG;
    
    // On-chain storage: tokenId => attributes JSON (stored when claimed)
    mapping(uint256 => string) private _tokenAttributes;

    error AlreadyMinted();
    error InvalidProof();
    error InvalidTokenId();

    constructor(bytes32 _merkleRoot, uint256 _maxSupply) ERC721("Ooman", "OOMAN") {
        MERKLE_ROOT = _merkleRoot;
        MAX_SUPPLY = _maxSupply;
    }

    /**
     * @notice Claim a token by providing the data and Merkle proof
     * @param tokenId The token ID to claim
     * @param image The SVG image data (data URI format)
     * @param attributes The attributes JSON string
     * @param proof The Merkle proof
     */
    function claim(
        uint256 tokenId,
        string calldata image,
        string calldata attributes,
        bytes32[] calldata proof
    ) external {
        if (tokenId >= MAX_SUPPLY) revert InvalidTokenId();
        if (isMinted[tokenId]) revert AlreadyMinted();
        
        // Create leaf matching the JS generator's double-hash pattern:
        // 1. Hash image and attributes separately
        // 2. Pack: tokenId + imageHash + attributesHash
        // 3. Double hash for second-preimage protection
        bytes32 imageHash = keccak256(bytes(image));
        bytes32 attributesHash = keccak256(bytes(attributes));
        bytes32 innerHash = keccak256(abi.encodePacked(tokenId, imageHash, attributesHash));
        bytes32 leaf = keccak256(abi.encodePacked(innerHash));
        
        // Verify proof
        if (!MerkleProof.verify(proof, MERKLE_ROOT, leaf)) revert InvalidProof();
        
        // Store data
        _tokenSVG[tokenId] = image;
        _tokenAttributes[tokenId] = attributes;
        isMinted[tokenId] = true;
        
        // Mint to caller
        _safeMint(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!isMinted[tokenId]) revert InvalidTokenId();
        
        string memory json = string(
            abi.encodePacked(
                '{"name":"Ooman #',
                tokenId.toString(),
                '","description":"10k onchain Ooman SVGs!",',
                '"image":"',
                _tokenSVG[tokenId],
                '","attributes":',
                _tokenAttributes[tokenId],
                '}'
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    function getSVG(uint256 tokenId) external view returns (string memory) {
        if (!isMinted[tokenId]) revert InvalidTokenId();
        return _tokenSVG[tokenId];
    }

    function getAttributes(uint256 tokenId) external view returns (string memory) {
        if (!isMinted[tokenId]) revert InvalidTokenId();
        return _tokenAttributes[tokenId];
    }
}
