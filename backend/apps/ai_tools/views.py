from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsOrganisationMember, IsManagerOrAbove

from .models import AIOutput, ChatThread, ChatMessage
from .serializers import (
    AIOutputSerializer,
    ChatThreadSerializer,
    ChatThreadListSerializer,
)
from .services import chat_completion


class AIOutputViewSet(viewsets.ModelViewSet):
    serializer_class = AIOutputSerializer
    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return AIOutput.objects.filter(organisation=self.request.user.organisation)

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            organisation=self.request.user.organisation,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_chat(request):
    """Send a message to the AI assistant. Persists the user prompt and the
    AI response into a `ChatThread` so history survives reloads.

    Expects JSON: { "thread_id"?: int, "content": "..." }  (preferred)
    Or legacy:    { "messages": [...], "output_type": "..." }
    Returns:      { "thread_id": 123, "user_message": {...}, "assistant_message": {...} }
    """
    user = request.user
    if not user.organisation_id:
        return Response({"error": "User has no organisation"}, status=400)

    content = (request.data.get("content") or "").strip()
    thread_id = request.data.get("thread_id")
    legacy_messages = request.data.get("messages") or []

    # Accept the legacy {messages: [...]} payload by deriving the latest user message.
    if not content and legacy_messages:
        for m in reversed(legacy_messages):
            if m.get("role") == "user":
                content = (m.get("content") or "").strip()
                break

    if not content:
        return Response({"error": "content is required"}, status=400)

    # Resolve or create the thread
    thread = None
    if thread_id:
        try:
            thread = ChatThread.objects.get(id=thread_id, user=user)
        except ChatThread.DoesNotExist:
            thread = None
    if thread is None:
        thread = ChatThread.objects.create(
            user=user,
            organisation=user.organisation,
            title=content[:80],
        )

    # Persist user turn first so it's never lost even if the LLM call fails
    user_turn = ChatMessage.objects.create(thread=thread, role="user", content=content)

    # Build full conversation history for the LLM
    convo = list(thread.messages.values("role", "content"))
    user_context = (
        f"User: {user.first_name} {user.last_name} ({user.email})\n"
        f"Role: {user.role}\n"
        f"Organisation: {user.organisation.name if user.organisation else 'N/A'}\n"
        f"Department: {user.department.name if user.department else 'N/A'}\n"
        f"Job Title: {user.job_title or 'N/A'}"
    )
    ai_response = chat_completion(convo, user_context)
    assistant_turn = ChatMessage.objects.create(
        thread=thread, role="assistant", content=ai_response
    )

    # Bump thread updated_at + lazily set a meaningful title from the first turn
    if not thread.title:
        thread.title = content[:80]
    thread.save(update_fields=["title", "updated_at"])

    AIOutput.objects.create(
        output_type="NL_SEARCH",
        user=user,
        organisation=user.organisation,
        input_data={"thread_id": thread.id, "last_query": content},
        output_content=ai_response,
        is_draft=True,
        entity_type="chat_thread",
        entity_id=thread.id,
    )

    return Response({
        "thread_id": thread.id,
        "user_message": {
            "id": user_turn.id, "role": "user", "content": user_turn.content,
            "created_at": user_turn.created_at,
        },
        "assistant_message": {
            "id": assistant_turn.id, "role": "assistant", "content": assistant_turn.content,
            "created_at": assistant_turn.created_at,
        },
        # Legacy fields for older clients
        "response": ai_response,
    })


