# Abyrith: Technical Architecture Specification

## Architecture Overview

Abyrith follows a **zero-knowledge, AI-first, multi-platform architecture** where security and user experience are never in conflict. The entire platform is designed around client-side encryption with intelligent features that work on metadata, not plaintext secrets.

**Core Principle:** Security that doesn't compromise usability. Intelligence without compromising privacy.

**Architecture Philosophy:**
- **Zero-Knowledge Encryption:** We never have access to unencrypted secrets
- **Client-Side First:** All encryption/decryption happens in the user's browser/client
- **AI for Education, Not Secrets:** AI works with metadata (service names, descriptions) not values
- **Multi-Platform:** Same security model across web, MCP, CLI, browser extension
- **API-Driven:** Every interface talks to the same secure backend API

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
│   Web App │ MCP Client │ CLI │ Browser Extension │ Mobile   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Client-Side Encryption Layer                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Master Key Derivation (from password)             │   │
│  │  • AES-256-GCM Encryption/Decryption                 │   │
│  │  • Key never leaves client                           │   │
│  │  • Zero-knowledge proof of identity                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │ (encrypted blobs + metadata)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge Network                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Workers      │  │ DDoS & WAF   │  │ Rate Limiting│      │
│  │ (API Gateway)│  │ Protection   │  │ per IP/User  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────┬───────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ API      │  │ MCP      │  │ AI       │
│ Endpoints│  │ Server   │  │ Service  │
│ (REST)   │  │ (Claude) │  │ (Claude) │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     └─────────────┼─────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  PostgreSQL Database                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │ users        │  │ projects     │  │ secrets    │ │   │
│  │  │ (auth data)  │  │ (metadata)   │  │ (encrypted)│ │   │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │ audit_logs   │  │ team_members │  │ api_info   │ │   │
│  │  │ (who/when)   │  │ (permissions)│  │ (metadata) │ │   │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Service │  │ RLS Policies │  │ Edge Funcs   │      │
│  │ (JWT, OAuth) │  │ (Multi-tenant)│  │ (Webhooks)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              External Integrations                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Claude API   │  │ FireCrawl    │  │ Email/Slack  │      │
│  │ (AI Guide)   │  │ (Doc Scrape) │  │ (Notify)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Examples

**Scenario 1: User Stores a New Secret**
```
1. User enters API key in web app
   ↓
2. Client-side JavaScript derives master key from password
   ↓
3. Client encrypts secret with AES-256-GCM
   ↓
4. Encrypted blob + metadata sent to Cloudflare Worker
   ↓
5. Worker validates JWT, rate limits, forwards to Supabase
   ↓
6. Supabase stores encrypted blob (we can't decrypt it)
   ↓
7. Audit log created (user X added secret Y to project Z)
```

**Scenario 2: Claude Code Requests a Secret via MCP**
```
1. Claude Code: "I need OPENAI_API_KEY"
   ↓
2. MCP Client sends request to Abyrith MCP Server
   ↓
3. MCP Server checks: Does this project have OPENAI_API_KEY?
   ↓
4. If yes → Web app shows approval prompt to user
   ↓
5. User approves → Client decrypts secret
   ↓
6. Decrypted value returned to MCP Client (in memory only)
   ↓
7. Claude Code receives secret, uses it
   ↓
8. Audit log: "Claude accessed OPENAI_API_KEY via MCP"
```

**Scenario 3: AI Helps User Get a New Key**
```
1. User: "I need a Google Gemini API key"
   ↓
2. Web app sends request to AI Worker
   ↓
3. AI Worker calls Claude API with context
   ↓
4. Claude: "I'll help you get that key"
   ↓
5. In parallel, calls FireCrawl to get latest docs from
   console.cloud.google.com/apis
   ↓
6. Claude generates step-by-step instructions
   ↓
7. User follows steps, gets key, stores in Abyrith
   ↓
8. AI never sees the actual key value
```

### Key Architectural Layers

**1. Client Layer (Zero-Knowledge Encryption)**
- All encryption/decryption happens here
- Master key derived from password using PBKDF2
- Encryption keys never transmitted to server
- WebCrypto API for browser, native crypto for CLI/mobile

