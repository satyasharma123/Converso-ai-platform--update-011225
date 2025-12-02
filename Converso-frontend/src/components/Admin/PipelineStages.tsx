import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Info, Edit, Trash2, Plus, Loader2 } from "lucide-react";
import { 
  usePipelineStages, 
  useCreatePipelineStage, 
  useUpdatePipelineStage, 
  useDeletePipelineStage 
} from "@/hooks/usePipelineStages";
import type { PipelineStage } from "@backend/src/types";

export function PipelineStages() {
  // Component for managing pipeline stages via backend API
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [editingStage, setEditingStage] = React.useState<PipelineStage | null>(null);
  const [deletingStage, setDeletingStage] = React.useState<PipelineStage | null>(null);
  const [stageName, setStageName] = React.useState("");
  const [stageDescription, setStageDescription] = React.useState("");

  // Use React Query hooks
  const { data: customStages = [], isLoading } = usePipelineStages();
  const createMutation = useCreatePipelineStage();
  const updateMutation = useUpdatePipelineStage();
  const deleteMutation = useDeletePipelineStage();

  const handleAddStage = async () => {
    if (!stageName.trim()) {
      return;
    }

    // Get the highest display_order and add 1
    const maxOrder = customStages.length > 0 
      ? Math.max(...customStages.map(s => s.display_order || 0))
      : 0;

    await createMutation.mutateAsync({
      name: stageName,
      description: stageDescription || null,
      display_order: maxOrder + 1
    });

    setStageName("");
    setStageDescription("");
    setIsAddModalOpen(false);
  };

  const handleEditStage = async () => {
    if (!editingStage || !stageName.trim()) {
      return;
    }

    await updateMutation.mutateAsync({
      id: editingStage.id,
      updates: {
        name: stageName,
        description: stageDescription || null
      }
    });

    setEditingStage(null);
    setStageName("");
    setStageDescription("");
    setIsEditModalOpen(false);
  };

  const handleDeleteClick = async (stage: PipelineStage) => {
    setDeletingStage(stage);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStage = async () => {
    if (!deletingStage) return;

    // Backend will handle lead reassignment automatically
    await deleteMutation.mutateAsync(deletingStage.id);

    setDeletingStage(null);
    setIsDeleteDialogOpen(false);
  };

  const openEditModal = (stage: PipelineStage) => {
    setEditingStage(stage);
    setStageName(stage.name);
    setStageDescription(stage.description || "");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingStage(null);
    setStageName("");
    setStageDescription("");
    setIsEditModalOpen(false);
  };

  const closeAddModal = () => {
    setStageName("");
    setStageDescription("");
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pipeline Stages</CardTitle>
              <CardDescription>
                Define and customize the stages for your sales pipeline
              </CardDescription>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Add Stage
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Stage</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="stage-name">Stage Name *</Label>
                    <Input
                      id="stage-name"
                      placeholder="Enter stage name"
                      value={stageName}
                      onChange={(e) => setStageName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stage-description">Description</Label>
                    <Textarea
                      id="stage-description"
                      placeholder="Enter stage description (optional)"
                      value={stageDescription}
                      onChange={(e) => setStageDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeAddModal} disabled={createMutation.isPending}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddStage} disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* All Stages (Editable) */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading stages...</p>
              </div>
            ) : customStages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No stages found. Click "Add Stage" to create one.</p>
                <p className="text-xs mt-2">Note: Default stages should be automatically created. Please run the migration script.</p>
              </div>
            ) : (
              customStages.map((stage, index) => (
                <div
                  key={stage.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-background"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-xs font-mono">
                      {index + 1}
                    </Badge>
                    <div>
                      <h4 className="font-medium">{stage.name}</h4>
                      {stage.description && (
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(stage)}
                      title="Edit stage"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(stage)}
                      title="Delete stage"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-stage-name">Stage Name *</Label>
              <Input
                id="edit-stage-name"
                placeholder="Enter stage name"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-stage-description">Description</Label>
              <Textarea
                id="edit-stage-description"
                placeholder="Enter stage description (optional)"
                value={stageDescription}
                onChange={(e) => setStageDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleEditStage} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stage? Any leads currently assigned to this stage will automatically move to the previous stage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStage} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