class ChatThreadViewSet(viewsets.ModelViewSet):
    """User-scoped persisted AI assistant threads."""

    permission_classes = [IsAuthenticated, IsOrganisationMember]

    def get_queryset(self):
        return ChatThread.objects.filter(user=self.request.user).order_by("-updated_at")

    def get_serializer_class(self):
        if self.action in ("list",):
            return ChatThreadListSerializer
        return ChatThreadSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, organisation=self.request.user.organisation)

    def update(self, request, *args, **kwargs):
        # Allow renaming via PATCH only
        thread = self.get_object()
        title = request.data.get("title")
        if title is None:
            return Response({"error": "Only the 'title' field can be updated."}, status=400)
        thread.title = title[:255]
        thread.save(update_fields=["title", "updated_at"])
        return Response(ChatThreadSerializer(thread).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate_jd(request):
    """Generate a Job Description using AI.

    Expects: { role_title, department, seniority, key_responsibilities }
    Returns: { content, ai_output_id }
    """
    role_title = request.data.get("role_title", "")
    department = request.data.get("department", "")
    seniority = request.data.get("seniority", "")
    responsibilities = request.data.get("key_responsibilities", "")

    if not role_title:
        return Response({"error": "role_title is required"}, status=400)

    prompt = f"""Generate a professional, structured Job Description for the following role:

Role Title: {role_title}
Department: {department}
Seniority Level: {seniority}
Key Responsibilities: {responsibilities}

Please include the following sections:
1. Job Title
2. Department
3. Reports To
4. Job Summary
5. Key Responsibilities (detailed list)
6. Required Qualifications
7. Preferred Qualifications
8. Skills & Competencies
9. Working Conditions

Format the output as a clean, professional document."""

    messages = [{"role": "user", "content": prompt}]

    user = request.user
    user_context = f"User: {user.first_name} {user.last_name}, Role: {user.role}, Organisation: {user.organisation.name if user.organisation else 'N/A'}"

    ai_response = chat_completion(messages, user_context, timeout=15)

    ai_output = AIOutput.objects.create(
        output_type="JD_DRAFT",
        user=user,
        organisation=user.organisation,
        input_data={"role_title": role_title, "department": department, "seniority": seniority, "key_responsibilities": responsibilities},
        output_content=ai_response,
        is_draft=True,
        entity_type="job_description",
    )

    return Response({
        "content": ai_response,
        "ai_output_id": ai_output.id,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsOrganisationMember, IsManagerOrAbove])
def generate_policy_description(request):
    """Analyze an uploaded policy document and draft a vault description.

    Accepts multipart: { file, title? }.
    Returns: { description, ai_output_id, is_ai_generated }.
    """
    import os

    upload = request.FILES.get("file")
    title = (request.data.get("title") or "").strip()

    if not upload:
        return Response({"error": "file is required"}, status=400)

    ext = os.path.splitext(upload.name)[1].lower()
    if ext not in [".pdf", ".docx", ".doc"]:
        return Response({"error": "Only PDF and DOCX files are allowed."}, status=400)

    text = _read_uploaded_text(upload)
    if not text.strip():
        return Response({"error": "Could not extract text from document"}, status=400)

    title_line = f"Document title: {title}\n" if title else ""
    prompt = (
        "Analyze this organisational policy document and write a concise, professional "
        "description for a policy vault entry.\n\n"
        f"{title_line}\n"
        "The description should:\n"
        "- Summarize the policy's purpose in 2-4 sentences\n"
        "- Note the key topics or obligations covered\n"
        "- Use plain language suitable for staff browsing the policy vault\n\n"
        "Respond with ONLY the description text — no headings, labels, or markdown.\n\n"
        "DOCUMENT:\n"
        + text
    )

    user = request.user
    user_context = (
        f"User: {user.first_name} {user.last_name}, Role: {user.role}, "
        f"Organisation: {user.organisation.name if user.organisation else 'N/A'}"
    )
    ai_response = chat_completion([{"role": "user", "content": prompt}], user_context, timeout=15)

    ai_output = AIOutput.objects.create(
        output_type="POLICY_DESCRIPTION",
        user=user,
        organisation=user.organisation,
        input_data={"title": title, "filename": upload.name},
        output_content=ai_response,
        is_draft=True,
        entity_type="policy",
    )

    return Response({
        "description": ai_response.strip(),
        "ai_output_id": ai_output.id,
        "is_ai_generated": True,
    })


# ─── Project AI helpers (SOW 3.11) ───────────────────────────────────────────


def _read_uploaded_text(file_obj, max_chars: int = 30_000) -> str:
    """Best-effort extraction of plain text from an uploaded document."""
    if not file_obj:
        return ""
    name = getattr(file_obj, "name", "").lower()
    try:
        raw = file_obj.read()
    except Exception:
        return ""
    if name.endswith(".txt") or name.endswith(".md"):
        return raw.decode("utf-8", errors="ignore")[:max_chars]
    if name.endswith(".pdf"):
        try:
            import io
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(raw))
            return "\n".join(page.extract_text() or "" for page in reader.pages)[:max_chars]
        except Exception:
            return ""
    if name.endswith(".docx"):
        try:
            import io
            from docx import Document

            doc = Document(io.BytesIO(raw))
            return "\n".join(p.text for p in doc.paragraphs)[:max_chars]
        except Exception:
            return ""
    return raw.decode("utf-8", errors="ignore")[:max_chars]


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def extract_milestones(request):
    """Extract milestones from an uploaded workplan/result framework.

    Accepts: multipart {file} OR {project_id, document_id}.
    Returns: { milestones: [{title, description, deadline}], ai_output_id }.
    SLO: < 20s (SOW 3.11).
    """
    from apps.projects.models import Project, ProjectDocument

    project_id = request.data.get("project_id")
    document_id = request.data.get("document_id")
    upload = request.FILES.get("file")
    text = ""

    if upload:
        text = _read_uploaded_text(upload)
    elif document_id:
        try:
            doc = ProjectDocument.objects.get(
                id=document_id, project__organisation=request.user.organisation
            )
            text = _read_uploaded_text(doc.file)
        except ProjectDocument.DoesNotExist:
            return Response({"error": "document not found"}, status=404)
    else:
        return Response({"error": "Provide a file upload or document_id"}, status=400)

    if not text.strip():
        return Response({"error": "Could not extract text from document"}, status=400)

    prompt = (
        "Extract the key project milestones, deliverables, and deadlines from "
        "the document below. Respond ONLY with a JSON array of objects with "
        "keys 'title' (string), 'description' (string), and 'deadline' "
        "(YYYY-MM-DD or empty). Do not include any prose.\n\nDOCUMENT:\n"
        + text
    )
    raw = chat_completion([{"role": "user", "content": prompt}], "", timeout=20)

    import json as _json, re

    parsed = []
    try:
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        parsed = _json.loads(match.group(0) if match else raw)
        if not isinstance(parsed, list):
            parsed = []
    except Exception:
        parsed = []

    project = None
    if project_id:
        try:
            project = Project.objects.get(
                id=project_id, organisation=request.user.organisation
            )
        except Project.DoesNotExist:
            project = None

    ai_output = AIOutput.objects.create(
        output_type="MILESTONE_EXTRACTION",
        user=request.user,
        organisation=request.user.organisation,
        input_data={"project_id": project_id, "document_id": document_id},
        output_content=raw,
        is_draft=True,
        entity_type="project",
        entity_id=project.id if project else None,
    )
    return Response({
        "milestones": parsed,
        "ai_output_id": ai_output.id,
        "raw": raw,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def project_progress_summary(request):
    """AI summary of a project's current state.

    Expects: { project_id }. SLO: < 10s.
    """
    from apps.projects.models import Project, ProjectMilestone
    from apps.tasks.models import Task

    project_id = request.data.get("project_id")
    if not project_id:
        return Response({"error": "project_id is required"}, status=400)
    try:
        project = Project.objects.get(
            id=project_id, organisation=request.user.organisation
        )
    except Project.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)

    tasks = Task.objects.filter(project=project)
    milestones = ProjectMilestone.objects.filter(project=project).order_by("deadline")
    task_lines = "\n".join(
        f"- [{t.status}] {t.task_id} {t.title} (deadline {t.deadline}, progress {t.progress_percentage}%)"
        for t in tasks[:50]
    )
    ms_lines = "\n".join(
        f"- {'[done] ' if m.is_completed else ''}{m.title} (due {m.deadline})"
        for m in milestones[:30]
    )
    prompt = (
        f"Project: {project.name} ({project.status}, {project.start_year}-{project.end_year}).\n"
        f"Tasks ({tasks.count()}):\n{task_lines or '(none)'}\n\n"
        f"Milestones ({milestones.count()}):\n{ms_lines or '(none)'}\n\n"
        "Write a 4-6 sentence plain-language progress summary highlighting status, "
        "key wins, blockers, and what's next. Label as AI draft."
    )
    raw = chat_completion([{"role": "user", "content": prompt}], "", timeout=10)

    ai_output = AIOutput.objects.create(
        output_type="PROJECT_SUMMARY",
        user=request.user,
        organisation=request.user.organisation,
        input_data={"project_id": project_id},
        output_content=raw,
        is_draft=True,
        entity_type="project",
        entity_id=project.id,
    )
    return Response({"summary": raw, "ai_output_id": ai_output.id})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def draft_project_report(request):
    """Generate a draft project report for a given period.

    Expects: { project_id, period_start (YYYY-MM-DD), period_end, title? }.
    Persists as ProjectReport(is_ai_generated=True, is_draft=True). SLO: < 10s.
    """
    from apps.projects.models import Project, ProjectReport, ProjectMilestone
    from apps.tasks.models import Task

    project_id = request.data.get("project_id")
    start = request.data.get("period_start")
    end = request.data.get("period_end")
    title = request.data.get("title") or "Progress Report"
    if not (project_id and start and end):
        return Response(
            {"error": "project_id, period_start and period_end are required"},
            status=400,
        )
    try:
        project = Project.objects.get(
            id=project_id, organisation=request.user.organisation
        )
    except Project.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)

    tasks = Task.objects.filter(project=project, updated_at__date__range=[start, end])
    milestones = ProjectMilestone.objects.filter(project=project)
    task_lines = "\n".join(
        f"- [{t.status}] {t.task_id} {t.title}" for t in tasks[:80]
    )
    ms_lines = "\n".join(
        f"- {'[done] ' if m.is_completed else ''}{m.title}" for m in milestones[:30]
    )
    prompt = (
        f"Draft a structured project progress report for the period {start} to {end}.\n"
        f"Project: {project.name}.\n"
        f"Recent tasks:\n{task_lines or '(none)'}\n\n"
        f"Milestones:\n{ms_lines or '(none)'}\n\n"
        "Use these sections: Executive Summary, Activities Completed, Milestone Status, "
        "Key Risks/Blockers, Next-Period Plan. Label clearly as an AI-generated draft."
    )
    raw = chat_completion([{"role": "user", "content": prompt}], "", timeout=10)

    report = ProjectReport.objects.create(
        project=project,
        title=title,
        content=raw,
        period_start=start,
        period_end=end,
        is_ai_generated=True,
        is_draft=True,
        created_by=request.user,
    )
    ai_output = AIOutput.objects.create(
        output_type="REPORT_DRAFT",
        user=request.user,
        organisation=request.user.organisation,
        input_data={"project_id": project_id, "period_start": start, "period_end": end},
        output_content=raw,
        is_draft=True,
        entity_type="project_report",
        entity_id=report.id,
    )
    return Response({
        "report_id": report.id,
        "content": raw,
        "ai_output_id": ai_output.id,
    })


