/**
 * Email Body Rendering Utility
 * Used ONLY by EmailView component (not LinkedIn)
 * Handles HTML/text email rendering with proper sanitization
 */

import DOMPurify from 'dompurify';

/**
 * Detect if content is actual HTML (not just plain text)
 */
export function isActualHtml(content: string): boolean {
  if (!content) return false;
  // Check for common HTML tags
  return /<(html|head|body|div|p|table|br|img|a|span|strong|em|b|i|ul|ol|li|blockquote|h[1-6])[>\s]/i.test(content);
}

/**
 * Escape HTML entities in plain text
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert plain text to HTML
 * Handles line breaks, paragraphs, and quoted text
 */
export function convertPlainTextToHtml(text: string): string {
  if (!text) return '';
  
  // Split by double newlines or common email separators
  const sections = text.split(/\n{2,}|(?=^On .* wrote:$)|(?=^From:)|(?=^Sent:)|(?=^[-]{3,})|(?=^_{3,})/gm);
  
  return sections
    .map((section) => {
      const trimmed = section.trim();
      if (!trimmed) return '';
      
      // Detect quoted/replied sections
      const isQuoted = trimmed.startsWith('>') || /^On .* wrote:/i.test(trimmed) || trimmed.startsWith('|');
      const isSeparator = /^[-_]{3,}/.test(trimmed);
      const isHeader = /^(From|To|Sent|Subject|Date):/i.test(trimmed);
      
      const escaped = escapeHtml(trimmed).replace(/\n/g, '<br />');
      
      if (isQuoted) {
        // Style quoted text as blockquote
        return `<blockquote class="email-quote">${escaped}</blockquote>`;
      }
      
      if (isSeparator) {
        return '<hr class="email-separator" />';
      }
      
      if (isHeader) {
        return `<p class="email-header-line"><strong>${escaped}</strong></p>`;
      }
      
      return `<p>${escaped}</p>`;
    })
    .filter(Boolean)
    .join('');
}

/**
 * Sanitize HTML email content
 * Removes dangerous elements while preserving formatting
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  
  // Configure DOMPurify for email content
  const config = {
    // Allowed tags - common email elements
    ALLOWED_TAGS: [
      'html', 'head', 'body', 'meta', 'title', 'style',
      'div', 'span', 'p', 'br', 'hr',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'a', 'img', 'picture', 'source',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code',
      'font', 'center', // Legacy tags common in emails
    ],
    // Allowed attributes
    ALLOWED_ATTR: [
      'style', 'class', 'id', 
      'href', 'target', 'rel',
      'src', 'alt', 'title', 'width', 'height',
      'align', 'valign', 'border', 'cellpadding', 'cellspacing',
      'colspan', 'rowspan',
      'color', 'bgcolor', 'face', 'size', // Font attributes
      'dir', 'lang',
    ],
    // Allow inline styles (common in emails)
    ALLOW_DATA_ATTR: false,
    // Remove scripts, iframes, etc.
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'base', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    // Keep document structure
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  };
  
  // Sanitize HTML
  let sanitized = DOMPurify.sanitize(html, config);
  
  // Post-processing: fix common email issues
  sanitized = postProcessEmailHtml(sanitized);
  
  return sanitized;
}

/**
 * Post-process sanitized HTML to fix common email rendering issues
 */
function postProcessEmailHtml(html: string): string {
  if (!html) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Fix 1: Handle CID images (inline attachments)
  doc.querySelectorAll('img[src^="cid:"]').forEach((img) => {
    const cid = img.getAttribute('src')?.replace('cid:', '');
    // Replace with placeholder or hide (CID images often don't work in web view)
    img.setAttribute('alt', `[Inline Image: ${cid}]`);
    img.setAttribute('title', 'Inline image from email');
    img.classList.add('email-cid-image');
    // Keep src for potential future resolution
  });
  
  // Fix 2: Add classes to common email structures for styling
  doc.querySelectorAll('blockquote').forEach((bq) => {
    bq.classList.add('email-quote');
  });
  
  doc.querySelectorAll('.gmail_quote').forEach((gq) => {
    gq.classList.add('email-quote', 'gmail-quote');
  });
  
  // Fix 3: Detect Outlook quoted sections
  doc.querySelectorAll('div[style*="border"]').forEach((div) => {
    const style = div.getAttribute('style') || '';
    if (style.includes('border') && (style.includes('left') || style.includes('solid'))) {
      div.classList.add('email-quote', 'outlook-quote');
    }
  });
  
  // Fix 4: Make all links open in new tab
  doc.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  
  // Fix 5: Ensure images don't overflow
  doc.querySelectorAll('img').forEach((img) => {
    if (!img.style.maxWidth) {
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    }
  });
  
  return doc.body.innerHTML;
}

