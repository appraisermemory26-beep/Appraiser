import { api } from "@/lib/api";
import type { DeletionDocumentType } from "@/lib/deletion-types";
import type {
  JobDescription,
  PaginatedResponse,
  Policy,
  Project,
  ProjectDocument,
} from "@/lib/types";

export interface DeletionDocumentOption {
  id: number;
  label: string;
  searchText: string;
}

const PROJECT_DOC_CATEGORY_LABELS: Record<string, string> = {
  PD: "Project Document",
  BUDGET: "Budget",
  WORKPLAN: "Work Plan",
  SCHEDULE: "Schedule",
  RESULT_FRAMEWORK: "Result Framework",
  SUPPORTING: "Supporting",
};

function fileNameFromPath(path: string): string {
  return path.split("/").pop() || "Document";
}

export async function fetchDeletionDocumentOptions(
  documentType: DeletionDocumentType,
): Promise<DeletionDocumentOption[]> {
  switch (documentType) {
    case "policy_version": {
      const res = await api.get<PaginatedResponse<Policy>>("/api/v1/policies/policies/");
      return res.results
        .flatMap((policy) =>
          (policy.versions ?? []).map((version) => ({
            id: version.id,
            label: `${policy.title} — v${version.version_number}`,
            searchText: `${policy.title} v${version.version_number} ${version.uploaded_by_name ?? ""}`.toLowerCase(),
          })),
        )
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    case "jd_version": {
      const res = await api.get<PaginatedResponse<JobDescription>>("/api/v1/jd-management/job-descriptions/");
      return res.results
        .flatMap((jd) =>
          (jd.versions ?? []).map((version) => ({
            id: version.id,
            label: `${jd.title} — v${version.version_number}`,
            searchText: `${jd.title} ${jd.role_title ?? ""} v${version.version_number} ${version.uploaded_by_name ?? ""}`.toLowerCase(),
          })),
        )
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    case "project_document": {
      const [docRes, projRes] = await Promise.all([
        api.get<PaginatedResponse<ProjectDocument>>("/api/v1/projects/project-documents/"),
        api.get<PaginatedResponse<Project>>("/api/v1/projects/projects/"),
      ]);
      const projectMap = Object.fromEntries(projRes.results.map((p) => [p.id, p.name]));
      return docRes.results
        .map((doc) => {
          const projectName = projectMap[doc.project] || `Project #${doc.project}`;
          const fileName = fileNameFromPath(doc.file);
          const categoryLabel = PROJECT_DOC_CATEGORY_LABELS[doc.category] || doc.category;
          return {
            id: doc.id,
            label: `${projectName} — ${fileName}`,
            searchText: `${projectName} ${fileName} ${categoryLabel} v${doc.version}`.toLowerCase(),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    default:
      return [];
  }
}
