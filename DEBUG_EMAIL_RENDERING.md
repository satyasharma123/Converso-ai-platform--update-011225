# Email Rendering Debug Guide

## Current Status
The email body rendering fix has been applied with enhanced debugging.

## What Changed (Latest Updates)

### 1. Improved HTML Detection
- `isActualHtml()` now requires at least 3 HTML tags to consider content as "real HTML"
- This prevents plain text with minimal HTML wrapping from being treated as HTML

### 2. Enhanced Plain Text Conversion
- Strips `<div>` and `<span>` tags that might wrap plain text
- Better paragraph detection
- Converts URLs to clickable links
- Converts email addresses to mailto links
- Preserves line breaks within paragraphs

### 3. Debug Banner Added
- Yellow banner appears in development mode
- Shows which data source is being used (HTML, Text, or Preview)
- Shows byte sizes of each data source

### 4. Enhanced Console Logging
- Detailed logs show exactly what data is available
- Preview of actual content being rendered

## How to Debug

### Step 1: Check the Debug Banner
When you open an email, you should see a yellow banner like this:

```
🔧 Debug Info: HTML: 1234b | Text: none | Preview: 567b
```

This tells you:
- **HTML: Xb** - HTML body is available with X bytes
- **Text: Xb** - Plain text body is available with X bytes  
- **none** - That data source is not available

### Step 2: Check Console Logs
Open browser console (F12) and look for logs like:

```javascript
[EmailBodyContent] Email rendering: {
  hasHtmlBody: true,
  htmlBodyLength: 1234,
  htmlBodyPreview: "Hello Satya, I understand your...",
  hasTextBody: false,
  textBodyLength: 0,
  renderedBodyLength: 1456,
  renderedBodyPreview: "<p>Hello Satya, I understand your...</p>"
}
```

### Step 3: Interpret the Results

#### Case 1: Only HTML Body Available
```
Debug Banner: HTML: 1234b | Text: none | Preview: 567b
```

**What this means:**
- Email provider sent HTML version only
- System will check if it's "real HTML" or plain text wrapped in HTML
- If it has < 3 HTML tags, it will be converted to proper HTML paragraphs

**Expected behavior:**
- Real HTML emails: Display with formatting
- Plain text in HTML wrapper: Convert to paragraphs with line breaks

#### Case 2: Only Text Body Available
```
Debug Banner: HTML: none | Text: 1234b | Preview: 567b
```

**What this means:**
- Email provider sent plain text only
- System will convert to HTML with paragraphs and clickable links

**Expected behavior:**
- Text split into paragraphs (double line breaks)
- URLs become clickable links
- Email addresses become mailto links

#### Case 3: Both HTML and Text Available
```
Debug Banner: HTML: 1234b | Text: 1234b | Preview: 567b
```

**What this means:**
- Email provider sent both versions
- System will use HTML if it's "real HTML", otherwise use text

**Expected behavior:**
- If HTML has proper structure: Use HTML
- If HTML is just wrapped text: Use text version instead

#### Case 4: Only Preview Available
```
Debug Banner: HTML: none | Text: none | Preview: 567b
```

**What this means:**
- Full body not fetched yet (lazy loading)
- Using preview/snippet from email metadata

**Expected behavior:**
- Short preview text
- Will fetch full body when you open the email

## Common Issues & Solutions

### Issue 1: "All text in one line, no breaks"

**Diagnosis:**
- Check console log for `htmlBodyPreview` or `textBodyPreview`
- If text has `\n` characters but they're not showing, the conversion is failing

**Solution:**
- The plain text conversion should split on `\n\n` for paragraphs
- Single `\n` should become `<br />`
- If this isn't happening, there might be an encoding issue

### Issue 2: "Text showing but not formatted"

**Diagnosis:**
- Check if `renderedBodyPreview` shows HTML tags like `<p>` and `<br />`
- If yes, the conversion is working but CSS might not be applied

**Solution:**
- Check if `email-html-body` class is present
- Check if `EMAIL_BODY_STYLES` are loaded
- Inspect element in browser DevTools

### Issue 3: "HTML emails broken"

**Diagnosis:**
- Check if `hasActualHtml` is true in console
- Check if `isActualHtml()` is correctly detecting HTML

**Solution:**
- Adjust the HTML detection threshold in `isActualHtml()`
- Currently requires 3+ HTML tags

### Issue 4: "Changes not visible"

**Diagnosis:**
- Check if debug banner appears (yellow banner at top)
- If no banner, changes haven't loaded

**Solution:**
- Hard refresh browser (Cmd+Shift+R)
- Check dev server terminal for HMR updates
- Restart dev server if needed

## Testing Checklist

### For Each Email Type:

#### Plain Text Email (like "Re: Problem with Cursor")
- [ ] Debug banner shows: `Text: Xb` or `HTML: Xb` (with low byte count)
- [ ] Console shows text content in preview
- [ ] Email displays with paragraph breaks
- [ ] URLs are clickable (blue, underlined)
- [ ] Email addresses are clickable
- [ ] Quoted text has left border

#### HTML Email (like "Stay Connected to Postman")
- [ ] Debug banner shows: `HTML: Xb` (with higher byte count)
- [ ] Console shows HTML tags in preview
- [ ] Email displays with original formatting
- [ ] Images load (if any)
- [ ] Tables display correctly (if any)
- [ ] Links work

#### Mixed Email (has both HTML and text)
- [ ] Debug banner shows both: `HTML: Xb | Text: Xb`
- [ ] Console shows which version is being used
- [ ] Email displays correctly
- [ ] Formatting is preserved

## What to Report

If emails still aren't displaying correctly, please provide:

1. **Screenshot of:**
   - The email body with the yellow debug banner visible
   - The browser console with the `[EmailBodyContent]` log expanded

2. **Copy-paste from console:**
   ```javascript
   [EmailBodyContent] Email rendering: { ... }
   ```

3. **Which email:**
   - Subject line
   - From address
   - Is it Gmail or Outlook?

4. **What you see vs what you expect:**
   - Current: "All text in one line"
   - Expected: "Paragraphs with line breaks"

## Next Steps

Based on the debug info, we can:

1. **Adjust HTML detection** - If plain text is being treated as HTML
2. **Improve text conversion** - If line breaks aren't being converted
3. **Fix data source** - If wrong data is being used (HTML vs Text)
4. **Check encoding** - If special characters are causing issues

---

**Note:** The debug banner will only show in development mode. It will be removed before production deployment.
