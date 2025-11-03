'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg" />
            <span className="text-2xl font-bold">Abyrith</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            AI-Native Secrets Management
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            Manage API keys and secrets with the simplicity of conversation.
            <br />
            Zero-knowledge encryption. Enterprise security. 5-year-old simple.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free Trial
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">The Problem</h2>
          <p className="text-lg text-muted-foreground">
            Managing API keys is complicated. Docs are scattered. Security is hard.
            <br />
            Most tools assume you're a security expert. <strong>We assume you're human.</strong>
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">
            What Makes Abyrith Different
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1: AI-Powered */}
            <Card className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Assistant</h3>
              <p className="text-muted-foreground">
                Ask "How do I get a Stripe API key?" and get step-by-step guidance with real documentation.
              </p>
            </Card>

            {/* Feature 2: Zero-Knowledge */}
            <Card className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Zero-Knowledge</h3>
              <p className="text-muted-foreground">
                Your secrets are encrypted client-side. We never see your data. Period.
              </p>
            </Card>

            {/* Feature 3: Environment Separation */}
            <Card className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Environment Separation</h3>
              <p className="text-muted-foreground">
                Dev, staging, production. Keep secrets organized and separate automatically.
              </p>
            </Card>

            {/* Feature 4: Team Collaboration */}
            <Card className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
              <p className="text-muted-foreground">
                Invite teammates. Set permissions. Track who accessed what and when.
              </p>
            </Card>

            {/* Feature 5: Audit Logs */}
            <Card className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Complete Audit Trail</h3>
              <p className="text-muted-foreground">
                Every access logged. SOC 2 ready. Know exactly what happened and when.
              </p>
            </Card>

            {/* Feature 6: AI Workflow Integration */}
            <Card className="p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">MCP Integration</h3>
              <p className="text-muted-foreground">
                Works with Claude Code, Cursor, and other AI tools via Model Context Protocol.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Target Personas */}
      <section className="container mx-auto px-4 py-16 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Built For Everyone</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-2">🌱 The Learner</h3>
              <p className="text-muted-foreground">
                First time using APIs? We'll guide you through getting your first key
                with step-by-step instructions.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-2">👨‍💻 The Solo Developer</h3>
              <p className="text-muted-foreground">
                Stop searching through .env files. Manage all your project keys in one secure place.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-2">👥 The Development Team</h3>
              <p className="text-muted-foreground">
                Share secrets securely. Control access. Never email API keys again.
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-2">🏢 The Enterprise</h3>
              <p className="text-muted-foreground">
                SOC 2 compliance. Audit trails. Role-based access. Enterprise-grade security.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Ready to Simplify Secrets?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Start managing your API keys the AI-native way. No credit card required.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="text-lg px-8 py-6">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded" />
              <span className="font-semibold">Abyrith</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Abyrith. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition">Terms</Link>
              <Link href="#" className="hover:text-foreground transition">Docs</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
