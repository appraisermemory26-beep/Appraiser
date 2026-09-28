# Appraiser — Backend Architecture

> Technical reference for the Appraiser platform backend. Covers database schema, API structure, multi-tenancy, audit trail, file storage, and security model.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Database Schema](#3-database-schema)
4. [Multi-Tenancy & Data Isolation](#4-multi-tenancy--data-isolation)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [API Structure & Endpoints](#6-api-structure--endpoints)
7. [Audit Trail Implementation](#7-audit-trail-implementation)
8. [Task Workflow Engine](#8-task-workflow-engine)
9. [Messaging (Immutable Records)](#9-messaging-immutable-records)
10. [File Storage & Uploads](#10-file-storage--uploads)
11. [Caching, Task Queue & WebSockets](#11-caching-task-queue--websockets)
12. [AI Integration](#12-ai-integration)
13. [Deployment Architecture](#13-deployment-architecture)

---

## 1. Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | Django 5.1 + DRF 3.15 | REST API, ORM, admin |
| **Language** | Python 3.13 | Backend logic |
| **Database** | PostgreSQL 17 | Primary data store |
| **Cache/Broker** | Redis 7 | Caching, Celery broker, Channels layer |
| **Auth** | SimpleJWT | JWT token authentication |
| **Task Queue** | Celery 5.4 | Async background jobs |
| **WebSockets** | Django Channels 4.0 | Real-time messaging |
| **File Storage** | AWS S3 (boto3) | Document & media storage |
| **Server** | Gunicorn (prod) | WSGI HTTP server |
| **Admin** | Django Unfold | Modern admin interface |
| **Monitoring** | Sentry SDK | Error tracking |
| **Package Manager** | UV | Fast Python dependency management |

---

## 2. Project Structure

```
backend/
├── config/                          # Django project configuration
│   ├── settings/
│   │   ├── base.py                  # Shared settings (DB, REST, JWT, CORS, etc.)
│   │   ├── development.py           # Dev overrides (DEBUG=True)
│   │   └── production.py            # Production settings (Sentry, S3)
│   ├── urls.py                      # Root URL routing
│   ├── celery.py                    # Celery app configuration
│   ├── asgi.py                      # ASGI entry (Channels support)
│   └── wsgi.py                      # WSGI entry (Gunicorn)
│
├── apps/                            # 14 domain-specific Django apps
│   ├── core/                        # Base models, dashboard, health check
│   ├── accounts/                    # User management, auth, permissions
│   ├── organisations/               # Org structure (departments, units, divisions)
│   ├── tasks/                       # Task lifecycle & workflow engine
│   ├── attention/                   # Time tracking, activity & break logging
│   ├── messaging/                   # Immutable institutional messaging
│   ├── policies/                    # Policy vault with versioned documents
│   ├── projects/                    # Project management & documents
│   ├── jd_management/               # Job description versioning
│   ├── audit/                       # Immutable audit log
│   ├── billing/                     # Billing profiles & subscriptions
│   ├── ai_tools/                    # AI-powered content generation
│   ├── notifications/               # In-app notification system
│   └── document_retention/          # Data deletion request workflow
│
├── manage.py
└── pyproject.toml                   # Dependencies, dev extras & tool config
```

Each app follows a consistent internal structure:

```
apps/{app_name}/
├── models.py          # Data models
├── serializers.py     # API serialization (DRF)
├── views.py           # ViewSets & API views
├── urls.py            # URL routing (DefaultRouter)
├── permissions.py     # Custom permission classes (if needed)
├── admin.py           # Django admin registration
└── apps.py            # App configuration
```

---

## 3. Database Schema

### 3.1 Core & Accounts

```
┌─────────────────────────┐     ┌─────────────────────────┐
│      Organisation       │     │          User            │
├─────────────────────────┤     ├─────────────────────────┤
│ id (PK)                 │◄────│ organisation_id (FK)     │
│ name                    │     │ id (PK)                  │
│ slug (unique)           │     │ email (unique)           │
│ logo                    │     │ first_name, last_name    │
│ address, phone          │     │ role (enum)              │
│ email, website          │     │ employment_status (enum) │
│ is_setup_complete       │     │ department_id (FK) ──────┼──┐
│ organogram_file         │     │ reports_to_id (self FK)  │  │
│ created_at, updated_at  │     │ phone, avatar, job_title │  │
└─────────────────────────┘     │ is_active (auto-synced)  │  │
                                │ created_at, updated_at   │  │
                                └─────────────────────────┘  │
                                                              │
┌─────────────────────────┐     ┌─────────────────────────┐  │
│      Department         │◄────│         Unit             │  │
├─────────────────────────┤     ├─────────────────────────┤  │
│ id (PK)                 │◄──┐ │ id (PK)                  │  │
│ name                    │   │ │ name                     │  │
│ organisation_id (FK)    │   │ │ department_id (FK)       │  │
│ parent_id (self FK)     │   │ └─────────────────────────┘  │
│ head_id (FK → User)     │   │                              │
│ unique: (name, org)     │◄──┼──────────────────────────────┘
└─────────────────────────┘   │
                              │ ┌─────────────────────────┐
                              │ │       Division           │
                              │ ├─────────────────────────┤
                              └─│ unit_id (FK)             │
                                │ name                     │
                                └─────────────────────────┘
```

**User Roles** (hierarchical):

| Role | Level | Description |
|------|-------|-------------|
| `STAFF` | 1 | Individual contributor |
| `MANAGER` | 2 | Team supervisor |
| `DEPT_HEAD` | 3 | Department leader |
| `EXECUTIVE` | 4 | C-suite / senior leadership |
| `BOARD_MEMBER` | 5 | Board oversight (read-only for operational data) |
| `ADMIN` | 6 | Platform administrator |

**Employment Status**: `ACTIVE` | `RESIGNED` | `TERMINATED` | `CONTRACT_ENDED`
- When status != ACTIVE, `is_active` is automatically set to `False` in the `save()` method, preventing login.

### 3.2 Tasks & Workflow

```
┌─────────────────────────┐     ┌─────────────────────────┐
│          Task            │     │       TaskOutput         │
├─────────────────────────┤     ├─────────────────────────┤
│ id (PK)                  │◄────│ task_id (FK)             │
│ task_id (auto: TK-0001)  │     │ submitted_by (FK→User)   │
│ title, description       │     │ file (FileField)         │
│ objectives               │     │ text_content             │
│ status (enum, 6 states)  │     │ created_at, updated_at   │
│ priority (enum)          │     └─────────────────────────┘
│ deadline                 │
│ deadline_type (enum)     │     ┌─────────────────────────┐
│ assigned_to (FK→User)    │     │       TaskReview         │
│ created_by (FK→User)     │     ├─────────────────────────┤
│ organisation_id (FK)     │◄────│ task_id (FK)             │
│ department_id (FK)       │     │ reviewer (FK→User)       │
│ project_id (FK)          │     │ action (APPROVED/        │
│ parent_task (self FK)    │     │   REJECTED/RETURNED)     │
│ linked_jd (FK→JD)       │     │ comment                  │
│ progress_percentage      │     │ created_at               │
│ created_at, updated_at   │     └─────────────────────────┘
└─────────────────────────┘
                                 ┌─────────────────────────┐
                                 │    TaskStatusChange      │
                                 ├─────────────────────────┤
                                 │ task_id (FK)             │
                                 │ from_status, to_status   │
                                 │ changed_by (FK→User)     │
                                 │ comment                  │
                                 │ timestamp (auto)         │
                                 └─────────────────────────┘
```

### 3.3 Messaging

```
┌─────────────────────────┐     ┌───────────────────────────┐
│     Conversation         │     │ ConversationParticipant   │
├─────────────────────────┤     ├───────────────────────────┤
│ id (PK)                  │◄────│ conversation_id (FK)      │
│ conversation_type        │     │ user_id (FK→User)         │
│   (TASK_THREAD/DIRECT/   │     │ unique: (convo, user)     │
│    GROUP)                │     └───────────────────────────┘
│ task_id (FK, nullable)   │
│ organisation_id (FK)     │     ┌─────────────────────────┐
│ created_by (FK→User)     │     │        Message           │
│ created_at, updated_at   │     ├─────────────────────────┤
└─────────────────────────┘◄────│ conversation_id (FK)     │
                                 │ sender (FK→User)         │
                                 │ content (text)           │
                                 │ is_read (boolean)        │
                                 │ organisation_id (FK)     │
                                 │ created_at, updated_at   │
                                 └─────────────────────────┘
                                 ⚠ Messages are IMMUTABLE:
                                   - No edit (PUT/PATCH → 403)
                                   - No delete (DELETE → 403)
```

### 3.4 Policies

```
┌─────────────────────────┐     ┌─────────────────────────┐
│    PolicyCategory        │     │         Policy           │
├─────────────────────────┤     ├─────────────────────────┤
│ id, name                 │◄────│ category_id (FK)         │
│ organisation_id (FK)     │     │ title, description       │
└─────────────────────────┘     │ organisation_id (FK)     │
                                │ current_version (int)    │
                                └──────────┬──────────────┘
                                           │
                                ┌──────────▼──────────────┐
                                │     PolicyVersion        │
                                ├─────────────────────────┤
                                │ policy_id (FK)           │
                                │ version_number           │
                                │ file (FileField)         │
                                │ uploaded_by (FK→User)    │
                                │ unique: (policy, version)│
                                └──────────┬──────────────┘
                                           │
                                ┌──────────▼──────────────┐
                                │  PolicyAcknowledgment    │
                                ├─────────────────────────┤
                                │ policy_version_id (FK)   │
                                │ user_id (FK→User)        │
                                │ acknowledged_at (auto)   │
                                │ unique: (version, user)  │
                                └─────────────────────────┘
```

### 3.5 Projects

```
┌─────────────────────────┐     ┌─────────────────────────┐
│        Project           │     │    ProjectDocument       │
├─────────────────────────┤     ├─────────────────────────┤
│ id (PK)                  │◄────│ project_id (FK)          │
│ name                     │     │ category (PD/BUDGET/     │
│ start_year, end_year     │     │   WORKPLAN/SCHEDULE/     │
│ department_id (FK)       │     │   RESULT_FRAMEWORK/      │
│ owner (FK→User)          │     │   SUPPORTING)            │
│ status (ACTIVE/ON_HOLD/  │     │ file (FileField)         │
│   COMPLETED/CANCELLED)   │     │ uploaded_by (FK→User)    │
│ organisation_id (FK)     │     │ version (default=1)      │
│ created_at, updated_at   │     └─────────────────────────┘
└──────────┬──────────────┘
           │                     ┌─────────────────────────┐
           ├────────────────────►│   ProjectMilestone       │
           │                     ├─────────────────────────┤
           │                     │ project_id (FK)          │
           │                     │ title, description       │
           │                     │ deadline (date)          │
           │                     │ is_completed             │
           │                     │ completed_at (nullable)  │
           │                     └─────────────────────────┘
           │
           └────────────────────►┌─────────────────────────┐
                                 │    ProjectReport         │
                                 ├─────────────────────────┤
                                 │ project_id (FK)          │
                                 │ title, content           │
                                 │ period_start, period_end │
                                 │ is_ai_generated          │
                                 │ created_by (FK→User)     │
                                 └─────────────────────────┘
```

### 3.6 Audit, Notifications & Other Tables

```
┌─────────────────────────┐     ┌─────────────────────────┐
│       AuditLog           │     │      Notification        │
├─────────────────────────┤     ├─────────────────────────┤
│ id (PK)                  │     │ id (PK)                  │
│ event_type               │     │ user_id (FK→User)        │
│ event_category           │     │ organisation_id (FK)     │
│ user_id (FK, nullable)   │     │ notification_type        │
│ organisation_id (FK)     │     │ title, message           │
│ description              │     │ is_read                  │
│ entity_type, entity_id   │     │ entity_type, entity_id   │
│ metadata (JSONField)     │     │ created_at, updated_at   │
│ timestamp (auto, final)  │     └─────────────────────────┘
│ ⚠ IMMUTABLE: no update   │
│   or delete allowed      │     ┌─────────────────────────┐
└─────────────────────────┘     │    DeletionRequest       │
                                ├─────────────────────────┤
┌─────────────────────────┐     │ document_type            │
│     BillingProfile       │     │ document_id              │
├─────────────────────────┤     │ requested_by (FK→User)   │
│ organisation (1:1)       │     │ reason                   │
│ contact_name             │     │ status (PENDING/APPROVED/│
│ billing_email            │     │   REJECTED/EXECUTED)     │
│ plan_tier (BASIC/PRO/    │     │ approved_by (FK→User)    │
│   ENTERPRISE)            │     │ organisation_id (FK)     │
│ billing_cycle            │     │ resolved_at (nullable)   │
│ payment_status           │     └─────────────────────────┘
│ gateway_customer_id      │
└─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│     JobDescription       │     │       JDVersion          │
├─────────────────────────┤     ├─────────────────────────┤
│ title, role_title        │◄────│ job_description_id (FK)  │
│ department_id (FK)       │     │ version_number           │
│ organisation_id (FK)     │     │ file (FileField)         │
│ current_version          │     │ content_text             │
│ linked_user (FK→User)    │     │ uploaded_by (FK→User)    │
└─────────────────────────┘     │ is_ai_generated          │
                                └─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│       TimeLog            │     │      ActivityLog         │
├─────────────────────────┤     ├─────────────────────────┤
│ user_id (FK)             │     │ user_id (FK)             │
│ task_id (FK)             │     │ activity_type (DESK_WORK/│
│ started_at, ended_at     │     │   FIELD_WORK/MEETING)    │
│ organisation_id (FK)     │     │ started_at, ended_at     │
└─────────────────────────┘     │ organisation_id (FK)     │
                                └─────────────────────────┘
┌─────────────────────────┐
│       BreakLog           │     ┌─────────────────────────┐
├─────────────────────────┤     │       AIOutput           │
│ user_id (FK)             │     ├─────────────────────────┤
│ break_type (LUNCH/       │     │ output_type (JD_DRAFT/   │
│   STEP_OUT/ANNUAL_LEAVE/ │     │   COACHING_TIP/SUMMARY/  │
│   SICK_LEAVE)            │     │   REPORT_DRAFT/NL_SEARCH)│
│ started_at, ended_at     │     │ user_id (FK)             │
│ organisation_id (FK)     │     │ organisation_id (FK)     │
└─────────────────────────┘     │ input_data (JSON)        │
                                │ output_content (text)    │
                                │ entity_type, entity_id   │
                                └─────────────────────────┘
```

---

## 4. Multi-Tenancy & Data Isolation

Appraiser uses **row-level organisation scoping** — every data model that stores tenant-specific data has an `organisation` foreign key.

### How It Works

**1. Every domain model includes an organisation FK:**
```python
class Task(TimeStampedModel):
    organisation = models.ForeignKey("organisations.Organisation", on_delete=models.CASCADE)
    # ... other fields
```

**2. ViewSets filter querysets by the requesting user's organisation:**
```python
class TaskViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Task.objects.filter(organisation=self.request.user.organisation)
```

**3. The `IsOrganisationMember` permission class enforces this at the permission layer:**
```python
class IsOrganisationMember(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.organisation is not None

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'organisation'):
            return obj.organisation == request.user.organisation
        return True
```

**4. On creation, the organisation is set automatically:**
```python
def perform_create(self, serializer):
    serializer.save(organisation=self.request.user.organisation)
```

### Isolation Guarantee

- Users can **never** read, update, or delete data belonging to another organisation
- The `CASCADE` delete on organisation FK ensures all tenant data is removed when an organisation is deleted
- Dashboard stats, task lists, messaging, policies — all are scoped to `request.user.organisation`
- Even the `UserViewSet` filters: `User.objects.filter(organisation=self.request.user.organisation)`

### Role-Based Data Scoping (within an organisation)

Beyond organisation isolation, some endpoints further scope data by role:

```python
# Task ViewSet — role-based queryset scoping
def get_queryset(self):
    user = self.request.user
    qs = Task.objects.filter(organisation=user.organisation)

    if user.role == 'STAFF':
        # Staff see only tasks assigned to them
        qs = qs.filter(assigned_to=user)
    elif user.role == 'MANAGER':
        # Managers see their own + direct reports' + created tasks
        direct_report_ids = user.direct_reports.values_list('id', flat=True)
        qs = qs.filter(
            Q(assigned_to=user) |
            Q(assigned_to__in=direct_report_ids) |
            Q(created_by=user)
        )
    # DEPT_HEAD, EXECUTIVE, BOARD_MEMBER, ADMIN see all org tasks

    return qs
```

---

## 5. Authentication & Authorization

### JWT Token Flow

```
Client                              Server
  │                                    │
  │  POST /api/v1/auth/token/          │
  │  { email, password }               │
  │───────────────────────────────────►│
  │                                    │  Validates credentials
  │                                    │  Creates AuditLog (user_login)
  │  { access: "...", refresh: "..." } │
  │◄───────────────────────────────────│
  │                                    │
  │  GET /api/v1/tasks/tasks/          │
  │  Authorization: Bearer <access>    │
  │───────────────────────────────────►│
  │                                    │  SimpleJWT validates token
  │                                    │  Permission classes check role
  │  { results: [...] }               │
  │◄───────────────────────────────────│
  │                                    │
  │  POST /api/v1/auth/token/refresh/  │
  │  { refresh: "..." }               │  (when access token expires)
  │───────────────────────────────────►│
  │  { access: "new_token" }          │  Old refresh token blacklisted
  │◄───────────────────────────────────│
```

**Token Configuration:**
- Access token lifetime: **60 minutes**
- Refresh token lifetime: **7 days**
- Token rotation: enabled (new refresh token on each refresh)
- Blacklisting: enabled (prevents refresh token reuse)

### Permission Classes

| Permission Class | Allowed Roles | Usage |
|-----------------|--------------|-------|
| `IsOrganisationMember` | Any authenticated user with an org | Base for all tenant endpoints |
| `IsAdmin` | ADMIN | User creation, org settings, billing |
| `IsManagerOrAbove` | MANAGER, DEPT_HEAD, EXECUTIVE, BOARD_MEMBER, ADMIN | User updates, task reviews |
| `IsDeptHeadOrAbove` | DEPT_HEAD, EXECUTIVE, BOARD_MEMBER, ADMIN | Department management |
| `IsExecutiveOrAbove` | EXECUTIVE, BOARD_MEMBER, ADMIN | Accountability views |
| `IsManagerOrAboveExcludingBoard` | MANAGER, DEPT_HEAD, EXECUTIVE, ADMIN | Operational mutations (board is read-only) |

### RBAC Enforcement Examples

```python
class UserViewSet(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [IsAuthenticated(), IsAdmin()]           # Only admins create/delete users
        if self.action in ["update", "partial_update"]:
            return [IsAuthenticated(), IsManagerOrAbove()]   # Managers+ can edit users
        return super().get_permissions()                     # Default: authenticated + org member
```

---

## 6. API Structure & Endpoints

All endpoints follow the pattern: `GET /api/v1/{app}/{resource}/`

### 6.1 Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/token/` | Login (returns JWT pair) | Public |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh access token | Public |
| `POST` | `/api/v1/auth/token/verify/` | Verify token validity | Public |
| `POST` | `/api/v1/auth/token/blacklist/` | Logout (blacklist refresh) | Public |
| `POST` | `/api/v1/accounts/signup/` | Register new organisation | Public |
| `POST` | `/api/v1/accounts/password-reset/` | Request password reset | Public |
| `POST` | `/api/v1/accounts/password-reset/confirm/` | Confirm password reset | Public |

### 6.2 Users & Organisation

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/v1/accounts/users/` | List org users | Org member |
| `GET` | `/api/v1/accounts/users/me/` | Current user profile | Authenticated |
| `POST` | `/api/v1/accounts/users/` | Invite new user | Admin only |
| `PATCH` | `/api/v1/accounts/users/{id}/` | Update user | Manager+ |
| `POST` | `/api/v1/accounts/users/{id}/change-status/` | Change employment status | Manager+ |
| `GET` | `/api/v1/organisations/my-org/` | Current org details | Org member |
| `PATCH` | `/api/v1/organisations/organisations/{id}/` | Update org | Admin |
| `GET/POST` | `/api/v1/organisations/departments/` | Department CRUD | Manager+ |
| `GET/POST` | `/api/v1/organisations/reporting-lines/` | Reporting structure | Manager+ |

### 6.3 Tasks

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/v1/tasks/tasks/` | List tasks (role-scoped) | Org member |
| `POST` | `/api/v1/tasks/tasks/` | Create task | Org member |
| `GET` | `/api/v1/tasks/tasks/{id}/` | Task detail with outputs | Org member |
| `POST` | `/api/v1/tasks/tasks/{id}/transition/` | Change task status | Org member |
| `POST` | `/api/v1/tasks/tasks/{id}/submit-output/` | Submit work output | Assignee |
| `POST` | `/api/v1/tasks/tasks/{id}/review/` | Approve/reject/return | Manager+ |
| `GET` | `/api/v1/tasks/task-status-changes/` | Status change history | Org member |

**Filters available:** `status`, `priority`, `assigned_to`, `department`, `deadline_type`
**Search fields:** `title`, `description`, `task_id`
**Ordering:** `created_at`, `deadline`, `status`, `priority`

### 6.4 Messaging

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/v1/messaging/conversations/` | List conversations | Org member |
| `GET/POST` | `/api/v1/messaging/messages/` | List/send messages | Org member |
| `POST` | `/api/v1/messaging/messages/{id}/mark-read/` | Mark message read | Org member |
| `POST` | `/api/v1/messaging/direct/` | Send direct message | Org member |
| `POST` | `/api/v1/messaging/broadcast/` | Broadcast to group | Manager+ |
| `DELETE` | `/api/v1/messaging/messages/{id}/` | **BLOCKED (403)** | — |
| `PUT/PATCH` | `/api/v1/messaging/messages/{id}/` | **BLOCKED (403)** | — |

### 6.5 Policies

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET/POST` | `/api/v1/policies/policies/` | Policy CRUD | Manager+ (write) |
| `POST` | `/api/v1/policies/policies/{id}/upload-version/` | Upload new version | Manager+ |
| `POST` | `/api/v1/policies/policy-acknowledgments/` | Acknowledge policy | Org member |
| `GET/POST` | `/api/v1/policies/policy-categories/` | Manage categories | Manager+ |

### 6.6 Projects

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET/POST` | `/api/v1/projects/projects/` | Project CRUD | Org member |
| `GET/POST` | `/api/v1/projects/project-documents/` | Upload documents | Org member |
| `GET/POST` | `/api/v1/projects/project-milestones/` | Milestone CRUD | Org member |
| `GET/POST` | `/api/v1/projects/project-reports/` | Report CRUD | Org member |

### 6.7 Other Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/v1/core/dashboard/` | Role-scoped dashboard stats | Authenticated |
| `GET` | `/api/v1/core/status/` | Health check | Public |
| `GET` | `/api/v1/audit/audit-logs/` | Audit log (read-only) | Dept head+ |
| `GET/POST` | `/api/v1/attention/time-logs/` | Time tracking | Org member |
| `GET/POST` | `/api/v1/attention/activity-logs/` | Activity logging | Org member |
| `GET/POST` | `/api/v1/attention/break-logs/` | Break logging | Org member |
| `GET/POST` | `/api/v1/jd-management/job-descriptions/` | JD management | Manager+ |
| `GET` | `/api/v1/jd-management/my-jd/` | Current user's JD | Authenticated |
| `POST` | `/api/v1/ai-tools/chat/` | AI chat assistant | Org member |
| `POST` | `/api/v1/ai-tools/generate-jd/` | AI JD generation | Manager+ |
| `GET` | `/api/v1/notifications/notifications/` | User notifications | Authenticated |
| `GET/POST` | `/api/v1/document-retention/deletion-requests/` | Deletion requests | Org member |
| `GET/POST` | `/api/v1/billing/billing-profiles/` | Billing management | Admin |

---

## 7. Audit Trail Implementation

The audit system provides an **immutable, append-only log** of all significant events in the platform.

### AuditLog Model

```python
class AuditLog(models.Model):
    event_type = models.CharField(max_length=100)       # e.g., "user_login"
    event_category = models.CharField(max_length=50)    # e.g., "AUTHENTICATION"
    user = models.ForeignKey(User, null=True)            # Who did it
    organisation = models.ForeignKey(Organisation)       # Which org
    description = models.TextField()                     # Human-readable
    entity_type = models.CharField(max_length=50)        # e.g., "task"
    entity_id = models.IntegerField(null=True)           # PK of affected record
    metadata = models.JSONField(default=dict)            # Structured extra data
    timestamp = models.DateTimeField(auto_now_add=True)  # Immutable timestamp
```

### Immutability Enforcement

```python
class AuditLog(models.Model):
    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("Audit logs cannot be modified after creation.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Audit logs cannot be deleted.")
```

### Event Categories & Triggers

| Category | Event Types | Trigger Location |
|----------|------------|-----------------|
| **AUTHENTICATION** | `user_login`, `user_logout`, `login_failed`, `password_reset_requested`, `password_reset_completed` | `AuditedTokenObtainPairView`, `AuditedTokenBlacklistView`, password reset views |
| **USER_MANAGEMENT** | `user_account_created`, `user_role_changed`, `employment_status_change`, `account_created` | `UserViewSet.perform_create`, `perform_update`, `change_employment_status`, `signup` |
| **TASK** | `task_created`, `task_assigned`, `task_submitted`, `task_approved`, `task_rejected`, `task_status_changed`, `task_deadline_changed` | `TaskViewSet.perform_create`, `perform_update`, `transition`, `submit_output`, `review` |
| **PROJECT** | `project_created`, `project_document_uploaded`, `milestone_created`, `milestone_completed` | `ProjectViewSet`, `ProjectDocumentViewSet`, `ProjectMilestoneViewSet` |
| **POLICY** | `policy_created`, `policy_version_uploaded`, `policy_acknowledged` | `PolicyViewSet`, `PolicyAcknowledgmentViewSet` |
| **DOCUMENT** | `jd_created`, `jd_version_uploaded` | `JobDescriptionViewSet`, `JDVersionViewSet` |
| **ADMINISTRATIVE** | `org_updated`, `organogram_uploaded`, `department_created`, `department_updated` | `OrganisationViewSet`, `DepartmentViewSet` |

### Audit Log API

The audit log is exposed as a **read-only** API:

```python
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsOrganisationMember, IsDeptHeadOrAbove]
```

**Filters:** `event_type`, `event_category`, `user`, `entity_type`, `date_from`, `date_to`

Department heads see logs filtered to their department's users. Executives and admins see all org logs.

---

## 8. Task Workflow Engine

### State Machine

```
         ┌──────────┐
         │ CREATED  │
         └────┬─────┘
              │ assign
         ┌────▼─────┐
    ┌────►│ ASSIGNED │
    │     └────┬─────┘
    │          │ start
    │     ┌────▼────────┐
    │     │ IN_PROGRESS  │◄─────────────────────┐
    │     └────┬─────────┘                       │
    │          │ submit output                   │ return / reject
    │     ┌────▼─────┐                           │
    │     │SUBMITTED │───────────────────────────┘
    │     └────┬─────┘
    │          │ approve
    │     ┌────▼─────┐
    │     │ REVIEWED  │──────────┐
    │     └────┬─────┘           │ revert
    │          │ close           │ (manager only)
    │     ┌────▼─────┐           │
    │     │  CLOSED   │           │
    │     └──────────┘     ┌─────▼──────┐
    │                      │IN_PROGRESS │
    └──────────────────────┘            │
         (unassign)                     │
                                        └─(continues cycle)
```

### Transition Validation

```python
VALID_TRANSITIONS = {
    "CREATED":     ["ASSIGNED"],
    "ASSIGNED":    ["IN_PROGRESS", "CREATED"],      # Can unassign
    "IN_PROGRESS": ["SUBMITTED"],
    "SUBMITTED":   ["REVIEWED", "IN_PROGRESS"],     # Approve or return
    "REVIEWED":    ["CLOSED", "IN_PROGRESS"],        # Close or revert
    "CLOSED":      [],                               # Terminal state
}
```

Every transition:
1. Validates against `VALID_TRANSITIONS`
2. Creates a `TaskStatusChange` record
3. Creates an `AuditLog` entry
4. Managers+ can force backward transitions

### Submit Output Flow

```
POST /api/v1/tasks/tasks/{id}/submit-output/

1. Validates task status == IN_PROGRESS
2. Accepts: file (multipart) + text_content
3. Creates TaskOutput record (submitted_by = request.user)
4. Transitions task: IN_PROGRESS → SUBMITTED
5. Creates TaskStatusChange record
6. Creates AuditLog (event_type="task_submitted")
7. Returns updated task with nested outputs
```

### Review Flow

```
POST /api/v1/tasks/tasks/{id}/review/

1. Validates task status == SUBMITTED
2. Validates reviewer is Manager+
3. Accepts: action (APPROVED|REJECTED|RETURNED), comment
4. Creates TaskReview record
5. Transitions task:
   - APPROVED → SUBMITTED → REVIEWED
   - REJECTED/RETURNED → SUBMITTED → IN_PROGRESS
6. Creates TaskStatusChange + AuditLog
7. Returns updated task
```

---

## 9. Messaging (Immutable Records)

Per SOW Section 3.5: *"All messages are stored as permanent institutional records — end users cannot delete messages."*

### Enforcement

```python
class MessageViewSet(viewsets.ModelViewSet):
    def destroy(self, request, *args, **kwargs):
        """Messages cannot be deleted — permanent institutional records."""
        return Response(
            {"error": "Messages are permanent institutional records and cannot be deleted."},
            status=status.HTTP_403_FORBIDDEN
        )

    def update(self, request, *args, **kwargs):
        """Messages cannot be edited."""
        return Response(
            {"error": "Messages cannot be edited."},
            status=status.HTTP_403_FORBIDDEN
        )

    def partial_update(self, request, *args, **kwargs):
        """Messages cannot be edited."""
        return Response(
            {"error": "Messages cannot be edited."},
            status=status.HTTP_403_FORBIDDEN
        )
```

The same pattern applies to `ConversationViewSet.destroy()` — conversations cannot be deleted.

### Message Features
- **Searchable**: Full-text search across all messages within the organisation
- **Timestamped**: Every message has an immutable `created_at` timestamp
- **Sender tracked**: `sender` FK ensures accountability
- **Organisation scoped**: Messages filtered by `organisation_id`

---

## 10. File Storage & Uploads

### Storage Configuration

```python
# Production: AWS S3
if AWS_STORAGE_BUCKET_NAME:
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
    }
    AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"
    AWS_DEFAULT_ACL = None
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}

# Development: Local filesystem
else:
    MEDIA_ROOT = BASE_DIR / "media"
    MEDIA_URL = "/media/"
```

### Upload Paths by Content Type

| Content | Upload Path | Allowed Formats | Max Size |
|---------|------------|-----------------|----------|
| User avatars | `avatars/` | Images | — |
| Organisation logos | `org_logos/` | Images | — |
| Policy documents | `policies/` | PDF, DOCX, DOC | — |
| Project documents | `project_documents/` | Any | — |
| Task outputs | `task_outputs/` | PDF, DOCX, DOC, Images | 25 MB |
| JD versions | `jd_versions/` | PDF, DOCX, DOC | — |
| Organogram files | Cloudinary (external) | PDF, Images | 20 MB |

### File Validation Example (Task Outputs)

```python
def validate_file(self, value):
    if value:
        ext = os.path.splitext(value.name)[1].lower()
        allowed = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.gif', '.webp']
        if ext not in allowed:
            raise serializers.ValidationError("Only PDF, DOCX, and image files are allowed.")
        if value.size > 25 * 1024 * 1024:
            raise serializers.ValidationError("File must be under 25MB.")
    return value
```

---

## 11. Caching, Task Queue & WebSockets

### Redis Cache

```python
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,      # redis://redis:6379/0
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}
```

### Celery Task Queue

```python
# config/celery.py
app = Celery("appraiser")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()    # Auto-discovers tasks.py in all apps
```

Configuration:
- Broker: Redis
- Result backend: Redis
- Serializer: JSON
- Timezone: UTC

Used for: async document processing, deletion request execution, notification delivery.

### Django Channels (WebSockets)

```python
ASGI_APPLICATION = "config.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    },
}
```

Used for: real-time messaging updates, live notification delivery.

---

## 12. AI Integration

The AI module uses **OpenRouter API** (routing to Claude Sonnet 4) for content generation.

### Capabilities

| Output Type | Description | Endpoint |
|------------|-------------|----------|
| `JD_DRAFT` | Generate job descriptions from role requirements | `/ai-tools/generate-jd/` |
| `COACHING_TIP` | Productivity coaching suggestions | `/ai-tools/chat/` |
| `TASK_SUMMARY` | Summarize task history and outputs | `/ai-tools/chat/` |
| `PROJECT_SUMMARY` | Project progress narrative | `/ai-tools/chat/` |
| `MILESTONE_EXTRACTION` | Extract milestones from documents | `/ai-tools/chat/` |
| `REPORT_DRAFT` | Draft project reports | `/ai-tools/chat/` |
| `NL_SEARCH` | Natural language search across data | `/ai-tools/chat/` |

All AI outputs are stored in the `AIOutput` model with input/output tracking, and are associated with a specific user and organisation.

---

## 13. Deployment Architecture

### Production Stack

```
                    ┌─────────────┐
                    │   Nginx     │  (reverse proxy, SSL/TLS)
                    │  :80/:443   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
     ┌────────▼────────┐    ┌──────────▼──────────┐
     │   Next.js App   │    │   Django/Gunicorn    │
     │   (Frontend)    │    │   (Backend API)      │
     │   :3000         │    │   :8000              │
     │   Node 22       │    │   4 workers          │
     │   512MB / 0.5CPU│    │   1GB / 1.0CPU       │
     └─────────────────┘    └──────────┬───────────┘
                                       │
                          ┌────────────┼────────────┐
                          │                         │
                 ┌────────▼────────┐    ┌──────────▼──────────┐
                 │  PostgreSQL 17  │    │     Redis 7          │
                 │  (Database)     │    │  (Cache + Broker)    │
                 │  :5432          │    │  :6379               │
                 └─────────────────┘    └──────────────────────┘
                                                   │
                                        ┌──────────▼──────────┐
                                        │   Celery Worker      │
                                        │  (Async tasks)       │
                                        └──────────────────────┘

                                        ┌──────────────────────┐
                                        │      AWS S3          │
                                        │  (File storage)      │
                                        └──────────────────────┘
```

### Resource Limits (Production)

| Service | Memory | CPU | Health Check |
|---------|--------|-----|-------------|
| Backend (Gunicorn) | 1 GB | 1.0 | Every 30s |
| Frontend (Next.js) | 512 MB | 0.5 | Every 30s |
| PostgreSQL | 512 MB | 0.5 | Every 10s |
| Redis | 256 MB | 0.25 | Every 10s |

### Environment Variables

```
# Application
SECRET_KEY, DEBUG, DJANGO_SETTINGS_MODULE

# Database
POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT

# Cache & Queue
REDIS_URL, REDIS_PASSWORD

# Storage
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_STORAGE_BUCKET_NAME, AWS_S3_REGION_NAME

# Auth & CORS
DJANGO_ALLOWED_HOSTS, DJANGO_CORS_ALLOWED_ORIGINS, DJANGO_CSRF_TRUSTED_ORIGINS
FRONTEND_URL (for password reset / invite links)

# AI
OPENROUTER_API_KEY, OPENROUTER_MODEL

# Monitoring
SENTRY_DSN, SENTRY_ENVIRONMENT

# Email
EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS
```

---

## Key Design Patterns Summary

| Pattern | Implementation |
|---------|---------------|
| **Multi-tenancy** | Row-level org FK + `IsOrganisationMember` permission |
| **Immutable records** | `save()`/`delete()` overrides on AuditLog; 403 on Message edit/delete |
| **State machine** | `VALID_TRANSITIONS` dict with validation in `transition_status()` |
| **Base model** | `TimeStampedModel` abstract class for `created_at`/`updated_at` |
| **Role hierarchy** | Permission classes like `IsManagerOrAbove` checking role membership |
| **Audit on write** | `AuditLog.objects.create()` in every `perform_create`/`perform_update` |
| **Version tracking** | `PolicyVersion`, `JDVersion` with auto-incrementing version numbers |
| **Soft deactivation** | Employment status auto-syncs `is_active` flag — no hard deletes |
