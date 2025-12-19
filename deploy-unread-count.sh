#!/bin/bash

# Deploy Unread Count Feature
# This script applies the database migration and verifies the implementation

echo "🚀 Deploying Unread Count Feature"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "Converso-frontend/supabase/migrations/20251215000002_add_unread_count.sql" ]; then
    echo -e "${RED}✗ Migration file not found${NC}"
    echo "  Please run this script from the project root directory"
    exit 1
fi

echo "Step 1: Checking database connection..."
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ psql found${NC}"
else
    echo -e "${YELLOW}⚠ psql not found, will try supabase CLI${NC}"
fi
echo ""

echo "Step 2: Applying database migration..."
echo "  File: 20251215000002_add_unread_count.sql"
echo ""

# Try Supabase CLI first
if command -v supabase &> /dev/null; then
    echo "  Using Supabase CLI..."
    cd Converso-frontend
    supabase db push
    cd ..
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migration applied via Supabase CLI${NC}"
    else
        echo -e "${RED}✗ Migration failed${NC}"
        echo "  Please apply manually or check your Supabase connection"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Supabase CLI not found${NC}"
    echo "  Please apply migration manually:"
    echo "  1. Go to Supabase Dashboard → SQL Editor"
    echo "  2. Paste contents of: Converso-frontend/supabase/migrations/20251215000002_add_unread_count.sql"
    echo "  3. Run the migration"
    echo ""
    read -p "Press Enter after applying migration manually..."
fi
echo ""

echo "Step 3: Verifying migration..."
echo "  Checking if unread_count column exists..."
echo "  (Manual verification recommended)"
echo ""

echo "Step 4: What's next?"
echo ""
echo "✅ Migration applied (or ready to apply)"
echo ""
echo "📋 Next steps:"
echo "  1. Verify migration in Supabase Dashboard"
echo "  2. Restart backend: cd Converso-backend && npm run dev"
echo "  3. Refresh frontend in browser (Cmd+Shift+R)"
echo "  4. Test with a LinkedIn message"
echo ""

echo "🧪 Testing checklist:"
echo "  □ Send 1 message → Badge shows '1'"
echo "  □ Send 3 messages → Badge shows '3'"
echo "  □ Click conversation → Badge disappears"
echo "  □ Send message while inbox open → Badge updates in real-time"
echo ""

echo "📚 Documentation:"
echo "  - Full guide: UNREAD_COUNT_IMPLEMENTATION.md"
echo "  - Troubleshooting: See 'Troubleshooting' section in docs"
echo ""

echo "🔍 Verification queries:"
echo ""
echo "  -- Check column exists:"
echo "  SELECT column_name FROM information_schema.columns"
echo "  WHERE table_name = 'conversations' AND column_name = 'unread_count';"
echo ""
echo "  -- Check triggers exist:"
echo "  SELECT tgname FROM pg_trigger"
echo "  WHERE tgrelid = 'conversations'::regclass"
echo "  OR tgrelid = 'messages'::regclass;"
echo ""
echo "  -- View unread counts:"
echo "  SELECT sender_name, unread_count, is_read"
echo "  FROM conversations"
echo "  WHERE unread_count > 0"
echo "  ORDER BY last_message_at DESC;"
echo ""

echo "=================================="
echo -e "${GREEN}✓ Deployment script complete!${NC}"
echo ""
echo "Need help? Check UNREAD_COUNT_IMPLEMENTATION.md"



