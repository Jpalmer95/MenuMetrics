#!/bin/bash
# Push MenuMetrics to GitHub
# Usage: GITHUB_TOKEN=your_token ./push-to-github.sh
# Or: export GITHUB_TOKEN=your_token && ./push-to-github.sh

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is not set"
  echo "Usage: GITHUB_TOKEN=your_token ./push-to-github.sh"
  exit 1
fi

cd "$(dirname "$0")"

# Configure git to use token for this push
git remote set-url origin https://Jpalmer95:${GITHUB_TOKEN}@github.com/Jpalmer95/MenuMetrics.git

# Push all branches and tags
echo "Pushing to GitHub..."
git push -u origin main --follow-tags

# Reset remote URL to clean version (without token)
git remote set-url origin https://github.com/Jpalmer95/MenuMetrics.git

echo "Done! Pushed to https://github.com/Jpalmer95/MenuMetrics.git"
