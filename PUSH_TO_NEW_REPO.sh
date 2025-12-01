#!/bin/bash

# Push code to new repository
# New repository: https://github.com/satyasharma123/Converso-ai-platform--update-011225.git

echo "Checking current git status..."
git status

echo ""
echo "Staging all changes..."
git add -A

echo ""
echo "Checking if changes need to be committed..."
if ! git diff --staged --quiet; then
    echo "Committing changes..."
    git commit -m "Fix: Add toast notification for individual email favorite action and fix horizontal scroll with dynamic email body panel width

- Added toast notifications (success/error) when favoriting/unfavoriting individual emails via 3-dot menu
- Made email body panel width dynamic to prevent horizontal scroll when all panels are open
- Profile drawer now properly reserves space without causing page overflow"
else
    echo "No changes to commit."
fi

echo ""
echo "Checking current remote..."
git remote -v

echo ""
echo "Adding/updating remote to new repository..."
git remote set-url origin https://github.com/satyasharma123/Converso-ai-platform--update-011225.git

echo ""
echo "Verifying remote update..."
git remote -v

echo ""
echo "Pushing to new repository (main branch)..."
git push -u origin main

echo ""
echo "✅ Done! Code has been pushed to the new repository:"
echo "   https://github.com/satyasharma123/Converso-ai-platform--update-011225.git"

