'use client';

import { useState, useEffect } from 'react';
import { Calendar, Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { AuditLogFilters as Filters } from '@/lib/api/audit';
import { getActionTypes, getResourceTypes, getOrganizationMembers } from '@/lib/api/audit';

interface AuditLogFiltersProps {
  organizationId: string;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function AuditLogFilters({ organizationId, filters, onFiltersChange }: AuditLogFiltersProps) {
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; email: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch filter options
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [actions, resources, orgMembers] = await Promise.all([
          getActionTypes(organizationId),
          getResourceTypes(organizationId),
          getOrganizationMembers(organizationId),
        ]);
        setActionTypes(actions);
        setResourceTypes(resources);
        setMembers(orgMembers);
      } catch (error) {
        console.error('Failed to load filter options:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadFilterOptions();
  }, [organizationId]);

  const updateFilter = (key: keyof Filters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof Filters] !== undefined
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-medium">Filters</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Date Range - Start Date */}
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="start-date"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {filters.startDate ? format(filters.startDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.startDate}
                onSelect={(date) => updateFilter('startDate', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date Range - End Date */}
        <div className="space-y-2">
          <Label htmlFor="end-date">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="end-date"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {filters.endDate ? format(filters.endDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.endDate}
                onSelect={(date) => updateFilter('endDate', date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* User Filter */}
        <div className="space-y-2">
          <Label htmlFor="user">User</Label>
          <Select
            value={filters.userId || 'all'}
            onValueChange={(value) => updateFilter('userId', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="user">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="action">Action</Label>
          <Select
            value={filters.action || 'all'}
            onValueChange={(value) => updateFilter('action', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="action">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionTypes.map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resource Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="resource">Resource Type</Label>
          <Select
            value={filters.resourceType || 'all'}
            onValueChange={(value) =>
              updateFilter('resourceType', value === 'all' ? undefined : value)
            }
          >
            <SelectTrigger id="resource">
              <SelectValue placeholder="All resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              {resourceTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search Resource ID</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search..."
              className="pl-9"
              value={filters.searchQuery || ''}
              onChange={(e) => updateFilter('searchQuery', e.target.value || undefined)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
