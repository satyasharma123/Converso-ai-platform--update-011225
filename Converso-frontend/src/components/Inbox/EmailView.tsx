import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Reply, Paperclip, MoreVertical, Forward, Maximize2, ReplyAll, Bold, Italic, Underline, List, ListOrdered, Link2, Image, Smile, Highlighter, Palette, X, Download, FileIcon, Trash2 } from "lucide-react";
import { renderEmailBody, EMAIL_BODY_STYLES } from "@/utils/renderEmailBody";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useAssignConversation, useUpdateConversationStage, useToggleRead, useDeleteConversation } from "@/hooks/useConversations";
import { useSendMessage } from "@/hooks/useMessages";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SavedReplies } from "@/components/Inbox/SavedReplies";
import { toast } from "sonner";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cn } from "@/lib/utils";
import "./email-editor.css";

const FONT_OPTIONS = ["sans-serif", "serif", "monospace", "arial", "times-new-roman", "courier-new"];
const SIZE_OPTIONS = ["12px", "14px", "16px", "18px", "20px", "24px"];
const COLOR_OPTIONS = ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFA500", "#800080", "#008080", "#808080"];
const EMOJI_LIST = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'];
const QUILL_FORMATS = ["font", "size", "bold", "italic", "underline", "color", "background", "list", "bullet", "ordered", "link", "image"];
const quillModules = {
  toolbar: false,
  history: { delay: 500, maxStack: 100, userOnly: true },
};

if (typeof window !== "undefined") {
  const Font = Quill.import("formats/font");
  Font.whitelist = FONT_OPTIONS;
  Quill.register(Font, true);

  const Size = Quill.import("formats/size");
  Size.whitelist = SIZE_OPTIONS;
  Quill.register(Size, true);
}

// Using type from props or defining compatible one
interface Message {
  id: string;
  senderName: string;
  senderEmail?: string;
  content: string;
  // ✅ MINIMAL FIX: Email body stored in messages table
  html_body?: string; // HTML version of email body
  text_body?: string; // Plain text version of email body
  email_body?: string; // Legacy field (backward compatibility)
  timestamp: string;
  isFromLead: boolean;
}

interface EmailViewProps {
  conversation: {
    id: string;
    senderName: string;
    senderEmail: string;
    subject?: string;
    status: string;
    assigned_to?: string;
    custom_stage_id?: string;
    is_read?: boolean;
    // ✅ MINIMAL FIX: Conversation is metadata only - NO email body fields
    // Email body is in messages[0].html_body / messages[0].text_body
    preview?: string; // Email preview/snippet (fallback only)
    received_account?: {
      id: string;
      account_name?: string;
      account_email: string;
      account_type: string;
      oauth_provider?: string;
    };
    email_timestamp?: string; // Timestamp when email was received
  };
  messages: Message[];
}

// Attachment interface for composing (sending)
interface Attachment {
  id: string;
  file: File;
  preview?: string;
}

// Email attachment interface (received attachments from provider)
interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isInline?: boolean;
  contentId?: string;
  provider?: 'gmail' | 'outlook';
}

export function EmailView({ conversation, messages }: EmailViewProps) {
  const [replyContent, setReplyContent] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [toText, setToText] = useState("");
  const [ccText, setCcText] = useState("");
  const [bccText, setBccText] = useState("");
  const [expandedCompose, setExpandedCompose] = useState(false);
  const [replyType, setReplyType] = useState<"reply" | "replyAll" | "forward">("reply");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0]);
  const [fontSize, setFontSize] = useState(SIZE_OPTIONS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTypingInRecipients, setIsTypingInRecipients] = useState(false);
  const inlineQuillRef = useRef<ReactQuill | null>(null);
  const dialogQuillRef = useRef<ReactQuill | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);
  const bccInputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoFocusedRef = useRef<boolean>(false);
  
  const { data: teamMembers } = useTeamMembers();
  const { data: pipelineStages } = usePipelineStages();
  const assignMutation = useAssignConversation();
  const updateStageMutation = useUpdateConversationStage();
  const toggleRead = useToggleRead();
  const deleteConversation = useDeleteConversation();
  const sendMessage = useSendMessage();
  const queryClient = useQueryClient();
  
  const sdrs = teamMembers?.filter(member => member.role === 'sdr') || [];
  const assignedSdr = sdrs.find(sdr => sdr.id === conversation.assigned_to);
  const currentStage = pipelineStages?.find(stage => stage.id === conversation.custom_stage_id);

  // Helper to check if content is actual HTML vs plain text
  const isActualHtml = (content: string): boolean => {
    if (!content) return false;
    // Check for common HTML tags that indicate formatted content
    // Exclude just <br> tags alone - need actual structure
    const htmlPatterns = [
      /<(div|p|table|tr|td|th|span|a|img|ul|ol|li|h[1-6]|center|font|b|i|u|strong|em)[^>]*>/i,
      /<html[^>]*>/i,
      /<body[^>]*>/i,
      /<!DOCTYPE/i,
    ];
    return htmlPatterns.some(pattern => pattern.test(content));
  };

  // Legacy styles (kept for backward compatibility, but mainly using renderEmailBody.ts now)
