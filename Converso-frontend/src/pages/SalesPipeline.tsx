import { AppLayout } from "@/components/Layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { KanbanBoard } from "@/components/Pipeline/KanbanBoard";
import { PipelineFilters } from "@/components/Pipeline/PipelineFilters";
import { useState, useEffect } from "react";

const STORAGE_KEY = 'sales-pipeline-filters';

export default function SalesPipeline() {
  const { user, userRole } = useAuth();
  const { data: userProfile } = useProfile();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: pipelineStages = [] } = usePipelineStages();
  
  // Load filters from localStorage on mount
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        return {
          ...parsed,
          dateFrom: parsed.dateFrom ? new Date(parsed.dateFrom) : undefined,
          dateTo: parsed.dateTo ? new Date(parsed.dateTo) : undefined,
        };
      }
    } catch (error) {
      console.error('Error loading filters from localStorage:', error);
    }
    return {
      assignedTo: "all",
      channelType: "all",
      search: "",
      selectedStages: [] as string[],
      dateFrom: undefined as Date | undefined,
      dateTo: undefined as Date | undefined,
    };
  });

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving filters to localStorage:', error);
    }
  }, [filters]);

  // Initialize selectedStages with all stages once they're loaded
  useEffect(() => {
    if (pipelineStages.length > 0 && filters.selectedStages.length === 0) {
      setFilters(prev => ({
        ...prev,
        selectedStages: pipelineStages.map(s => s.id)
      }));
    }
  }, [pipelineStages]);

  const currentUserMember = teamMembers.find(m => m.id === user?.id);
  const userDisplayName = userProfile?.full_name || currentUserMember?.full_name || user?.email || "User";

  return (
    <AppLayout role={userRole} userName={userDisplayName}>
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-x-hidden overflow-y-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Sales Pipeline</h1>
              <p className="text-xs text-muted-foreground">Manage your leads through the sales process</p>
            </div>
          </div>
          
          <PipelineFilters filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Scrollable Kanban Area */}
        <div className="flex-1 overflow-x-hidden overflow-y-hidden pt-6">
          <KanbanBoard filters={filters} />
        </div>
      </div>
    </AppLayout>
  );
}
