/**
 * Audit Logs API
 * Functions for fetching, filtering, and exporting audit logs
 */

import { supabase } from '@/lib/api/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Joined fields
  user_email?: string;
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resourceType?: string;
  searchQuery?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetch audit logs with filters and pagination
 */
export async function fetchAuditLogs(
  organizationId: string,
  filters: AuditLogFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 50 }
): Promise<AuditLogsResponse> {
  const { page, pageSize} = pagination;
  const offset = (page - 1) * pageSize;

  // Build query
  let query = supabase
    .from('audit_logs')
    .select('*, user:auth.users!user_id(email)', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  // Apply filters
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate.toISOString());
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate.toISOString());
  }

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.action) {
    query = query.eq('action', filters.action);
  }

  if (filters.resourceType) {
    query = query.eq('resource_type', filters.resourceType);
  }

  if (filters.searchQuery) {
    // Search in resource_id or metadata
    query = query.or(`resource_id.ilike.%${filters.searchQuery}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  // Transform data to include user email
  const logs: AuditLog[] = (data || []).map((log: any) => ({
    ...log,
    user_email: log.user?.email || 'Unknown',
  }));

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Get unique action types for filtering
 */
export async function getActionTypes(organizationId: string): Promise<string[]> {
const { data, error } = await supabase
    .from('audit_logs')
    .select('action')
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`Failed to fetch action types: ${error.message}`);
  }

  // Get unique actions
  const actions = [...new Set((data as any[])?.map((log: any) => log.action) || [])];
  return actions.sort();
}

/**
 * Get unique resource types for filtering
 */
export async function getResourceTypes(organizationId: string): Promise<string[]> {
const { data, error } = await supabase
    .from('audit_logs')
    .select('resource_type')
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`Failed to fetch resource types: ${error.message}`);
  }

  // Get unique resource types
  const types = [...new Set((data as any[])?.map((log: any) => log.resource_type) || [])];
  return types.sort();
}

/**
 * Get organization members for user filter
 */
export async function getOrganizationMembers(organizationId: string): Promise<Array<{ id: string; email: string }>> {
const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, user:auth.users!user_id(email)')
    .eq('organization_id', organizationId);

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  return (data || []).map((member: any) => ({
    id: member.user_id,
    email: member.user?.email || 'Unknown',
  }));
}

/**
 * Export audit logs to CSV
 */
export async function exportAuditLogsToCSV(
  organizationId: string,
  filters: AuditLogFilters = {}
): Promise<string> {
  // Fetch all matching logs (no pagination)
let query = supabase
    .from('audit_logs')
    .select('*, user:auth.users!user_id(email)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate.toISOString());
  }
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.resourceType) {
    query = query.eq('resource_type', filters.resourceType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to export audit logs: ${error.message}`);
  }

  // Convert to CSV
  const logs = data || [];
  if (logs.length === 0) {
    return 'No audit logs found';
  }

  // CSV headers
  const headers = ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'Details'];
  const csvRows = [headers.join(',')];

  // CSV rows
  logs.forEach((log: any) => {
    const row = [
      log.created_at,
      log.user?.email || 'Unknown',
      log.action,
      log.resource_type,
      log.resource_id,
      log.ip_address || 'N/A',
      JSON.stringify(log.metadata).replace(/"/g, '""'), // Escape quotes
    ];
    csvRows.push(row.map((field) => `"${field}"`).join(','));
  });

  return csvRows.join('\n');
}

/**
 * Export audit logs to JSON
 */
export async function exportAuditLogsToJSON(
  organizationId: string,
  filters: AuditLogFilters = {}
): Promise<string> {
  // Fetch all matching logs
let query = supabase
    .from('audit_logs')
    .select('*, user:auth.users!user_id(email)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate.toISOString());
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate.toISOString());
  }
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.resourceType) {
    query = query.eq('resource_type', filters.resourceType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to export audit logs: ${error.message}`);
  }

  // Transform data
  const logs = (data || []).map((log: any) => ({
    id: log.id,
    timestamp: log.created_at,
    user: log.user?.email || 'Unknown',
    userId: log.user_id,
    action: log.action,
    resourceType: log.resource_type,
    resourceId: log.resource_id,
    ipAddress: log.ip_address,
    userAgent: log.user_agent,
    metadata: log.metadata,
  }));

  return JSON.stringify(logs, null, 2);
}

/**
 * Subscribe to real-time audit log updates
 */
export function subscribeToAuditLogs(
  organizationId: string,
  onNewLog: (log: AuditLog) => void
): RealtimeChannel {
const channel = supabase
    .channel(`audit_logs:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'audit_logs',
        filter: `organization_id=eq.${organizationId}`,
      },
      async (payload) => {
        // Fetch user email for the new log
        const { data: userData } = await supabase
          .from('auth.users')
          .select('email')
          .eq('id', payload.new.user_id)
          .single();

        const log: AuditLog = {
          ...payload.new as any,
          user_email: (userData as any)?.email || 'Unknown',
        };

        onNewLog(log);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Log secret access (call when decrypting a secret)
 */
export async function logSecretAccess(secretId: string): Promise<void> {
const { error } = await (supabase.rpc as any)('log_secret_access', {
    secret_id: secretId,
  });

  if (error) {
    console.error('Failed to log secret access:', error);
    // Don't throw - logging failure shouldn't block secret access
  }
}
