'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getRepositorySyncLogs, type SyncLog, type LinkedRepository } from '@/lib/api/github';
import { CheckCircle2, XCircle, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface SyncHistoryLogProps {
  linkedRepository: LinkedRepository;
}

/**
 * SyncHistoryLog Component
 *
 * Displays sync history for a linked GitHub repository.
 */
export function SyncHistoryLog({ linkedRepository }: SyncHistoryLogProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { toast } = useToast();
  const perPage = 10;

  useEffect(() => {
    loadLogs();
  }, [linkedRepository.id, currentPage]);

  const loadLogs = async () => {
    setIsLoading(true);

    try {
      const { logs: syncLogs, total_count } = await getRepositorySyncLogs(
        linkedRepository.id,
        currentPage,
        perPage
      );
      setLogs(syncLogs);
      setTotalCount(total_count);
    } catch (error) {
      console.error('Failed to load sync logs:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load history',
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: SyncLog['sync_status']) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Success
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="default" className="gap-1 bg-yellow-600">
            <AlertTriangle className="h-3 w-3" />
            Partial
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync History</CardTitle>
        <CardDescription>
          Past imports from {linkedRepository.repo_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No sync history yet</p>
            <p className="text-sm text-muted-foreground">
              Import secrets to see history here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Skipped</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <>
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {format(new Date(log.started_at), 'MMM d, yyyy')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.started_at), 'h:mm a')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(log.sync_status)}</TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            {log.secrets_imported}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">{log.secrets_skipped}</span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              log.secrets_failed > 0
                                ? 'font-medium text-red-600'
                                : 'text-muted-foreground'
                            }
                          >
                            {log.secrets_failed}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedLogId((prev) => (prev === log.id ? null : log.id))
                            }
                          >
                            {expandedLogId === log.id ? 'Hide' : 'Details'}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Details */}
                      {expandedLogId === log.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="space-y-3 py-4">
                              {log.imported_files.length > 0 && (
                                <div>
                                  <p className="text-sm font-semibold mb-2">Files Imported:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {log.imported_files.map((file, index) => (
                                      <Badge key={index} variant="secondary">
                                        {file}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {log.error_message && (
                                <div className="rounded-lg bg-destructive/10 p-3">
                                  <p className="text-sm font-semibold text-destructive mb-1">
                                    Error:
                                  </p>
                                  <p className="text-sm">{log.error_message}</p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalCount > perPage && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * perPage + 1} to{' '}
                  {Math.min(currentPage * perPage, totalCount)} of {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage * perPage >= totalCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