**2. Edge Layer (Cloudflare)**
- Global CDN for web app
- Workers as API gateway and rate limiting
- DDoS protection and WAF
- MCP server endpoint for AI tools

**3. Application Layer (Supabase + Custom Workers)**
- PostgreSQL for encrypted data storage
- Row-level security for multi-tenancy
- Auth service for user management
- Custom Workers for AI interactions

**4. AI Layer (Claude + FireCrawl)**
- AI assistant for education and guidance
- FireCrawl for real-time API documentation
- Research agent for new/unknown APIs
- Never has access to secret values

**5. Integration Layer (MCP, Webhooks, APIs)**
- MCP server for Claude Code/Cursor integration
- REST API for CLI and programmatic access
- Webhooks for notifications (Slack, email)
- OAuth for enterprise SSO

---

---

## Technology Stack

### Frontend Layer

**Primary Technology:** React / Next.js SPA

**Hosting:** Cloudflare Pages
- Global CDN distribution (200+ edge locations)
- Automatic HTTPS with SSL certificates
- Built-in CI/CD from Git repositories
- Edge rendering capabilities
- Instant cache invalidation

**Key Features:**
- Modern JavaScript/TypeScript
- Component-based architecture
- Client-side routing
- API integration via fetch/axios
- State management (React Context/Redux/Zustand)

**Security:**
- Content Security Policy (CSP) headers
- Subresource Integrity (SRI)
- HTTPS-only with HSTS
- XSS protection via React's built-in escaping

---

### Backend Layer

**Philosophy:** Serverless-first, minimal custom backend code.

#### Supabase (Primary Backend)

**Database:** PostgreSQL 15+
- Row-Level Security (RLS) policies
- Full ACID compliance
- JSON/JSONB support for flexible schemas
- PostGIS for geospatial data (if needed)
- Connection pooling (PgBouncer)

**Authentication:**
- JWT-based authentication
- OAuth 2.0 providers (Google, GitHub, etc.)
- Email/password with confirmation
- Magic link authentication
- SSO support (SAML, OAuth)
- Multi-factor authentication (MFA)

**Auto-Generated APIs:**
- RESTful API (PostgREST)
- GraphQL-like query syntax
- Real-time subscriptions via WebSocket
- Automatic API documentation

**Storage:**
- S3-compatible object storage
- Image transformations
- CDN integration
- Access policies and signed URLs

**Edge Functions:**
- Deno runtime (TypeScript/JavaScript)
- Deploy custom logic to edge locations
- WebAssembly support
- Sub-100ms cold starts

#### Cloudflare Workers (Supplementary Logic)

**Use Cases:**
- Custom API endpoints not suitable for Supabase
- Webhook handlers
- Third-party API proxying (to hide keys)
- Request transformation and routing
- A/B testing and feature flags
- Custom authentication middleware

**Characteristics:**
- V8 isolate execution (not containers)
- Zero cold starts
- Global deployment (millisecond edge routing)
- JavaScript/TypeScript/Rust/C support
- KV storage for caching
- Durable Objects for stateful applications

---

### Data Architecture

#### Database Schema Design

**Principles:**
- Normalize for consistency, denormalize for performance
- Use row-level security for all tables
- Timestamp all records (created_at, updated_at)
- Soft deletes where appropriate (deleted_at)
- UUIDs for primary keys (prevent enumeration attacks)

**Core Tables:**
```sql
-- Users (managed by Supabase Auth)
auth.users

-- Organizations/Tenants
organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- User Organization Memberships
organization_members (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations,
  user_id uuid REFERENCES auth.users,
  role text NOT NULL, -- 'owner', 'admin', 'member'
  created_at timestamptz DEFAULT now()
)

-- API Keys/Secrets (encrypted)
secrets (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations,
  service_name text NOT NULL,
  encrypted_value text NOT NULL, -- encrypted with master key
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
)

-- Audit Log
audit_logs (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations,
  user_id uuid REFERENCES auth.users,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
)
```

#### Row-Level Security (RLS) Policies

**Example Policy:**
```sql
-- Users can only see organizations they belong to
CREATE POLICY "Users see own organizations"
ON organizations FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Only organization admins can update organization
CREATE POLICY "Admins update organizations"
ON organizations FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);
```

---

### Security Architecture

#### Network Security

