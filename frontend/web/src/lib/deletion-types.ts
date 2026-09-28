/** SOW §3.9 — document types the backend executor can resolve and delete. */
export const DELETION_DOCUMENT_TYPES = [
  "policy_version",
  "jd_version",
  "project_document",
] as const;

export type DeletionDocumentType = (typeof DELETION_DOCUMENT_TYPES)[number];

export const DELETION_TYPE_LABELS: Record<DeletionDocumentType, string> = {
  policy_version: "Policy version",
  jd_version: "Job description version",
  project_document: "Project document",
};

export const DELETION_TYPE_OPTIONS = DELETION_DOCUMENT_TYPES.map((value) => ({
  value,
  label: DELETION_TYPE_LABELS[value],
}));

export function deletionTypeLabel(documentType: string): string {
  return DELETION_TYPE_LABELS[documentType as DeletionDocumentType] ?? documentType;
}
