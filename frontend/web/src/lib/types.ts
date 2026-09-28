// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

// ─── User ────────────────────────────────────────────────────────────────────

export type UserRole =
  | "STAFF"
  | "MANAGER"
  | "DEPT_HEAD"
  | "EXECUTIVE"
  | "BOARD_MEMBER"
  | "ADMIN";

export type EmploymentStatus =
  | "ACTIVE"
  | "PROBATION"
  | "PROMOTED"
  | "DEMOTED"
  | "SUSPENDED"
  | "RESIGNED"
  | "TERMINATED"
  | "CONTRACT_ENDED";

export interface User {
  id: number;
  email: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name?: string;
  role: UserRole;
  employment_status: EmploymentStatus;
  organisation: number | null;
  department: number | null;
  reports_to: number | null;
  phone: string;
  avatar: string | null;
  job_title: string;
  succeeded_by: number | null;
  succeeded_by_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Organisation ────────────────────────────────────────────────────────────

export interface Organisation {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  address: string;
  phone: string;
  email: string;
  website: string;
  is_setup_complete: boolean;
  organogram_file: string | null;
  organogram_parse_status: "NOT_PARSED" | "PARSING" | "PARSED" | "FAILED";
  organogram_structure: {
    departments?: Array<{ name: string; units?: string[]; divisions?: string[] }>;
    reporting_lines?: Array<{ supervisor_title: string; subordinate_title: string }>;
    notes?: string[];
    raw_output?: string;
  } | null;
  organogram_parsed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: number;
  name: string;
  organisation: number;
  parent: number | null;
  head: number | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: number;
  name: string;
  department: number;
  created_at: string;
  updated_at: string;
}

export interface Division {
  id: number;
  name: string;
  unit: number;
  created_at: string;
  updated_at: string;
}

export interface ReportingLine {
  id: number;
  subordinate: number;
  supervisor: number;
  organisation: number;
  created_at: string;
  updated_at: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "CREATED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "REVIEWED"
  | "CLOSED";

export type DeadlineType = "DAILY" | "WEEKLY" | "MONTHLY";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Task {
  id: number;
  task_id: string;
  title: string;
  description: string;
  objectives: string;
  deadline: string | null;
  deadline_type: DeadlineType;
  status: TaskStatus;
  assigned_to: number | null;
  assigned_to_name?: string;
  created_by: number;
  created_by_name?: string;
  organisation: number;
  department: number | null;
  department_name?: string;
  project: number | null;
  parent_task: number | null;
  linked_jd: number | null;
  progress_percentage: number;
  priority: TaskPriority;
  is_inherited?: boolean;
  inherited_from_name?: string | null;
  outputs?: TaskOutput[];
  reviews?: TaskReview[];
  created_at: string;
  updated_at: string;
}

export interface TaskOutput {
  id: number;
  task: number;
  submitted_by: number;
  submitted_by_name: string | null;
  file: string | null;
  text_content: string;
  created_at: string;
  updated_at: string;
}

export type TaskReviewAction = "APPROVED" | "REJECTED" | "RETURNED";

export interface TaskReview {
  id: number;
  task: number;
  reviewer: number;
  reviewer_name?: string | null;
  action: TaskReviewAction;
  comment: string;
  created_at: string;
}

export interface TaskStatusChange {
  id: number;
  task: number;
  from_status: TaskStatus;
  to_status: TaskStatus;
  changed_by: number;
  comment: string;
  timestamp: string;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export interface Project {
  id: number;
  name: string;
  start_year: number;
  end_year: number;
  department: number | null;
  department_name: string | null;
  owner: number;
  owner_name: string | null;
  status: ProjectStatus;
  organisation: number;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
  total_milestones: number;
  completed_milestones: number;
  total_tasks: number;
}

export type ProjectDocumentCategory =
  | "PD"
  | "BUDGET"
  | "WORKPLAN"
  | "SCHEDULE"
  | "RESULT_FRAMEWORK"
  | "SUPPORTING";

export interface ProjectDocument {
  id: number;
  project: number;
  category: ProjectDocumentCategory;
  file: string;
  uploaded_by: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: number;
  project: number;
  title: string;
  description: string;
  deadline: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectReport {
  id: number;
  project: number;
  title: string;
  content: string;
  period_start: string;
  period_end: string;
  is_ai_generated: boolean;
  is_draft: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// ─── Policies ────────────────────────────────────────────────────────────────

export interface PolicyCategory {
  id: number;
  name: string;
  organisation: number | null;
  created_at: string;
  updated_at: string;
}

export interface Policy {
  id: number;
  title: string;
  description: string;
  category: number | null;
  organisation: number;
  current_version: number;
  versions?: PolicyVersion[];
  acknowledgment_count?: number;
  total_staff?: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyVersion {
  id: number;
  policy: number;
  version_number: number;
  file: string | null;
  uploaded_by: number;
  uploaded_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyAcknowledgment {
  id: number;
  policy_version: number;
  user: number;
  acknowledged_at: string;
  created_at: string;
  updated_at: string;
}

// ─── Job Descriptions ────────────────────────────────────────────────────────

export interface JDVersion {
  id: number;
  job_description: number;
  version_number: number;
  file: string | null;
  content_text: string;
  uploaded_by: number;
  uploaded_by_name?: string;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobDescription {
  id: number;
  title: string;
  department: number | null;
  role_title: string;
  organisation: number;
  current_version: number;
  linked_user: number | null;
  linked_user_name?: string;
  versions?: JDVersion[];
  created_at: string;
  updated_at: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  user: number;
  organisation: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  entity_type: string;
  entity_id: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export type ConversationType = "TASK_THREAD" | "DIRECT" | "GROUP";

export interface ConversationParticipantDetail {
  id: number;
  name: string;
  email: string;
}

export interface ConversationLastMessage {
  content: string;
  sender_name: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  conversation_type: ConversationType;
  task: number | null;
  organisation: number;
  created_by: number;
  participants_detail: ConversationParticipantDetail[];
  last_message: ConversationLastMessage | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: number;
  conversation: number;
  user: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation: number;
  sender: number;
  sender_name: string;
  content: string;
  is_read: boolean;
  organisation: number;
  created_at: string;
  updated_at: string;
  is_editable?: boolean | null;
  edited?: boolean;
}

// ─── Attention / Time Tracking ───────────────────────────────────────────────

export interface TimeLog {
  id: number;
  user: number;
  task: number;
  started_at: string;
  ended_at: string | null;
  organisation: number;
  created_at: string;
  updated_at: string;
}

export type ActivityType = "DESK_WORK" | "FIELD_WORK" | "MEETING";

export interface ActivityLog {
  id: number;
  user: number;
  activity_type: ActivityType;
  started_at: string;
  ended_at: string | null;
  organisation: number;
  created_at: string;
  updated_at: string;
}

export type BreakType = "LUNCH" | "STEP_OUT" | "ANNUAL_LEAVE" | "SICK_LEAVE";

export interface BreakLog {
  id: number;
  user: number;
  break_type: BreakType;
  started_at: string;
  ended_at: string | null;
  organisation: number;
  created_at: string;
  updated_at: string;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditEventCategory =
  | "TASK"
  | "PROJECT"
  | "DOCUMENT"
  | "POLICY"
  | "USER_MANAGEMENT"
  | "AUTHENTICATION"
  | "ADMINISTRATIVE";

export interface AuditLog {
  id: number;
  event_type: string;
  event_category: AuditEventCategory;
  user: number | null;
  user_name: string;
  organisation: number;
  description: string;
  entity_type: string;
  entity_id: number | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export type PlanTier = "BASIC" | "PROFESSIONAL" | "ENTERPRISE";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type PaymentStatus = "ACTIVE" | "PENDING" | "OVERDUE" | "CANCELLED";

export interface BillingProfile {
  id: number;
  organisation: number;
  organisation_name?: string;
  contact_name: string;
  billing_email: string;
  address: string;
  plan_tier: PlanTier;
  billing_cycle: BillingCycle;
  payment_status: PaymentStatus;
  card_last_four: string;
  card_brand: string;
  created_at: string;
  updated_at: string;
}

// ─── AI Tools ────────────────────────────────────────────────────────────────

export type AIOutputType =
  | "JD_DRAFT"
  | "COACHING_TIP"
  | "TASK_SUMMARY"
  | "PROJECT_SUMMARY"
  | "MILESTONE_EXTRACTION"
  | "REPORT_DRAFT"
  | "NL_SEARCH"
  | "POLICY_DESCRIPTION";

export interface AIOutput {
  id: number;
  output_type: AIOutputType;
  user: number;
  organisation: number;
  input_data: Record<string, unknown>;
  output_content: string;
  is_draft: boolean;
  entity_type: string;
  entity_id: number | null;
  created_at: string;
  updated_at: string;
}

// ─── PMCS (Performance Management & Compliance System) ───────────────────────

export interface InstitutionalPerformanceObjective {
  id: number;
  title: string;
  description: string;
  file: string;
  period: string;
  uploaded_by: number | null;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PMCSKpiTarget {
  id: number;
  metric: "TASK_COMPLETION_RATE" | "ON_TIME_DELIVERY" | "DEPT_PRODUCTIVITY";
  period: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  department: number | null;
  department_name: string;
  target: number;
  actual: number;
  status: "green" | "amber" | "red";
}

export interface PMCSPayload {
  execution_score: number;
  on_time_rate: number;
  department_performance: {
    id: number;
    name: string;
    completion_pct: number;
    task_total: number;
  }[];
  projects: {
    id: number;
    name: string;
    status: string;
    health: "ON_TRACK" | "DELAYED" | "CRITICAL";
    completion_pct: number;
    department_id: number | null;
  }[];
  alerts: {
    type: "overdue_task" | "delayed_milestone";
    task_id?: number;
    milestone_id?: number;
    task_label?: string;
    title: string;
    deadline: string | null;
    department_id?: number | null;
    department_name?: string;
    project_id?: number;
    project_name?: string;
  }[];
  kpi_targets: PMCSKpiTarget[];
  generated_at: string;
}

// ─── Document Retention ──────────────────────────────────────────────────────

export type DeletionRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";

export interface DeletionRequest {
  id: number;
  document_type: string;
  document_id: number;
  document_description?: string;
  requested_by: number;
  requested_by_name?: string;
  reason: string;
  status: DeletionRequestStatus;
  approved_by: number | null;
  approved_by_name?: string;
  organisation: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Paginated Response ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