**Cloudflare Protection:**
- DDoS mitigation (automatic, unlimited)
- Web Application Firewall (WAF)
- Bot management and CAPTCHA
- Rate limiting (per IP, per user)
- Geographic restrictions (if needed)
- Always HTTPS with TLS 1.3

**API Security:**
- JWT authentication for all API calls
- Short-lived tokens (15-60 minutes)
- Refresh token rotation
- API key rate limiting
- Request size limits
- CORS policies (strict origin validation)

#### Data Security

**Encryption:**
- **In Transit:** TLS 1.3 for all connections
- **At Rest:** AES-256 encryption (Supabase/Cloudflare default)
- **Secrets:** Additional application-level encryption using envelope encryption
  - Master key stored in Cloudflare Workers secrets
  - Data keys stored with encrypted secrets
  - Key rotation capability

**Access Control:**
- Principle of Least Privilege
- Role-Based Access Control (RBAC)
- Row-Level Security on database
- Service accounts with minimal permissions
- Audit logging for sensitive operations

**Secrets Management:**
```javascript
// Cloudflare Worker for secrets encryption
export default {
  async fetch(request, env) {
    const masterKey = env.MASTER_ENCRYPTION_KEY;
    const data = await request.json();
    
    // Encrypt using Web Crypto API
    const encrypted = await encryptData(data.secret, masterKey);
    
    // Store in Supabase with RLS
    const { data: secret } = await supabase
      .from('secrets')
      .insert({ 
        organization_id: data.org_id,
        service_name: data.service,
        encrypted_value: encrypted 
      });
    
    return new Response(JSON.stringify(secret));
  }
}
```

#### Authentication Flow

```
1. User enters credentials
   ↓
2. Frontend → Supabase Auth
   ↓
3. Supabase validates & returns JWT
   ↓
4. Frontend stores JWT (httpOnly cookie or secure storage)
   ↓
5. All API requests include JWT in Authorization header
   ↓
6. Supabase validates JWT on each request
   ↓
7. RLS policies enforce data access based on JWT claims
```

---

### AI Integration Architecture

### AI Integration Architecture

AI is not a feature in Abyrith—it's the primary user interface and orchestration layer. The platform is designed to be AI-native, AI-proof, and AI-collaborative.

#### AI-Native Design Principles

**1. AI as Primary Interface**
- 80% of users never leave the conversational interface
- Visual UI generated dynamically based on current project state
- Configuration through conversation, not forms
- AI maintains context across sessions and projects

**2. AI-Proof Architecture**
- Platform improves automatically as AI models improve
- Model-agnostic design (can swap Claude for future models)
- Structured outputs ensure reliable orchestration
- Graceful degradation if AI unavailable (fallback to traditional UI)

**3. AI Ecosystem Integration**
- Works with Cursor, GitHub Copilot, Windsurf, and other AI IDEs
- Model Context Protocol (MCP) for standardized integration
- Shares context with user's other AI tools
- No fighting or conflicting with other AI assistants

#### Claude API Integration (Primary)

**Core Use Cases:**

**For Beginners:**
- Natural language app building ("Make me a todo app")
- Plain-English explanations ("What's a database?")
- Visual progress tracking with friendly messages
- Error recovery ("Something went wrong" → AI fixes it)
- Learning through doing (AI teaches concepts as needed)

**For Enterprises:**
- Complex infrastructure orchestration
- Compliance automation and reporting
- Team onboarding automation
- Code review and security scanning
- Documentation generation

**Architectural Flow:**
```
User: "I want to accept payments"
    ↓
Frontend (React/Next.js)
    ↓
Cloudflare Worker (AI Gateway)
    ├─→ Validate JWT & permissions
    ├─→ Load user/project context
    ├─→ Check rate limits
    └─→ Add system prompts & constraints
         ↓
Claude API (Extended Thinking mode for complex requests)
    ├─→ Understand intent
    ├─→ Check current project state (via MCP)
    ├─→ Plan multi-step implementation
    └─→ Execute with user approval gates
         ↓
MCP Tools (Model Context Protocol)
    ├─→ supabase_query (read/write database)
    ├─→ cloudflare_deploy (deploy changes)
    ├─→ integration_config (setup OAuth/APIs)
    ├─→ security_scan (validate changes)
    └─→ docs_generate (create documentation)
         ↓
Orchestration Layer (Abyrith Core)
    ├─→ Translate AI intent to API calls
    ├─→ Execute operations sequentially
    ├─→ Handle rollback if any step fails
    ├─→ Generate visual feedback
    └─→ Update project state
         ↓
Frontend (Real-time updates)
    ↓
User sees: "✓ Stripe connected ✓ Payment flow ready"
```