const EMAIL_BODY_STYLES_LEGACY = `
.email-body-wrapper {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
}
.email-body-root {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
  color: #111827 !important;
  font-size: 0.8125rem;
  line-height: 1.6;
  word-break: break-word;
  text-align: left !important;
  width: 100%;
  max-width: 100%;
}
.email-body-root * {
  max-width: 100% !important;
  box-sizing: border-box !important;
}
.email-body-root p {
  margin: 0 0 1rem 0;
  text-align: left !important;
}
.email-body-root img {
  max-width: 100% !important;
  height: auto !important;
  border: none;
  display: inline-block;
}
.email-body-root table {
  border-collapse: collapse;
  width: auto !important;
  max-width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.email-body-root table td,
.email-body-root table th {
  vertical-align: top;
  text-align: left !important;
  padding: 4px 8px;
}
.email-body-root blockquote {
  border-left: 3px solid #e5e7eb;
  margin: 1rem 0;
  padding-left: 1rem;
  color: #4b5563;
}
.email-body-root a {
  color: #2563eb;
  text-decoration: none;
}
.email-body-root a:hover {
  text-decoration: underline;
}
.email-body-root hr {
  border: 0;
  border-top: 1px solid #e5e7eb;
  margin: 1.5rem 0;
}
.email-body-root pre {
  white-space: pre-wrap;
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.85rem;
}
.email-body-root div,
.email-body-root span {
  text-align: inherit;
}
/* Remove center alignment from email content */
.email-body-root center {
  text-align: left !important;
}
.email-body-root [align="center"] {
  text-align: left !important;
}
.email-body-root [style*="text-align: center"] {
  text-align: left !important;
}
.email-body-root [style*="text-align:center"] {
  text-align: left !important;
}
`;

