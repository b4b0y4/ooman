// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title Ooman
 * @notice Immutable ERC721 with on-chain SVG storage and Merkle verification
 * @dev Users mint with Merkle proof. No owner, no upgrades, no pausing.
 */
contract Ooman is ERC721 {
    using Strings for uint256;
    
    // Immutable Merkle root for verifying valid tokens
    bytes32 public immutable MERKLE_ROOT;
    
    // Constants
    uint256 public constant MAX_SUPPLY = 10000;
    
    // On-chain storage: tokenId => SVG data
    mapping(uint256 => string) private _tokenSVG;
    
    // On-chain storage: tokenId => attributes JSON
    mapping(uint256 => string) private _tokenAttributes;
    
    // Track minted tokens
    mapping(uint256 => bool) public minted;
    
    // Events
    event OomanMinted(uint256 indexed tokenId, address indexed minter);
    
    /**
     * @notice Contract is immutable - no owner controls
     * @param merkleRoot The root of the Merkle tree containing all valid token data
     */
    constructor(bytes32 merkleRoot) ERC721("Ooman", "OOMAN") {
        MERKLE_ROOT = merkleRoot;
    }
    
    /**
     * @notice Mint a specific Ooman token
     * @param tokenId The token ID (0-9999)
     * @param svg The SVG image data (as stored in metadata)
     * @param attributes The attributes JSON string
     * @param merkleProof Array of sibling hashes to verify token validity
     */
    function mint(
        uint256 tokenId,
        string calldata svg,
        string calldata attributes,
        bytes32[] calldata merkleProof
    ) external {
        require(tokenId < MAX_SUPPLY, "Ooman: invalid token ID");
        require(!minted[tokenId], "Ooman: already minted");
        require(bytes(svg).length > 0, "Ooman: empty SVG");
        
        // Verify the token data is valid using Merkle proof
        // Note: tree was generated with tokenId as string ("0", "1", etc.)
        bytes32 leaf = keccak256(abi.encodePacked(tokenId.toString(), svg, attributes));
        require(_verifyMerkleProof(leaf, merkleProof), "Ooman: invalid proof");
        
        // Store data on-chain
        _tokenSVG[tokenId] = svg;
        _tokenAttributes[tokenId] = attributes;
        minted[tokenId] = true;
        
        // Mint to caller
        _safeMint(msg.sender, tokenId);
        
        emit OomanMinted(tokenId, msg.sender);
    }
    
    /**
     * @notice Returns the complete metadata URI for a token
     * @dev Constructs JSON on-the-fly with embedded SVG
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Ooman: query for nonexistent token");
        
        string memory svg = _tokenSVG[tokenId];
        string memory attributes = _tokenAttributes[tokenId];
        
        // Build metadata JSON
        string memory json = string(abi.encodePacked(
            '{',
            '"name":"Ooman #', tokenId.toString(), '",',
            '"description":"10k onchain Ooman SVGs!",',
            '"image":"', svg, '",',
            '"attributes":', attributes,
            '}'
        ));
        
        // Return as base64 data URI
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }
    
    /**
     * @notice Get the SVG for a token
     */
    function getSVG(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Ooman: query for nonexistent token");
        return _tokenSVG[tokenId];
    }
    
    /**
     * @notice Get the attributes for a token
     */
    function getAttributes(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Ooman: query for nonexistent token");
        return _tokenAttributes[tokenId];
    }
    
    /**
     * @notice Check if a token has been minted
     */
    function isMinted(uint256 tokenId) external view returns (bool) {
        return tokenId < MAX_SUPPLY && minted[tokenId];
    }
    
    /**
     * @notice Get total number of minted tokens
     */
    function totalMinted() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            if (minted[i]) count++;
        }
        return count;
    }
    
    /**
     * @notice Verify a Merkle proof
     */
    function _verifyMerkleProof(bytes32 leaf, bytes32[] memory proof) internal view returns (bool) {
        bytes32 computedHash = leaf;
        
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            
            if (computedHash < proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        
        return computedHash == MERKLE_ROOT;
    }
}