**Context Management:**

Abyrith maintains rich context for AI interactions:

```javascript
// Example context structure passed to Claude
{
  user: {
    id: "uuid",
    experience_level: "beginner|builder|expert",
    preferences: {
      explanation_depth: "minimal|moderate|detailed",
      show_code: false,
      language: "en"
    }
  },
  project: {
    id: "uuid",
    type: "recipe_app",
    current_state: {
      database_tables: ["users", "recipes", "favorites"],
      integrations: ["supabase_auth"],
      deployment_status: "staging"
    },
    history: [
      {action: "created user authentication", timestamp: "..."},
      {action: "added recipes table", timestamp: "..."}
    ]
  },
  conversation: {
    recent_messages: [...],
    unresolved_issues: [],
    pending_approvals: []
  }
}
```

**Security & Safety:**

- **Sandboxed Execution:** AI never has direct infrastructure access
- **Approval Gates:** Destructive operations require user confirmation
- **Rate Limiting:** Per-user and per-org limits prevent abuse
- **Content Filtering:** All responses sanitized for sensitive data
- **Audit Logging:** Every AI action logged for compliance
- **Rollback Capability:** Any AI-initiated change can be undone

**Model Context Protocol (MCP) Integration:**

Abyrith implements MCP servers for:

**1. Supabase MCP Server**
```typescript
// Allows AI to read/write database with permission
tools: [
  "supabase_list_tables",
  "supabase_query_table",
  "supabase_create_table", // requires approval
  "supabase_insert_data",
  "supabase_update_schema", // requires approval
  "supabase_get_table_stats"
]
```

**2. Cloudflare MCP Server**
```typescript
// Allows AI to manage deployments and CDN
tools: [
  "cloudflare_deploy_preview",
  "cloudflare_deploy_production", // requires approval
  "cloudflare_purge_cache",
  "cloudflare_get_analytics",
  "cloudflare_configure_worker"
]
```

**3. Integration MCP Server**
```typescript
// Handles third-party service integrations
tools: [
  "integration_initiate_oauth", // user completes OAuth flow
  "integration_test_credentials",
  "integration_configure_webhook",
  "integration_get_documentation"
]
```

**4. Visual Builder MCP Server**
```typescript
// Generates and updates UI components
tools: [
  "ui_generate_component",
  "ui_update_styling",
  "ui_preview_changes",
  "ui_get_user_feedback"
]
```

#### Multi-Model Strategy

While Claude is primary, Abyrith supports multiple AI models:

**Model Selection by Task:**
```javascript
const AI_ROUTING = {
  // Claude Extended Thinking for complex orchestration
  complex_infrastructure: "claude-3.5-sonnet-extended",
  
  // Claude Opus for creative UI generation
  ui_generation: "claude-3-opus",
  
  // Fast models for simple queries
  quick_answers: "claude-3-haiku",
  
  // Future: Specialized models
  image_generation: "future-dalle-4",
  code_review: "future-github-models"
}
```

#### AI Ecosystem Integration

**Integration with Other AI Tools:**

**1. Cursor / VS Code + Copilot**
```
Developer workflow:
1. Uses Abyrith AI to scaffold app ("Create recipe app")
2. Abyrith deploys basic structure
3. Developer opens project in Cursor
4. Cursor/Copilot has full context via MCP
5. Developer codes custom features
6. Push to git → Abyrith auto-deploys
```

**2. Claude.ai / ChatGPT for Planning**
```
User workflow:
1. Plans app with Claude.ai/ChatGPT
2. Copies plan to Abyrith
3. Abyrith: "I see you want to build X, let me implement that"
4. Abyrith builds based on the plan
```

**3. AI-Generated Requirements**
```
Product Manager workflow:
1. Uses AI to generate PRD
2. Imports PRD to Abyrith
3. Abyrith: "Based on this PRD, here's the implementation plan"
4. PM approves, Abyrith builds
```