/**
 * Main email body renderer
 * Returns HTML string ready to be rendered
 */
export function renderEmailBody(
  htmlBody?: string | null,
  textBody?: string | null,
  preview?: string | null
): string {
  // Priority: htmlBody > textBody > preview
  
  // 1. Try HTML body
  if (htmlBody && isActualHtml(htmlBody)) {
    return sanitizeEmailHtml(htmlBody);
  }
  
  // 2. Try text body
  if (textBody) {
    return convertPlainTextToHtml(textBody);
  }
  
  // 3. Fallback to preview (from metadata)
  if (preview) {
    if (isActualHtml(preview)) {
      return sanitizeEmailHtml(preview);
    }
    return convertPlainTextToHtml(preview);
  }
  
  // 4. Nothing to render
  return '<p class="text-muted-foreground"><em>No email content available</em></p>';
}

/**
 * Email body CSS styles (scoped to .email-html-body)
 * Applied ONLY to email content, not LinkedIn messages
 */
export const EMAIL_BODY_STYLES = `
/* Email body wrapper */
.email-html-body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: #111827;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

/* Reset margins and padding */
.email-html-body * {
  max-width: 100%;
  box-sizing: border-box;
}

.email-html-body body,
.email-html-body html {
  margin: 0;
  padding: 0;
}

/* Paragraphs */
.email-html-body p {
  margin: 0 0 1em 0;
}

.email-html-body p:last-child {
  margin-bottom: 0;
}

/* Links */
.email-html-body a {
  color: #2563eb;
  text-decoration: none;
}

.email-html-body a:hover {
  text-decoration: underline;
}

/* Images */
.email-html-body img {
  max-width: 100% !important;
  height: auto !important;
  display: inline-block;
  border: none;
}

.email-html-body img.email-cid-image {
  opacity: 0.5;
  border: 1px dashed #d1d5db;
  padding: 4px;
}

/* Tables */
.email-html-body table {
  border-collapse: collapse;
  max-width: 100%;
  margin: 0.5em 0;
}

.email-html-body table td,
.email-html-body table th {
  padding: 4px 8px;
  vertical-align: top;
}

.email-html-body table img {
  display: inline-block;
}

/* Lists */
.email-html-body ul,
.email-html-body ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.email-html-body li {
  margin: 0.25em 0;
}

/* Blockquotes (quoted text) */
.email-html-body blockquote,
.email-html-body .email-quote {
  border-left: 3px solid #d1d5db;
  margin: 1em 0;
  padding-left: 1em;
  color: #6b7280;
}

.email-html-body .gmail-quote {
  border-left-color: #ea4335;
}

.email-html-body .outlook-quote {
  border-left-color: #0078d4;
}

/* Separators */
.email-html-body hr,
.email-html-body .email-separator {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.5em 0;
}

/* Headings */
.email-html-body h1,
.email-html-body h2,
.email-html-body h3,
.email-html-body h4,
.email-html-body h5,
.email-html-body h6 {
  margin: 1em 0 0.5em 0;
  font-weight: 600;
}

.email-html-body h1 { font-size: 1.5em; }
.email-html-body h2 { font-size: 1.3em; }
.email-html-body h3 { font-size: 1.1em; }
.email-html-body h4 { font-size: 1em; }
.email-html-body h5 { font-size: 0.9em; }
.email-html-body h6 { font-size: 0.85em; }

/* Code */
.email-html-body pre,
.email-html-body code {
  background: #f3f4f6;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 0.9em;
}

.email-html-body pre {
  padding: 0.75em;
  overflow-x: auto;
  white-space: pre-wrap;
}

.email-html-body code {
  padding: 0.2em 0.4em;
}

/* Email header lines (From, To, etc.) */
.email-html-body .email-header-line {
  font-size: 0.9em;
  color: #4b5563;
  margin: 0.25em 0;
}

/* Text alignment fixes for Outlook */
.email-html-body center,
.email-html-body [align="center"] {
  text-align: left !important;
}

.email-html-body div,
.email-html-body span,
.email-html-body td {
  text-align: inherit;
}

/* Force left alignment on common email wrappers */
.email-html-body table[align="center"] {
  margin-left: 0 !important;
  margin-right: auto !important;
}

/* MSO (Microsoft Office) conditional cleanup */
.email-html-body [class^="Mso"],
.email-html-body [class*=" Mso"] {
  font-family: inherit !important;
}
`;
