import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Reply, Paperclip, MoreVertical, Forward, Maximize2, ReplyAll, Bold, Italic, Underline, List, ListOrdered, Link2, Image, Smile, Highlighter, Palette, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useAssignConversation, useUpdateConversationStage, useToggleRead } from "@/hooks/useConversations";
import { useSendMessage } from "@/hooks/useMessages";
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
  email_body?: string; // Full HTML body
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
    email_body?: string; // Full email body for emails (stored in conversation)
    preview?: string; // Email preview/description
  };
  messages: Message[];
}

interface Attachment {
  id: string;
  file: File;
  preview?: string;
}

export function EmailView({ conversation, messages }: EmailViewProps) {
  const [replyContent, setReplyContent] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
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
  const inlineQuillRef = useRef<ReactQuill | null>(null);
  const dialogQuillRef = useRef<ReactQuill | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const { data: teamMembers } = useTeamMembers();
  const { data: pipelineStages } = usePipelineStages();
  const assignMutation = useAssignConversation();
  const updateStageMutation = useUpdateConversationStage();
  const toggleRead = useToggleRead();
  const sendMessage = useSendMessage();
  
  const sdrs = teamMembers?.filter(member => member.role === 'sdr') || [];
  const assignedSdr = sdrs.find(sdr => sdr.id === conversation.assigned_to);
  const currentStage = pipelineStages?.find(stage => stage.id === conversation.custom_stage_id);

  // Helper function to clean HTML email body - removes excessive top spacing and malicious tags
  const cleanEmailHtml = (html: string): string => {
    if (!html) return html;
    
    // CRITICAL: Remove tags that can affect the entire page layout/styling
    let cleaned = html
      // Remove <html>, <head>, <body> tags (but keep their content)
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      // Remove ALL <style> tags and their content (prevents CSS injection)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove <script> tags (security)
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Remove <link> tags (prevents external CSS)
      .replace(/<link[^>]*>/gi, '')
      // Remove <meta> tags
      .replace(/<meta[^>]*>/gi, '')
      // Remove <base> tags
      .replace(/<base[^>]*>/gi, '')
      // Remove on* event handlers (onclick, onload, etc.) - security
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '')
      // Remove javascript: protocol from links
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
      // Remove data: protocol for security (except images)
      .replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"')
      // Remove common spacer patterns at the start of HTML emails
      .replace(/^[\s\n]*<div[^>]*style="[^"]*height:\s*\d+px[^"]*"[^>]*><\/div>/gi, '')
      .replace(/^[\s\n]*<div[^>]*style="[^"]*padding-top:\s*\d+px[^"]*"[^>]*><\/div>/gi, '')
      .replace(/^[\s\n]*<div[^>]*style="[^"]*margin-top:\s*\d+px[^"]*"[^>]*><\/div>/gi, '')
      // Remove spacer images (1-10px height)
      .replace(/^[\s\n]*<img[^>]*height=["']?[1-9]["']?[^>]*>/gi, '')
      .replace(/^[\s\n]*<img[^>]*height=["']?10["']?[^>]*>/gi, '')
      // Remove empty table rows with height at start
      .replace(/^[\s\n]*<tr[^>]*><td[^>]*height=["']?\d+["']?[^>]*>(\s|&nbsp;)*<\/td><\/tr>/gi, '')
      // Remove leading whitespace and newlines
      .replace(/^[\s\n]+/, '')
      // Remove empty paragraphs at start
      .replace(/^<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
      // Remove multiple consecutive empty divs at start
      .replace(/^(<div[^>]*>\s*<\/div>\s*)+/gi, '');
    
    return cleaned;
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

  useEffect(() => {
    if (!showReply) return;
    const timeout = setTimeout(() => {
    (expandedCompose ? dialogQuillRef.current : inlineQuillRef.current)?.getEditor().focus();
    }, 150);
    return () => clearTimeout(timeout);
  }, [showReply, expandedCompose]);

useEffect(() => {
  if (!showReply) return;
  const editor = getActiveEditor();
  if (!editor) return;
  editor.format("font", fontFamily);
  editor.format("size", fontSize);
}, [fontFamily, fontSize, expandedCompose, showReply]);

// Set default font size when editor is first created
useEffect(() => {
  if (!showReply) return;
  const timeout = setTimeout(() => {
    const editor = getActiveEditor();
    if (!editor) return;
    // Set default font size if no content exists
    if (!replyContent || replyContent.trim() === '' || replyContent === '<p><br></p>') {
      editor.format("font", fontFamily);
      editor.format("size", fontSize);
    }
  }, 200);
  return () => clearTimeout(timeout);
}, [showReply, expandedCompose]);

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

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
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

    try {
      await sendMessage.mutateAsync({
        conversationId: conversation.id,
        content: replyContent || plainText,
      });

      toast.success("Reply sent");
      setReplyContent("");
      setAttachments([]);
      setShowReply(false);
      setShowCc(false);
      setShowBcc(false);
      setCcText("");
      setBccText("");
      setExpandedCompose(false);
      inlineQuillRef.current?.getEditor()?.setText("");
      dialogQuillRef.current?.getEditor()?.setText("");
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    }
  };

  const handleReplyClick = (type: "reply" | "replyAll" | "forward") => {
    setReplyType(type);
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
              <span className="text-muted-foreground font-medium">To:</span>
              <span className="text-foreground">{conversation.senderEmail}</span>
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
              <span className="text-muted-foreground font-medium">Cc:</span>
              <Input
                value={ccText}
                onChange={(e) => setCcText(e.target.value)}
                placeholder="Add recipients"
                className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0"
              />
            </div>
          )}
          
          {showBcc && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">Bcc:</span>
              <Input
                value={bccText}
                onChange={(e) => setBccText(e.target.value)}
                placeholder="Add recipients"
                className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 px-0"
              />
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div
            className={cn(
              "rounded-lg bg-transparent ring-0 focus-within:ring-0",
              isExpanded ? "min-h-[360px]" : "min-h-[200px]"
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
                  if (editor) {
                    editor.format("font", fontFamily);
                    editor.format("size", fontSize);
                  }
                }, 100);
              }}
              theme="snow"
              value={replyContent}
              onChange={handleEditorChange}
              modules={quillModules}
              formats={QUILL_FORMATS}
              placeholder="Type your reply..."
              className="email-quill h-full"
              style={{ minHeight: isExpanded ? 340 : 160 }}
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
                        <p className="text-base font-semibold text-foreground">
                          {conversation.senderName} &lt;{conversation.senderEmail}&gt;
                        </p>
                        <p className="text-sm text-foreground mt-1">
                          <span className="font-medium">To:</span> {conversation.senderEmail}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {conversation.email_body ? (
                  <div className="mt-16">
                    <div 
                      className="email-body-content"
                      dangerouslySetInnerHTML={{ __html: cleanEmailHtml(conversation.email_body) }}
                    />
                  </div>
                ) : conversation.preview ? (
                  <div className="mt-16">
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words">
                      {conversation.preview}
                    </div>
                  </div>
                ) : null}
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
                            <p className="text-base font-semibold text-foreground">
                              {message.senderName} &lt;{message.senderEmail || conversation.senderEmail}&gt;
                            </p>
                            <p className="text-sm text-foreground mt-1">
                              <span className="font-medium">To:</span> {conversation.senderEmail}
                            </p>
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">{formatEmailTimestamp(message.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {message.email_body ? (
                      <div className="mt-16">
                        <div 
                          className="email-body-content"
                          dangerouslySetInnerHTML={{ __html: cleanEmailHtml(message.email_body) }}
                        />
                      </div>
                    ) : (
                      <div className="mt-16">
                        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words">
                          {message.content}
                        </div>
                      </div>
                    )}
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
                    
                    {message.email_body ? (
                      <div 
                        className="email-body-content opacity-80 mt-4"
                        dangerouslySetInnerHTML={{ __html: cleanEmailHtml(message.email_body) }}
                      />
                    ) : (
                      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed break-words opacity-80 mt-4">
                        {message.content}
                      </div>
                    )}
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
