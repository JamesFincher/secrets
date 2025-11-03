'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuditLogFilters } from './AuditLogFilters';
import {
  fetchAuditLogs,
  exportAuditLogsToCSV,
  exportAuditLogsToJSON,
  subscribeToAuditLogs,
  type AuditLog,
  type AuditLogFilters as Filters,
} from '@/lib/api/audit';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface AuditLogViewerProps {
  organizationId: string;
}

export function AuditLogViewer({ organizationId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Fetch logs
  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchAuditLogs(organizationId, filters, { page, pageSize });
      setLogs(result.logs);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load audit logs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, filters, page, pageSize, toast]);

  // Load logs on mount and when dependencies change
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = subscribeToAuditLogs(organizationId, (newLog) => {
      // Only add if on first page and no filters
      if (page === 1 && Object.keys(filters).length === 0) {
        setLogs((prev) => [newLog, ...prev.slice(0, pageSize - 1)]);
        setTotal((prev) => prev + 1);
      }

      // Show toast notification
      toast({
        title: 'New Activity',
        description: `${newLog.action} by ${newLog.user_email}`,
      });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [organizationId, page, filters, pageSize, toast]);

  // Export handlers
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setIsExporting(true);

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'csv') {
        content = await exportAuditLogsToCSV(organizationId, filters);
        filename = `audit-logs-${Date.now()}.csv`;
        mimeType = 'text/csv';
      } else {
        content = await exportAuditLogsToJSON(organizationId, filters);
        filename = `audit-logs-${Date.now()}.json`;
        mimeType = 'application/json';
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Exported ${format.toUpperCase()} file successfully.`,
      });
    } catch (error) {
      console.error('Failed to export logs:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export audit logs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Filter change handler
  const handleFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  // Format action type for display
  const formatAction = (action: string) => {
    const [resource, operation] = action.split('.');
    return {
      resource: resource.charAt(0).toUpperCase() + resource.slice(1),
      operation: operation.charAt(0).toUpperCase() + operation.slice(1),
    };
  };

  // Get badge color based on action
  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' => {
    if (action.includes('delete')) return 'destructive';
    if (action.includes('create')) return 'default';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Complete activity history for your organization ({total} total events)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadLogs} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Select
                value="export"
                onValueChange={(value) => {
                  if (value === 'csv' || value === 'json') {
                    handleExport(value);
                  }
                }}
              >
                <SelectTrigger className="w-32">
                  <Download className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Export" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">Export CSV</SelectItem>
                  <SelectItem value="json">Export JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <AuditLogFilters
            organizationId={organizationId}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource Type</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading audit logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No audit logs found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const { resource, operation } = formatAction(log.action);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell className="text-sm">{log.user_email}</TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {resource} {operation}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{log.resource_type}</TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[150px]">
                          {log.resource_id}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.ip_address || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <details className="cursor-pointer">
                            <summary className="text-xs text-muted-foreground hover:text-foreground">
                              View
                            </summary>
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-w-md">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {logs.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, total)} of {total} results
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="px-4 text-sm">
                  Page {page} of {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={page >= totalPages || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
