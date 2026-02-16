const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CHUNK_SIZE = 1000;

// Get merkle root from the first data chunk
function getMerkleRoot() {
  const firstChunk = path.join(DATA_DIR, "Ooman_merkle_proofs_1.json");
  if (!fs.existsSync(firstChunk)) {
    throw new Error("Data files not found");
  }
  const data = JSON.parse(fs.readFileSync(firstChunk, "utf8"));
  return data.merkleRoot;
}

// Find which chunk contains a token
function getChunkForToken(tokenId) {
  return Math.floor(tokenId / CHUNK_SIZE) + 1;
}

// Load token data from appropriate chunk
function loadTokenData(tokenId) {
  const chunkNum = getChunkForToken(tokenId);
  const chunkFile = path.join(DATA_DIR, `Ooman_merkle_proofs_${chunkNum}.json`);

  if (!fs.existsSync(chunkFile)) {
    throw new Error(`Chunk file not found: ${chunkFile}`);
  }

  const data = JSON.parse(fs.readFileSync(chunkFile, "utf8"));
  return data.proofs[tokenId.toString()];
}

function showMintData(tokenId) {
  try {
    const tokenData = loadTokenData(tokenId);

    if (!tokenData) {
      console.error(`❌ Token ${tokenId} not found`);
      process.exit(1);
    }

    console.log(`🎨 Mint Data for Ooman #${tokenId}\n`);
    console.log("========================\n");

    console.log("📋 Mint Transaction Data:");
    console.log(`   tokenId: ${tokenData.tokenId}`);
    console.log(
      `   svg: "${tokenData.image.substring(0, 50)}..." (${tokenData.image.length} chars)`,
    );
    console.log(`   attributes: ${tokenData.attributes.substring(0, 50)}...`);
    console.log(`   merkleProof: [`);
    tokenData.proof.forEach((p, i) => {
      console.log(`     "${p}"${i < tokenData.proof.length - 1 ? "," : ""}`);
    });
    console.log(`   ]\n`);

    // Estimate gas
    const svgBytes = Buffer.byteLength(tokenData.image, "utf8");
    const attributesBytes = Buffer.byteLength(tokenData.attributes, "utf8");
    const totalBytes = svgBytes + attributesBytes;
    const estimatedGas =
      50000 + totalBytes * 20 + tokenData.proof.length * 2000;

    console.log("⛽ Gas Estimate:");
    console.log(`   ~${Math.round(estimatedGas).toLocaleString()} gas`);
    console.log(`   SVG size: ${svgBytes} bytes`);
    console.log(`   Attributes size: ${attributesBytes} bytes`);
    console.log(`   Proof length: ${tokenData.proof.length} hashes\n`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

function showDeploymentInfo() {
  const merkleRoot = getMerkleRoot();

  console.log("🚀 Ooman NFT Deployment\n");
  console.log("========================\n");

  console.log("📋 Deployment Parameters:");
  console.log(`   Merkle Root: ${merkleRoot}`);
  console.log(`   Max Supply: 10,000`);
  console.log(`   Network: Ethereum / Optimism\n`);

  console.log("🔧 Step 1: Test on Optimism:");
  console.log(
    "   forge script script/Deploy.s.sol \\\n     --ledger \\\n     --broadcast \\\n     --rpc-url https://mainnet.optimism.io\n",
  );
  console.log("");
  console.log("🔧 Step 2: Real Deploy on Ethereum Mainnet (~$100-200):");
  console.log(
    "   forge script script/Deploy.s.sol \\\n     --ledger \\\n     --broadcast \\\n     --rpc-url https://ethereum.reth.rs/rpc\n",
  );
  console.log("   # Test first on Optimism, then deploy for real on mainnet!");

  console.log("📄 Contract Summary:");
  console.log("   - Name: Ooman");
  console.log("   - Symbol: OOMAN");
  console.log("   - Immutable: No owner, no pause, no upgrades");
  console.log("   - Minting: Free, requires Merkle proof");
  console.log("   - Storage: SVG + attributes stored on-chain after mint\n");

  console.log("✅ Ready to deploy!");
  console.log(`\n💡 Constructor argument: ${merkleRoot}`);
}

// CLI handling
const args = process.argv.slice(2);

if (args.length === 0) {
  showDeploymentInfo();
} else if (args[0] === "mint" && args[1]) {
  showMintData(parseInt(args[1]));
} else if (args[0] === "info") {
  showDeploymentInfo();
} else {
  console.log("Usage:");
  console.log("  node mint.js                - Show deployment info");
  console.log("  node mint.js mint <id>      - Show mint data for token ID");
  console.log("  node mint.js info           - Show deployment info");
}
