import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  FileText, 
  Plus, 
  Pencil, 
  Trash2,
  X 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  useEmailTemplates, 
  useCreateEmailTemplate, 
  useUpdateEmailTemplate, 
  useDeleteEmailTemplate 
} from "@/hooks/useEmailTemplates";
import { Label } from "@/components/ui/label";

interface SavedRepliesProps {
  onSelectReply: (content: string) => void;
}

interface TemplateFormData {
  title: string;
  content: string;
  category: string;
  shortcut: string;
}

export function SavedReplies({ onSelectReply }: SavedRepliesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    title: "",
    content: "",
    category: "general",
    shortcut: "",
  });

  const { data: templates = [], isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const categories = ["general", "demo", "pricing", "follow-up", "qualification", "objection"];

  const filteredTemplates = templates.filter(
    (template) =>
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.shortcut?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTemplatesByCategory = (category: string) => {
    if (category === "all") return filteredTemplates;
    return filteredTemplates.filter((template) => template.category === category);
  };

  const handleSelectReply = (content: string) => {
    onSelectReply(content);
    setOpen(false);
    setSearchQuery("");
  };

  const handleAddNew = () => {
    setEditingTemplate(null);
    setFormData({
      title: "",
      content: "",
      category: "general",
      shortcut: "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      content: template.content,
      category: template.category,
      shortcut: template.shortcut || "",
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (template: any) => {
    setEditingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          updates: formData,
        });
      } else {
        await createTemplate.mutateAsync(formData);
      }
      setEditDialogOpen(false);
      setEditingTemplate(null);
      setFormData({
        title: "",
        content: "",
        category: "general",
        shortcut: "",
      });
    } catch (error) {
      // Error is handled by the hook's onError
    }
  };

  const handleConfirmDelete = async () => {
    if (editingTemplate) {
      try {
        await deleteTemplate.mutateAsync(editingTemplate.id);
        setDeleteDialogOpen(false);
        setEditingTemplate(null);
      } catch (error) {
        // Error is handled by the hook's onError
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <DialogTitle>Saved Replies & Templates</DialogTitle>
              <Button
                onClick={handleAddNew}
                size="sm"
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Template
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates or type / for shortcuts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
            ) : (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-7">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {categories.map((cat) => (
                    <TabsTrigger key={cat} value={cat} className="capitalize">
                      {cat.replace('-', ' ')}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {["all", ...categories].map((category) => (
                  <TabsContent key={category} value={category} className="space-y-2 mt-4">
                    {getTemplatesByCategory(category).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No templates found
                      </div>
                    ) : (
                      getTemplatesByCategory(category).map((template) => (
                        <Card
                          key={template.id}
                          className="p-3 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium flex-1">{template.title}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {template.category.replace('-', ' ')}
                              </Badge>
                              {template.shortcut && (
                                <Badge variant="secondary">{template.shortcut}</Badge>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(template);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(template);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <p 
                            className="text-sm text-muted-foreground cursor-pointer"
                            onClick={() => handleSelectReply(template.content)}
                          >
                            {template.content}
                          </p>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Add New Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Demo Request Response"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                placeholder="Enter your template content..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[150px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortcut">Shortcut (optional)</Label>
                <Input
                  id="shortcut"
                  placeholder="e.g., /demo"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingTemplate(null);
                  setFormData({
                    title: "",
                    content: "",
                    category: "general",
                    shortcut: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!formData.title.trim() || !formData.content.trim() || createTemplate.isPending || updateTemplate.isPending}
              >
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{editingTemplate?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
