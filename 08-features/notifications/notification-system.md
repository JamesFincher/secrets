---
Document: Notification System - Feature Documentation
Version: 1.0.0
Last Updated: 2025-10-30
Owner: Product + Backend Engineering
Status: Draft
Dependencies: 04-database/schemas/audit-logs.md, 06-backend/supabase/supabase-realtime.md, 09-integrations/webhooks/webhooks-integration.md, TECH-STACK.md, GLOSSARY.md
---

# Notification System Feature

## Overview

The Abyrith Notification System provides real-time, multi-channel alerts to keep users informed about important events in their secrets management platform. Users receive notifications when secrets are accessed, team members join or leave, security events occur, and MCP requests require approval—all through their preferred channels including in-app notifications, email, and Slack/Discord webhooks.

**Purpose:** Enable timely awareness of security events, team activities, and system changes through configurable, multi-channel notifications while maintaining zero-knowledge security architecture.

**Target Users:** All personas (The Learner, Solo Developer, Development Team, Enterprise Security/DevOps Team)

**Priority:** P1 - Post-MVP (Phase 5)

---

## Table of Contents

1. [User Perspective](#user-perspective)
2. [Technical Architecture](#technical-architecture)
3. [User Flows](#user-flows)
4. [Technical Implementation](#technical-implementation)
5. [API Contracts](#api-contracts)
6. [Security Considerations](#security-considerations)
7. [Performance Requirements](#performance-requirements)
8. [Testing Strategy](#testing-strategy)
9. [Dependencies](#dependencies)
10. [References](#references)
11. [Change Log](#change-log)

---

## User Perspective

### What Users See

Users experience notifications through three primary channels:

**1. In-App Notifications (Real-time)**
- Notification bell icon in header with unread count badge
- Dropdown panel showing recent notifications (last 50)
- Visual indicators: red for security alerts, blue for team changes, green for approvals
- Click to view full details or take action (approve MCP request, view audit log)
- Mark as read/unread functionality
- "View all notifications" link to dedicated notifications page

**2. Email Notifications**
- Configurable digest (immediate, hourly, daily, weekly)
- Rich HTML emails with event details and action buttons
- Plain-text fallback for accessibility
- Unsubscribe/preference management links
- Critical security alerts always sent immediately (bypass digest)

**3. Webhook Notifications (Slack, Discord, Custom)**
- Real-time push to team communication channels
- Formatted messages with rich context (user, secret name, timestamp)
- Action buttons for approvals (Slack Block Kit)
- Thread support for related events
- Custom webhook endpoints for SIEM/incident response systems

### Key Capabilities

**For All Users:**
- Real-time in-app notifications (via Supabase Realtime)
- Email notifications with configurable frequency
- Notification preferences per event type
- Read/unread tracking with auto-mark-read on view
- Notification history (last 30 days)

**For Team Admins/Owners:**
- Configure organization-wide notification defaults
- Set up webhook integrations (Slack, Discord, custom endpoints)
- Manage notification rules and filters
- Compliance export of notification delivery logs

**For Developers:**
- MCP request approval notifications
- Secret access alerts for production environments
- Team member activity updates
- Project change notifications

**For Enterprise Security Teams:**
- Security event alerts with threat severity
- Suspicious activity notifications (multiple failed access attempts)
- Audit trail notifications for compliance
- SIEM integration via webhooks

### User Benefits

**For Learners (Beginners):**
- Gentle reminders about API key best practices
- Educational notifications ("Why is this secret being accessed?")
- Progress notifications when setting up first project
- Friendly language and helpful context

**For Solo Developers:**
- Email alerts when secrets are accessed (security awareness)
- Reminders to rotate keys
- Notifications about expiring secrets
- Low-noise, high-signal alerts

**For Development Teams:**
- Slack notifications when team members access production secrets
- MCP approval requests appear in team channel
- Team member join/leave notifications
- Project activity feed for coordination

**For Enterprise:**
- Compliance notifications (audit log exports ready)
- Security incident alerts routed to SOC
- Custom webhook integrations with existing tools
- Granular notification rules per project/environment

### Example Scenarios

**Scenario 1: Production Secret Accessed**

*User Story:* Sarah (Developer) accesses the production Stripe API key from the Abyrith dashboard to debug a payment issue.

1. **In-app:** Team Admin (John) sees notification: "Sarah accessed STRIPE_SECRET_KEY (production) from 203.0.113.42"
2. **Slack:** Team channel receives formatted message with secret name, accessor, timestamp, and "View Audit Log" button
3. **Email:** Security team receives immediate email alert (production access always triggers immediate notification)
4. **Result:** Team aware of production access, can verify it's legitimate, audit trail preserved

**Scenario 2: MCP Request Approval**

*User Story:* Claude Code requests access to AWS_ACCESS_KEY to help developer deploy application. Developer must approve AI tool access.

1. **In-app:** Developer sees notification: "Claude Code is requesting access to AWS_ACCESS_KEY. Approve or Deny?"
2. **Email:** Developer receives email with approve/deny buttons (deep links to app)
3. **Slack:** Optional notification in team channel (configurable)
4. **Action:** Developer clicks "Approve" → AI tool receives secret → Access logged
5. **Follow-up:** Developer receives confirmation: "You approved Claude Code access to AWS_ACCESS_KEY (expires in 1 hour)"

**Scenario 3: Suspicious Activity Detected**

*User Story:* Someone attempts to access 5 different secrets in 2 minutes from an unusual IP address.

1. **In-app:** Security alert banner appears: "⚠️ Suspicious activity detected: Multiple failed access attempts from 203.0.113.99"
2. **Email:** Immediate alert to all Admins/Owners with details and recommended actions
3. **Slack:** High-priority message in security channel with threat score and IP info
4. **Webhook:** Custom SIEM endpoint receives JSON payload for automated incident response
5. **Action:** Team investigates, discovers compromised account, revokes access

**Scenario 4: New Team Member Added**

*User Story:* Admin invites new developer to join team and grants access to "RecipeApp" project.

1. **In-app:** All team members see: "John invited emma@example.com as Developer on RecipeApp"
2. **Slack:** Team channel receives welcome message: "Welcome Emma! 👋 You now have Developer access to RecipeApp"
3. **Email:** New member (Emma) receives onboarding email with getting started guide
4. **Result:** Team aware of new member, Emma has context about her access

---

## Technical Architecture

### System Components

**Components involved:**

**Frontend:**
- `NotificationBell.tsx` - Header notification icon with unread count
- `NotificationPanel.tsx` - Dropdown panel showing recent notifications
- `NotificationList.tsx` - Full page notification list with pagination
- `NotificationPreferences.tsx` - User settings for notification channels and frequency
- `WebhookSettings.tsx` - Organization-level webhook configuration
- Zustand store: `useNotificationStore` - In-app notification state
- React Query: Real-time notification subscription via Supabase

**Backend:**
- Supabase Realtime: WebSocket connections for real-time in-app notifications
- Cloudflare Worker: `notification-dispatcher.worker.ts` - Routes events to channels
- Cloudflare Worker: `webhook-dispatcher.worker.ts` - Delivers webhook notifications
- Cloudflare Worker: `email-dispatcher.worker.ts` - Sends email notifications via SendGrid
- Database tables:
  - `notifications` - User in-app notification records
  - `notification_preferences` - User/org notification settings
  - `webhook_subscriptions` - Webhook endpoint configurations
  - `webhook_deliveries` - Webhook delivery logs
  - `email_deliveries` - Email delivery logs

**External Services:**
- SendGrid API - Email delivery
- Slack Incoming Webhooks - Slack notifications
- Discord Webhooks - Discord notifications
- Custom HTTPS endpoints - Customer webhooks

### Architecture Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                    Abyrith Events                             │
│  (secret access, team change, MCP request, security alert)    │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ Audit log entry created
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          Notification Dispatcher (Cloudflare Worker)        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Receive event from audit log                      │  │
│  │  2. Query notification preferences                    │  │
│  │  3. Determine recipient users                         │  │
│  │  4. Route to appropriate channels:                    │  │
│  │     - In-app (Supabase insert)                       │  │
│  │     - Email (queue for digest or send immediately)   │  │
│  │     - Webhook (trigger webhook dispatcher)           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────┬───────────────┬──────────────────┬────────────────────┘
      │               │                  │
      ▼               ▼                  ▼
┌──────────┐  ┌──────────────┐  ┌──────────────────┐
│ Supabase │  │   Email      │  │    Webhook       │
│ Realtime │  │  Dispatcher  │  │   Dispatcher     │
│          │  │  (SendGrid)  │  │  (Slack, etc.)   │
└─────┬────┘  └──────────────┘  └──────────────────┘
      │
      │ WebSocket
      ▼
┌──────────────────────────────────────┐
│  Frontend (React)                    │
│  - NotificationBell (live updates)   │
│  - Toast notifications               │
│  - Notification panel                │
└──────────────────────────────────────┘
```

### Data Flow

**1. Event Occurs**
   - User accesses secret → Audit log entry created
   - Event data: user_id, action, resource_type, resource_id, metadata

**2. Notification Dispatcher Worker Triggered**
   - Subscribed to new audit log entries (Supabase webhook or polling)
   - Receives event payload with full context

**3. Determine Recipients & Channels**
   - Query `notification_preferences` for affected users
   - Apply notification rules (e.g., "notify Admins for production access")
   - Determine channels: in-app, email, webhooks

**4. In-App Notifications**
   - Insert record into `notifications` table
   - Supabase Realtime broadcasts to connected clients
   - Frontend receives WebSocket message → Updates notification bell

**5. Email Notifications**
   - If immediate: Queue email job in email dispatcher
   - If digest: Add to user's digest queue (sent hourly/daily)
   - SendGrid sends email with templated content

**6. Webhook Notifications**
   - Query `webhook_subscriptions` for organization
   - For each webhook: Trigger webhook dispatcher
   - Format payload, generate HMAC signature, send HTTP POST
   - Log delivery status in `webhook_deliveries`

**7. Notification Delivered**
   - User sees notification in-app (real-time)
   - User receives email (immediate or digest)
   - Team channel receives Slack/Discord message
   - Custom endpoint receives webhook

---

## User Flows

### Flow 1: Receiving In-App Notification

**Trigger:** Another user accesses a secret

**Steps:**
1. **Event occurs:** Sarah accesses `OPENAI_API_KEY` (production)
2. **Audit log created:** `secret.accessed` event with user, secret, timestamp
3. **Notification dispatcher:** Determines John (Admin) should be notified
4. **Notification created:** Record inserted into `notifications` table
5. **Real-time broadcast:** Supabase Realtime sends WebSocket message
6. **Frontend receives:** React component subscribed to notifications receives update
7. **UI updates:** Notification bell badge increments (0 → 1), red dot appears
8. **User sees:** John clicks bell → Notification panel opens
9. **Notification displayed:** "Sarah accessed OPENAI_API_KEY (production) • 2 minutes ago"
10. **User reads:** John clicks notification → Redirects to audit log detail page
11. **Mark as read:** Notification marked read, bell badge decrements (1 → 0)

**Success Criteria:**
- Notification delivered within 1 second of event
- UI updates without page refresh
- Read state persists across sessions

**Error Cases:**
- **WebSocket disconnected** → Notification queued, delivered on reconnect (React Query refetch)
- **User offline** → Notification stored, shown when user returns online
- **Database unavailable** → Event queued, retried with exponential backoff

---

### Flow 2: Configuring Notification Preferences

**Trigger:** User wants to reduce email noise

**Steps:**
1. **Navigate to settings:** User clicks profile → Settings → Notifications
2. **Current preferences shown:**
   - Email: Immediate for all events
   - In-app: Enabled for all events
   - Slack: Disabled
3. **Change email frequency:** User selects "Daily digest (8 AM)"
4. **Customize event types:** User unchecks "Team member activities" for email
5. **Save preferences:** Frontend sends `PATCH /api/notification-preferences`
6. **Backend validates:** Ensure at least one channel enabled for critical events
7. **Preferences updated:** Database record updated
8. **Confirmation:** "Notification preferences saved. You'll receive daily email digests at 8 AM."
9. **Effect:** Future team member events → In-app only, no email until digest

**Success Criteria:**
- Preferences saved within 500ms
- Changes apply immediately to future notifications
- Critical security alerts always delivered (override)

**Error Cases:**
- **Validation fails** → "You must have at least one notification channel enabled for security alerts"
- **Network error** → "Failed to save preferences. Please try again."
- **Concurrent update** → Last write wins with conflict warning

---

### Flow 3: Approving MCP Request via Notification

**Trigger:** Claude Code requests secret access

**Steps:**
1. **MCP request created:** Claude Code asks for `AWS_ACCESS_KEY`
2. **Approval required:** Organization has approval workflow enabled
3. **Notification sent:** Multiple channels
   - In-app: Banner notification with action buttons
   - Email: "Claude Code is requesting AWS_ACCESS_KEY. Approve?"
   - Slack: Message with approve/deny buttons
4. **User sees notification:** John (Developer) opens in-app notification panel
5. **Review request:** Notification shows:
   - Requester: Claude Code (AI assistant)
   - Secret: AWS_ACCESS_KEY
   - Project: RecipeApp
   - Requested by: john@example.com (self-request)
   - Time: 30 seconds ago
6. **User approves:** John clicks "Approve" button in notification panel
7. **Confirmation modal:** "Grant Claude Code access to AWS_ACCESS_KEY for 1 hour?"
8. **Approve confirmed:** `PATCH /api/mcp-requests/:id { status: 'approved' }`
9. **MCP request updated:** Status: pending → approved, expires_at: now() + 1 hour
10. **Claude Code notified:** MCP server receives approval, returns secret to Claude
11. **Confirmation notification:** John receives "You approved Claude Code access (expires 2:30 PM)"
12. **Slack update:** Original Slack message updated with "✅ Approved by John"

**Success Criteria:**
- Request appears in notifications within 2 seconds
- Approval action completes within 500ms
- Claude Code receives secret immediately after approval

**Error Cases:**
- **Request expired** → "This request has expired. Ask Claude to request again."
- **Already approved by someone else** → "Sarah already approved this request."
- **Secret deleted** → "This secret no longer exists."

---

### Flow 4: Security Alert for Suspicious Activity

**Trigger:** System detects 5 failed access attempts in 2 minutes

**Steps:**
1. **Anomaly detected:** Monitoring system identifies pattern
2. **Security event created:** `security.suspicious_activity` in audit logs
3. **Notification priority:** Critical (bypasses all digest settings)
4. **Recipients determined:** All Admins and Owners notified immediately
5. **Multi-channel alert:**
   - In-app: Red banner at top of page + notification
   - Email: Immediate alert email (overrides digest)
   - Slack: High-priority message with @security mention
   - Webhook: JSON payload to custom SIEM endpoint
6. **In-app banner shows:**
   - "⚠️ SECURITY ALERT: Suspicious activity detected"
   - "Multiple failed access attempts from IP 203.0.113.99"
   - "Review Activity" button
7. **User investigates:** John clicks "Review Activity"
8. **Audit log filtered:** Shows all events from suspicious IP
9. **User takes action:**
   - Identifies compromised account
   - Clicks "Revoke Access" on user
   - Confirms account suspension
10. **Incident resolved:** User access revoked, notification dismissed
11. **Follow-up notification:** "User suspended: suspicious-user@example.com"

**Success Criteria:**
- Alert delivered within 5 seconds of detection
- All Admins/Owners notified across all channels
- No notification delivery failures

**Error Cases:**
- **Email delivery fails** → Retry immediately, log failure, show in-app fallback
- **Webhook timeout** → Retry with backoff, continue other channels
- **Supabase unavailable** → Queue notifications, deliver on recovery

---

## Technical Implementation

### Frontend Implementation

**Components:**

**`NotificationBell.tsx`** - Header notification icon with unread count
```typescript
interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { unreadCount, notifications } = useNotifications(userId);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <NotificationPanel
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
        />
      </PopoverContent>
    </Popover>
  );
}
```

**`useNotifications` Hook** - Real-time subscription and state management
```typescript
export function useNotifications(userId: string) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  // Fetch notifications with React Query
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    }
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Add new notification to cache
          queryClient.setQueryData(['notifications', userId], (old: Notification[]) => [
            payload.new as Notification,
            ...old
          ]);

          // Show toast notification
          toast({
            title: payload.new.title,
            description: payload.new.body,
            action: <ToastAction altText="View">View</ToastAction>
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, queryClient]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read_at).length,
    [notifications]
  );

  return { notifications, unreadCount, isLoading };
}
```

**State Management:**
- **Local state:** Notification panel open/closed
- **Global state (Zustand):** Notification preferences (cached)
- **Server state (React Query):** Notification list with real-time updates

**Key Functions:**

```typescript
// Mark notification as read
async function markNotificationAsRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
}

// Mark all notifications as read
async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
}

// Delete notification
async function deleteNotification(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);
}
```

### Backend Implementation

**API Endpoints:**
- `GET /api/notifications` - List user's notifications (paginated)
- `PATCH /api/notifications/:id` - Mark notification as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notification-preferences` - Get user preferences
- `PATCH /api/notification-preferences` - Update user preferences
- `POST /api/webhooks` - Create webhook subscription
- `GET /api/webhooks` - List webhook subscriptions
- `DELETE /api/webhooks/:id` - Delete webhook subscription

**Cloudflare Workers:**

**`notification-dispatcher.worker.ts`** - Main notification routing logic
```typescript
interface NotificationDispatcherEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  SENDGRID_API_KEY: string;
  WEBHOOK_DISPATCHER_URL: string;
}

interface AuditLogEvent {
  id: string;
  user_id: string;
  organization_id: string;
  event_type: string;
  event_category: string;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

export default {
  async fetch(request: Request, env: NotificationDispatcherEnv): Promise<Response> {
    // Parse audit log event
    const event: AuditLogEvent = await request.json();

    // Determine recipients based on event type and preferences
    const recipients = await determineRecipients(event, env);

    // Dispatch to each channel in parallel
    await Promise.all([
      // In-app notifications (Supabase insert)
      createInAppNotifications(event, recipients.inApp, env),

      // Email notifications (immediate or queue for digest)
      sendEmailNotifications(event, recipients.email, env),

      // Webhook notifications (Slack, Discord, custom)
      triggerWebhooks(event, recipients.webhooks, env)
    ]);

    return new Response('Notifications dispatched', { status: 200 });
  }
};

async function determineRecipients(
  event: AuditLogEvent,
  env: NotificationDispatcherEnv
): Promise<NotificationRecipients> {
  // Query notification preferences for organization members
  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('user_id, channel, event_types, frequency')
    .eq('organization_id', event.organization_id);

  const recipients: NotificationRecipients = {
    inApp: [],
    email: [],
    webhooks: []
  };

  // Apply notification rules
  for (const pref of preferences) {
    // Check if user wants notifications for this event type
    if (!pref.event_types.includes(event.event_type)) continue;

    // In-app: Always enabled unless user disabled
    if (pref.channel.includes('in_app')) {
      recipients.inApp.push(pref.user_id);
    }

    // Email: Check frequency preference
    if (pref.channel.includes('email')) {
      if (pref.frequency === 'immediate' || isHighPriority(event)) {
        recipients.email.push(pref.user_id);
      } else {
        // Queue for digest
        await queueForDigest(pref.user_id, event, pref.frequency, env);
      }
    }
  }

  // Webhooks: Query webhook subscriptions
  const { data: webhooks } = await supabase
    .from('webhook_subscriptions')
    .select('*')
    .eq('organization_id', event.organization_id)
    .eq('active', true)
    .contains('events', [event.event_type]);

  recipients.webhooks = webhooks || [];

  return recipients;
}

async function createInAppNotifications(
  event: AuditLogEvent,
  userIds: string[],
  env: NotificationDispatcherEnv
): Promise<void> {
  const notifications = userIds.map(userId => ({
    user_id: userId,
    organization_id: event.organization_id,
    event_type: event.event_type,
    title: formatNotificationTitle(event),
    body: formatNotificationBody(event),
    action_url: generateActionUrl(event),
    metadata: event.metadata,
    created_at: new Date().toISOString()
  }));

  // Bulk insert (Supabase Realtime will broadcast to connected clients)
  await supabase
    .from('notifications')
    .insert(notifications);
}

function formatNotificationTitle(event: AuditLogEvent): string {
  switch (event.event_type) {
    case 'secret.accessed':
      return 'Secret Accessed';
    case 'member.added':
      return 'New Team Member';
    case 'security.suspicious_activity':
      return '⚠️ Security Alert';
    case 'mcp.request':
      return 'AI Tool Requesting Access';
    default:
      return event.action;
  }
}

function isHighPriority(event: AuditLogEvent): boolean {
  // High priority events bypass digest settings
  const highPriorityEvents = [
    'security.suspicious_activity',
    'secret.accessed', // Production only
    'mcp.request'
  ];

  return highPriorityEvents.includes(event.event_type);
}
```

**Supabase Functions:**
- `send_notification_email` - Edge function to send digest emails (Deno runtime)
- `cleanup_old_notifications` - Scheduled function to delete notifications older than 30 days

### Database Implementation

**Tables Used:**

**`notifications`** - In-app notification records
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_event_type CHECK (event_type IN (
    'secret.created', 'secret.accessed', 'secret.updated', 'secret.deleted',
    'member.added', 'member.removed', 'member.role_changed',
    'mcp.request', 'mcp.approved', 'mcp.denied',
    'security.suspicious_activity', 'project.created'
  ))
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
```

**`notification_preferences`** - User/org notification settings
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  channel TEXT[] NOT NULL DEFAULT ARRAY['in_app', 'email'], -- in_app, email, webhook
  event_types TEXT[] NOT NULL DEFAULT ARRAY['secret.accessed', 'member.added'],
  frequency TEXT NOT NULL DEFAULT 'immediate', -- immediate, hourly, daily, weekly
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_frequency CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
  CONSTRAINT unique_user_org UNIQUE(user_id, organization_id)
);
```

**RLS Policies:**
```sql
-- Users can only view their own notifications
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can only update their own notifications (mark as read)
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## API Contracts

### Endpoint: GET /api/notifications

**Purpose:** List user's notifications with pagination

**Request:**
```typescript
interface GetNotificationsRequest {
  page?: number;          // Page number (default: 1)
  per_page?: number;      // Items per page (default: 50, max: 100)
  unread_only?: boolean;  // Filter to unread notifications only
}
```

**Example Request:**
```bash
GET /api/notifications?page=1&per_page=50&unread_only=false
Authorization: Bearer <jwt_token>
```

**Success Response (200 OK):**
```typescript
interface GetNotificationsResponse {
  data: Notification[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface Notification {
  id: string;
  event_type: string;
  title: string;
  body: string;
  action_url?: string;
  metadata: Record<string, any>;
  read_at?: string;       // ISO 8601 timestamp or null
  created_at: string;     // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "notif_123",
      "event_type": "secret.accessed",
      "title": "Secret Accessed",
      "body": "Sarah accessed OPENAI_API_KEY (production)",
      "action_url": "/audit/secret_550e8400",
      "metadata": {
        "secret_name": "OPENAI_API_KEY",
        "accessor_email": "sarah@example.com",
        "environment": "production"
      },
      "read_at": null,
      "created_at": "2025-10-30T12:34:56.789Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 123,
    "total_pages": 3
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT token
- `500 Internal Server Error` - Database error

---

### Endpoint: PATCH /api/notifications/:id

**Purpose:** Mark notification as read or unread

**Request:**
```typescript
interface UpdateNotificationRequest {
  read_at: string | null;  // ISO 8601 timestamp or null (mark unread)
}
```

**Example Request:**
```json
PATCH /api/notifications/notif_123
{
  "read_at": "2025-10-30T12:35:00.000Z"
}
```

**Success Response (200 OK):**
```typescript
interface UpdateNotificationResponse {
  id: string;
  read_at: string | null;
}
```

**Error Responses:**
- `401 Unauthorized` - User doesn't own this notification
- `404 Not Found` - Notification doesn't exist
- `500 Internal Server Error` - Database error

---

### Endpoint: GET /api/notification-preferences

**Purpose:** Get user's notification preferences

**Success Response (200 OK):**
```typescript
interface NotificationPreferences {
  id: string;
  user_id: string;
  organization_id: string;
  channel: ('in_app' | 'email' | 'webhook')[];
  event_types: string[];
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quiet_hours_start?: string;  // HH:MM format
  quiet_hours_end?: string;    // HH:MM format
  timezone: string;
}
```

**Example Response:**
```json
{
  "id": "pref_abc123",
  "user_id": "user_xyz789",
  "organization_id": "org_def456",
  "channel": ["in_app", "email"],
  "event_types": [
    "secret.accessed",
    "security.suspicious_activity",
    "mcp.request"
  ],
  "frequency": "immediate",
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00",
  "timezone": "America/Los_Angeles"
}
```

---

### Endpoint: PATCH /api/notification-preferences

**Purpose:** Update user's notification preferences

**Request:**
```typescript
interface UpdatePreferencesRequest {
  channel?: ('in_app' | 'email' | 'webhook')[];
  event_types?: string[];
  frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone?: string;
}
```

**Example Request:**
```json
PATCH /api/notification-preferences
{
  "frequency": "daily",
  "event_types": ["secret.accessed", "security.suspicious_activity"]
}
```

**Success Response (200 OK):**
```json
{
  "id": "pref_abc123",
  "frequency": "daily",
  "event_types": ["secret.accessed", "security.suspicious_activity"],
  "updated_at": "2025-10-30T12:40:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid preference values
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Database error

---

## Security Considerations

### Threat Model

**Potential Threats:**

1. **Notification Injection/Spoofing**
   - **Description:** Attacker creates fake notifications to trick users
   - **Mitigation:**
     - All notifications created via service_role only (users cannot insert)
     - RLS policies prevent users from creating notifications for others
     - Notification source verified via audit log linkage

2. **Information Disclosure via Notifications**
   - **Description:** Notifications reveal sensitive data to unauthorized users
   - **Mitigation:**
     - Notifications only sent to users with permission to view event
     - Secret values never included in notification text
     - Metadata sanitized before notification creation
     - RLS ensures users only see their own notifications

3. **Notification Spam/Abuse**
   - **Description:** Attacker triggers excessive notifications to overwhelm users
   - **Mitigation:**
     - Rate limiting on notification-triggering actions
     - Notification deduplication (same event within 5 minutes)
     - User can mute specific event types
     - Organization-wide notification limits

4. **Email/Webhook Phishing**
   - **Description:** Attacker sends fake notification emails/webhooks
   - **Mitigation:**
     - Email: SPF, DKIM, DMARC configuration
     - Webhook: HMAC signature verification
     - Action URLs always point to app.abyrith.com (verified domain)
     - Email templates clearly branded with Abyrith identity

### Security Controls

**Authentication:**
- All notification API endpoints require valid JWT authentication
- Supabase RLS enforces user can only access their own notifications
- Webhook endpoints secured with HMAC signatures

**Authorization:**
- Notifications only created for users with permission to view event
- Organization admins can view notification delivery logs
- Regular users cannot view other users' notifications

**Data Protection:**
- **Data at rest:** Notifications stored in PostgreSQL with RLS enabled
- **Data in transit:** All APIs served over HTTPS (TLS 1.3)
- **Data in notifications:**
  - Secret values: NEVER included
  - User emails: Included (necessary for context)
  - IP addresses: Included for security events only
  - Metadata: Sanitized to remove sensitive fields

**Audit Logging:**
- All notification deliveries logged (in-app, email, webhook)
- Notification preference changes logged
- Failed deliveries logged with error details

### Compliance

**GDPR:**
- Users can view all notifications sent to them (right to access)
- Users can delete notifications (right to erasure)
- Users can export notification history (data portability)
- Email unsubscribe links in all emails (consent withdrawal)

**SOC 2:**
- Notification delivery logs for audit trail
- Failed delivery alerts for monitoring
- Notification preference changes tracked

---

## Performance Requirements

### Performance Targets

**Latency:**
- In-app notification delivery: < 1 second (p95)
- Email delivery queuing: < 2 seconds (p95)
- Webhook delivery: < 5 seconds (p95)
- Notification list API: < 200ms (p95)

**Throughput:**
- Support 10,000 concurrent WebSocket connections
- Handle 1,000 notifications/second
- Process 100 webhook deliveries/second

**Resource Usage:**
- Cloudflare Worker: < 50ms CPU time per notification
- Database: < 10ms per notification insert
- WebSocket: < 5KB memory per connection

### Optimization Strategy

**Frontend:**
- React Query caching (5-minute stale time)
- WebSocket connection reuse across components
- Optimistic updates for mark-as-read
- Virtual scrolling for notification list (> 100 items)

**Backend:**
- Bulk insert notifications (batch up to 100)
- Database indexes on user_id, created_at, read_at
- Connection pooling for Supabase
- Webhook delivery parallelization

**Database:**
- Composite index: `(user_id, created_at DESC)`
- Partial index: `(user_id, read_at) WHERE read_at IS NULL`
- Automatic cleanup of old notifications (> 30 days)

### Load Handling

**Expected Load:**
- Peak: 5,000 notifications/minute during high-activity periods
- Average: 500 notifications/minute
- Concurrent WebSocket connections: 2,000-10,000

**Scalability:**
- Cloudflare Workers: Auto-scaling (no limits)
- Supabase: Vertical scaling (upgrade plan as needed)
- WebSockets: Supabase Realtime supports 50,000+ connections

**Bottlenecks:**
- Database writes (notifications table)
- SendGrid email API rate limits (100 emails/second)
- Webhook delivery timeouts (30s each)

---

## Testing Strategy

### Unit Tests

**Frontend:**
- Test: Notification bell displays correct unread count
- Test: Notification panel renders notifications correctly
- Test: Mark as read updates UI optimistically
- Test: WebSocket connection handles reconnection
- Coverage: 80%+

**Backend:**
- Test: Notification dispatcher routes to correct channels
- Test: Recipient determination respects preferences
- Test: High-priority events bypass digest settings
- Test: Notification title/body formatting
- Coverage: 85%+

### Integration Tests

**Test Scenarios:**

1. **End-to-End Notification Flow**
   - Trigger audit log event
   - Verify notification created in database
   - Verify WebSocket broadcast received
   - Verify email queued
   - Verify webhook delivered

2. **Preference Filtering**
   - User disables email notifications
   - Trigger event
   - Verify in-app notification sent
   - Verify email NOT sent

3. **Real-time Updates**
   - User connected via WebSocket
   - Another user triggers event
   - Verify notification appears without refresh

### End-to-End Tests

**E2E Flows (Playwright):**

1. **Receive and Read Notification**
   - User A logged in
   - User B accesses secret
   - User A sees notification bell badge update
   - User A clicks bell, sees notification
   - User A clicks notification, redirects to audit log
   - Badge count decrements

2. **Configure Notification Preferences**
   - Navigate to Settings > Notifications
   - Change email frequency to "Daily digest"
   - Disable "Team member activities"
   - Save preferences
   - Verify confirmation message

### Security Tests

**Security Test Cases:**

1. **Notification Isolation**
   - User A creates notification
   - User B attempts to access User A's notification API
   - Verify 403 Forbidden response

2. **HMAC Signature Verification**
   - Send webhook without signature
   - Verify receiver rejects (401)
   - Send webhook with invalid signature
   - Verify receiver rejects (401)

---

## Dependencies

### Technical Dependencies

**Must exist before implementation:**
- [x] `04-database/schemas/audit-logs.md` - Audit events trigger notifications
- [x] `06-backend/supabase/supabase-realtime.md` - Real-time WebSocket delivery
- [x] `09-integrations/webhooks/webhooks-integration.md` - Webhook delivery system
- [ ] `04-database/schemas/notification-preferences.md` - User preference storage
- [ ] `04-database/schemas/notification-subscriptions.md` - Notification subscriptions

**External Services:**
- Supabase Realtime - Real-time WebSocket connections
- SendGrid - Email delivery
- Cloudflare Workers - Notification routing and delivery

### Feature Dependencies

**Depends on these features:**
- Audit Logs (`08-features/audit-logs/`) - Events that trigger notifications
- Team Collaboration (`08-features/team-collaboration/`) - Team member events
- MCP Integration (`09-integrations/mcp/`) - AI tool approval requests

**Enables these features:**
- Security Monitoring - Real-time alerts for suspicious activity
- Compliance Reporting - Notification delivery audit trail
- Team Coordination - Activity awareness across team

---

## References

### Internal Documentation
- `04-database/schemas/audit-logs.md` - Audit log events and structure
- `06-backend/supabase/supabase-realtime.md` - Supabase Realtime WebSocket setup
- `09-integrations/webhooks/webhooks-integration.md` - Webhook delivery implementation
- `TECH-STACK.md` - Technology decisions (Supabase, Cloudflare Workers, SendGrid)
- `GLOSSARY.md` - Term definitions (notification, webhook, real-time)

### External Resources
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime) - WebSocket subscriptions
- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference) - Email delivery
- [shadcn/ui Notification Components](https://ui.shadcn.com/docs/components/toast) - UI components
- [Web Push Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) - Browser push (future)

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-30 | Product + Backend Engineering | Initial notification system feature documentation |

---

## Notes

### Future Enhancements

**Browser Push Notifications (Phase 6+):**
- Web Push API for desktop/mobile notifications
- Service Worker registration and management
- Push notification preferences per device
- Silent notifications for background sync

**Advanced Filtering:**
- Custom notification rules (if secret.environment = 'production' AND user.role != 'owner')
- Notification templates with variable substitution
- Conditional routing (route security alerts to specific Slack channel)

**Notification Channels:**
- SMS notifications via Twilio (high-priority alerts)
- Microsoft Teams webhook integration
- PagerDuty integration for incident response
- Telegram bot notifications

**Analytics:**
- Notification delivery rates (opened/clicked/ignored)
- User engagement metrics (which event types get most attention)
- Notification fatigue detection (auto-suggest digest frequency)

**Collaboration Features:**
- Mark notification as resolved (with comment)
- Assign notification to team member
- Thread conversations on notifications
- Mention users in notification comments

### Known Limitations

- Maximum 50 notifications loaded in panel (pagination required for more)
- WebSocket reconnection may cause brief delay (< 5 seconds)
- Email digest sends at fixed times (not customizable per user in MVP)
- Webhook retries limited to 5 attempts (30-minute max delay)
- No notification preview images/thumbnails
- Notification retention: 30 days (older notifications auto-deleted)

### Performance Considerations

**Database Growth:**
- Notifications table grows rapidly (estimate 1M rows/month for 1000 active users)
- Automatic cleanup essential (cron job to delete > 30 days)
- Consider partitioning by month if exceeds 10M rows

**WebSocket Scaling:**
- Supabase Realtime supports 50,000+ concurrent connections
- If exceeding, consider implementing custom WebSocket server
- Monitor connection churn (frequent disconnect/reconnect)

**Email Delivery:**
- SendGrid rate limit: 100 emails/second (Free tier)
- Digest batching reduces email volume by 80-90%
- Consider multiple SendGrid accounts for higher throughput

---
