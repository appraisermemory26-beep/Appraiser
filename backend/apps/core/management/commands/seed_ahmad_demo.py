"""
Seed rich demo data into the existing organisation owned by ahmad@credminds.com.

Idempotent: skips users/depts/policies/etc. that already exist by natural key, but
re-creates volatile time-series data (audit log, notifications, messages, time logs)
on each run unless --skip-existing is passed.

Usage:
    docker compose exec backend python manage.py seed_ahmad_demo
"""

from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.attention.models import ActivityLog, BreakLog, TimeLog
from apps.audit.models import AuditLog
from apps.billing.models import BillingProfile
from apps.core.models import KPITarget
from apps.document_retention.models import DeletionRequest
from apps.jd_management.models import JDVersion, JobDescription
from apps.messaging.models import Conversation, ConversationParticipant, Message
from apps.notifications.models import Notification
from apps.organisations.models import Department, Unit
from apps.policies.models import (
    Policy,
    PolicyAcknowledgment,
    PolicyCategory,
    PolicyVersion,
)
from apps.projects.models import Project, ProjectDocument, ProjectMilestone, ProjectReport
from apps.tasks.models import Task, TaskOutput, TaskReview, TaskStatusChange


ADMIN_EMAIL = "ahmad@credminds.com"
DEMO_PASSWORD = "Demo@2026"


