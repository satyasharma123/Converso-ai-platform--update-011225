import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Zap, Edit, Search, X } from "lucide-react";
import { useRoutingRules, useCreateRoutingRule, useUpdateRoutingRule, useDeleteRoutingRule } from "@/hooks/useRoutingRules";
import { type RoutingRule } from "@/lib/backend-api";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function RulesEngine() {
  const { data: rules = [], isLoading } = useRoutingRules();
  const createRule = useCreateRoutingRule();
  const updateRule = useUpdateRoutingRule();
  const deleteRule = useDeleteRoutingRule();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<RoutingRule | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [ruleName, setRuleName] = useState("");
  const [conditionField, setConditionField] = useState("subject");
  const [conditionOperator, setConditionOperator] = useState("contains");
  const [conditionValue, setConditionValue] = useState("");
  const [actionType, setActionType] = useState("assign");
  const [actionValue, setActionValue] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Filter rules based on search query
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    
    const query = searchQuery.toLowerCase();
    return rules.filter(rule => 
      rule.name.toLowerCase().includes(query) ||
      rule.condition_field.toLowerCase().includes(query) ||
      rule.condition_value.toLowerCase().includes(query) ||
      rule.action_type.toLowerCase().includes(query) ||
      rule.action_value.toLowerCase().includes(query)
    );
  }, [rules, searchQuery]);

  const resetForm = () => {
    setRuleName("");
    setConditionField("subject");
    setConditionOperator("contains");
    setConditionValue("");
    setActionType("assign");
    setActionValue("");
    setIsActive(true);
  };

  const handleAddRule = async () => {
    if (!ruleName.trim() || !conditionValue.trim() || !actionValue.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    await createRule.mutateAsync({
      name: ruleName,
      condition_field: conditionField,
      condition_operator: conditionOperator,
      condition_value: conditionValue,
      action_type: actionType,
      action_value: actionValue,
      is_active: isActive,
    });

    resetForm();
    setIsAddModalOpen(false);
  };

  const handleUpdateRule = async () => {
    if (!editingRule || !ruleName.trim() || !conditionValue.trim() || !actionValue.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    await updateRule.mutateAsync({
      id: editingRule.id,
      updates: {
        name: ruleName,
        condition_field: conditionField,
        condition_operator: conditionOperator,
        condition_value: conditionValue,
        action_type: actionType,
        action_value: actionValue,
        is_active: isActive,
      },
    });

    setEditingRule(null);
    resetForm();
  };

  const handleDeleteClick = (rule: RoutingRule) => {
    setDeletingRule(rule);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;
    await deleteRule.mutateAsync(deletingRule.id);
    setDeletingRule(null);
    setIsDeleteDialogOpen(false);
  };

  const openEditModal = (rule: RoutingRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setConditionField(rule.condition_field);
    setConditionOperator(rule.condition_operator);
    setConditionValue(rule.condition_value);
    setActionType(rule.action_type);
    setActionValue(rule.action_value);
    setIsActive(rule.is_active);
  };

  const closeEditModal = () => {
    setEditingRule(null);
    resetForm();
  };

  const closeAddModal = () => {
    resetForm();
    setIsAddModalOpen(false);
  };

  const getConditionFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      subject: "Subject",
      content: "Message Content",
      sender: "Sender",
      channel: "Channel",
    };
    return labels[field] || field;
  };

  const getActionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      assign: "Assign to SDR",
      tag: "Add Tag",
      status: "Set Status",
      priority: "Set Priority",
    };
    return labels[type] || type;
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      contains: "Contains",
      equals: "Equals",
      starts_with: "Starts With",
      ends_with: "Ends With",
    };
    return labels[operator] || operator;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">Loading rules...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Routing Rules</h2>
            <Badge variant="secondary" className="ml-2">
              {filteredRules.length} {filteredRules.length === 1 ? 'rule' : 'rules'}
            </Badge>
          </div>
        </div>

        {/* Search Bar and Add Button Row */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rules by name, field, value, or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Routing Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rule Name *</label>
                  <Input
                    placeholder="e.g., Auto-assign Demo Requests"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IF Field *</label>
                    <Select value={conditionField} onValueChange={setConditionField}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subject">Subject</SelectItem>
                        <SelectItem value="content">Message Content</SelectItem>
                        <SelectItem value="sender">Sender</SelectItem>
                        <SelectItem value="channel">Channel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Condition *</label>
                    <Select value={conditionOperator} onValueChange={setConditionOperator}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="starts_with">Starts With</SelectItem>
                        <SelectItem value="ends_with">Ends With</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Value *</label>
                    <Input
                      placeholder="e.g., demo"
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">THEN Action *</label>
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assign">Assign to SDR</SelectItem>
                        <SelectItem value="tag">Add Tag</SelectItem>
                        <SelectItem value="status">Set Status</SelectItem>
                        <SelectItem value="priority">Set Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Action Value *</label>
                    <Input
                      placeholder="e.g., Demo SDR"
                      value={actionValue}
                      onChange={(e) => setActionValue(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="is-active" className="text-sm font-medium">
                    Rule is active
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeAddModal}>Cancel</Button>
                <Button onClick={handleAddRule} disabled={createRule.isPending}>
                  {createRule.isPending ? "Creating..." : "Create Rule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {filteredRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? (
              <>
                <p>No rules match your search.</p>
                <Button
                  variant="link"
                  onClick={() => setSearchQuery("")}
                  className="mt-2"
                >
                  Clear search
                </Button>
              </>
            ) : (
              "No routing rules yet. Create your first rule to get started."
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredRules.map((rule) => (
              <Card key={rule.id} className="p-3 hover:shadow-md transition-shadow">
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight flex-1">{rule.name}</h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge 
                        variant={rule.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEditModal(rule)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(rule)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Condition */}
                  <div className="pt-1 border-t">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">IF</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {getConditionFieldLabel(rule.condition_field)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getOperatorLabel(rule.condition_operator)}
                      </span>
                      <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded whitespace-nowrap">
                        "{rule.condition_value}"
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-1 border-t">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">THEN</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {getActionTypeLabel(rule.action_type)}
                      </Badge>
                      <span className="text-sm font-semibold text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 px-2 py-1 rounded whitespace-nowrap">
                        "{rule.action_value}"
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {editingRule && (
        <Dialog open={!!editingRule} onOpenChange={(open) => !open && closeEditModal()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Routing Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rule Name *</label>
                <Input
                  placeholder="e.g., Auto-assign Demo Requests"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">IF Field *</label>
                  <Select value={conditionField} onValueChange={setConditionField}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subject">Subject</SelectItem>
                      <SelectItem value="content">Message Content</SelectItem>
                      <SelectItem value="sender">Sender</SelectItem>
                      <SelectItem value="channel">Channel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Condition *</label>
                  <Select value={conditionOperator} onValueChange={setConditionOperator}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="starts_with">Starts With</SelectItem>
                      <SelectItem value="ends_with">Ends With</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Value *</label>
                  <Input
                    placeholder="e.g., demo"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">THEN Action *</label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assign">Assign to SDR</SelectItem>
                      <SelectItem value="tag">Add Tag</SelectItem>
                      <SelectItem value="status">Set Status</SelectItem>
                      <SelectItem value="priority">Set Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Action Value *</label>
                  <Input
                    placeholder="e.g., Demo SDR"
                    value={actionValue}
                    onChange={(e) => setActionValue(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="edit-is-active" className="text-sm font-medium">
                  Rule is active
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeEditModal}>Cancel</Button>
              <Button onClick={handleUpdateRule} disabled={updateRule.isPending}>
                {updateRule.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Routing Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRule?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
