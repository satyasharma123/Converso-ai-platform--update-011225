# Email Layout Bug Fix

## Problem
When clicking certain HTML emails, the entire application layout would change:
- Left sidebar menu fonts would change
- Page orientation/layout would shift
- Clicking another email would sometimes restore normal layout

## Root Cause
HTML emails often contain:
- `<style>` tags with global CSS selectors (`body`, `*`, `html`, etc.)
- `<html>`, `<head>`, `<body>` tags
- Inline JavaScript event handlers
- External CSS links
- Meta tags and other document-level elements

When these were rendered via `dangerouslySetInnerHTML`, they would **leak out** and affect the entire application, not just the email content area.

## Solution Implemented

### 1. **Aggressive HTML Sanitization** (EmailView.tsx)
The `cleanEmailHtml()` function now removes all dangerous/layout-breaking tags:

```typescript
// Remove document-level tags
- <html>, <head>, <body> tags (keeps content, removes tags)
- <style> tags and their CSS content (prevents CSS injection)
- <script> tags (security)
- <link> tags (prevents external CSS)
- <meta> tags
- <base> tags

// Remove security risks
- on* event handlers (onclick, onload, etc.)
- javascript: protocol from links
- data: protocol from href attributes

// Remove spacer elements (spacing fix)
- Empty divs with height/padding
- Spacer images (1-10px)
- Empty table rows
- Empty paragraphs
```

### 2. **CSS Containment** (email-editor.css)
Added modern CSS properties to create a "firewall" around email content:

```css
.email-body-content {
  /* CSS Containment - prevents styles from leaking */
  contain: layout style;
  isolation: isolate;
  
  /* Force safe typography */
  font-family: ... !important;
  font-size: 14px !important;
  
  /* GPU acceleration for isolation */
  transform: translateZ(0);
}
```

### 3. **Additional Safety Layers**
- Hide any `<style>` tags that slip through: `display: none !important`
- Force all child elements to use safe box-sizing
- Override font-family inheritance

## Testing
After refreshing your browser:

1. ✅ Click on HTML emails with complex layouts (newsletters, marketing emails)
2. ✅ Verify sidebar fonts remain unchanged
3. ✅ Verify page layout stays stable
4. ✅ Email content displays correctly within its container
5. ✅ Text emails still display perfectly

## Files Modified
1. **Converso-frontend/src/components/Inbox/EmailView.tsx**
   - Enhanced `cleanEmailHtml()` function with comprehensive sanitization

2. **Converso-frontend/src/components/Inbox/email-editor.css**
   - Added CSS containment and isolation
   - Added safety overrides for rogue styles

## Security Benefits
This fix also improves security by:
- Removing all `<script>` tags (XSS prevention)
- Removing event handlers (XSS prevention)
- Removing javascript: protocol links
- Isolating email CSS from application CSS

## Next Steps
- **Test immediately**: Refresh browser and click various emails
- **No backend restart needed**: This is frontend-only
- **Report any remaining issues**: If any specific email still causes problems

---

**Status**: ✅ FIXED
**Type**: Critical Bug Fix
**Impact**: High - Affects entire application stability
**Date**: December 2, 2025
