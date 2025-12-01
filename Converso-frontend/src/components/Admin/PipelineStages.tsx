import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Info, Edit, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type CustomStage = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
};

export function PipelineStages() {
  const [customStages, setCustomStages] = React.useState<CustomStage[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [editingStage, setEditingStage] = React.useState<CustomStage | null>(null);
  const [deletingStage, setDeletingStage] = React.useState<CustomStage | null>(null);
  const [stageName, setStageName] = React.useState("");
  const [stageDescription, setStageDescription] = React.useState("");
  const [hasLeads, setHasLeads] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    fetchCustomStages();
  }, []);

  const fetchCustomStages = async () => {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      toast({ title: "Error fetching stages", description: error.message, variant: "destructive" });
      return;
    }
    
    setCustomStages(data || []);
  };

  const handleAddStage = async () => {
    if (!stageName.trim()) {
      toast({ title: "Stage name is required", variant: "destructive" });
      return;
    }

    // Get the highest display_order and add 1
    const maxOrder = customStages.length > 0 
      ? Math.max(...customStages.map(s => s.display_order))
      : 0;

    const { error } = await supabase
      .from('pipeline_stages')
      .insert({
        name: stageName,
        description: stageDescription || null,
        display_order: maxOrder + 1
      });

    if (error) {
      toast({ title: "Error adding stage", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Stage added successfully" });
    setStageName("");
    setStageDescription("");
    setIsAddModalOpen(false);
    fetchCustomStages();
  };

  const handleEditStage = async () => {
    if (!editingStage || !stageName.trim()) {
      toast({ title: "Stage name is required", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from('pipeline_stages')
      .update({
        name: stageName,
        description: stageDescription || null
      })
      .eq('id', editingStage.id);

    if (error) {
      toast({ title: "Error updating stage", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Stage updated successfully" });
    setEditingStage(null);
    setStageName("");
    setStageDescription("");
    setIsEditModalOpen(false);
    fetchCustomStages();
  };

  const checkStageHasLeads = async (stageId: string) => {
    const { count, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('custom_stage_id', stageId);

    if (error) {
      console.error("Error checking leads:", error);
      return false;
    }

    return (count || 0) > 0;
  };

  const handleDeleteClick = async (stage: CustomStage) => {
    setDeletingStage(stage);
    const hasLeadsInStage = await checkStageHasLeads(stage.id);
    setHasLeads(hasLeadsInStage);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteStage = async () => {
    if (!deletingStage) return;

    // If stage has leads, reassign them to the first available stage (or null)
    if (hasLeads) {
      // Find the first stage that's not being deleted
      const firstAvailableStage = customStages
        .filter(s => s.id !== deletingStage.id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[0];

      const { error: updateError } = await supabase
        .from('conversations')
        .update({ custom_stage_id: firstAvailableStage?.id || null })
        .eq('custom_stage_id', deletingStage.id);

      if (updateError) {
        toast({ title: "Error reassigning leads", description: updateError.message, variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', deletingStage.id);

    if (error) {
      toast({ title: "Error deleting stage", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Stage deleted successfully" });
    setDeletingStage(null);
    setIsDeleteDialogOpen(false);
    fetchCustomStages();
  };

  const openEditModal = (stage: CustomStage) => {
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
                Manage the stages leads move through in your sales pipeline. All stages are editable to match your business needs.
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
                  <Button variant="outline" onClick={closeAddModal}>Cancel</Button>
                  <Button onClick={handleAddStage}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* All Stages (Editable) */}
            {customStages.length === 0 ? (
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
                      {stage.display_order || index + 1}
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
            <Button variant="outline" onClick={closeEditModal}>Cancel</Button>
            <Button onClick={handleEditStage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasLeads
                ? 'Leads currently assigned to this stage will automatically move to another stage. Are you sure you want to continue?'
                : 'Are you sure you want to delete this stage? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStage}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
