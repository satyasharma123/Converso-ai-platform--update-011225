import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, ChevronDown } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { usePipelineStages } from "@/hooks/usePipelineStages";

interface PipelineFiltersProps {
  filters: {
    assignedTo: string;
    channelType: string;
    search: string;
    selectedStages: string[];
  };
  onFiltersChange: (filters: any) => void;
}

export function PipelineFilters({ filters, onFiltersChange }: PipelineFiltersProps) {
  const { data: teamMembers } = useTeamMembers();
  const { data: pipelineStages = [] } = usePipelineStages();
  const { userRole } = useAuth();

  const toggleStage = (stageId: string) => {
    const newSelectedStages = filters.selectedStages.includes(stageId)
      ? filters.selectedStages.filter(id => id !== stageId)
      : [...filters.selectedStages, stageId];
    
    onFiltersChange({ ...filters, selectedStages: newSelectedStages });
  };

  const selectAllStages = () => {
    onFiltersChange({ ...filters, selectedStages: pipelineStages.map(s => s.id) });
  };

  const clearAllStages = () => {
    onFiltersChange({ ...filters, selectedStages: [] });
  };

  const getStageFilterLabel = () => {
    if (filters.selectedStages.length === 0 || filters.selectedStages.length === pipelineStages.length) {
      return "All Stages";
    }
    if (filters.selectedStages.length === 1) {
      const stage = pipelineStages.find(s => s.id === filters.selectedStages[0]);
      return stage?.name || "1 Stage";
    }
    return `${filters.selectedStages.length} Stages`;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        
        <Select
          value={filters.channelType}
          onValueChange={(value) => onFiltersChange({ ...filters, channelType: value })}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>

        {userRole === 'admin' && (
          <Select
            value={filters.assignedTo}
            onValueChange={(value) => onFiltersChange({ ...filters, assignedTo: value })}
          >
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Assigned to" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SDRs</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {teamMembers?.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Stage Multi-Select Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 text-xs w-[140px] justify-between">
              {getStageFilterLabel()}
              <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-3" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-xs font-medium">Filter by Stages</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllStages}
                    className="h-6 px-2 text-xs"
                  >
                    All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllStages}
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {pipelineStages.map((stage) => (
                  <div key={stage.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`stage-${stage.id}`}
                      checked={filters.selectedStages.includes(stage.id)}
                      onCheckedChange={() => toggleStage(stage.id)}
                    />
                    <label
                      htmlFor={`stage-${stage.id}`}
                      className="text-xs font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {stage.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