class Command(BaseCommand):
    help = "Seed rich demo data into ahmad@credminds.com's existing organisation."

    def handle(self, *args, **options):
        try:
            ahmad = User.objects.get(email=ADMIN_EMAIL)
        except User.DoesNotExist:
            raise CommandError(f"User {ADMIN_EMAIL} not found.")

        org = ahmad.organisation
        if org is None:
            raise CommandError(f"User {ADMIN_EMAIL} has no organisation.")

        now = timezone.now()
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Seeding org '{org.name}' (id={org.id}) — admin: {ahmad.email}"
        ))

        # Ensure org setup is complete and has an organogram URL placeholder
        if not org.is_setup_complete or not org.organogram_file:
            org.is_setup_complete = True
            if not org.organogram_file:
                org.organogram_file = "https://res.cloudinary.com/demo/image/upload/sample.pdf"
            org.save()

        # ------------------------------------------------------------------ #
        # 1. Departments + Units
        # ------------------------------------------------------------------ #
        dept_specs = [
            ("Human Resources", ["Talent Acquisition", "People Operations"]),
            ("Engineering", ["Platform", "Quality Assurance", "DevOps"]),
            ("Finance & Procurement", ["Financial Planning", "Procurement"]),
            ("Operations", ["Logistics", "Facilities"]),
            ("Marketing", ["Brand", "Growth"]),
            ("Legal", ["Compliance", "Contracts"]),
        ]
        departments = {}
        unit_count = 0
        for dept_name, unit_names in dept_specs:
            dept, _ = Department.objects.get_or_create(
                name=dept_name, organisation=org,
            )
            departments[dept_name] = dept
            for un in unit_names:
                _, created = Unit.objects.get_or_create(name=un, department=dept)
                if created:
                    unit_count += 1
        self.stdout.write(self.style.SUCCESS(
            f"  Departments: {len(departments)} | Units created: {unit_count}"
        ))

        # ------------------------------------------------------------------ #
        # 2. Users
        # ------------------------------------------------------------------ #
        user_specs = [
            # email, first, last, role, dept, job_title
            ("emily.zhang@appraiser-demo.com",   "Emily",   "Zhang",   User.Role.MANAGER,      "Human Resources",       "HR Manager"),
            ("frank.russo@appraiser-demo.com",   "Frank",   "Russo",   User.Role.MANAGER,      "Engineering",           "Engineering Manager"),
            ("grace.patel@appraiser-demo.com",   "Grace",   "Patel",   User.Role.MANAGER,      "Finance & Procurement", "Finance Manager"),
            ("henry.kim@appraiser-demo.com",     "Henry",   "Kim",     User.Role.MANAGER,      "Operations",            "Operations Manager"),

            ("isla.nguyen@appraiser-demo.com",   "Isla",    "Nguyen",  User.Role.STAFF,        "Human Resources",       "HR Specialist"),
            ("james.wright@appraiser-demo.com",  "James",   "Wright",  User.Role.STAFF,        "Engineering",           "Software Engineer"),
            ("kira.tanaka@appraiser-demo.com",   "Kira",    "Tanaka",  User.Role.STAFF,        "Engineering",           "QA Engineer"),
            ("liam.brown@appraiser-demo.com",    "Liam",    "Brown",   User.Role.STAFF,        "Finance & Procurement", "Financial Analyst"),
            ("maya.jones@appraiser-demo.com",    "Maya",    "Jones",   User.Role.STAFF,        "Operations",            "Operations Coordinator"),
            ("noah.garcia@appraiser-demo.com",   "Noah",    "Garcia",  User.Role.STAFF,        "Marketing",             "Marketing Specialist"),
            ("olivia.martinez@appraiser-demo.com","Olivia", "Martinez",User.Role.STAFF,        "Legal",                 "Legal Analyst"),
            ("peter.hall@appraiser-demo.com",    "Peter",   "Hall",    User.Role.STAFF,        "Engineering",           "DevOps Engineer"),

            ("quinn.stewart@appraiser-demo.com", "Quinn",   "Stewart", User.Role.DEPT_HEAD,    "Marketing",             "VP of Marketing"),
            ("rachel.lee@appraiser-demo.com",    "Rachel",  "Lee",     User.Role.DEPT_HEAD,    "Legal",                 "General Counsel"),
            ("samuel.adeyemi@appraiser-demo.com","Samuel",  "Adeyemi", User.Role.DEPT_HEAD,    "Engineering",           "VP of Engineering"),

            ("tanya.wilson@appraiser-demo.com",  "Tanya",   "Wilson",  User.Role.EXECUTIVE,    "Operations",            "Chief Operating Officer"),
            ("umar.sheikh@appraiser-demo.com",   "Umar",    "Sheikh",  User.Role.EXECUTIVE,    "Finance & Procurement", "Chief Financial Officer"),
            ("vanessa.clark@appraiser-demo.com", "Vanessa", "Clark",   User.Role.EXECUTIVE,    "Human Resources",       "Chief People Officer"),

            ("william.grant@appraiser-demo.com", "William", "Grant",   User.Role.BOARD_MEMBER, None,                    "Board Chairperson"),
            ("xena.dubois@appraiser-demo.com",   "Xena",    "Dubois",  User.Role.BOARD_MEMBER, None,                    "Board Member"),
        ]

        users = {ADMIN_EMAIL: ahmad}
        created_users = 0
        for email, first, last, role, dept_name, job_title in user_specs:
            user = User.objects.filter(email=email).first()
            if user is None:
                user = User.objects.create_user(
                    email=email,
                    password=DEMO_PASSWORD,
                    first_name=first,
                    last_name=last,
                    role=role,
                    department=departments.get(dept_name) if dept_name else None,
                    organisation=org,
                    employment_status=User.EmploymentStatus.ACTIVE,
                    job_title=job_title,
                )
                created_users += 1
            users[email] = user

        # Friendly aliases
        u = users
        admin1 = ahmad
        mgr_hr  = u["emily.zhang@appraiser-demo.com"]
        mgr_eng = u["frank.russo@appraiser-demo.com"]
        mgr_fin = u["grace.patel@appraiser-demo.com"]
        mgr_ops = u["henry.kim@appraiser-demo.com"]

        s_hr   = u["isla.nguyen@appraiser-demo.com"]
        s_eng  = u["james.wright@appraiser-demo.com"]
        s_qa   = u["kira.tanaka@appraiser-demo.com"]
        s_fin  = u["liam.brown@appraiser-demo.com"]
        s_ops  = u["maya.jones@appraiser-demo.com"]
        s_mkt  = u["noah.garcia@appraiser-demo.com"]
        s_leg  = u["olivia.martinez@appraiser-demo.com"]
        s_dev  = u["peter.hall@appraiser-demo.com"]

        dh_mkt = u["quinn.stewart@appraiser-demo.com"]
        dh_leg = u["rachel.lee@appraiser-demo.com"]
        dh_eng = u["samuel.adeyemi@appraiser-demo.com"]

        exe_coo = u["tanya.wilson@appraiser-demo.com"]
        exe_cfo = u["umar.sheikh@appraiser-demo.com"]
        exe_cpo = u["vanessa.clark@appraiser-demo.com"]

        board1 = u["william.grant@appraiser-demo.com"]
        board2 = u["xena.dubois@appraiser-demo.com"]

        self.stdout.write(self.style.SUCCESS(
            f"  Users (existing/new): {len(users)} total, {created_users} new"
        ))

        # Department heads & reports_to
        head_map = {
            "Human Resources":       mgr_hr,
            "Engineering":           dh_eng,
            "Finance & Procurement": mgr_fin,
            "Operations":            mgr_ops,
            "Marketing":             dh_mkt,
            "Legal":                 dh_leg,
        }
        for dname, head_user in head_map.items():
            d = departments[dname]
            if d.head_id != head_user.id:
                d.head = head_user
                d.save()

        reporting = [
            (s_hr,  mgr_hr),
            (s_eng, mgr_eng),
            (s_qa,  mgr_eng),
            (s_dev, mgr_eng),
            (s_fin, mgr_fin),
            (s_ops, mgr_ops),
            (s_mkt, dh_mkt),
            (s_leg, dh_leg),
            (mgr_hr,  exe_cpo),
            (mgr_eng, dh_eng),
            (mgr_fin, exe_cfo),
            (mgr_ops, exe_coo),
        ]
        for sub, sup in reporting:
            if sub.reports_to_id != sup.id:
                sub.reports_to = sup
                sub.save()

        # ------------------------------------------------------------------ #
        # 3. Projects (+ milestones, documents, reports)
        # ------------------------------------------------------------------ #
        project_specs = [
            ("Digital Transformation Initiative", 2026, 2027, "Engineering",           mgr_eng,  Project.Status.ACTIVE),
            ("Employee Wellness Program",         2026, 2026, "Human Resources",       mgr_hr,   Project.Status.ACTIVE),
            ("Annual Budget Optimization",        2026, 2026, "Finance & Procurement", mgr_fin,  Project.Status.ON_HOLD),
            ("Customer Experience Revamp",        2025, 2026, "Marketing",             dh_mkt,   Project.Status.COMPLETED),
            ("Regulatory Compliance Overhaul",    2026, 2027, "Legal",                 dh_leg,   Project.Status.ACTIVE),
            ("Operational Efficiency Program",    2026, 2027, "Operations",            mgr_ops,  Project.Status.ACTIVE),
        ]
        projects = {}
        new_proj = 0
        for pname, sy, ey, dept_name, owner, status in project_specs:
            p, created = Project.objects.get_or_create(
                name=pname, organisation=org,
                defaults=dict(
                    start_year=sy, end_year=ey,
                    department=departments[dept_name],
                    owner=owner, status=status,
                ),
            )
            projects[pname] = p
            if created:
                new_proj += 1
        self.stdout.write(self.style.SUCCESS(f"  Projects: {len(projects)} ({new_proj} new)"))

        milestone_specs = {
            "Digital Transformation Initiative": [
                ("Platform Migration Phase 1",   30),
                ("API Integration Complete",     60),
                ("User Acceptance Testing",      90),
            ],
            "Employee Wellness Program": [
                ("Wellness Survey Rollout",       14),
                ("Mental Health Workshops Launch",45),
            ],
            "Annual Budget Optimization": [
                ("Q1 Budget Review",              20),
                ("Cost Reduction Targets",        50),
                ("Final Budget Approval",         75),
            ],
            "Customer Experience Revamp": [
                ("Customer Feedback Analysis", -30),
                ("New CX Strategy Approved",   -10),
            ],
            "Regulatory Compliance Overhaul": [
                ("Gap Analysis Complete",         25),
                ("Policy Updates Drafted",        55),
                ("Compliance Training Delivered", 85),
            ],
            "Operational Efficiency Program": [
                ("Process Mapping Complete",      18),
                ("Automation Pilot Launch",       48),
            ],
        }
        ms_count = 0
        for pname, items in milestone_specs.items():
            for title, off in items:
                deadline = (now + timedelta(days=off)).date()
                _, created = ProjectMilestone.objects.get_or_create(
                    project=projects[pname], title=title,
                    defaults=dict(
                        description=f"Milestone for {pname}: {title}",
                        deadline=deadline,
                        is_completed=off < 0,
                        completed_at=now - timedelta(days=5) if off < 0 else None,
                    ),
                )
                if created:
                    ms_count += 1
        self.stdout.write(self.style.SUCCESS(f"  Milestones created: {ms_count}"))

        # Project documents (one per category for the flagship project)
        flagship = projects["Digital Transformation Initiative"]
        doc_count = 0
        for cat in ProjectDocument.Category.values:
            exists = ProjectDocument.objects.filter(project=flagship, category=cat).exists()
            if not exists:
                ProjectDocument.objects.create(
                    project=flagship,
                    category=cat,
                    file=ContentFile(
                        f"%PDF-1.4 {flagship.name} - {cat} v1".encode(),
                        name=f"{flagship.id}_{cat.lower()}_v1.pdf",
                    ),
                    uploaded_by=admin1,
                    version=1,
                )
                doc_count += 1
        self.stdout.write(self.style.SUCCESS(f"  Project documents: {doc_count}"))

        # A draft AI-generated report on flagship
        ProjectReport.objects.get_or_create(
            project=flagship,
            title="Q2 Progress Summary (AI Draft)",
            defaults=dict(
                content=(
                    "AI-GENERATED DRAFT — pending human review.\n\n"
                    "The Digital Transformation Initiative is currently 45% complete. "
                    "Key risks: vendor delivery slippage on the API integration milestone."
                ),
                period_start=(now - timedelta(days=60)).date(),
                period_end=now.date(),
                is_ai_generated=True,
                is_draft=True,
                created_by=mgr_eng,
            ),
        )

        # ------------------------------------------------------------------ #
        # 4. Tasks (with status transitions, outputs, reviews)
        # ------------------------------------------------------------------ #
        S, P, DT = Task.Status, Task.Priority, Task.DeadlineType

        task_specs = [
            # title, status, priority, deadline_type, assignee, creator, dept, project_name|None, progress, deadline_offset
            ("Q1 Performance Reviews",         S.IN_PROGRESS, P.HIGH,   DT.MONTHLY, mgr_hr,  admin1,  "Human Resources",       "Employee Wellness Program",            45,  30),
            ("Update Security Policy",         S.ASSIGNED,    P.URGENT, DT.WEEKLY,  s_eng,   mgr_eng, "Engineering",           "Digital Transformation Initiative",    10,  14),
            ("Onboarding Checklist v3",        S.SUBMITTED,   P.MEDIUM, DT.WEEKLY,  s_hr,    mgr_hr,  "Human Resources",       "Employee Wellness Program",            80,   7),
            ("Quarterly Financial Report",     S.IN_PROGRESS, P.URGENT, DT.MONTHLY, s_fin,   mgr_fin, "Finance & Procurement", "Annual Budget Optimization",           60,  21),
            ("Vendor Contract Renewal",        S.CREATED,     P.HIGH,   DT.MONTHLY, mgr_fin, exe_cfo, "Finance & Procurement", None,                                    0,  45),
            ("Deploy CI/CD Pipeline v2",       S.IN_PROGRESS, P.HIGH,   DT.WEEKLY,  s_dev,   mgr_eng, "Engineering",           "Digital Transformation Initiative",    55,  10),
            ("Brand Guidelines Refresh",       S.REVIEWED,    P.MEDIUM, DT.MONTHLY, s_mkt,   dh_mkt,  "Marketing",             "Customer Experience Revamp",           95,   5),
            ("GDPR Compliance Audit",          S.ASSIGNED,    P.URGENT, DT.MONTHLY, s_leg,   dh_leg,  "Legal",                 "Regulatory Compliance Overhaul",        5,  35),
            ("Employee Satisfaction Survey",   S.CLOSED,      P.MEDIUM, DT.MONTHLY, s_hr,    mgr_hr,  "Human Resources",       "Employee Wellness Program",           100, -10),
            ("Infrastructure Cost Analysis",   S.IN_PROGRESS, P.HIGH,   DT.WEEKLY,  s_dev,   mgr_eng, "Engineering",           "Digital Transformation Initiative",    40,  18),
            ("Marketing Campaign Q2",          S.CREATED,     P.MEDIUM, DT.MONTHLY, s_mkt,   dh_mkt,  "Marketing",             None,                                    0,  50),
            ("Data Retention Policy Review",   S.ASSIGNED,    P.HIGH,   DT.WEEKLY,  s_leg,   dh_leg,  "Legal",                 "Regulatory Compliance Overhaul",       15,  20),
            ("Supply Chain Optimization",      S.IN_PROGRESS, P.MEDIUM, DT.MONTHLY, s_ops,   mgr_ops, "Operations",            "Operational Efficiency Program",       35,  40),
            ("New Hire Training Program",      S.SUBMITTED,   P.LOW,    DT.MONTHLY, s_qa,    mgr_eng, "Engineering",           None,                                   75,  28),
            ("Board Meeting Preparation",      S.REVIEWED,    P.URGENT, DT.DAILY,   admin1,  exe_coo, "Operations",            None,                                   90,   3),
            ("API Documentation Update",       S.IN_PROGRESS, P.MEDIUM, DT.WEEKLY,  s_eng,   mgr_eng, "Engineering",           "Digital Transformation Initiative",    50,  15),
            ("Office Space Redesign",          S.CREATED,     P.LOW,    DT.MONTHLY, s_ops,   mgr_ops, "Operations",            "Operational Efficiency Program",        0,  55),
            ("Legal Contract Templates",       S.ASSIGNED,    P.MEDIUM, DT.MONTHLY, s_leg,   dh_leg,  "Legal",                 "Regulatory Compliance Overhaul",       20,  25),
            ("Payroll System Migration",       S.IN_PROGRESS, P.HIGH,   DT.MONTHLY, admin1,  exe_cfo, "Finance & Procurement", None,                                   30,  35),
            ("Customer Feedback Analysis",     S.CLOSED,      P.MEDIUM, DT.WEEKLY,  s_mkt,   dh_mkt,  "Marketing",             "Customer Experience Revamp",          100,  -5),
            ("Security Penetration Testing",   S.ASSIGNED,    P.URGENT, DT.WEEKLY,  s_dev,   dh_eng,  "Engineering",           "Digital Transformation Initiative",    10,  12),
            ("Annual Compliance Training",     S.SUBMITTED,   P.HIGH,   DT.MONTHLY, s_hr,    exe_cpo, "Human Resources",       None,                                   85,  22),
            ("Budget Forecast FY2027",         S.CREATED,     P.MEDIUM, DT.MONTHLY, s_fin,   mgr_fin, "Finance & Procurement", "Annual Budget Optimization",            0,  60),
            ("Process Automation Pilot",       S.IN_PROGRESS, P.HIGH,   DT.WEEKLY,  s_ops,   mgr_ops, "Operations",            "Operational Efficiency Program",       65,  16),
            ("Executive Dashboard Design",     S.REVIEWED,    P.HIGH,   DT.WEEKLY,  s_eng,   dh_eng,  "Engineering",           "Digital Transformation Initiative",    92,   8),
            # A few overdue ones for the alert panel
            ("Overdue: Q4 Compliance Filing",  S.IN_PROGRESS, P.URGENT, DT.MONTHLY, s_leg,   dh_leg,  "Legal",                 "Regulatory Compliance Overhaul",       40, -12),
            ("Overdue: Inventory Reconciliation", S.ASSIGNED, P.HIGH,   DT.WEEKLY,  s_ops,   mgr_ops, "Operations",            None,                                   15,  -7),
        ]

        tasks_by_title = {}
        new_tasks = 0
        for (title, status, priority, dt, assignee, creator, dept_name,
             proj_name, progress, deadline_days) in task_specs:
            t = Task.objects.filter(title=title, organisation=org).first()
            if t is None:
                t = Task.objects.create(
                    title=title,
                    description=f"{title}. Auto-seeded for demo.",
                    objectives="Deliver agreed scope by the deadline.",
                    status=status,
                    priority=priority,
                    deadline_type=dt,
                    assigned_to=assignee,
                    created_by=creator,
                    organisation=org,
                    department=departments[dept_name],
                    project=projects.get(proj_name) if proj_name else None,
                    progress_percentage=progress,
                    deadline=now + timedelta(days=deadline_days),
                )
                new_tasks += 1
            tasks_by_title[title] = t
        self.stdout.write(self.style.SUCCESS(f"  Tasks: {len(tasks_by_title)} total ({new_tasks} new)"))

        # Outputs for SUBMITTED / REVIEWED / CLOSED tasks
        for t in tasks_by_title.values():
            if t.status in (S.SUBMITTED, S.REVIEWED, S.CLOSED):
                if not t.outputs.exists():
                    TaskOutput.objects.create(
                        task=t,
                        submitted_by=t.assigned_to,
                        text_content=(
                            f"Submission for '{t.title}'. Deliverables completed per spec. "
                            f"See attached file for details."
                        ),
                        file=ContentFile(
                            f"%PDF-1.4 Output for {t.task_id}".encode(),
                            name=f"output_{t.task_id}.pdf",
                        ),
                    )

        # Reviews for REVIEWED / CLOSED
        for t in tasks_by_title.values():
            if t.status in (S.REVIEWED, S.CLOSED) and not t.reviews.exists():
                TaskReview.objects.create(
                    task=t,
                    reviewer=t.created_by or admin1,
                    action=TaskReview.Action.APPROVED,
                    comment="Looks good — approved.",
                )

        # A few status-change records for visible history
        sample_history = [
            ("Onboarding Checklist v3",     S.IN_PROGRESS, S.SUBMITTED, mgr_hr),
            ("Brand Guidelines Refresh",    S.SUBMITTED,   S.REVIEWED,  dh_mkt),
            ("Customer Feedback Analysis",  S.REVIEWED,    S.CLOSED,    dh_mkt),
            ("Employee Satisfaction Survey",S.REVIEWED,    S.CLOSED,    mgr_hr),
        ]
        for title, frm, to, by in sample_history:
            t = tasks_by_title.get(title)
            if t and not t.status_changes.filter(from_status=frm, to_status=to).exists():
                TaskStatusChange.objects.create(
                    task=t, from_status=frm, to_status=to,
                    changed_by=by, comment="State advanced.",
                )

        # ------------------------------------------------------------------ #
        # 5. Policy categories + policies + versions + acknowledgments
        # ------------------------------------------------------------------ #
        cat_names = [
            "Strategic Plan",
            "HR Policies",
            "Finance & Procurement",
            "Operations",
            "Compliance",
            "Custom",
        ]
        categories = {}
        for cn in cat_names:
            c, _ = PolicyCategory.objects.get_or_create(name=cn, organisation=org)
            categories[cn] = c

        policy_specs = [
            ("Code of Conduct",               "Defines expected behaviour and ethics.",                 "HR Policies"),
            ("Information Security Policy",   "Guidelines for protecting information assets.",           "Compliance"),
            ("Remote Work Policy",            "Rules for remote and hybrid work arrangements.",          "HR Policies"),
            ("Procurement Guidelines",        "Standardised vendor selection procedures.",               "Finance & Procurement"),
            ("Data Privacy Policy",           "GDPR-aligned data protection rules.",                     "Compliance"),
            ("Travel & Expense Policy",       "Business travel and expense rules.",                      "Finance & Procurement"),
            ("Strategic Plan 2026-2030",      "Five-year strategic roadmap.",                            "Strategic Plan"),
            ("Incident Response Plan",        "Procedures for security incidents.",                      "Operations"),
            ("Anti-Corruption Policy",        "Zero-tolerance bribery / corruption policy.",             "Compliance"),
            ("Employee Leave Policy",         "Leave entitlements and approval workflows.",              "HR Policies"),
            ("IT Acceptable Use Policy",      "Rules for use of company IT resources.",                  "Operations"),
            ("Whistleblower Protection",      "Protection for employees reporting misconduct.",          "Custom"),
        ]

        policies = []
        new_pol = 0
        for title, desc, cat in policy_specs:
            p, created = Policy.objects.get_or_create(
                title=title, organisation=org,
                defaults=dict(
                    description=desc,
                    category=categories[cat],
                    current_version=1,
                ),
            )
            if created:
                new_pol += 1
            policies.append(p)
            if not p.versions.exists():
                PolicyVersion.objects.create(
                    policy=p, version_number=1,
                    file=ContentFile(
                        f"%PDF-1.4 {title} v1".encode(),
                        name=f"{title.lower().replace(' ', '_')}_v1.pdf",
                    ),
                    uploaded_by=admin1,
                )
        # Add a v2 to one policy to demo version history
        sec = next((p for p in policies if p.title == "Information Security Policy"), None)
        if sec and not sec.versions.filter(version_number=2).exists():
            PolicyVersion.objects.create(
                policy=sec, version_number=2,
                file=ContentFile(b"%PDF-1.4 Information Security Policy v2",
                                 name="information_security_policy_v2.pdf"),
                uploaded_by=admin1,
            )
            sec.current_version = 2
            sec.save()
        self.stdout.write(self.style.SUCCESS(
            f"  Policies: {len(policies)} ({new_pol} new), categories: {len(categories)}"
        ))

        ack_users = [mgr_hr, mgr_eng, s_hr, s_eng, s_fin, s_mkt, dh_mkt, exe_coo]
        ack_count = 0
        for p in policies[:6]:
            v = p.versions.order_by("version_number").first()
            if v:
                for usr in ack_users[:5]:
                    _, created = PolicyAcknowledgment.objects.get_or_create(
                        policy_version=v, user=usr,
                    )
                    if created:
                        ack_count += 1
        self.stdout.write(self.style.SUCCESS(f"  New policy acknowledgments: {ack_count}"))

        # ------------------------------------------------------------------ #
        # 6. Job Descriptions
        # ------------------------------------------------------------------ #
        jd_specs = [
            ("Software Engineer JD",       "Software Engineer",         "Engineering",           s_eng),
            ("HR Specialist JD",           "HR Specialist",             "Human Resources",       s_hr),
            ("Financial Analyst JD",       "Financial Analyst",         "Finance & Procurement", s_fin),
            ("Marketing Specialist JD",    "Marketing Specialist",      "Marketing",             s_mkt),
            ("Legal Analyst JD",           "Legal Analyst",             "Legal",                 s_leg),
            ("Operations Coordinator JD",  "Operations Coordinator",    "Operations",            s_ops),
        ]
        new_jd = 0
        for title, role, dept_name, linked in jd_specs:
            jd, created = JobDescription.objects.get_or_create(
                title=title, organisation=org,
                defaults=dict(
                    role_title=role,
                    department=departments[dept_name],
                    current_version=1,
                    linked_user=linked,
                ),
            )
            if created:
                new_jd += 1
            if not jd.versions.exists():
                JDVersion.objects.create(
                    job_description=jd,
                    version_number=1,
                    content_text=(
                        f"Role: {role}\nDepartment: {dept_name}\n\n"
                        f"Responsibilities: lead initiatives in {dept_name}, "
                        f"collaborate cross-functionally, maintain compliance."
                    ),
                    uploaded_by=admin1,
                )
        self.stdout.write(self.style.SUCCESS(f"  Job descriptions: {len(jd_specs)} ({new_jd} new)"))

        # ------------------------------------------------------------------ #
        # 7. Audit log entries
        # ------------------------------------------------------------------ #
        EC = AuditLog.EventCategory
        audit_specs = [
            (EC.AUTHENTICATION,   "user_login",            admin1,  "Admin Ahmad Ashfaq logged in."),
            (EC.USER_MANAGEMENT,  "user_account_created",  admin1,  "Created user Emily Zhang (MANAGER)."),
            (EC.USER_MANAGEMENT,  "user_account_created",  admin1,  "Created user Frank Russo (MANAGER)."),
            (EC.TASK,             "task_created",          mgr_hr,  "Created task: Q1 Performance Reviews."),
            (EC.TASK,             "task_assigned",         mgr_eng, "Assigned task Update Security Policy to James Wright."),
            (EC.TASK,             "task_status_changed",   s_eng,   "Task Update Security Policy moved to IN_PROGRESS."),
            (EC.PROJECT,          "project_created",       mgr_eng, "Created project: Digital Transformation Initiative."),
            (EC.PROJECT,          "milestone_completed",   dh_mkt,  "Milestone Customer Feedback Analysis completed."),
            (EC.POLICY,           "policy_uploaded",       admin1,  "Uploaded Code of Conduct v1."),
            (EC.POLICY,           "policy_version_uploaded",admin1, "Uploaded Information Security Policy v2."),
            (EC.POLICY,           "policy_acknowledged",   mgr_hr,  "Acknowledged Code of Conduct."),
            (EC.DOCUMENT,         "document_uploaded",     mgr_eng, "Uploaded Workplan to Digital Transformation."),
            (EC.ADMINISTRATIVE,   "department_created",    admin1,  "Created department: Engineering."),
            (EC.ADMINISTRATIVE,   "organogram_uploaded",   admin1,  "Organogram uploaded for organisation."),
            (EC.AUTHENTICATION,   "user_login",            mgr_eng, "Manager Frank Russo logged in."),
            (EC.TASK,             "task_submitted",        s_hr,    "Onboarding Checklist v3 submitted for review."),
            (EC.TASK,             "task_approved",         mgr_hr,  "Approved task Onboarding Checklist v3."),
            (EC.USER_MANAGEMENT,  "user_role_changed",     admin1,  "Role of Quinn Stewart set to DEPT_HEAD."),
            (EC.AUTHENTICATION,   "login_failed",          None,    "Login failed for unknown@example.com."),
            (EC.AUTHENTICATION,   "user_logout",           admin1,  "Admin Ahmad Ashfaq logged out."),
        ]
        new_audit = 0
        for cat, etype, user, desc in audit_specs:
            exists = AuditLog.objects.filter(
                organisation=org, event_type=etype, description=desc,
            ).exists()
            if not exists:
                AuditLog.objects.create(
                    event_category=cat, event_type=etype,
                    user=user, organisation=org,
                    description=desc,
                )
                new_audit += 1
        self.stdout.write(self.style.SUCCESS(f"  Audit logs created: {new_audit}"))

        # ------------------------------------------------------------------ #
        # 8. Notifications
        # ------------------------------------------------------------------ #
        notif_specs = [
            (admin1,  "task_submitted",  "Task Submitted",          "Onboarding Checklist v3 has been submitted.", False),
            (admin1,  "policy_update",   "Policy Updated",          "Information Security Policy v2 has been published.", False),
            (admin1,  "system_alert",    "Welcome to Appraiser",    "Your demo organisation is fully seeded and ready.", False),
            (admin1,  "project_update",  "Project Milestone Met",   "Milestone 'New CX Strategy Approved' completed.", True),
            (s_eng,   "task_assigned",   "New Task Assigned",       "You have been assigned: Update Security Policy.", False),
            (s_hr,    "task_assigned",   "New Task Assigned",       "You have been assigned: Onboarding Checklist v3.", True),
            (mgr_hr,  "task_overdue",    "Task Approaching",        "Q1 Performance Reviews deadline is near.", False),
            (mgr_eng, "task_overdue",    "Task Approaching",        "Deploy CI/CD Pipeline v2 deadline in 3 days.", False),
            (board1,  "policy_update",   "Strategic Plan Published","Strategic Plan 2026-2030 is now available.", False),
            (board1,  "system_alert",    "Deletion Request",        "Document deletion request requires your approval.", False),
            (exe_coo, "project_update",  "Project Update",          "Wellness Program milestone approaching.", False),
        ]
        new_notif = 0
        for usr, ntype, title, msg, is_read in notif_specs:
            if not Notification.objects.filter(
                user=usr, organisation=org, title=title,
            ).exists():
                Notification.objects.create(
                    user=usr, organisation=org,
                    notification_type=ntype, title=title,
                    message=msg, is_read=is_read,
                )
                new_notif += 1
        self.stdout.write(self.style.SUCCESS(f"  Notifications created: {new_notif}"))

        # ------------------------------------------------------------------ #
        # 9. Conversations + messages (DIRECT, GROUP, TASK_THREAD)
        # ------------------------------------------------------------------ #
        CT = Conversation.ConversationType

        def get_or_create_conversation(ctype, members, task=None, creator=None):
            qs = Conversation.objects.filter(
                organisation=org, conversation_type=ctype, task=task,
            )
            for c in qs:
                pids = set(c.participants.values_list("user_id", flat=True))
                if pids == set(m.id for m in members):
                    return c, False
            c = Conversation.objects.create(
                organisation=org, conversation_type=ctype, task=task,
                created_by=creator or members[0],
            )
            for m in members:
                ConversationParticipant.objects.get_or_create(
                    conversation=c, user=m,
                )
            return c, True

        c_direct_admin_hr, _   = get_or_create_conversation(CT.DIRECT, [admin1, mgr_hr])
        c_direct_admin_eng, _  = get_or_create_conversation(CT.DIRECT, [admin1, mgr_eng])
        c_direct_coo_admin, _  = get_or_create_conversation(CT.DIRECT, [admin1, exe_coo])
        c_group_eng, _         = get_or_create_conversation(
            CT.GROUP, [mgr_eng, s_eng, s_qa, s_dev, dh_eng], creator=mgr_eng,
        )
        c_group_exec, _        = get_or_create_conversation(
            CT.GROUP, [exe_coo, exe_cfo, exe_cpo, admin1, board1], creator=exe_coo,
        )

        # Task threads
        task_thread_for = tasks_by_title.get("Update Security Policy")
        c_thread_sec = None
        if task_thread_for:
            c_thread_sec, _ = get_or_create_conversation(
                CT.TASK_THREAD,
                [mgr_eng, s_eng],
                task=task_thread_for, creator=mgr_eng,
            )

        message_specs = [
            (c_direct_admin_hr, mgr_hr,  "Hi Ahmad — onboarding revisions are 80% done. Friday delivery."),
            (c_direct_admin_hr, admin1,  "Great. Ensure the new compliance section from Legal is included."),
            (c_direct_admin_hr, mgr_hr,  "Will coordinate with Olivia today."),
            (c_direct_admin_eng, admin1,  "Frank — security policy update is the top priority this week."),
            (c_direct_admin_eng, mgr_eng, "Already on it. James starts the review today."),
            (c_direct_coo_admin, exe_coo, "Ahmad — board materials ready?"),
            (c_direct_coo_admin, admin1,  "Almost. Final financial summary by EOD."),
            (c_group_eng, mgr_eng, "Team — CI/CD upgrade status?"),
            (c_group_eng, s_dev,   "Staging is ready. Integration tests running."),
            (c_group_eng, s_eng,   "API docs updated to reflect new endpoints."),
            (c_group_eng, s_qa,    "QA caught two minor issues — both fixed."),
            (c_group_eng, dh_eng,  "Aim for production deployment next Tuesday."),
            (c_group_exec, exe_coo, "Quarterly priorities — let's discuss."),
            (c_group_exec, exe_cfo, "Budget optimization is behind schedule."),
            (c_group_exec, exe_cpo, "HR side on track. Wellness milestones progressing."),
            (c_group_exec, board1,  "Please prepare a consolidated update for the next board meeting."),
        ]
        if c_thread_sec:
            message_specs.extend([
                (c_thread_sec, mgr_eng, "James — focus on access control and encryption sections first."),
                (c_thread_sec, s_eng,   "Got it. Draft ready by Wednesday."),
            ])

        new_msgs = 0
        for conv, sender, content in message_specs:
            if not Message.objects.filter(
                conversation=conv, sender=sender, content=content,
            ).exists():
                Message.objects.create(
                    conversation=conv, sender=sender,
                    content=content, organisation=org,
                )
                new_msgs += 1
        self.stdout.write(self.style.SUCCESS(f"  Messages created: {new_msgs}"))

        # ------------------------------------------------------------------ #
        # 10. Activity / Time / Break logs (5 days, immutable closed lines)
        # ------------------------------------------------------------------ #
        AT = ActivityLog.ActivityType
        BT = BreakLog.BreakType

        work_users = [s_hr, s_eng, s_qa, s_fin, s_ops, s_mkt, s_leg, s_dev, mgr_hr, mgr_eng]
        activity_cycle = [AT.DESK_WORK, AT.FIELD_WORK, AT.MEETING, AT.DESK_WORK, AT.MEETING]
        break_cycle    = [BT.LUNCH, BT.STEP_OUT, BT.LUNCH, BT.SICK_LEAVE, BT.LUNCH]

        a_count = t_count = b_count = 0
        for d in range(5):
            day_start = (now - timedelta(days=d)).replace(hour=9, minute=0, second=0, microsecond=0)
            for i, usr in enumerate(work_users):
                # Activity 9:00–11:00
                started = day_start + timedelta(minutes=i * 5)
                if not ActivityLog.objects.filter(user=usr, started_at=started).exists():
                    ActivityLog.objects.create(
                        user=usr, organisation=org,
                        activity_type=activity_cycle[(i + d) % len(activity_cycle)],
                        started_at=started, ended_at=started + timedelta(hours=2),
                    )
                    a_count += 1
                # Break at 12:30 for half the team alternating
                if (i + d) % 2 == 0:
                    bstart = day_start.replace(hour=12, minute=30) + timedelta(minutes=i)
                    if not BreakLog.objects.filter(user=usr, started_at=bstart).exists():
                        BreakLog.objects.create(
                            user=usr, organisation=org,
                            break_type=break_cycle[(i + d) % len(break_cycle)],
                            started_at=bstart, ended_at=bstart + timedelta(minutes=45),
                        )
                        b_count += 1

        # Time logs against tasks
        time_pairs = [
            (s_hr,  "Onboarding Checklist v3"),
            (s_eng, "Update Security Policy"),
            (s_eng, "API Documentation Update"),
            (s_fin, "Quarterly Financial Report"),
            (s_ops, "Supply Chain Optimization"),
            (s_mkt, "Brand Guidelines Refresh"),
            (s_leg, "GDPR Compliance Audit"),
            (s_dev, "Deploy CI/CD Pipeline v2"),
            (mgr_hr, "Q1 Performance Reviews"),
            (mgr_eng,"Deploy CI/CD Pipeline v2"),
        ]
        for d in range(3):
            for usr, ttitle in time_pairs:
                t = tasks_by_title.get(ttitle)
                if not t:
                    continue
                started = (now - timedelta(days=d, hours=6)).replace(microsecond=0)
                if not TimeLog.objects.filter(user=usr, task=t, started_at=started).exists():
                    TimeLog.objects.create(
                        user=usr, task=t, organisation=org,
                        started_at=started, ended_at=started + timedelta(hours=2, minutes=15),
                    )
                    t_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"  Activity logs: {a_count} | Time logs: {t_count} | Break logs: {b_count}"
        ))

        # ------------------------------------------------------------------ #
        # 11. Billing profile
        # ------------------------------------------------------------------ #
        BillingProfile.objects.get_or_create(
            organisation=org,
            defaults=dict(
                contact_name=f"{ahmad.first_name or 'Ahmad'} {ahmad.last_name or 'Ashfaq'}",
                billing_email=ahmad.email,
                address="100 Innovation Drive, Suite 400",
                plan_tier=BillingProfile.PlanTier.PROFESSIONAL,
                billing_cycle=BillingProfile.BillingCycle.MONTHLY,
                payment_status=BillingProfile.PaymentStatus.ACTIVE,
            ),
        )

        # ------------------------------------------------------------------ #
        # 12. KPI targets (board-set, drive Accountability dashboard)
        # ------------------------------------------------------------------ #
        kpi_specs = [
            (KPITarget.Metric.TASK_COMPLETION_RATE, 85, KPITarget.Period.QUARTERLY, None),
            (KPITarget.Metric.ON_TIME_DELIVERY,     90, KPITarget.Period.QUARTERLY, None),
            (KPITarget.Metric.DEPT_PRODUCTIVITY,    80, KPITarget.Period.QUARTERLY, departments["Engineering"]),
            (KPITarget.Metric.DEPT_PRODUCTIVITY,    75, KPITarget.Period.QUARTERLY, departments["Operations"]),
        ]
        kpi_new = 0
        for metric, target, period, dept in kpi_specs:
            _, created = KPITarget.objects.get_or_create(
                organisation=org, metric=metric, period=period, department=dept,
                defaults=dict(target_value=target, set_by=board1, notes="Set by board for Q2."),
            )
            if created:
                kpi_new += 1
        self.stdout.write(self.style.SUCCESS(f"  KPI targets created: {kpi_new}"))

        # ------------------------------------------------------------------ #
        # 13. Document deletion request (for Document Retention demo)
        # ------------------------------------------------------------------ #
        sample_pol_v = (
            PolicyVersion.objects.filter(policy__organisation=org)
            .order_by("id").first()
        )
        if sample_pol_v:
            _, created = DeletionRequest.objects.get_or_create(
                organisation=org, document_type="PolicyVersion",
                document_id=sample_pol_v.id,
                defaults=dict(
                    requested_by=board1,
                    reason="Document supersedes prior version; retention period exceeded per board review.",
                    status=DeletionRequest.Status.PENDING,
                ),
            )
            if created:
                self.stdout.write(self.style.SUCCESS(
                    "  Deletion request: 1 PENDING (awaiting second board approval)"
                ))

        # ------------------------------------------------------------------ #
        # Done
        # ------------------------------------------------------------------ #
        self.stdout.write(self.style.SUCCESS(
            "\n=== Seeding complete ===\n"
            f"  Login email:    {ADMIN_EMAIL}\n"
            f"  Password:       {DEMO_PASSWORD}\n"
            f"  Organisation:   {org.name} (id={org.id})\n"
            f"  Departments:    {len(departments)}\n"
            f"  Users total:    {len(users)}\n"
            f"  Projects:       {len(projects)}\n"
            f"  Tasks:          {len(tasks_by_title)}\n"
            f"  Policies:       {len(policies)}\n"
            f"  JDs:            {len(jd_specs)}\n"
        ))
