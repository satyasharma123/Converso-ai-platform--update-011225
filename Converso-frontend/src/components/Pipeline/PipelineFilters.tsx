import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";

interface PipelineFiltersProps {
  filters: {
    assignedTo: string;
    channelType: string;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function PipelineFilters({ filters, onFiltersChange }: PipelineFiltersProps) {
  const { data: teamMembers } = useTeamMembers();
  const { userRole } = useAuth();

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
      </div>
    </div>
  );
}