# ─── Platform-wide AI tools (SOW 3.12) ───────────────────────────────────────


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def coaching_tip(request):
    """Return a productivity coaching tip personalised to the current task load.
    SLO: < 10s. Cached for the calendar day per user."""
    from django.core.cache import cache
    from apps.tasks.models import Task

    cache_key = f"coaching_tip:{request.user.id}:{timezone_today_str()}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    user = request.user
    my = Task.objects.filter(assigned_to=user)
    open_count = my.filter(status__in=["CREATED", "ASSIGNED", "IN_PROGRESS"]).count()
    overdue = my.filter(
        deadline__lt=_now(),
        status__in=["CREATED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED"],
    ).count()
    summary = (
        f"User: {user.first_name} {user.last_name} ({user.role})\n"
        f"Open tasks: {open_count}; Overdue: {overdue}.\n"
    )
    prompt = (
        summary
        + "\nAs a productivity coach, give one concrete, actionable tip (<= 60 words) for today. Keep it warm, specific, and free of clichés."
    )
    raw = chat_completion([{"role": "user", "content": prompt}], "", timeout=10)
    ai_output = AIOutput.objects.create(
        output_type="COACHING_TIP",
        user=user,
        organisation=user.organisation,
        input_data={"open": open_count, "overdue": overdue},
        output_content=raw,
        is_draft=False,
        entity_type="user",
        entity_id=user.id,
    )
    payload = {"tip": raw, "ai_output_id": ai_output.id, "context": {"open": open_count, "overdue": overdue}}
    cache.set(cache_key, payload, 60 * 60 * 12)
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def task_summary(request):
    """Plain-language summary of a task: status history, time logs, outputs.
    Expects: { task_id }. SLO: < 10s."""
    from apps.tasks.models import Task

    task_id = request.data.get("task_id")
    if not task_id:
        return Response({"error": "task_id is required"}, status=400)
    try:
        task = Task.objects.get(id=task_id, organisation=request.user.organisation)
    except Task.DoesNotExist:
        return Response({"error": "Task not found"}, status=404)

    transitions = task.status_changes.order_by("timestamp").values(
        "from_status", "to_status", "timestamp"
    )
    outputs = task.outputs.order_by("created_at").values("text_content", "file", "created_at")
    reviews = task.reviews.order_by("created_at").values("action", "comment", "created_at")
    prompt = (
        f"Task {task.task_id} '{task.title}' — status {task.status}, progress {task.progress_percentage}%.\n"
        f"Description: {task.description[:500]}\nObjectives: {task.objectives[:500]}\n"
        f"Transitions: {list(transitions)}\nOutputs: {list(outputs)}\nReviews: {list(reviews)}\n\n"
        "Summarise this task's state in 5-8 sentences for a manager. Highlight progress, blockers, and what's outstanding."
    )
    raw = chat_completion([{"role": "user", "content": prompt}], "", timeout=10)
    ai_output = AIOutput.objects.create(
        output_type="TASK_SUMMARY",
        user=request.user,
        organisation=request.user.organisation,
        input_data={"task_id": task_id},
        output_content=raw,
        is_draft=True,
        entity_type="task",
        entity_id=task.id,
    )
    return Response({"summary": raw, "ai_output_id": ai_output.id})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def nl_search(request):
    """Natural-language search across tasks, projects, and policies.

    Returns plain-text matches augmented by an AI rephrasing of the top hits.
    SLO: < 10s (search portion is local; AI rephrase is bounded).
    """
    from apps.tasks.models import Task
    from apps.projects.models import Project
    from apps.policies.models import Policy
    from django.db.models import Q

    q = (request.data.get("query") or "").strip()
    if not q:
        return Response({"error": "query is required"}, status=400)
    org = request.user.organisation

    tasks = list(
        Task.objects.filter(organisation=org)
        .filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(task_id__icontains=q))
        .values("id", "task_id", "title", "status")[:10]
    )
    projects = list(
        Project.objects.filter(organisation=org)
        .filter(Q(name__icontains=q))
        .values("id", "name", "status")[:10]
    )
    policies = list(
        Policy.objects.filter(organisation=org)
        .filter(Q(title__icontains=q) | Q(description__icontains=q))
        .values("id", "title")[:10]
    )

    summary_prompt = (
        f"User asked: {q}\n"
        f"Top task hits: {tasks}\nProject hits: {projects}\nPolicy hits: {policies}\n"
        "Write 2-3 sentences telling the user what was found and where to look."
    )
    summary = chat_completion(
        [{"role": "user", "content": summary_prompt}], "", timeout=10
    )
    return Response({
        "query": q,
        "tasks": tasks,
        "projects": projects,
        "policies": policies,
        "summary": summary,
    })


# ─── Tiny helpers (deferred imports to avoid Django app-loading issues) ────


def _now():
    from django.utils import timezone

    return timezone.now()


def timezone_today_str():
    from django.utils import timezone

    return timezone.now().strftime("%Y-%m-%d")
