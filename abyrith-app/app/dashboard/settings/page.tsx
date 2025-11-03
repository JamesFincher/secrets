'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/hooks/use-auth';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'workspace'>('account');

  const tabs = [
    { id: 'account' as const, name: 'Account', icon: '👤' },
    { id: 'security' as const, name: 'Security', icon: '🔒' },
    { id: 'workspace' as const, name: 'Workspace', icon: '🏢' },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and workspace preferences
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email cannot be changed after account creation
                  </p>
                </div>
                <div>
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    className="mt-1"
                  />
                </div>
                <Button>Save Changes</Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Preferences</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Theme</div>
                    <div className="text-sm text-muted-foreground">Choose your interface theme</div>
                  </div>
                  <select className="px-3 py-2 border rounded-lg">
                    <option>System</option>
                    <option>Light</option>
                    <option>Dark</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-sm text-muted-foreground">Receive activity updates</div>
                  </div>
                  <input type="checkbox" className="w-4 h-4" defaultChecked />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Master Password</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Your master password encrypts all your secrets locally. We never see it.
              </p>
              <Button variant="outline">Change Master Password</Button>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Two-Factor Authentication</h2>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium">2FA Status</div>
                  <div className="text-sm text-muted-foreground">Add an extra layer of security</div>
                </div>
                <span className="px-3 py-1 text-sm bg-yellow-500/10 text-yellow-500 rounded-full">
                  Not Enabled
                </span>
              </div>
              <Button>Enable 2FA</Button>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Active Sessions</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                      💻
                    </div>
                    <div>
                      <div className="font-medium">Current Session</div>
                      <div className="text-sm text-muted-foreground">
                        MacOS • Chrome • Just now
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-green-500">Active</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Workspace Tab */}
        {activeTab === 'workspace' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Workspace Settings</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    placeholder="My Workspace"
                    className="mt-1"
                  />
                </div>
                <Button>Update Workspace</Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Billing</h2>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium">Current Plan</div>
                  <div className="text-sm text-muted-foreground">Free Trial</div>
                </div>
                <Button variant="outline">Upgrade</Button>
              </div>
            </Card>

            <Card className="p-6 border-destructive">
              <h2 className="text-xl font-semibold text-destructive mb-4">Danger Zone</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Delete Workspace</div>
                    <div className="text-sm text-muted-foreground">
                      Permanently delete this workspace and all secrets
                    </div>
                  </div>
                  <Button variant="destructive">Delete</Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