#### AI Interaction Patterns

**Pattern 1: Guided Conversation (Beginners)**
```
User: "I want to build an app"
AI: "Great! What kind of app? For example:
     • Social (like Instagram)
     • Productivity (like Notion)  
     • E-commerce (like Shopify)
     • Something else?"

User: "Social app for sharing recipes"
AI: "Perfect! A recipe sharing app needs:
     ✓ User accounts (for login)
     ✓ Place to store recipes
     ✓ Way to share with friends
     ✓ Photo uploads
     
     Should I build this for you?"

User: "Yes!"
AI: [Builds entire app]
    "✓ App ready! Here's your link: [URL]
     
     What would you like to add next?"
```

**Pattern 2: Direct Intent (Builders)**
```
User: "Add comments to recipes with nested replies"
AI: "✓ Adding comment system with threading...
    
    Done! Users can now:
    • Comment on any recipe
    • Reply to comments (unlimited nesting)
    • Edit/delete their own comments
    • Get notifications on replies
    
    Want to customize the notification behavior?"
```

**Pattern 3: Technical Collaboration (Experts)**
```
User: "Add RLS policy so users can only edit their own recipes"
AI: "I'll create a row-level security policy.
    
    ```sql
    CREATE POLICY 'users_own_recipes' ON recipes
    FOR UPDATE USING (auth.uid() = user_id);
    ```
    
    Should I apply this now?"

User: "Also need delete policy"
AI: "Adding delete policy with same logic:
    
    ```sql
    CREATE POLICY 'users_delete_own' ON recipes
    FOR DELETE USING (auth.uid() = user_id);
    ```
    
    Applied! Want to test with the policy validator?"
```

#### Handling AI Uncertainty

When AI isn't confident, it asks for help:

```
User: "Add the Johnson protocol for data synchronization"

AI: "I'm not familiar with 'Johnson protocol' for data sync.
     Could you help me understand what you need?
     
     Are you referring to:
     • A specific syncing pattern?
     • A third-party service?
     • Something custom from your team?
     
     Or could you describe what behavior you want?"
```

This prevents AI from making assumptions that could break the app.

#### Future AI Capabilities

**Phase 2: AI Agents**
- Autonomous debugging ("I noticed an error pattern, fixing it")
- Proactive optimization ("Your database queries could be faster, want me to optimize?")
- Predictive scaling ("Traffic spike detected, scaling automatically")

**Phase 3: Multi-Agent Systems**
- Specialized agents (SecurityAgent, PerformanceAgent, UXAgent)
- Agents collaborate on complex tasks
- Humans oversee, agents execute

**Phase 4: Learning & Personalization**
- AI learns team coding style and patterns
- Suggests features based on usage analytics
- Predicts what users will ask for next

---

### Deployment Architecture

#### Development Workflow

```
Developer → Git Push
    ↓
GitHub Actions CI/CD
    ↓
    ├─→ Run Tests (Jest, Playwright)
    ├─→ Security Scan (Dependabot, Snyk)
    ├─→ Lint & Format (ESLint, Prettier)
    └─→ Build
          ↓
    Deploy to Staging (Cloudflare Pages)
          ↓
    Manual Approval
          ↓
    Deploy to Production (Cloudflare Pages)
```

#### Environment Management

**Environments:**
- **Development:** Local with Supabase CLI
- **Staging:** Cloudflare Pages preview deployment + Supabase staging project
- **Production:** Cloudflare Pages + Supabase production project

**Environment Variables:**
- Stored in Cloudflare Pages settings
- Supabase connection strings
- API keys for integrations
- Feature flags
- Never committed to repository

**Database Migrations:**
- Version controlled SQL files
- Supabase CLI migration tool
- Applied automatically in CI/CD
- Rollback capability

---

### Monitoring & Observability

#### Logging

**Cloudflare:**
- Request logs (via Logpush to storage)
- Worker logs (console.log → Logpush)
- Security events (WAF, bot detection)

**Supabase:**
- Database query logs
- Auth events
- Edge function logs
- Realtime connection logs

**Aggregation:**
- Send to centralized logging (e.g., Datadog, LogDNA)
- Real-time alerting on errors
- Retention policies (90 days standard, 1 year for security)

