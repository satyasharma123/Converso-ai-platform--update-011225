#!/bin/bash
# Test if /api/conversations is filtering correctly

echo "Testing /api/conversations?type=email filter..."
echo "This should return ONLY inbox emails, NOT sent folder"
echo ""
echo "Run this in your browser console:"
echo ""
echo "fetch('http://localhost:3001/api/conversations?type=email', {"
echo "  headers: {"
echo "    'x-user-id': localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token') ? JSON.parse(localStorage.getItem('sb-wahvinwuyefmkmgmjspo-auth-token')).user.id : ''"
echo "  }"
echo "}).then(r => r.json()).then(data => {"
echo "  const sentInInbox = data.data.filter(c => c.email_folder === 'sent');"
echo "  console.log('Sent emails in inbox list:', sentInInbox.length);"
echo "  console.log('Should be 0!', sentInInbox);"
echo "});"
