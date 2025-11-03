import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Audit Logs | Abyrith',
  description: 'View complete activity history for your organization',
};

export default async function AuditLogsPage() {
  const supabase = createServerComponentClient({ cookies });

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/login');
  }

  // Get user's organization
  // For MVP, assume user has one organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', session.user.id)
    .single();

  if (!membership) {
    redirect('/dashboard/onboarding');
  }

  // Check if user has permission to view audit logs
  // Only owners and admins can view audit logs
  const canViewAuditLogs = membership.role === 'owner' || membership.role === 'admin';

  if (!canViewAuditLogs) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have permission to view audit logs. Contact your organization owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <AuditLogViewer organizationId={membership.organization_id} />
    </div>
  );
}