#### Metrics

**Application Metrics:**
- Request latency (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Auth success/failure rates
- API integration response times

**Business Metrics:**
- Daily/monthly active users
- Feature usage rates
- AI query volume
- Deployment frequency

**Alerting:**
- PagerDuty for critical incidents
- Slack for warnings
- Email for daily summaries

#### Health Checks

**Frontend:**
- `/health` endpoint returning build info and timestamp
- Synthetic monitoring (Pingdom/UptimeRobot)

**Backend:**
- Supabase health endpoint check
- Database connection pool status
- External API availability checks

---

### Scalability Considerations

#### Horizontal Scaling

**Frontend:**
- Cloudflare's global CDN handles distribution
- No server scaling needed
- Instant global caching

**Workers:**
- Automatic scaling (0 to millions of requests)
- No configuration required
- Sub-millisecond provisioning

**Database:**
- Supabase auto-scaling (compute and storage)
- Read replicas for read-heavy workloads
- Connection pooling for efficiency
- Vertical scaling available (CPU/RAM upgrades)

#### Caching Strategy

**Layers:**
1. **Browser Cache:** Static assets (max-age: 1 year with versioning)
2. **Cloudflare CDN:** HTML, API responses (vary by auth state)
3. **Cloudflare KV:** Frequently accessed data (user settings, feature flags)
4. **Supabase Connection Pool:** Database connection reuse

**Cache Invalidation:**
- Versioned URLs for assets (automatic invalidation)
- API cache invalidation on mutations
- KV expiration or explicit purge
- Cloudflare purge API for emergency cache clear

---

### Disaster Recovery & Business Continuity

#### Backup Strategy

**Database:**
- Supabase automatic daily backups (30-day retention)
- Point-in-time recovery (PITR) available
- Manual backup triggers before major changes
- Cross-region backup storage

**Code:**
- Git repository (GitHub) with branch protection
- Multiple developer clones
- Daily automated backup to separate storage

**Secrets:**
- Encrypted backups of secrets table
- Master key backup in secure vault (1Password Business)
- Recovery procedures documented

#### Disaster Recovery Plan

**RTO (Recovery Time Objective):** 4 hours
**RPO (Recovery Point Objective):** 1 hour

**Scenarios:**
1. **Cloudflare Outage:** Wait for recovery (historically <30 min) or point DNS to backup hosting
2. **Supabase Outage:** Wait for recovery or restore from backup to new instance
3. **Full Region Failure:** Restore database to different region, update DNS
4. **Data Corruption:** Restore from PITR backup
5. **Security Breach:** Rotate all secrets, force user password resets, forensic analysis

---

## Technology Decision Log

| Component | Choice | Alternatives Considered | Rationale |
|-----------|--------|------------------------|-----------|
| Frontend Hosting | Cloudflare Pages | Vercel, Netlify | Global edge, integrated with other Cloudflare services |
| Database | Supabase (PostgreSQL) | Firebase, MongoDB, custom | Open source, PostgreSQL power, RLS, real-time |
| Serverless Functions | Cloudflare Workers | AWS Lambda, Vercel Functions | Edge execution, zero cold starts, V8 isolates |
| Auth | Supabase Auth | Auth0, Clerk | Integrated with database, JWT-based, flexible |
| AI | Claude API | OpenAI, Gemini | Best reasoning, MCP support, Anthropic alignment |

---

## Future Architecture Considerations

**Short-term (3-6 months):**
- Implement read replicas for database scaling
- Add Redis cache layer (Upstash) for session data
- Expand Cloudflare Workers usage for custom logic

**Medium-term (6-12 months):**
- Multi-region database deployment
- GraphQL API layer (if REST becomes limiting)
- Advanced monitoring with APM tools

**Long-term (12+ months):**
- Microservices extraction for specific high-scale features
- Event-driven architecture with message queues
- Machine learning model deployment for predictive features

---

## Conclusion

This architecture leverages proven, managed services to deliver a secure, scalable platform while minimizing operational complexity. By building on Cloudflare and Supabase, we inherit enterprise-grade capabilities without the overhead of managing infrastructure. This allows the team to focus on unique product features and user experience while maintaining the solid foundation needed for long-term success.
