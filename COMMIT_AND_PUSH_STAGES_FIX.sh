#!/bin/bash

# Commit and push Pipeline Stages fixes
# Fixes: Stage filter and stage display in EmailView

echo "📦 Staging all changes..."
git add -A

echo ""
echo "📝 Committing changes..."
git commit -m "Fix: Pipeline stages filter and display issues

- Fixed stage filter at email list level to properly filter conversations by stage
- Fixed selected stage display in EmailView - now shows current stage name correctly
- Improved stage ID property access (checks both custom_stage_id and customStageId)
- Added auto-close for filter popover when stage is selected
- Added debugging console logs for stage filtering
- Updated backend to use supabaseAdmin for reading pipeline stages (bypasses RLS)
- Enhanced error handling and logging for pipeline stages API

Changes:
- EmailInbox.tsx: Improved stage filter logic and auto-close popover
- EmailView.tsx: Fixed stage ID retrieval and display
- pipelineStages.ts (backend): Use admin client for better reliability
- usePipelineStages.tsx: Added error logging
- ConversationList.tsx: Added debugging for stage loading"

echo ""
echo "📤 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done! Changes have been pushed to GitHub."



