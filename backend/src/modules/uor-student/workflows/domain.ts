import type { UorStudentIdentity } from "../application/ports";

export const uorStudentWorkflowCategories = [
  "personal_event",
  "alert_preference",
  "community_report",
  "teaching_evaluation",
  "teaching_report",
  "tutor_profile",
  "tutoring_request",
  "tutoring_relationship",
  "tutoring_grant",
  "study_plan",
  "academic_appeal",
  "collective_request",
  "finance_reference_share",
  "finance_responsible_link",
  "market_listing",
  "market_reservation",
  "market_report",
  "product_configuration",
] as const;

export type UorStudentWorkflowCategory = typeof uorStudentWorkflowCategories[number];

export type UorStudentWorkflowView = {
  id: string;
  category: UorStudentWorkflowCategory;
  ownerProfileId: string;
  scopeKey: string;
  status: string;
  payload: Record<string, unknown>;
  version: number;
  expiresAt: string | null;
  actors: Array<{
    profileId: string;
    role: string;
    status: string;
    payload: Record<string, unknown> | null;
    decidedAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export interface UorStudentWorkflowRepository {
  create(input: {
    owner: UorStudentIdentity;
    category: UorStudentWorkflowCategory;
    scopeKey: string;
    status: string;
    payload: Record<string, unknown>;
    expiresAt?: Date | null;
    traceId?: string;
  }): Promise<UorStudentWorkflowView>;
  getAccessible(input: { student: UorStudentIdentity; id: string; category?: UorStudentWorkflowCategory }): Promise<UorStudentWorkflowView | null>;
  getOwned(input: { student: UorStudentIdentity; id: string; category: UorStudentWorkflowCategory; statuses?: string[] }): Promise<UorStudentWorkflowView | null>;
  getPublic(input: { student: UorStudentIdentity; id: string; category: UorStudentWorkflowCategory; statuses: string[] }): Promise<UorStudentWorkflowView | null>;
  getForActor(input: { student: UorStudentIdentity; id: string; category: UorStudentWorkflowCategory; role: string; actorStatuses: string[]; aggregateStatuses: string[] }): Promise<UorStudentWorkflowView | null>;
  list(input: {
    student: UorStudentIdentity;
    category: UorStudentWorkflowCategory;
    access: "owner" | "actor" | "public_institution";
    statuses?: string[];
    limit: number;
    cursor?: string;
  }): Promise<{ items: UorStudentWorkflowView[]; nextCursor: string | null }>;
  transitionOwned(input: {
    student: UorStudentIdentity;
    id: string;
    category: UorStudentWorkflowCategory;
    from: string[];
    to: string;
    payload?: Record<string, unknown>;
    traceId?: string;
  }): Promise<UorStudentWorkflowView | null>;
  addActor(input: {
    owner: UorStudentIdentity;
    aggregateId: string;
    category: UorStudentWorkflowCategory;
    profileId: string;
    role: string;
    status: string;
    payload?: Record<string, unknown>;
    traceId?: string;
  }): Promise<UorStudentWorkflowView | null>;
  decideActor(input: {
    student: UorStudentIdentity;
    aggregateId: string;
    category: UorStudentWorkflowCategory;
    role: string;
    from: string[];
    to: string;
    aggregateStatuses?: string[];
    traceId?: string;
  }): Promise<UorStudentWorkflowView | null>;
  reactPublic(input: {
    student: UorStudentIdentity;
    aggregateId: string;
    category: UorStudentWorkflowCategory;
    role: string;
    status: string;
    allowedAggregateStatuses: string[];
    payload?: Record<string, unknown>;
    traceId?: string;
  }): Promise<UorStudentWorkflowView | null>;
  revokeTutoringRelationship(input: { student: UorStudentIdentity; relationshipId: string; traceId?: string }): Promise<UorStudentWorkflowView | null>;
  listEvents(input: { student: UorStudentIdentity; aggregateId: string; limit: number }): Promise<Array<{
    id: string;
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
  }> | null>;
}
