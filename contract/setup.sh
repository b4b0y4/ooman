#!/bin/bash
set -e

echo "🚀 Setting up Foundry for Ooman NFT..."
echo ""

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "❌ Foundry not found. Installing..."
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc || source ~/.zshrc
    foundryup
fi

echo "✅ Foundry is installed"
echo ""

# Install dependencies
echo "📦 Installing OpenZeppelin contracts..."
if [ ! -d "lib/openzeppelin-contracts" ]; then
    forge install OpenZeppelin/openzeppelin-contracts --no-commit
fi

echo "✅ Dependencies installed"
echo ""

# Create remappings if not exists
if [ ! -f "remappings.txt" ]; then
    echo "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/" > remappings.txt
    echo "✅ Created remappings.txt"
fi

# Build the project
echo "🔨 Building contract..."
forge build

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and add your PRIVATE_KEY"
echo "  2. Test locally: forge test"
echo "  3. Deploy to OP Sepolia:"
echo "     forge script script/Deploy.s.sol --rpc-url op_sepolia --broadcast --verify"
echo "  4. Deploy to Ethereum mainnet:"
echo "     forge script script/Deploy.s.sol --rpc-url mainnet --broadcast --verify"
