'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TeamPage() {
  // Placeholder data - will be replaced with real data
  const teamMembers = [
    {
      id: '1',
      email: 'owner@example.com',
      role: 'Owner',
      joinedAt: '2024-01-01',
      lastActive: '2024-11-02',
    },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Team</h1>
          <p className="text-muted-foreground">
            Manage team members and their permissions
          </p>
        </div>

        {/* Invite Section */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Invite Team Members</h2>
          <div className="flex gap-4">
            <input
              type="email"
              placeholder="colleague@example.com"
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <select className="px-4 py-2 border rounded-lg">
              <option>Developer</option>
              <option>Admin</option>
              <option>Read-Only</option>
            </select>
            <Button>Send Invite</Button>
          </div>
        </Card>

        {/* Team Members */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Team Members ({teamMembers.length})</h2>
        </div>

        <Card>
          <div className="divide-y">
            {teamMembers.map((member) => (
              <div key={member.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-medium">
                      {member.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{member.email}</div>
                    <div className="text-sm text-muted-foreground">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge variant={member.role === 'Owner' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                  {member.role !== 'Owner' && (
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Roles Info */}
        <Card className="p-6 mt-8">
          <h3 className="text-lg font-semibold mb-4">Role Permissions</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge>Owner</Badge>
              <p className="text-sm text-muted-foreground">
                Full access to all features, can manage billing and delete workspace
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">Admin</Badge>
              <p className="text-sm text-muted-foreground">
                Can invite members, manage projects, and view audit logs
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">Developer</Badge>
              <p className="text-sm text-muted-foreground">
                Can create and manage secrets in assigned projects
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">Read-Only</Badge>
              <p className="text-sm text-muted-foreground">
                Can view secrets but cannot create or modify them
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
