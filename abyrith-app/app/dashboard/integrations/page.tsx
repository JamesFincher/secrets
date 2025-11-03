'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function IntegrationsPage() {
  const integrations = [
    {
      id: 'mcp',
      name: 'Model Context Protocol',
      description: 'Connect Abyrith to Claude Code, Cursor, and other AI tools',
      icon: '🤖',
      status: 'available',
      category: 'AI Tools',
      features: [
        'Access secrets from AI assistants',
        'Guided acquisition through chat',
        'Secure credential sharing',
      ],
    },
    {
      id: 'github',
      name: 'GitHub Actions',
      description: 'Use secrets in your CI/CD pipelines',
      icon: '🐙',
      status: 'coming-soon',
      category: 'CI/CD',
      features: [
        'Sync secrets to repositories',
        'Automatic rotation',
        'Audit trail integration',
      ],
    },
    {
      id: 'vercel',
      name: 'Vercel',
      description: 'Deploy with confidence using encrypted environment variables',
      icon: '▲',
      status: 'coming-soon',
      category: 'Deployment',
      features: [
        'Auto-sync to preview/production',
        'Zero-downtime updates',
        'Team collaboration',
      ],
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notified about secret access and changes',
      icon: '💬',
      status: 'coming-soon',
      category: 'Notifications',
      features: [
        'Real-time alerts',
        'Access notifications',
        'Approval workflows',
      ],
    },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Integrations</h1>
          <p className="text-muted-foreground">
            Connect Abyrith with your favorite tools and workflows
          </p>
        </div>

        {/* MCP Featured */}
        <Card className="p-8 mb-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start gap-6">
            <div className="text-6xl">🤖</div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">Model Context Protocol (MCP)</h2>
                <Badge variant="default">Available Now</Badge>
              </div>
              <p className="text-muted-foreground mb-4">
                Use Abyrith directly from Claude Code, Cursor, and other AI development tools.
                Manage secrets through natural conversation.
              </p>
              <Button>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Set Up MCP
              </Button>
            </div>
          </div>
        </Card>

        {/* Integrations Grid */}
        <h2 className="text-2xl font-semibold mb-6">All Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((integration) => (
            <Card key={integration.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{integration.icon}</div>
                  <div>
                    <h3 className="text-xl font-semibold">{integration.name}</h3>
                    <Badge variant="outline" className="mt-1">
                      {integration.category}
                    </Badge>
                  </div>
                </div>
                {integration.status === 'available' ? (
                  <Badge variant="default">Available</Badge>
                ) : (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                {integration.description}
              </p>

              <ul className="space-y-2 mb-4">
                {integration.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {integration.status === 'available' ? (
                <Button variant="outline" className="w-full">Configure</Button>
              ) : (
                <Button variant="ghost" className="w-full" disabled>
                  Notify Me
                </Button>
              )}
            </Card>
          ))}
        </div>

        {/* Custom Integration CTA */}
        <Card className="p-8 mt-8 text-center">
          <h3 className="text-2xl font-semibold mb-2">Need a Custom Integration?</h3>
          <p className="text-muted-foreground mb-4">
            We're building our API and would love to hear what you need
          </p>
          <Button variant="outline">Request Integration</Button>
        </Card>
      </div>
    </div>
  );
}
