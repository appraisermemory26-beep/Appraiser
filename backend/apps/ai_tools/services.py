"""OpenRouter AI service for Appraiser platform."""
import json
import os
import requests

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """You are the Appraiser AI Assistant — an intelligent helper inside an enterprise performance and productivity platform called Appraiser.

Your capabilities:
1. **Generate Job Descriptions** — Given a role title, department, seniority, and key responsibilities, produce a structured, professional JD.
2. **Productivity Coaching** — Provide personalised daily tips based on task load and progress.
3. **Task Summarisation** — Summarise task status, history, time logs, and submitted outputs in plain language.
4. **Project Progress Summaries** — Summarise project status from task data and milestones.
5. **Milestone Extraction** — From a workplan or result framework, extract key milestones, deliverables, and deadlines.
6. **Report Draft Support** — Generate structured draft reports for projects given a reporting period.
7. **Policy Document Drafting** — Help draft organisational policies.
8. **Natural Language Search** — Help users find tasks, projects, and documents using plain English queries.

Guidelines:
- Always label your outputs as AI-generated drafts requiring human review.
- Be professional, concise, and actionable.
- Format responses with markdown: use headers, bullet points, and bold for clarity.
- When generating documents (JDs, policies, reports), use a professional structure with sections.
- If you lack context, ask clarifying questions.
- Never fabricate data — if you need real data, say so.
"""


def chat_completion(messages: list[dict], user_context: str = "", timeout: int = 30) -> str:
    """Send a chat completion request to OpenRouter and return the response."""
    if not OPENROUTER_API_KEY:
        return "⚠️ AI service is not configured. Please set the OPENROUTER_API_KEY environment variable."

    system_msg = SYSTEM_PROMPT
    if user_context:
        system_msg += f"\n\nUser context:\n{user_context}"

    api_messages = [{"role": "system", "content": system_msg}]
    for msg in messages:
        api_messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })

    try:
        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://appraiser.credminds.com",
                "X-Title": "Appraiser AI Assistant",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": api_messages,
                "max_tokens": 2048,
                "temperature": 0.7,
            },
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except requests.exceptions.Timeout:
        return "⚠️ The AI service took too long to respond. Please try again."
    except requests.exceptions.RequestException as e:
        return f"⚠️ AI service error: {str(e)}"
    except (KeyError, IndexError, json.JSONDecodeError):
        return "⚠️ Unexpected response from AI service. Please try again."