const sanitizeEmailHtml = (html: string): string => {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove dangerous elements
  doc.querySelectorAll('script, iframe, object, embed, base, meta[http-equiv="refresh"]').forEach((el) =>
    el.remove()
  );

  doc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());

  // Remove inline event handlers and javascript: URLs
  doc.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value?.toLowerCase() || '';
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attr.name);
      }
    });
    
    // Force left alignment for center-aligned elements
    const align = node.getAttribute('align');
    if (align === 'center') {
      node.setAttribute('align', 'left');
    }
    
    // Override inline center text-align styles
    const style = node.getAttribute('style');
    if (style && (style.includes('text-align: center') || style.includes('text-align:center'))) {
      const newStyle = style.replace(/text-align\s*:\s*center/gi, 'text-align: left');
      node.setAttribute('style', newStyle);
    }
  });

  const bodyContent = doc.body?.innerHTML || doc.documentElement?.innerHTML || html;
  return `<div class="email-body-root">${bodyContent}</div>`;
};

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatPlainTextAsHtml = (text: string) => {
  if (!text) return '';
  
  // Split by double newlines or common email separators
  const sections = text.split(/\n{2,}|(?=^On .* wrote:$)|(?=^From:)|(?=^Sent:)|(?=^>{2,})/gm);
  
  return sections
    .map((section) => {
      const trimmed = section.trim();
      if (!trimmed) return '';
      
      // Check if this is a quoted/replied section
      const isQuoted = trimmed.startsWith('>') || /^On .* wrote:/.test(trimmed);
      
      const withBreaks = escapeHtml(trimmed).replace(/\n/g, '<br />');
      
      if (isQuoted) {
        // Style quoted text differently
        return `<blockquote style="border-left: 3px solid #e5e7eb; margin: 1rem 0; padding-left: 1rem; color: #6b7280;">${withBreaks}</blockquote>`;
      }
      
      return `<p>${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join('');
};

const EmailBodyContent = ({
  htmlBody,
  textBody,
  preview,
}: {
  htmlBody?: string | null;
  textBody?: string | null;
  preview?: string | null;
}) => {
  // ✅ FINAL FIX: Unwrap JSON if needed, then render HTML directly
  const getActualHtmlBody = (body: string | null | undefined): string | null => {
    if (!body) return null;
    
    // Check if body is JSON-wrapped: {"body":"<html>..."}
    if (body.trim().startsWith('{') && body.includes('"body"')) {
      try {
        const parsed = JSON.parse(body);
        return parsed.body || parsed.htmlBody || body;
      } catch (e) {
        // Not valid JSON, return as-is
        return body;
      }
    }
    
    return body;
  };

  const actualHtmlBody = getActualHtmlBody(htmlBody);
  
  // Temporary debug log (remove later)
  React.useEffect(() => {
    console.log('[EmailBodyContent] HTML unwrapping:', {
      originalType: typeof htmlBody,
      wasJsonWrapped: htmlBody?.trim().startsWith('{'),
      hasActualHtml: !!actualHtmlBody,
      actualHtmlPreview: actualHtmlBody?.slice(0, 200),
      hasText: !!textBody,
      hasPreview: !!preview,
    });
  }, [htmlBody, actualHtmlBody, textBody, preview]);

  return (
    <div className="mt-10 email-body-wrapper">
      <style>{EMAIL_BODY_STYLES}</style>
      
      {/* Priority 1: Render html_body directly if it exists */}
      {actualHtmlBody ? (
        <div 
          className="email-html-body"
          dangerouslySetInnerHTML={{ __html: actualHtmlBody }} 
        />
      ) : textBody ? (
        /* Priority 2: Render text_body as plain text */
        <pre className="email-text-body whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {textBody}
        </pre>
      ) : preview ? (
        /* Priority 3: Render preview as fallback */
        <div className="email-preview text-sm text-muted-foreground">
          {preview}
        </div>
      ) : (
        /* Priority 4: No content available */
        <div className="text-sm text-muted-foreground italic">
          No email content available
        </div>
      )}
    </div>
  );
};

  // Mark as read after 5 seconds
  useEffect(() => {
    if (!conversation.id || conversation.is_read) return;

    const timer = setTimeout(() => {
      toggleRead.mutate({ 
        conversationId: conversation.id, 
        isRead: true // Mark as read after 5 seconds
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [conversation.id, conversation.is_read, toggleRead]);

  // Auto-focus editor only once when reply opens (unless user is in recipient fields)
  useEffect(() => {
    if (!showReply) {
      hasAutoFocusedRef.current = false;
      return;
    }
    
    if (hasAutoFocusedRef.current || isTypingInRecipients) return;
    
    const timeout = setTimeout(() => {
      if (!isTypingInRecipients) {
        (expandedCompose ? dialogQuillRef.current : inlineQuillRef.current)?.getEditor().focus();
        hasAutoFocusedRef.current = true;
      }
    }, 150);
    return () => clearTimeout(timeout);
  }, [showReply, expandedCompose, isTypingInRecipients]);

useEffect(() => {
  if (!showReply || isTypingInRecipients) return;
  const editor = getActiveEditor();
  if (!editor) return;
  // Don't auto-focus, just format
  const currentSelection = editor.getSelection();
  editor.format("font", fontFamily);
  editor.format("size", fontSize);
  // Restore selection without forcing focus
  if (currentSelection) {
    editor.setSelection(currentSelection.index, currentSelection.length);
  }
}, [fontFamily, fontSize, expandedCompose, showReply, isTypingInRecipients]);

// Set default font size when editor is first created
useEffect(() => {
  if (!showReply || isTypingInRecipients) return;
  const timeout = setTimeout(() => {
    const editor = getActiveEditor();
    if (!editor || isTypingInRecipients) return;
    // Set default font size if no content exists - but don't steal focus
    if (!replyContent || replyContent.trim() === '' || replyContent === '<p><br></p>') {
      const currentSelection = editor.getSelection();
      editor.format("font", fontFamily);
      editor.format("size", fontSize);
      // Don't force focus, just restore selection if it existed
      if (currentSelection) {
        editor.setSelection(currentSelection.index, currentSelection.length);
      }
    }
  }, 200);
  return () => clearTimeout(timeout);
}, [showReply, expandedCompose, isTypingInRecipients]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Format timestamp to "M/D/YYYY h:mm AM/PM" format
  const formatEmailTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return timestamp;
      
      const month = date.getMonth() + 1; // 0-indexed
      const day = date.getDate();
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      // Convert to 12-hour format
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      
      // Pad minutes with leading zero if needed
      const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
      
      return `${month}/${day}/${year} ${hours}:${minutesStr} ${ampm}`;
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp;
    }
  };

  const getActiveEditor = () =>
    (expandedCompose ? dialogQuillRef.current : inlineQuillRef.current)?.getEditor();

  const handleEditorChange = (content: string) => {
    setReplyContent(content);
  };

  const handleEditorFocus = () => {
    // When editor gains focus, user is no longer typing in recipients
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setIsTypingInRecipients(false);
  };

  const handleRecipientFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setIsTypingInRecipients(true);
    hasAutoFocusedRef.current = true; // Mark that user has interacted
    
    // Force the input to stay focused
    const input = e.target;
    setTimeout(() => {
      if (input) {
        input.focus();
      }
    }, 0);
  };

  const handleRecipientBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only blur if not focusing another recipient field
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToAnotherRecipient = 
      relatedTarget?.tagName === 'INPUT' &&
      (relatedTarget === toInputRef.current || 
       relatedTarget === ccInputRef.current || 
       relatedTarget === bccInputRef.current);
    
    if (isMovingToAnotherRecipient) {
      // Stay in recipient mode
      return;
    }
    
    // Small delay to allow click events to process
    blurTimerRef.current = setTimeout(() => {
      setIsTypingInRecipients(false);
    }, 300);
  };

  const applyFormat = (format: string, value?: any) => {
    const editor = getActiveEditor();
    if (!editor) return;
    editor.focus();
    
    // If value is provided, use it directly (for color, background, etc.)
    if (value !== undefined) {
      editor.format(format, value);
    } else {
      // For toggle formats (bold, italic, underline), check current state and toggle
      const current = editor.getFormat();
      const isActive = current[format] === true;
      editor.format(format, isActive ? false : true);
    }
    
    setReplyContent(editor.root.innerHTML);
  };

  const handleListFormat = (type: "bullet" | "ordered") => {
    const editor = getActiveEditor();
    if (!editor) return;
    const current = editor.getFormat();
    const isActive = current.list === type;
    editor.format("list", isActive ? false : type);
    setReplyContent(editor.root.innerHTML);
  };

  const handleInsertLink = () => {
    const editor = getActiveEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    setLinkText(selection && selection.length > 0 ? editor.getText(selection.index, selection.length) : "");
    setLinkUrl("");
    setShowLinkDialog(true);
  };

  const handleConfirmLink = () => {
    if (!linkUrl.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    const editor = getActiveEditor();
    if (!editor) return;

    const selection = editor.getSelection(true);
    const linkTextToUse = linkText.trim();

    if (selection && selection.length > 0) {
      editor.format("link", linkUrl);
    } else if (linkTextToUse) {
      editor.insertText(selection ? selection.index : editor.getLength(), linkTextToUse, "link", linkUrl);
      editor.setSelection((selection ? selection.index : editor.getLength()) + linkTextToUse.length, 0);
    } else {
      editor.insertText(selection ? selection.index : editor.getLength(), linkUrl, "link", linkUrl);
      editor.setSelection((selection ? selection.index : editor.getLength()) + linkUrl.length, 0);
    }

    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkText("");
    editor.focus();
    setReplyContent(editor.root.innerHTML);
  };

  const handleInsertImage = () => {
    imageInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const editor = getActiveEditor();
      if (!editor || typeof event.target?.result !== "string") return;
      const selection = editor.getSelection(true);
      editor.insertEmbed(selection ? selection.index : editor.getLength(), "image", event.target.result, "user");
      editor.setSelection((selection ? selection.index : editor.getLength()) + 1, 0);
      setReplyContent(editor.root.innerHTML);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleInsertEmoji = (emoji: string) => {
    const editor = getActiveEditor();
    if (!editor) return;
    const selection = editor.getSelection(true);
    editor.insertText(selection ? selection.index : editor.getLength(), emoji, "user");
    editor.setSelection((selection ? selection.index : editor.getLength()) + emoji.length, 0);
    setReplyContent(editor.root.innerHTML);
    setShowEmojiPicker(false);
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const attachment: Attachment = {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      };
      setAttachments((prev) => [...prev, attachment]);
    });
    e.target.value = "";
  };

  // Download received email attachment
  const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
    try {
      const response = await fetch(`/api/emails/${conversation.id}/attachments/${attachmentId}/download`);
      
      if (!response.ok) {
        throw new Error('Failed to download attachment');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${filename}`);
    } catch (error: any) {
      toast.error(`Failed to download attachment: ${error.message}`);
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const buildEmailBodyWithQuotedOriginal = () => {
    // Get the user's new message
    const userMessage = replyContent || '';

    // Get the original email content
    const originalEmailHtml = conversation.email_body_html || conversation.email_body || '';
    const originalEmailText = conversation.email_body_text || '';
    
    // Use HTML if available, otherwise text
    const originalContent = originalEmailHtml || originalEmailText;

    if (!originalContent) {
      // No original content to quote
      return userMessage;
    }

    // Format the original email timestamp
    const emailDate = conversation.email_timestamp 
      ? new Date(conversation.email_timestamp).toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      : '';

    // Build the quoted email header
    const quotedHeader = replyType === 'forward'
      ? `<br><br><div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ccc;">
           <p><strong>---------- Forwarded message ---------</strong><br>
           From: <strong>${conversation.senderName}</strong> &lt;${conversation.senderEmail}&gt;<br>
           Date: ${emailDate}<br>
           Subject: ${conversation.subject || 'No Subject'}</p>
         </div><br>`
      : `<br><br><div style="margin-top: 20px; padding-top: 10px; border-left: 3px solid #ccc; padding-left: 10px; color: #666;">
           <p>On ${emailDate}, <strong>${conversation.senderName}</strong> &lt;${conversation.senderEmail}&gt; wrote:</p>
         </div>`;

    // Build quoted original content
    const quotedContent = replyType === 'forward'
      ? `<div style="margin-left: 0;">${originalContent}</div>`
      : `<blockquote style="margin: 10px 0; padding-left: 10px; border-left: 3px solid #ccc; color: #666;">
           ${originalContent}
         </blockquote>`;

    // Combine user's message with quoted original
    return `${userMessage}${quotedHeader}${quotedContent}`;
  };

  const handleSend = async () => {
    const editor =
      getActiveEditor() ||
      inlineQuillRef.current?.getEditor() ||
      dialogQuillRef.current?.getEditor();
    const plainText = editor?.getText().trim() ?? replyContent.replace(/<[^>]+>/g, "").trim();

    if (!plainText && attachments.length === 0) {
      toast.error("Please enter a message or attach a file");
      return;
    }

    // Validate recipients for forward
    if (replyType === "forward" && !toText.trim()) {
      toast.error("Please add at least one recipient");
      return;
    }

    try {
      // Get authentication from localStorage
      const supabaseKey = 'sb-wahvinwuyefmkmgmjspo-auth-token';
      const sessionStr = localStorage.getItem(supabaseKey);
      let token: string | null = null;
      let userId: string | null = null;
      
      if (sessionStr) {
        try {
          const parsed = JSON.parse(sessionStr);
          token = parsed?.access_token || null;
          userId = parsed?.user?.id || null;
        } catch {
          toast.error("Authentication error. Please refresh and try again.");
          return;
        }
      }

      if (!userId) {
        toast.error("User not authenticated. Please log in again.");
        return;
      }

      // Prepare headers with authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Build complete email body with quoted original
      const fullEmailBody = buildEmailBodyWithQuotedOriginal();

      // Call the actual email sending API
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/emails/send`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          conversationId: conversation.id,
          to: toText,
          cc: ccText || undefined,
          bcc: bccText || undefined,
          subject: replyType === "forward" 
            ? `Fwd: ${conversation.subject || "No Subject"}`
            : `Re: ${conversation.subject || "No Subject"}`,
          body: fullEmailBody,
          replyType,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to send email';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      toast.success(`${replyType === "forward" ? "Email forwarded" : "Reply sent"} successfully`);
      setReplyContent("");
      setAttachments([]);
      setShowReply(false);
      setShowCc(false);
      setShowBcc(false);
      setToText("");
      setCcText("");
      setBccText("");
      setExpandedCompose(false);
      inlineQuillRef.current?.getEditor()?.setText("");
      dialogQuillRef.current?.getEditor()?.setText("");
      
      // ✅ CRITICAL: Force refresh conversations to show updated inbox with action icons
      // This prevents showing stale cached data (sent emails in inbox)
      console.log('[EmailView] Invalidating all queries after send');
      await queryClient.invalidateQueries({ queryKey: ['conversations', 'email'] });
      await queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      await queryClient.invalidateQueries({ queryKey: ['email-body', conversation.id] }); // ← FIX: Clear email body cache!
      
      // Small delay to let backend complete all database operations
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['conversations', 'email'] });
        queryClient.refetchQueries({ queryKey: ['email-body', conversation.id] }); // ← FIX: Refetch email body!
        console.log('[EmailView] Refetched all queries after send');
      }, 500);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    }
  };

  const handleReplyClick = (type: "reply" | "replyAll" | "forward") => {
    setReplyType(type);
    hasAutoFocusedRef.current = false; // Reset auto-focus flag for new compose
    
    // Set recipients based on reply type
    if (type === "forward") {
      // Forward: blank To, Cc, Bcc
      setToText("");
      setCcText("");
      setBccText("");
      setShowCc(false);
      setShowBcc(false);
    } else if (type === "reply") {
      // Reply: To = sender only
      setToText(conversation.senderEmail);
      setCcText("");
      setBccText("");
      setShowCc(false);
      setShowBcc(false);
    } else if (type === "replyAll") {
      // Reply All: To = sender, show Cc
      setToText(conversation.senderEmail);
      // TODO: Parse original Cc recipients from email headers if available
      setCcText("");
      setBccText("");
      setShowCc(true);
      setShowBcc(false);
    }
    
    setShowReply(true);
  };

  const handleExpand = () => {
    setExpandedCompose(true);
  };

  const handleSelectTemplate = (content: string) => {
    setReplyContent((prev) => (prev ? `${prev}<p>${content}</p>` : `<p>${content}</p>`));
  };

  const getReplyLabel = () => {
    switch (replyType) {
      case "replyAll": return "Reply All";
      case "forward": return "Forward";
      default: return "Reply";
    }
  };

  const renderReplyComposer = (isExpanded: boolean = false) => (
    <div className={isExpanded ? "space-y-4" : ""}>
      <div className={`border-t bg-background ${isExpanded ? "p-0" : ""}`}>
        <div className="px-6 py-3 border-b bg-muted/30 space-y-2">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-muted-foreground font-medium w-8">To:</span>
              {replyType === "forward" ? (
                <Input
                  ref={toInputRef}
                  value={toText}
                  onChange={(e) => setToText(e.target.value)}
                  placeholder="Add recipients"
                  className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0 flex-1"
                  onFocus={handleRecipientFocus}
                  onBlur={handleRecipientBlur}
                  autoComplete="off"
                />
              ) : (
                <span className="text-foreground">{toText}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!showCc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCc(true)}
                  className="h-6 text-xs px-2"
                >
                  Cc
                </Button>
              )}
              {!showBcc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBcc(true)}
                  className="h-6 text-xs px-2"
                >
                  Bcc
                </Button>
              )}
            </div>
          </div>
          
          {showCc && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium w-8">Cc:</span>
              <Input
                ref={ccInputRef}
                value={ccText}
                onChange={(e) => setCcText(e.target.value)}
                placeholder="Add recipients"
                className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0 flex-1"
                onFocus={handleRecipientFocus}
                onBlur={handleRecipientBlur}
                autoComplete="off"
              />
            </div>
          )}
          
          {showBcc && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium w-8">Bcc:</span>
              <Input
                ref={bccInputRef}
                value={bccText}
                onChange={(e) => setBccText(e.target.value)}
                placeholder="Add recipients"
                className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0 flex-1"
                onFocus={handleRecipientFocus}
                onBlur={handleRecipientBlur}
                autoComplete="off"
              />
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div
            className={cn(
              "rounded-lg bg-transparent ring-0 focus-within:ring-0",
              isExpanded ? "min-h-[360px]" : "min-h-[200px]",
              isTypingInRecipients && "pointer-events-none opacity-50"
            )}
          >
            <ReactQuill
              ref={(instance) => {
                if (!instance) return;
                if (isExpanded) {
                  dialogQuillRef.current = instance;
                } else {
                  inlineQuillRef.current = instance;
                }
                // Set default font and size when editor is created
                setTimeout(() => {
                  const editor = instance.getEditor();
                  if (editor && !isTypingInRecipients) {
                    editor.format("font", fontFamily);
                    editor.format("size", fontSize);
                  }
                }, 100);
              }}
              theme="snow"
              value={replyContent}
              onChange={handleEditorChange}
              onFocus={handleEditorFocus}
              modules={quillModules}
              formats={QUILL_FORMATS}
              placeholder="Type your reply..."
              className="email-quill h-full"
              style={{ minHeight: isExpanded ? 340 : 160 }}
              readOnly={isTypingInRecipients}
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs"
                >
                  {attachment.preview ? (
                    <img
                      src={attachment.preview}
                      alt={attachment.file.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex flex-col max-w-[140px]">
                    <span className="truncate font-medium">{attachment.file.name}</span>
                    <span className="text-muted-foreground">
                      {(attachment.file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formatting Toolbar */}
        <div className="px-6 py-2 bg-muted/30 border-y">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Select value={fontFamily} onValueChange={(value) => {
              setFontFamily(value);
              applyFormat("font", value);
            }}>
              <SelectTrigger className="w-[100px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((font) => (
                  <SelectItem key={font} value={font}>
                    {font.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={fontSize} onValueChange={(value) => {
              setFontSize(value);
              applyFormat("size", value);
            }}>
              <SelectTrigger className="w-[70px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size.replace("px", "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Bold"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormat("bold");
                }}
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Italic"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormat("italic");
                }}
              >
                <Italic className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Underline"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyFormat("underline");
                }}
              >
                <Underline className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <div className="flex items-center gap-0.5">
              <DropdownMenu open={showColorPicker} onOpenChange={setShowColorPicker}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Text Color">
                    <Palette className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40 p-2">
                  <div className="grid grid-cols-5 gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        className="h-6 w-6 rounded-full border"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          applyFormat("color", color);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Highlight"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const editor = getActiveEditor();
                  if (!editor) return;
                  editor.focus();
                  const current = editor.getFormat();
                  const isActive = current.background === "#fff59d" || current.background === "rgb(255, 245, 157)";
                  editor.format("background", isActive ? false : "#fff59d");
                  setReplyContent(editor.root.innerHTML);
                }}
              >
                <Highlighter className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Bulleted List"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleListFormat("bullet");
                }}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Numbered List"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleListFormat("ordered");
                }}
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <Separator orientation="vertical" className="h-5 mx-1" />
            
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Insert Link"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleInsertLink();
                }}
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Insert Image"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleInsertImage();
                }}
              >
                <Image className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Insert Emoji">
                    <Smile className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 h-48 overflow-y-auto p-2">
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        className="h-8 w-8 text-lg hover:bg-muted rounded transition-colors"
                        onClick={() => handleInsertEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Attach File"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleFileAttach();
                }}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <SavedReplies onSelectReply={handleSelectTemplate} />
            {!isExpanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExpand}
                className="h-7 text-xs px-2"
              >
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Expand
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowReply(false);
                setShowCc(false);
                setShowBcc(false);
                setExpandedCompose(false);
                setToText("");
                setCcText("");
                setBccText("");
                setReplyContent("");
              }}
              className="h-7 text-xs px-3"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!replyContent.trim()}
              className="h-7 text-xs px-3"
            >
              <Send className="h-3 w-3 mr-1.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const handleAssign = (sdrId: string) => {
    assignMutation.mutate({ 
      conversationId: conversation.id, 
      sdrId: sdrId === 'unassigned' ? null : sdrId 
    }, {
      onSuccess: () => {
        // Force a refetch to update the UI
        // The query invalidation in the hook should handle this, but we ensure it here
      }
    });
  };

  const handleStageChange = (stageId: string) => {
    updateStageMutation.mutate({
      conversationId: conversation.id,
      stageId: stageId === 'none' ? null : stageId
    });
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    deleteConversation.mutate(conversation.id, {
      onSuccess: () => {
        toast.success("Email deleted successfully");
        setShowDeleteConfirm(false);
        // Parent component should handle navigation away from deleted email
      },
      onError: (error: any) => {
        toast.error(`Failed to delete email: ${error.message}`);
        setShowDeleteConfirm(false);
      }
    });
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Email Header */}
        <div className="px-6 py-4 border-b bg-background">
          {/* Assign and Stage Dropdowns */}
          <div className="flex items-center gap-2 mb-3">
            <Select value={conversation.assigned_to || 'unassigned'} onValueChange={handleAssign}>
              <SelectTrigger className="w-[140px] h-7 text-xs">
                <SelectValue placeholder={assignedSdr ? assignedSdr.full_name : 'Assign'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {sdrs.map((sdr) => (
                  <SelectItem key={sdr.id} value={sdr.id}>
                    {sdr.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={conversation.custom_stage_id || 'none'} onValueChange={handleStageChange}>
              <SelectTrigger className="w-[140px] h-7 text-xs">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {pipelineStages?.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-lg font-semibold">{conversation.subject || "No Subject"}</h2>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={handleDelete}
                title={showDeleteConfirm ? "Click again to confirm delete" : "Delete"}
              >
                <Trash2 className={cn("h-4 w-4", showDeleteConfirm && "text-red-600")} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleReplyClick("reply")}
                title="Reply"
              >
                <Reply className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleReplyClick("reply")} className="cursor-pointer">
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReplyClick("replyAll")} className="cursor-pointer">
                    <ReplyAll className="h-4 w-4 mr-2" />
                    Reply All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleReplyClick("forward")} className="cursor-pointer">
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Email Thread */}
        <ScrollArea className="flex-1 px-6 pt-2 pb-4">
          <div className="space-y-0">
            {/* For emails: Display email body from conversation when messages array is empty */}
            {messages.length === 0 && (conversation.email_body || conversation.preview) && (
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground text-base">
                      {getInitials(conversation.senderName)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        {/* ✅ FIX: Detect sent emails and swap From/To display */}
                        {(() => {
                          const isSentEmail = (conversation as any).folder_name === 'sent' || 
                                             window.location.pathname.includes('/sent');
                          
                          if (isSentEmail) {
                            // For SENT emails: Show YOU as From, recipient as To
                            return (
                              <>
                                <p className="text-base font-semibold text-foreground">
                                  {conversation.received_account?.account_name || 'Me'} &lt;{conversation.received_account?.account_email || 'me'}&gt;
                                </p>
                                <p className="text-sm text-foreground mt-1">
                                  <span className="font-medium">To:</span> {conversation.senderName} &lt;{conversation.senderEmail}&gt;
                                </p>
                              </>
                            );
                          } else {
                            // For INBOX emails: Show sender as From, you as To
                            return (
                              <>
                                <p className="text-base font-semibold text-foreground">
                                  {conversation.senderName} &lt;{conversation.senderEmail}&gt;
                                </p>
                                <p className="text-sm text-foreground mt-1">
                                  <span className="font-medium">To:</span> {conversation.received_account?.account_email || 'me'}
                                </p>
                              </>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* ✅ MINIMAL FIX: Render body from messages[0], not conversation */}
                <EmailBodyContent 
                  htmlBody={(messages[0] as any)?.html_body || null}
                  textBody={(messages[0] as any)?.text_body || null}
                  preview={conversation.preview}
                />
                
                {/* Email Attachments Section (Email-only, not LinkedIn) */}
                {conversation.email_attachments && conversation.email_attachments.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Attachments ({conversation.email_attachments.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {conversation.email_attachments
                        .filter((att) => !att.isInline) // Only show non-inline attachments
                        .map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {attachment.filename}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(attachment.size)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0"
                              onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* For LinkedIn or emails with messages: Display from messages array */}
            {messages.length > 0 && [...messages].reverse().map((message, index) => (
              <div key={message.id}>
                {/* Latest message - full display */}
                {index === 0 && (
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground text-base">
                          {getInitials(message.senderName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            {/* ✅ FIX: Detect sent emails and swap From/To display */}
                            {(() => {
                              const isSentEmail = (conversation as any).folder_name === 'sent' || 
                                                 window.location.pathname.includes('/sent');
                              
                              if (isSentEmail) {
                                // For SENT emails: Show YOU as From, recipient as To
                                return (
                                  <>
                                    <p className="text-base font-semibold text-foreground">
                                      {conversation.received_account?.account_name || 'Me'} &lt;{conversation.received_account?.account_email || 'me'}&gt;
                                    </p>
                                    <p className="text-sm text-foreground mt-1">
                                      <span className="font-medium">To:</span> {conversation.senderName} &lt;{conversation.senderEmail}&gt;
                                    </p>
                                  </>
                                );
                              } else {
                                // For INBOX emails: Show sender as From, you as To
                                return (
                                  <>
                                    <p className="text-base font-semibold text-foreground">
                                      {message.senderName} &lt;{message.senderEmail || conversation.senderEmail}&gt;
                                    </p>
                                    <p className="text-sm text-foreground mt-1">
                                      <span className="font-medium">To:</span> {conversation.received_account?.account_email || 'me'}
                                    </p>
                                  </>
                                );
                              }
                            })()}
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">{formatEmailTimestamp(message.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* ✅ MINIMAL FIX: Render body from message.html_body / text_body */}
                    <EmailBodyContent
                      htmlBody={(message as any).html_body || message.email_body || null}
                      textBody={(message as any).text_body || null}
                      preview={message.content || null}
                    />
                  </div>
                )}

                {/* Previous messages in thread */}
                {index > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-foreground mb-3">
                      On {formatEmailTimestamp(message.timestamp)}, {message.senderName} &lt;
                      <a href={`mailto:${message.senderEmail || conversation.senderEmail}`} className="text-primary">
                        {message.senderEmail || conversation.senderEmail}
                      </a>
                      &gt; wrote:
                    </p>
                    
                    <div className="opacity-80 mt-4">
                      {/* ✅ MINIMAL FIX: Render body from message.html_body / text_body */}
                      <EmailBodyContent
                        htmlBody={(message as any).html_body || message.email_body || null}
                        textBody={(message as any).text_body || null}
                        preview={message.content || null}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Reply Composition */}
        {showReply && !expandedCompose && renderReplyComposer(false)}
      </div>

      {/* Expanded Compose Dialog */}
      {expandedCompose && (
        <Dialog open={expandedCompose} onOpenChange={setExpandedCompose}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle className="text-base">
                {getReplyLabel()}: {conversation.subject || "No Subject"}
              </DialogTitle>
            </DialogHeader>
            {renderReplyComposer(true)}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="link-text" className="text-sm font-medium">
                Link Text
              </label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Display text"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="link-url" className="text-sm font-medium">
                URL
              </label>
              <Input
                id="link-url"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowLinkDialog(false);
                setLinkUrl("");
                setLinkText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmLink}>Insert Link</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
