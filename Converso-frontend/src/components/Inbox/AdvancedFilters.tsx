import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Filter, X, Calendar } from "lucide-react";
import { useState } from "react";

interface FilterState {
  search: string;
  status: string;
  sdr: string;
  channel: string;
  tag: string;
  sla: string;
  dateRange: string;
}

export function AdvancedFilters() {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    sdr: "all-sdr",
    channel: "all",
    tag: "all",
    sla: "all",
    dateRange: "all",
  });

  const activeFilterCount = Object.values(filters).filter(
    (v) => v && v !== "all" && v !== "all-sdr" && v !== ""
  ).length;

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      sdr: "all-sdr",
      channel: "all",
      tag: "all",
      sla: "all",
      dateRange: "all",
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in messages, names, emails..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="engaged">Engaged</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sdr} onValueChange={(v) => setFilters({ ...filters, sdr: v })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="SDR" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-sdr">All SDRs</SelectItem>
            <SelectItem value="john">John SDR</SelectItem>
            <SelectItem value="jane">Jane SDR</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              More Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary">{activeFilterCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Channel</label>
                <Select value={filters.channel} onValueChange={(v) => setFilters({ ...filters, channel: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tag</label>
                <Select value={filters.tag} onValueChange={(v) => setFilters({ ...filters, tag: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    <SelectItem value="high-priority">High Priority</SelectItem>
                    <SelectItem value="warm-lead">Warm Lead</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">SLA Status</label>
                <Select value={filters.sla} onValueChange={(v) => setFilters({ ...filters, sla: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="on-time">On Time</SelectItem>
                    <SelectItem value="near-deadline">Near Deadline</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(v) => setFilters({ ...filters, dateRange: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex gap-2 flex-wrap">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, search: "" })} />
            </Badge>
          )}
          {filters.status !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, status: "all" })} />
            </Badge>
          )}
          {filters.sdr !== "all-sdr" && (
            <Badge variant="secondary" className="gap-1">
              SDR: {filters.sdr}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters({ ...filters, sdr: "all-sdr" })} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
