#!/bin/bash
# Setup script for extracting knowshowgo-js to a separate repository

set -e

REPO_NAME="${1:-knowshowgo}"
GITHUB_USER="${2:-lehelkovach}"

echo "Setting up KnowShowGo JavaScript repository: $REPO_NAME"
echo "GitHub user: $GITHUB_USER"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the knowshowgo-js directory."
    exit 1
fi

# Update package.json with correct repository URL
echo "Updating package.json with repository URL..."
sed -i.bak "s|yourusername|${GITHUB_USER}|g" package.json
sed -i.bak "s|knowshowgo-js|${REPO_NAME}|g" package.json
rm -f package.json.bak

# Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit: KnowShowGo JavaScript implementation"
fi

# Add remote if not already added
if ! git remote | grep -q origin; then
    echo "Adding remote origin..."
    git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
else
    echo "Remote origin already exists. Updating..."
    git remote set-url origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
fi

echo ""
echo "Setup complete! Next steps:"
echo ""
echo "1. Create the repository on GitHub:"
echo "   https://github.com/new"
echo "   Name: ${REPO_NAME}"
echo "   Visibility: Public or Private"
echo ""
echo "2. Push to GitHub:"
echo "   git push -u origin main"
echo ""
echo "3. (Optional) Create and push to a 'main' branch if needed:"
echo "   git branch -M main"
echo "   git push -u origin main"

