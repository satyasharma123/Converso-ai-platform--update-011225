import { AppLayout } from "@/components/Layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { KanbanBoard } from "@/components/Pipeline/KanbanBoard";
import { PipelineFilters } from "@/components/Pipeline/PipelineFilters";
import { useState } from "react";

export default function SalesPipeline() {
  const { user, userRole } = useAuth();
  const [filters, setFilters] = useState({
    assignedTo: "all",
    channelType: "all",
    search: "",
  });

  return (
    <AppLayout role={userRole} userName={user?.email}>
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
