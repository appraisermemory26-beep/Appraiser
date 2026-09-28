"""
Seed data management command for the Appraiser platform.

Creates comprehensive demo data for enterprise client demonstrations.
Idempotent: checks if Organisation "Appraiser Corp" exists and skips if so.
"""

from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.attention.models import ActivityLog, BreakLog, TimeLog
from apps.audit.models import AuditLog
from apps.billing.models import BillingProfile
from apps.jd_management.models import JDVersion, JobDescription
from apps.messaging.models import Conversation, ConversationParticipant, Message
from apps.notifications.models import Notification
from apps.organisations.models import Department, Organisation
from apps.policies.models import Policy, PolicyAcknowledgment, PolicyCategory, PolicyVersion
from apps.projects.models import Project, ProjectMilestone
from apps.tasks.models import Task


class Command(BaseCommand):
    help = "Seed the database with comprehensive demo data for the Appraiser platform."

    def handle(self, *args, **options):
        if Organisation.objects.filter(slug="appraiser-corp").exists():
            self.stdout.write(self.style.WARNING(
                'Organisation "Appraiser Corp" already exists. Skipping seed.'
            ))
            return

        now = timezone.now()

        # ------------------------------------------------------------------ #
        # 1. Organisation
        # ------------------------------------------------------------------ #
        org = Organisation.objects.create(
            name="Appraiser Corp",
            slug="appraiser-corp",
            address="100 Innovation Drive, San Francisco, CA 94105",
            phone="+1-415-555-0100",
            email="info@appraiser-corp.com",
            website="https://appraiser-corp.com",
            is_setup_complete=True,
        )
        self.stdout.write(self.style.SUCCESS(f"Created organisation: {org.name}"))

        # ------------------------------------------------------------------ #
        # 2. Departments
        # ------------------------------------------------------------------ #
        dept_names = [
            "HR",
            "Engineering",
            "Finance & Procurement",
            "Operations",
            "Marketing",
            "Legal",
        ]
        departments = {}
        for name in dept_names:
            departments[name] = Department.objects.create(
                name=name, organisation=org
            )
        self.stdout.write(self.style.SUCCESS(f"Created {len(departments)} departments"))

        # ------------------------------------------------------------------ #
        # 3. Users (25 total)
        # ------------------------------------------------------------------ #
        def make_user(email, first, last, role, dept_name=None, **extra):
            return User.objects.create_user(
                email=email,
                password=extra.pop("password", "appraiser2026"),
                first_name=first,
                last_name=last,
                role=role,
                department=departments.get(dept_name),
                organisation=org,
                employment_status=User.EmploymentStatus.ACTIVE,
                **extra,
            )

        # -- Admin users (4) --
        admin1 = make_user(
            "admin@appraiser.com", "Alice", "Morrison", User.Role.ADMIN,
            "HR", password="admin123", is_staff=True, is_superuser=True,
            job_title="Platform Administrator",
        )
        admin2 = make_user(
            "bob.chen@appraiser.com", "Bob", "Chen", User.Role.ADMIN,
            "Engineering", job_title="Systems Administrator",
        )
        admin3 = make_user(
            "carol.woods@appraiser.com", "Carol", "Woods", User.Role.ADMIN,
            "Operations", job_title="IT Operations Lead",
        )
        admin4 = make_user(
            "daniel.okafor@appraiser.com", "Daniel", "Okafor", User.Role.ADMIN,
            "Finance & Procurement", job_title="Finance Systems Admin",
        )

        # -- Managers (4, one per dept as head) --
        mgr1 = make_user(
            "emily.zhang@appraiser.com", "Emily", "Zhang", User.Role.MANAGER,
            "HR", job_title="HR Manager",
        )
        mgr2 = make_user(
            "frank.russo@appraiser.com", "Frank", "Russo", User.Role.MANAGER,
            "Engineering", job_title="Engineering Manager",
        )
        mgr3 = make_user(
            "grace.patel@appraiser.com", "Grace", "Patel", User.Role.MANAGER,
            "Finance & Procurement", job_title="Finance Manager",
        )
        mgr4 = make_user(
            "henry.kim@appraiser.com", "Henry", "Kim", User.Role.MANAGER,
            "Operations", job_title="Operations Manager",
        )

        # -- Staff (8) --
        staff1 = make_user(
            "isla.nguyen@appraiser.com", "Isla", "Nguyen", User.Role.STAFF,
            "HR", job_title="HR Specialist",
        )
        staff2 = make_user(
            "james.wright@appraiser.com", "James", "Wright", User.Role.STAFF,
            "Engineering", job_title="Software Engineer",
        )
        staff3 = make_user(
            "kira.tanaka@appraiser.com", "Kira", "Tanaka", User.Role.STAFF,
            "Engineering", job_title="QA Engineer",
        )
        staff4 = make_user(
            "liam.brown@appraiser.com", "Liam", "Brown", User.Role.STAFF,
            "Finance & Procurement", job_title="Financial Analyst",
        )
        staff5 = make_user(
            "maya.jones@appraiser.com", "Maya", "Jones", User.Role.STAFF,
            "Operations", job_title="Operations Coordinator",
        )
        staff6 = make_user(
            "noah.garcia@appraiser.com", "Noah", "Garcia", User.Role.STAFF,
            "Marketing", job_title="Marketing Specialist",
        )
        staff7 = make_user(
            "olivia.martinez@appraiser.com", "Olivia", "Martinez", User.Role.STAFF,
            "Legal", job_title="Legal Analyst",
        )
        staff8 = make_user(
            "peter.hall@appraiser.com", "Peter", "Hall", User.Role.STAFF,
            "Engineering", job_title="DevOps Engineer",
        )

        # -- Department Heads (3) --
        dh1 = make_user(
            "quinn.stewart@appraiser.com", "Quinn", "Stewart", User.Role.DEPT_HEAD,
            "Marketing", job_title="VP of Marketing",
        )
        dh2 = make_user(
            "rachel.lee@appraiser.com", "Rachel", "Lee", User.Role.DEPT_HEAD,
            "Legal", job_title="General Counsel",
        )
        dh3 = make_user(
            "samuel.adeyemi@appraiser.com", "Samuel", "Adeyemi", User.Role.DEPT_HEAD,
            "Engineering", job_title="VP of Engineering",
        )

        # -- Executives (3) --
        exec1 = make_user(
            "tanya.wilson@appraiser.com", "Tanya", "Wilson", User.Role.EXECUTIVE,
            "Operations", job_title="Chief Operating Officer",
        )
        exec2 = make_user(
            "umar.sheikh@appraiser.com", "Umar", "Sheikh", User.Role.EXECUTIVE,
            "Finance & Procurement", job_title="Chief Financial Officer",
        )
        exec3 = make_user(
            "vanessa.clark@appraiser.com", "Vanessa", "Clark", User.Role.EXECUTIVE,
            "HR", job_title="Chief People Officer",
        )

        # -- Board Members (2) --
        board1 = make_user(
            "william.grant@appraiser.com", "William", "Grant", User.Role.BOARD_MEMBER,
            job_title="Board Chairperson",
        )
        board2 = make_user(
            "xena.dubois@appraiser.com", "Xena", "Dubois", User.Role.BOARD_MEMBER,
            job_title="Board Member",
        )

        all_users = [
            admin1, admin2, admin3, admin4,
            mgr1, mgr2, mgr3, mgr4,
            staff1, staff2, staff3, staff4, staff5, staff6, staff7, staff8,
            dh1, dh2, dh3,
            exec1, exec2, exec3,
            board1, board2,
        ]
        self.stdout.write(self.style.SUCCESS(f"Created {len(all_users)} users"))

        # Assign department heads
        departments["HR"].head = mgr1
        departments["HR"].save()
        departments["Engineering"].head = dh3
        departments["Engineering"].save()
        departments["Finance & Procurement"].head = mgr3
        departments["Finance & Procurement"].save()
        departments["Operations"].head = mgr4
        departments["Operations"].save()
        departments["Marketing"].head = dh1
        departments["Marketing"].save()
        departments["Legal"].head = dh2
        departments["Legal"].save()

        # ------------------------------------------------------------------ #
        # 5. Projects (6) — created before tasks so tasks can link to them
        # ------------------------------------------------------------------ #
        projects_data = [
            ("Digital Transformation Initiative", 2025, 2027, "Engineering", mgr2, Project.Status.ACTIVE),
            ("Employee Wellness Program", 2026, 2026, "HR", mgr1, Project.Status.ACTIVE),
            ("Annual Budget Optimization", 2026, 2026, "Finance & Procurement", mgr3, Project.Status.ON_HOLD),
            ("Customer Experience Revamp", 2025, 2026, "Marketing", dh1, Project.Status.COMPLETED),
            ("Regulatory Compliance Overhaul", 2026, 2027, "Legal", dh2, Project.Status.ACTIVE),
            ("Operational Efficiency Program", 2026, 2027, "Operations", mgr4, Project.Status.ACTIVE),
        ]
        projects = []
        for pname, sy, ey, dept_name, owner, status in projects_data:
            projects.append(Project.objects.create(
                name=pname,
                start_year=sy,
                end_year=ey,
                department=departments[dept_name],
                owner=owner,
                status=status,
                organisation=org,
            ))
        self.stdout.write(self.style.SUCCESS(f"Created {len(projects)} projects"))

        # Milestones (2-3 per project)
        milestones_data = [
            (projects[0], [
                ("Platform Migration Phase 1", now.date() + timedelta(days=30)),
                ("API Integration Complete", now.date() + timedelta(days=60)),
                ("User Acceptance Testing", now.date() + timedelta(days=90)),
            ]),
            (projects[1], [
                ("Wellness Survey Rollout", now.date() + timedelta(days=14)),
                ("Mental Health Workshops Launch", now.date() + timedelta(days=45)),
            ]),
            (projects[2], [
                ("Q1 Budget Review", now.date() + timedelta(days=20)),
                ("Cost Reduction Targets Identified", now.date() + timedelta(days=50)),
                ("Final Budget Approval", now.date() + timedelta(days=75)),
            ]),
            (projects[3], [
                ("Customer Feedback Analysis", now.date() - timedelta(days=30)),
                ("New CX Strategy Approved", now.date() - timedelta(days=10)),
            ]),
            (projects[4], [
                ("Gap Analysis Complete", now.date() + timedelta(days=25)),
                ("Policy Updates Drafted", now.date() + timedelta(days=55)),
                ("Compliance Training Delivered", now.date() + timedelta(days=85)),
            ]),
            (projects[5], [
                ("Process Mapping Complete", now.date() + timedelta(days=18)),
                ("Automation Pilot Launch", now.date() + timedelta(days=48)),
            ]),
        ]
        milestone_count = 0
        for proj, ms_list in milestones_data:
            for title, deadline in ms_list:
                completed = deadline < now.date()
                ProjectMilestone.objects.create(
                    project=proj,
                    title=title,
                    description=f"Milestone for {proj.name}: {title}",
                    deadline=deadline,
                    is_completed=completed,
                    completed_at=now - timedelta(days=5) if completed else None,
                )
                milestone_count += 1
        self.stdout.write(self.style.SUCCESS(f"Created {milestone_count} milestones"))

        # ------------------------------------------------------------------ #
        # 4. Tasks (25)
        # ------------------------------------------------------------------ #
        S = Task.Status
        P = Task.Priority
        DT = Task.DeadlineType

        tasks_data = [
            # (title, description, status, priority, deadline_type, assigned_to, created_by, dept, project_idx|None, progress, deadline_offset_days)
            ("Q1 Performance Reviews", "Conduct and finalize performance reviews for all departments.", S.IN_PROGRESS, P.HIGH, DT.MONTHLY, mgr1, admin1, "HR", 1, 45, 30),
            ("Update Security Policy", "Review and update the information security policy to meet ISO 27001 standards.", S.ASSIGNED, P.URGENT, DT.WEEKLY, staff2, mgr2, "Engineering", 0, 10, 14),
            ("Onboarding Checklist v3", "Revise the new-hire onboarding checklist with updated compliance requirements.", S.SUBMITTED, P.MEDIUM, DT.WEEKLY, staff1, mgr1, "HR", 1, 80, 7),
            ("Quarterly Financial Report", "Prepare the Q1 financial report for the board.", S.IN_PROGRESS, P.URGENT, DT.MONTHLY, staff4, mgr3, "Finance & Procurement", 2, 60, 21),
            ("Vendor Contract Renewal", "Negotiate and renew contracts with top 5 vendors.", S.CREATED, P.HIGH, DT.MONTHLY, mgr3, exec2, "Finance & Procurement", None, 0, 45),
            ("Deploy CI/CD Pipeline v2", "Upgrade the CI/CD infrastructure to support microservices.", S.IN_PROGRESS, P.HIGH, DT.WEEKLY, staff8, mgr2, "Engineering", 0, 55, 10),
            ("Brand Guidelines Refresh", "Update brand guidelines to reflect the new visual identity.", S.REVIEWED, P.MEDIUM, DT.MONTHLY, staff6, dh1, "Marketing", 3, 95, 5),
            ("GDPR Compliance Audit", "Conduct a full GDPR compliance audit across all systems.", S.ASSIGNED, P.URGENT, DT.MONTHLY, staff7, dh2, "Legal", 4, 5, 35),
            ("Employee Satisfaction Survey", "Design and distribute the annual employee satisfaction survey.", S.CLOSED, P.MEDIUM, DT.MONTHLY, staff1, mgr1, "HR", 1, 100, -10),
            ("Infrastructure Cost Analysis", "Analyze cloud infrastructure costs and identify optimization opportunities.", S.IN_PROGRESS, P.HIGH, DT.WEEKLY, staff8, mgr2, "Engineering", 0, 40, 18),
            ("Marketing Campaign Q2", "Plan and launch Q2 digital marketing campaign.", S.CREATED, P.MEDIUM, DT.MONTHLY, staff6, dh1, "Marketing", None, 0, 50),
            ("Data Retention Policy Review", "Review and update data retention policies for compliance.", S.ASSIGNED, P.HIGH, DT.WEEKLY, staff7, dh2, "Legal", 4, 15, 20),
            ("Supply Chain Optimization", "Identify bottlenecks in the supply chain and propose improvements.", S.IN_PROGRESS, P.MEDIUM, DT.MONTHLY, staff5, mgr4, "Operations", 5, 35, 40),
            ("New Hire Training Program", "Develop comprehensive training materials for new engineers.", S.SUBMITTED, P.LOW, DT.MONTHLY, staff3, mgr2, "Engineering", None, 75, 28),
            ("Board Meeting Preparation", "Prepare agenda and materials for the upcoming board meeting.", S.REVIEWED, P.URGENT, DT.DAILY, admin1, exec1, "Operations", None, 90, 3),
            ("API Documentation Update", "Update API documentation for external developer portal.", S.IN_PROGRESS, P.MEDIUM, DT.WEEKLY, staff2, mgr2, "Engineering", 0, 50, 15),
            ("Office Space Redesign Plan", "Create a proposal for the new office layout.", S.CREATED, P.LOW, DT.MONTHLY, staff5, mgr4, "Operations", 5, 0, 55),
            ("Legal Contract Templates", "Standardize legal contract templates across the organization.", S.ASSIGNED, P.MEDIUM, DT.MONTHLY, staff7, dh2, "Legal", 4, 20, 25),
            ("Payroll System Migration", "Migrate payroll processing to the new HRIS platform.", S.IN_PROGRESS, P.HIGH, DT.MONTHLY, admin4, exec2, "Finance & Procurement", None, 30, 35),
            ("Customer Feedback Analysis", "Analyze Q1 customer feedback and prepare insights report.", S.CLOSED, P.MEDIUM, DT.WEEKLY, staff6, dh1, "Marketing", 3, 100, -5),
            ("Security Penetration Testing", "Coordinate external penetration testing for all production systems.", S.ASSIGNED, P.URGENT, DT.WEEKLY, staff8, dh3, "Engineering", 0, 10, 12),
            ("Annual Compliance Training", "Roll out mandatory compliance training for all employees.", S.SUBMITTED, P.HIGH, DT.MONTHLY, staff1, exec3, "HR", 1, 85, 22),
            ("Budget Forecast FY2027", "Prepare preliminary budget forecast for fiscal year 2027.", S.CREATED, P.MEDIUM, DT.MONTHLY, staff4, mgr3, "Finance & Procurement", 2, 0, 60),
            ("Process Automation Pilot", "Implement RPA pilot for invoice processing workflow.", S.IN_PROGRESS, P.HIGH, DT.WEEKLY, staff5, mgr4, "Operations", 5, 65, 16),
            ("Executive Dashboard Design", "Design and implement the executive KPI dashboard.", S.REVIEWED, P.HIGH, DT.WEEKLY, staff2, dh3, "Engineering", 0, 92, 8),
        ]

        tasks = []
        for (title, desc, status, priority, dt, assigned, creator, dept_name,
             proj_idx, progress, deadline_days) in tasks_data:
            tasks.append(Task.objects.create(
                title=title,
                description=desc,
                status=status,
                priority=priority,
                deadline_type=dt,
                assigned_to=assigned,
                created_by=creator,
                organisation=org,
                department=departments[dept_name],
                project=projects[proj_idx] if proj_idx is not None else None,
                progress_percentage=progress,
                deadline=now + timedelta(days=deadline_days),
            ))
        self.stdout.write(self.style.SUCCESS(f"Created {len(tasks)} tasks"))

        # ------------------------------------------------------------------ #
        # 6. Policy Categories (6)
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
        for cname in cat_names:
            categories[cname] = PolicyCategory.objects.create(
                name=cname, organisation=org,
            )
        self.stdout.write(self.style.SUCCESS(f"Created {len(categories)} policy categories"))

        # ------------------------------------------------------------------ #
        # 7. Policies (12) with versions and acknowledgments
        # ------------------------------------------------------------------ #
        dummy_pdf = ContentFile(b"%PDF-1.4 dummy policy content", name="policy.pdf")

        policies_data = [
            ("Code of Conduct", "Defines expected behavior and ethical standards for all employees.", "HR Policies"),
            ("Information Security Policy", "Establishes guidelines for protecting company information assets.", "Compliance"),
            ("Remote Work Policy", "Outlines rules and expectations for remote and hybrid work arrangements.", "HR Policies"),
            ("Procurement Guidelines", "Standardized procedures for vendor selection and purchasing.", "Finance & Procurement"),
            ("Data Privacy Policy", "Ensures compliance with GDPR and local data protection regulations.", "Compliance"),
            ("Travel & Expense Policy", "Rules for business travel approvals and expense reimbursement.", "Finance & Procurement"),
            ("Strategic Plan 2026-2030", "Five-year strategic roadmap for organizational growth.", "Strategic Plan"),
            ("Incident Response Plan", "Procedures for handling security incidents and data breaches.", "Operations"),
            ("Anti-Corruption Policy", "Zero-tolerance policy for bribery and corruption.", "Compliance"),
            ("Employee Leave Policy", "Comprehensive leave entitlements and approval workflows.", "HR Policies"),
            ("IT Acceptable Use Policy", "Rules governing the use of company IT resources.", "Operations"),
            ("Whistleblower Protection Policy", "Protects employees who report misconduct in good faith.", "Custom"),
        ]

        policies = []
        policy_versions = []
        for title, desc, cat_name in policies_data:
            p = Policy.objects.create(
                title=title,
                description=desc,
                category=categories[cat_name],
                organisation=org,
                current_version=1,
            )
            policies.append(p)
            pv = PolicyVersion.objects.create(
                policy=p,
                version_number=1,
                file=ContentFile(
                    f"%PDF-1.4 {title} - Version 1 content".encode(),
                    name=f"{title.lower().replace(' ', '_')}_v1.pdf",
                ),
                uploaded_by=admin1,
            )
            policy_versions.append(pv)
        self.stdout.write(self.style.SUCCESS(f"Created {len(policies)} policies with versions"))

        # Acknowledgments — first 6 policy versions acknowledged by a few users each
        ack_count = 0
        ack_users = [mgr1, mgr2, staff1, staff2, staff4, staff6, dh1, exec1]
        for pv in policy_versions[:6]:
            for u in ack_users[:5]:
                PolicyAcknowledgment.objects.create(policy_version=pv, user=u)
                ack_count += 1
        self.stdout.write(self.style.SUCCESS(f"Created {ack_count} policy acknowledgments"))

        # ------------------------------------------------------------------ #
        # 8. Job Descriptions (6) with JDVersions
        # ------------------------------------------------------------------ #
        jd_data = [
            ("Software Engineer JD", "Software Engineer", "Engineering", staff2),
            ("HR Specialist JD", "HR Specialist", "HR", staff1),
            ("Financial Analyst JD", "Financial Analyst", "Finance & Procurement", staff4),
            ("Marketing Specialist JD", "Marketing Specialist", "Marketing", staff6),
            ("Legal Analyst JD", "Legal Analyst", "Legal", staff7),
            ("Operations Coordinator JD", "Operations Coordinator", "Operations", staff5),
        ]
        jds = []
        for jd_title, role_title, dept_name, linked in jd_data:
            jd = JobDescription.objects.create(
                title=jd_title,
                role_title=role_title,
                department=departments[dept_name],
                organisation=org,
                current_version=1,
                linked_user=linked,
            )
            jds.append(jd)
            JDVersion.objects.create(
                job_description=jd,
                version_number=1,
                content_text=(
                    f"Role: {role_title}\n\n"
                    f"Department: {dept_name}\n\n"
                    f"Summary: This role is responsible for key deliverables within the "
                    f"{dept_name} department. The ideal candidate will have 3-5 years of "
                    f"relevant experience and strong communication skills.\n\n"
                    f"Key Responsibilities:\n"
                    f"- Lead and execute department initiatives\n"
                    f"- Collaborate with cross-functional teams\n"
                    f"- Contribute to strategic planning and reporting\n"
                    f"- Maintain compliance with organizational policies"
                ),
                uploaded_by=admin1,
            )
        self.stdout.write(self.style.SUCCESS(f"Created {len(jds)} job descriptions with versions"))

        # ------------------------------------------------------------------ #
        # 9. Audit Logs (25)
        # ------------------------------------------------------------------ #
        EC = AuditLog.EventCategory
        audit_entries = [
            (EC.AUTHENTICATION, "user_login", admin1, "Admin Alice Morrison logged in."),
            (EC.USER_MANAGEMENT, "user_created", admin1, "Created user Bob Chen."),
            (EC.TASK, "task_created", mgr1, "Created task: Q1 Performance Reviews."),
            (EC.TASK, "task_assigned", mgr2, "Assigned task: Update Security Policy to James Wright."),
            (EC.TASK, "task_status_changed", staff2, "Task Update Security Policy moved to IN_PROGRESS."),
            (EC.PROJECT, "project_created", mgr2, "Created project: Digital Transformation Initiative."),
            (EC.POLICY, "policy_uploaded", admin1, "Uploaded Code of Conduct v1."),
            (EC.POLICY, "policy_acknowledged", mgr1, "Emily Zhang acknowledged Code of Conduct."),
            (EC.DOCUMENT, "document_uploaded", mgr3, "Uploaded Q1 financial report draft."),
            (EC.ADMINISTRATIVE, "department_created", admin1, "Created department: Engineering."),
            (EC.AUTHENTICATION, "user_login", mgr2, "Manager Frank Russo logged in."),
            (EC.TASK, "task_completed", staff1, "Task Employee Satisfaction Survey marked as closed."),
            (EC.USER_MANAGEMENT, "user_role_changed", admin1, "Changed Quinn Stewart role to DEPT_HEAD."),
            (EC.PROJECT, "milestone_completed", dh1, "Milestone Customer Feedback Analysis completed."),
            (EC.POLICY, "policy_updated", admin1, "Updated Information Security Policy."),
            (EC.AUTHENTICATION, "user_login", exec1, "Executive Tanya Wilson logged in."),
            (EC.TASK, "task_reviewed", dh3, "Reviewed task: Executive Dashboard Design."),
            (EC.ADMINISTRATIVE, "settings_updated", admin1, "Updated organisation billing settings."),
            (EC.DOCUMENT, "jd_created", admin1, "Created job description: Software Engineer JD."),
            (EC.USER_MANAGEMENT, "user_deactivated", admin1, "No deactivations - system check log."),
            (EC.TASK, "task_created", mgr4, "Created task: Supply Chain Optimization."),
            (EC.PROJECT, "project_status_changed", dh1, "Project Customer Experience Revamp marked COMPLETED."),
            (EC.AUTHENTICATION, "user_logout", admin1, "Admin Alice Morrison logged out."),
            (EC.POLICY, "policy_acknowledged", staff2, "James Wright acknowledged Information Security Policy."),
            (EC.ADMINISTRATIVE, "backup_completed", admin2, "Nightly database backup completed successfully."),
        ]
        for i, (cat, etype, user, desc) in enumerate(audit_entries):
            AuditLog.objects.create(
                event_category=cat,
                event_type=etype,
                user=user,
                organisation=org,
                description=desc,
            )
        self.stdout.write(self.style.SUCCESS(f"Created {len(audit_entries)} audit log entries"))

        # ------------------------------------------------------------------ #
        # 10. Notifications (25)
        # ------------------------------------------------------------------ #
        notif_data = [
            (staff2, "task_assigned", "New Task Assigned", "You have been assigned: Update Security Policy.", False),
            (staff1, "task_assigned", "New Task Assigned", "You have been assigned: Onboarding Checklist v3.", True),
            (mgr1, "task_overdue", "Task Overdue", "Task Q1 Performance Reviews is approaching its deadline.", False),
            (staff4, "task_assigned", "New Task Assigned", "You have been assigned: Quarterly Financial Report.", False),
            (mgr3, "task_assigned", "New Task Assigned", "You have been assigned: Vendor Contract Renewal.", True),
            (staff8, "task_assigned", "New Task Assigned", "You have been assigned: Deploy CI/CD Pipeline v2.", False),
            (staff6, "policy_update", "Policy Updated", "Brand Guidelines have been updated. Please review.", True),
            (staff7, "task_assigned", "New Task Assigned", "You have been assigned: GDPR Compliance Audit.", False),
            (admin1, "task_submitted", "Task Submitted for Review", "Onboarding Checklist v3 has been submitted.", False),
            (mgr2, "task_overdue", "Task Approaching Deadline", "Deploy CI/CD Pipeline v2 deadline in 3 days.", False),
            (staff5, "task_assigned", "New Task Assigned", "You have been assigned: Supply Chain Optimization.", True),
            (dh1, "project_update", "Project Completed", "Customer Experience Revamp has been marked complete.", True),
            (exec1, "task_submitted", "Board Materials Ready", "Board Meeting Preparation materials are ready for review.", False),
            (staff1, "policy_update", "New Policy Published", "Annual Compliance Training materials are now available.", False),
            (mgr4, "task_overdue", "Task Overdue Warning", "Process Automation Pilot deadline is approaching.", False),
            (dh2, "task_submitted", "Task Submitted", "Legal Contract Templates submitted for review.", True),
            (exec2, "policy_update", "Budget Policy Updated", "Procurement Guidelines have been revised.", True),
            (staff3, "task_assigned", "New Task Assigned", "You have been assigned: New Hire Training Program.", False),
            (board1, "policy_update", "Strategic Plan Published", "Strategic Plan 2026-2030 is now available.", False),
            (admin1, "system_alert", "System Maintenance", "Scheduled maintenance window: Saturday 2 AM - 4 AM.", True),
            (staff2, "task_overdue", "Task Deadline Reminder", "API Documentation Update deadline in 5 days.", False),
            (mgr1, "policy_update", "Policy Acknowledgment Required", "Please acknowledge the updated Employee Leave Policy.", False),
            (exec3, "project_update", "Wellness Program Update", "Employee Wellness Program milestone approaching.", False),
            (dh3, "task_submitted", "Task Review Required", "Executive Dashboard Design is ready for your review.", False),
            (admin2, "system_alert", "Backup Complete", "Nightly backup completed successfully.", True),
        ]
        for user, ntype, title, message, is_read in notif_data:
            Notification.objects.create(
                user=user,
                organisation=org,
                notification_type=ntype,
                title=title,
                message=message,
                is_read=is_read,
            )
        self.stdout.write(self.style.SUCCESS(f"Created {len(notif_data)} notifications"))

        # ------------------------------------------------------------------ #
        # 11. Conversations (5) with messages (30+)
        # ------------------------------------------------------------------ #
        CT = Conversation.ConversationType

        # 3 Direct conversations
        conv1 = Conversation.objects.create(
            conversation_type=CT.DIRECT, organisation=org, created_by=mgr1,
        )
        ConversationParticipant.objects.create(conversation=conv1, user=mgr1)
        ConversationParticipant.objects.create(conversation=conv1, user=staff1)

        conv2 = Conversation.objects.create(
            conversation_type=CT.DIRECT, organisation=org, created_by=mgr2,
        )
        ConversationParticipant.objects.create(conversation=conv2, user=mgr2)
        ConversationParticipant.objects.create(conversation=conv2, user=staff2)

        conv3 = Conversation.objects.create(
            conversation_type=CT.DIRECT, organisation=org, created_by=exec1,
        )
        ConversationParticipant.objects.create(conversation=conv3, user=exec1)
        ConversationParticipant.objects.create(conversation=conv3, user=admin1)

        # 2 Group conversations
        conv4 = Conversation.objects.create(
            conversation_type=CT.GROUP, organisation=org, created_by=mgr2,
        )
        for u in [mgr2, staff2, staff3, staff8, dh3]:
            ConversationParticipant.objects.create(conversation=conv4, user=u)

        conv5 = Conversation.objects.create(
            conversation_type=CT.GROUP, organisation=org, created_by=exec1,
        )
        for u in [exec1, exec2, exec3, admin1, board1]:
            ConversationParticipant.objects.create(conversation=conv5, user=u)

        # Messages
        messages_data = [
            # conv1: HR Manager <-> HR Specialist
            (conv1, mgr1, "Hi Isla, how is the onboarding checklist revision going?"),
            (conv1, staff1, "Hi Emily, I have completed about 80% of the updates. Should be ready by Friday."),
            (conv1, mgr1, "Great. Make sure to include the new compliance requirements from Legal."),
            (conv1, staff1, "Will do. I will coordinate with Olivia from Legal for the latest updates."),
            (conv1, mgr1, "Perfect. Let me know if you need any approvals expedited."),
            (conv1, staff1, "Thanks, Emily. I will keep you posted."),
            (conv1, mgr1, "Also, please prepare a summary for the Q1 performance review meeting."),
            # conv2: Engineering Manager <-> Software Engineer
            (conv2, mgr2, "James, the security policy update is urgent. Can you prioritize it this week?"),
            (conv2, staff2, "Absolutely, Frank. I will start the review today."),
            (conv2, mgr2, "Focus on the access control and data encryption sections first."),
            (conv2, staff2, "Got it. Should I coordinate with Peter on the infrastructure side?"),
            (conv2, mgr2, "Yes, loop him in. He has context on the recent cloud migration."),
            (conv2, staff2, "Will do. I will have a draft ready by Wednesday."),
            # conv3: COO <-> Admin
            (conv3, exec1, "Alice, are the board meeting materials ready?"),
            (conv3, admin1, "Almost there, Tanya. Finalizing the financial summary section now."),
            (conv3, exec1, "The board chair wants to see the strategic plan progress as well."),
            (conv3, admin1, "I have included that. Will send the final package by end of day."),
            (conv3, exec1, "Excellent. Make sure the formatting matches the board template."),
            (conv3, admin1, "Already done. I will share the PDF for your final review shortly."),
            # conv4: Engineering group
            (conv4, mgr2, "Team, quick update on the CI/CD pipeline upgrade. Peter, where are we?"),
            (conv4, staff8, "The staging environment is ready. Running integration tests now."),
            (conv4, staff2, "I have updated the API documentation to reflect the new endpoints."),
            (conv4, staff3, "QA is looking good. Found two minor issues, both fixed already."),
            (conv4, dh3, "Great progress everyone. Let us aim for production deployment next Tuesday."),
            (conv4, mgr2, "Agreed. I will schedule a deployment review meeting for Monday."),
            (conv4, staff8, "I will prepare the rollback plan just in case."),
            (conv4, staff3, "I will run one more round of regression tests over the weekend."),
            # conv5: Executive group
            (conv5, exec1, "Good morning, team. Let us discuss the quarterly priorities."),
            (conv5, exec2, "The budget optimization project needs more attention. We are behind schedule."),
            (conv5, exec3, "HR side is on track. Wellness program milestones are progressing well."),
            (conv5, admin1, "I have compiled the cross-department status report. Sharing now."),
            (conv5, board1, "Thank you all. I would like a consolidated update for the next board meeting."),
            (conv5, exec1, "We will have it ready by next Friday. I will coordinate with all department heads."),
            (conv5, exec2, "I will include the financial projections with the update."),
        ]
        for conv, sender, content in messages_data:
            Message.objects.create(
                conversation=conv,
                sender=sender,
                content=content,
                organisation=org,
            )
        self.stdout.write(self.style.SUCCESS(f"Created 5 conversations with {len(messages_data)} messages"))

        # ------------------------------------------------------------------ #
        # 12. ActivityLogs, TimeLogs, BreakLogs (20+ each)
        # ------------------------------------------------------------------ #
        AT = ActivityLog.ActivityType
        BT = BreakLog.BreakType

        work_users = [staff1, staff2, staff3, staff4, staff5, staff6, staff7, staff8, mgr1, mgr2]
        activity_types = [AT.DESK_WORK, AT.FIELD_WORK, AT.MEETING, AT.DESK_WORK, AT.MEETING]
        break_types = [BT.LUNCH, BT.STEP_OUT, BT.ANNUAL_LEAVE, BT.SICK_LEAVE, BT.LUNCH]

        activity_count = 0
        time_log_count = 0
        break_count = 0

        for day_offset in range(5):  # 5 recent workdays
            day_base = now - timedelta(days=day_offset)
            for i, user in enumerate(work_users[:5]):
                # ActivityLog — 4 per iteration across users/days
                started = day_base.replace(hour=9, minute=0, second=0) - timedelta(days=day_offset)
                ended = started + timedelta(hours=2)
                ActivityLog.objects.create(
                    user=user,
                    activity_type=activity_types[i % len(activity_types)],
                    started_at=started,
                    ended_at=ended,
                    organisation=org,
                )
                activity_count += 1

            for i, user in enumerate(work_users[5:]):
                started = day_base.replace(hour=10, minute=30, second=0) - timedelta(days=day_offset)
                ended = started + timedelta(hours=1, minutes=30)
                ActivityLog.objects.create(
                    user=user,
                    activity_type=activity_types[(i + 2) % len(activity_types)],
                    started_at=started,
                    ended_at=ended,
                    organisation=org,
                )
                activity_count += 1

        # TimeLogs — link users to their assigned tasks
        user_task_pairs = [
            (staff1, tasks[2]),   # Onboarding Checklist
            (staff2, tasks[1]),   # Update Security Policy
            (staff2, tasks[15]),  # API Documentation
            (staff4, tasks[3]),   # Quarterly Financial Report
            (staff5, tasks[12]),  # Supply Chain Optimization
            (staff6, tasks[6]),   # Brand Guidelines
            (staff7, tasks[7]),   # GDPR Compliance
            (staff8, tasks[5]),   # CI/CD Pipeline
            (mgr1, tasks[0]),    # Q1 Performance Reviews
            (mgr2, tasks[5]),    # CI/CD Pipeline (oversight)
        ]
        for day_offset in range(3):
            for user, task in user_task_pairs:
                started = now - timedelta(days=day_offset, hours=6)
                ended = started + timedelta(hours=2, minutes=15)
                TimeLog.objects.create(
                    user=user,
                    task=task,
                    started_at=started,
                    ended_at=ended,
                    organisation=org,
                )
                time_log_count += 1

        # BreakLogs
        for day_offset in range(5):
            for i, user in enumerate(work_users):
                if i % 2 == day_offset % 2:  # alternate to get variety
                    started = now - timedelta(days=day_offset)
                    started = started.replace(hour=12, minute=30, second=0)
                    ended = started + timedelta(minutes=45)
                    BreakLog.objects.create(
                        user=user,
                        break_type=break_types[(i + day_offset) % len(break_types)],
                        started_at=started,
                        ended_at=ended,
                        organisation=org,
                    )
                    break_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Created {activity_count} activity logs, {time_log_count} time logs, {break_count} break logs"
        ))

        # ------------------------------------------------------------------ #
        # 13. Billing Profile
        # ------------------------------------------------------------------ #
        BillingProfile.objects.create(
            organisation=org,
            contact_name="Tanya Wilson",
            billing_email="billing@appraiser-corp.com",
            address="100 Innovation Drive, San Francisco, CA 94105",
            plan_tier=BillingProfile.PlanTier.PROFESSIONAL,
            billing_cycle=BillingProfile.BillingCycle.MONTHLY,
            payment_status=BillingProfile.PaymentStatus.ACTIVE,
        )
        self.stdout.write(self.style.SUCCESS("Created billing profile"))

        # ------------------------------------------------------------------ #
        # Done
        # ------------------------------------------------------------------ #
        self.stdout.write(self.style.SUCCESS(
            "\n=== Seed data creation complete ===\n"
            f"  Organisation: 1\n"
            f"  Departments:  {len(departments)}\n"
            f"  Users:        {len(all_users)}\n"
            f"  Projects:     {len(projects)} (with {milestone_count} milestones)\n"
            f"  Tasks:        {len(tasks)}\n"
            f"  Categories:   {len(categories)}\n"
            f"  Policies:     {len(policies)} (with versions & {ack_count} acknowledgments)\n"
            f"  Job Descs:    {len(jds)}\n"
            f"  Audit Logs:   {len(audit_entries)}\n"
            f"  Notifications:{len(notif_data)}\n"
            f"  Conversations:5 (with {len(messages_data)} messages)\n"
            f"  Activity Logs:{activity_count}\n"
            f"  Time Logs:    {time_log_count}\n"
            f"  Break Logs:   {break_count}\n"
            f"  Billing:      1\n"
        ))
