import {
  resolveAbsoluteApiUrl,
  resolveApiRequestUrl,
} from "@/lib/runtime-config";

const TOKEN_KEY = "uor_token";
const CSRF_COOKIE = "uor_csrf";
const SESSION_HINT_COOKIE = "uor_session_hint";
const LEGACY_SESSION_HINT_COOKIE = "uor_session";
const COOKIE_SESSION_SENTINEL = "cookie-session";
let sessionHintActive = false;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface AdminSmsConfirmationResponse {
  success: true;
  operation: string;
  phone: string;
  codeLast4: string;
  expiresAt: string;
}

export interface PassportChallengeResetResult {
  challengeAnswersDeleted: number;
  surpriseEffectsDeleted: number;
  scansDeleted: number;
  studentBadgesDeleted: number;
  rankingFreezesDeleted: number;
  pointLedgerDeleted: number;
  qrActionScansDeleted: number;
}

export interface ProjectVotesResetResult {
  studentVotesDeleted: number;
  legacyVotesDeleted: number;
  scoreEventsDeleted: number;
}

export type ExhibitorScoreAdjustmentAction =
  | "QUALIFIED_FEEDBACK"
  | "PENALTY"
  | "STAND_BONUS"
  | "AMBASSADOR_MISSION"
  | "EXHIBITOR_MISSION"
  | "TEAM_BONUS";

export interface ExhibitorScoreAdjustmentInput {
  submissionId: number;
  action: ExhibitorScoreAdjustmentAction;
  points: number;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  studentId?: number | null;
  actorStudentId?: number | null;
  submissionMemberId?: number | null;
  role?: string | null;
  roundKey?: string | null;
  roundLabel?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExhibitorScoreAdjustmentResult {
  success: true;
  message: string;
  votesCount: number;
  score: number;
  scoreDelta: number;
  scoringEvents: Array<{ action: string; points: number; reason: string }>;
}

export interface ExhibitorScoreRoundConfig {
  key: string;
  label: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  status: "ACTIVE" | "FROZEN" | "CLOSED" | "DRAFT";
}

export interface ExhibitorScoreConfigPayload {
  version: number;
  weights: Record<string, number>;
  streakBonuses: Array<{ minCourses: number; points: number }>;
  rounds: ExhibitorScoreRoundConfig[];
}

export interface ExhibitorScoreConfigUpdateInput {
  weights?: Record<string, number>;
  streakBonuses?: Array<{ minCourses: number; points: number }>;
  rounds?: ExhibitorScoreRoundConfig[];
}

export interface ExhibitorScoreFreezeResult {
  freezeId: number;
  eventKey: string;
  frozenAt: string;
  lockedEvents: number;
  totalProjects: number;
}

export interface ExhibitorScoreRecalculateResult {
  eventKey: string;
  scannedEvents: number;
  changedEvents: number;
  beforeTotal: number;
  afterTotal: number;
}

export interface ExhibitorMemberLevelAwardResult {
  eventKey: string;
  scannedMembers: number;
  awarded: Array<{
    submissionId: number;
    memberId: number;
    memberName: string;
    level: string;
    points: number;
  }>;
}

export interface ExhibitorAutomaticMissionAwardResult {
  eventKey: string;
  scannedEvents: number;
  awardedCount: number;
  awardedPoints: number;
  awarded: Array<{
    businessKey: string;
    submissionId: number;
    memberId: number | null;
    action: string;
    sourceType: string;
    sourceId: string;
    points: number;
    reason: string;
  }>;
}

export interface ExhibitorTeamBonusAwardResult {
  eventKey: string;
  awardedCount: number;
  awardedPoints: number;
  awarded: Array<{
    businessKey: string;
    submissionId: number;
    sourceId: string;
    points: number;
  }>;
}

export interface ExhibitorAmbassadorRanking {
  eventKey: string;
  generatedAt: string;
  totalMembers: number;
  members: Array<{
    rank: number;
    submissionId: number;
    submissionName: string;
    memberId: number;
    memberName: string;
    conversions: number;
    coursesReached: number;
    missionPoints: number;
    penalties: number;
    scoreContribution: number;
    level: string | null;
    maxCourseStreak: number;
    inactiveRounds: number;
  }>;
}

export interface ExhibitorScoringAlerts {
  eventKey: string;
  generatedAt: string;
  totalAlerts: number;
  alerts: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    submissionId: number;
    submissionName: string;
    memberId?: number | null;
    memberName?: string | null;
    message: string;
    count: number;
  }>;
}

export interface ExhibitorScoreRankingExport {
  eventKey: string;
  generatedAt: string;
  frozenOnly: boolean;
  totalProjects: number;
  totalScore: number;
  weights: Record<string, number>;
  projects: Array<{
    rank: number;
    submissionId: number;
    name: string;
    course: string | null;
    type: string;
    area: string;
    score: number;
    votes: number;
    breakdown: Record<string, number>;
    courses: Array<{
      course: string;
      points: number;
      events: number;
    }>;
  }>;
}

export interface ExhibitorMemberDutyInput {
  submissionId: number;
  submissionMemberId: number;
  action: "EXHIBITOR_CHECK_IN" | "EXHIBITOR_CHECK_OUT";
  role: "EXPOSITOR" | "AMBASSADOR";
  roundKey?: string | null;
  roundLabel?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExhibitorEmptyStandPenaltyInput {
  submissionId: number;
  roundKey: string;
  roundLabel?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StudentProfile {
  id: number;
  studentNumber: string;
  accessType?: "OFFICIAL" | "TEMPORARY";
  name: string | null;
  email: string | null;
  course: string | null;
  classCode?: string | null;
  academicYear?: string | null;
  academicPeriod?: string | null;
  curricularYear?: string | null;
  academicSyncedAt?: string | null;
  birthDate: string | null;
  nationality: string | null;
  university?: string | null;
  isUorStudent?: boolean | null;
  registrationSource?: string | null;
  phone: string | null;
  alternatePhone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  profileCompletedAt?: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  isIncomplete?: boolean;
}

export interface StudentProfileUpdateInput {
  name?: string;
  email?: string;
  course?: string;
  phone?: string;
  alternatePhone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  consentPhotoCredential?: boolean;
  consentPublicProfile?: boolean;
  consentSocialLinks?: boolean;
  consentSms?: boolean;
  consentWhatsapp?: boolean;
  visibilityJson?: string | null;
}

export interface CompleteProfileInput {
  name: string;
  avatarUrl?: string | null;
  bio?: string;
  address?: string;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  consentPhotoCredential?: boolean;
  consentPublicProfile?: boolean;
  consentSocialLinks?: boolean;
  consentSms?: boolean;
  consentWhatsapp?: boolean;
  visibilityJson?: string | null;
}

export interface StudentProfileExtra {
  bio: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  consentPhotoCredential: boolean;
  consentPublicProfile: boolean;
  consentSocialLinks: boolean;
  consentSms: boolean;
  consentWhatsapp: boolean;
  visibilityJson: string | null;
}

export type ProfileContextKey =
  | "BASIC"
  | "CONTACT_READY"
  | "PUBLIC_READY"
  | "TEAM_READY"
  | "ADMIN_READY"
  | "EXPOSITOR_READY";

export interface ProfileCompletionContext {
  key: ProfileContextKey;
  label: string;
  completionScore: number;
  ready: boolean;
  missingFields: TeamCredentialRequirement[];
  missingRequiredFields: TeamCredentialRequirement[];
}

export interface StudentProfileState {
  primaryState: ProfileContextKey;
  completionScore: number;
  contexts: ProfileCompletionContext[];
  profileExtra: StudentProfileExtra | null;
  fieldSources: Record<
    string,
    "SECRETARIA" | "STUDENT" | "ADMIN" | "IMPORT" | "SYSTEM" | "UNKNOWN"
  >;
}

export interface AuthLoginResponse {
  success: boolean;
  studentNumber?: string;
  student?: StudentProfile;
  token?: string;
  error?: string;
}

export interface MediaUploadResponse {
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  originalMimeType: string;
  size: number;
  originalSize: number;
  width: number | null;
  height: number | null;
  metadataUrl: string;
}

export interface StudentWithStats extends StudentProfile {
  _count: {
    likes: number;
    votes: number;
    comments: number;
    courseEnrollments: number;
    certificates: number;
    attendanceCheckIns: number;
    submissions: number;
    submissionMemberships: number;
    liveChatMessages: number;
    passportScans: number;
    passportPointLedger: number;
    passportChallengeAnswers: number;
    passportStudentBadges: number;
    passportSurpriseEffects: number;
    exhibitorVoteScoreEvents: number;
    exhibitorActorScoreEvents: number;
  };
  activitySummary?: StudentActivitySummary;
}

export interface StudentActivityProject {
  id: number;
  referenceCode: string;
  name: string;
  type: string;
  status: string;
  role: "RESPONSAVEL" | "MEMBRO";
  course?: string | null;
  area?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface StudentActivitySummary {
  projects: StudentActivityProject[];
  businesses: StudentActivityProject[];
  products: StudentActivityProject[];
  courses: Array<{
    id: number;
    name: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  challenges: {
    digitalPassportEvents: number;
    exhibitorEvents: number;
    badges: number;
  };
  recentEvents: Array<{
    id: string;
    type:
      | "AUTH"
      | "PROJECT"
      | "BUSINESS"
      | "PRODUCT"
      | "COURSE"
      | "CERTIFICATE"
      | "ATTENDANCE"
      | "DIGITAL_PASSPORT"
      | "EXHIBITOR_CHALLENGE"
      | "LIVE_CHAT";
    title: string;
    description?: string | null;
    status?: string | null;
    points?: number | null;
    happenedAt: string;
  }>;
}

export interface StudentPagedStats {
  total: number;
  official: number;
  temporary: number;
  universities: number;
  synced: number;
  profileComplete: number;
  withEmail: number;
  withPhone: number;
}

export interface StudentPagedFacets {
  courses: string[];
  universities: string[];
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StudentsPagedResult extends PagedResult<StudentWithStats> {
  stats: StudentPagedStats;
  facets: StudentPagedFacets;
}

export interface PublicLiveVoteProject {
  id: number;
  name: string;
  detailPath: string;
  type: string;
  votes: number;
  score: number;
  comments: number;
  averageRating: number;
  pageViews: number;
  uniqueVisitors: number;
  authenticatedVisitors: number;
  rank: number;
  share: number;
  recentVotes: number;
}

export interface PublicLiveVoteCourse {
  course: string;
  votes: number;
  students: number;
  recentVotes: number;
  lastVoteAt: string | null;
}

export interface PublicLiveVoteMoment {
  id: number;
  course: string;
  project: string;
  createdAt: string;
}

export interface PublicLiveVotesOverview {
  generatedAt: string;
  totals: {
    votes: number;
    score: number;
    projects: number;
    activeCourses: number;
    recentVotes: number;
    pageViews: number;
    uniqueVisitors: number;
    authenticatedVisitors: number;
  };
  leader: PublicLiveVoteProject | null;
  projects: PublicLiveVoteProject[];
  courses: PublicLiveVoteCourse[];
  moments: PublicLiveVoteMoment[];
}

export type PaymentStatus =
  | "SUBMITTED_BY_USER"
  | "PENDING_REVIEW"
  | "CONFIRMED_BY_ADMIN"
  | "REJECTED"
  | "CANCELED";

export type PaymentTimelineStatus = "done" | "current" | "pending";
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type SubmissionType = "PROJECT" | "BUSINESS" | "PRODUCT";
export type AdminRole = "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER";
export type CertificateType =
  | "PARTICIPATION"
  | "EVENT_PARTICIPATION"
  | "COURSE_COMPLETION"
  | "PROJECT_EXHIBITION";
export type CertificateStatus = "ISSUED" | "REVOKED";

export interface PaymentTimelineItem {
  key: string;
  label: string;
  status: PaymentTimelineStatus;
  at: string | null;
  by: string | null;
  note: string | null;
}

export interface StudentOwnedSubmissionListItem {
  id: number;
  referenceCode: string;
  name: string;
  description: string;
  status: SubmissionStatus;
  statusLabel: string;
  type: SubmissionType;
  typeLabel: string;
  createdAt: string;
  detailPath: string;
  repoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  bannerUrl: string | null;
  receiptPath: string;
  exhibitorPdfPath: string | null;
  viewerRole?: "RESPONSAVEL" | "MEMBRO";
  canManageTeam?: boolean;
  canManagePresentation?: boolean;
  canManageChallenge?: boolean;
  teamInviteUrl: string | null;
  teamJourneyLabel: string;
  teamTotalMembers: number;
  teamConfirmedMembers: number;
  teamAllConfirmed: boolean;
  teamMembers: SubmissionTeamMember[];
}

export interface SubmissionTeamMember {
  id: number;
  name: string;
  confirmed: boolean;
  confirmedAt: string | null;
  expectedStudentNumber: string | null;
  studentNumber: string | null;
  studentName: string | null;
  studentCourse: string | null;
  isExternal: boolean;
  externalOrganization: string | null;
  externalReason: string | null;
  exceptionApprovedAt: string | null;
  role: "RESPONSAVEL" | "MEMBRO";
  roleLabel: string;
  isResponsible: boolean;
}

export interface SubmissionTeamState {
  teamInviteUrl: string | null;
  teamJourneyLabel: string;
  teamTotalMembers: number;
  teamConfirmedMembers: number;
  teamAllConfirmed: boolean;
  teamMembers: SubmissionTeamMember[];
}

export interface SubmissionTeamPayload {
  submission: {
    id: number;
    referenceCode: string;
    name: string;
    status: SubmissionStatus;
    type: SubmissionType;
    typeLabel: string;
    course: string | null;
    leaderName: string | null;
    detailPath: string;
  };
  inviteUrl: string | null;
  token: string | null;
  totalMembers: number;
  confirmedMembers: number;
  allConfirmed: boolean;
  journeyLabel: string;
  members: SubmissionTeamMember[];
}

export interface ExternalTeamMemberCredentials {
  studentNumber: string;
  temporaryPassword: string;
}

export interface ExhibitorPdfLinkPayload {
  submissionId: number;
  fileName: string;
  pdfPath: string;
  publicUrl: string | null;
  generatedAt: string;
  version: number;
  created: boolean;
}

export interface ExhibitorPdfRecipient {
  id: string;
  name: string;
  phone: string | null;
  role: "RESPONSAVEL" | "MEMBRO";
  confirmed: boolean;
  studentNumber: string | null;
  memberId: number | null;
}

export interface ExhibitorPdfRecipientsPayload {
  submissionId: number;
  teamTotalMembers: number;
  teamConfirmedMembers: number;
  recipients: ExhibitorPdfRecipient[];
}

export interface SubmissionPresentationUpdateResult {
  id: number;
  slug: string;
  detailPath: string;
  description: string;
  repoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  bannerUrl: string | null;
  status?: string;
}

export interface StudentSubmissionReceipt {
  id: number;
  referenceCode: string;
  name: string;
  description: string;
  status: SubmissionStatus;
  statusLabel: string;
  type: SubmissionType;
  typeLabel: string;
  area: string;
  course: string | null;
  stage: string | null;
  category: string | null;
  productType: string | null;
  createdAt: string;
  updatedAt: string;
  members: string;
  membersList: string[];
  teamSize: number;
  leaderName: string | null;
  leaderPhone: string | null;
  leaderEmail: string | null;
  needs: string[];
  observations: string | null;
  repoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  bannerUrl: string | null;
  communityUrl: string | null;
  boardingPassPath: string;
  exhibitorPdfPath: string | null;
  paymentStatus: PaymentStatus;
  paymentStatusLabel: string;
  paymentSubmittedAt: string | null;
  paymentReviewedAt: string | null;
  paymentReviewedByStudentNumber: string | null;
  paymentReviewNote: string | null;
  paymentTimeline: PaymentTimelineItem[];
  paymentProofPath: string | null;
  receiptPath: string;
  detailPath: string;
  canEdit: boolean;
  viewerRole?: "RESPONSAVEL" | "MEMBRO";
  canManageSubmission?: boolean;
}

export interface StudentEnrollmentListItem {
  id: number;
  courseId: number;
  courseName: string;
  companyName: string;
  referenceCode: string;
  paymentStatus: string;
  statusLabel: string;
  enrolledAt: string;
  receiptPath: string;
  ticketPath: string | null;
  paymentProofPath: string | null;
}

export interface StudentEnrollmentReceipt {
  id: number;
  courseId: number;
  courseName: string;
  courseDescription: string;
  companyName: string;
  companyCategory: string;
  communityUrl: string | null;
  referenceCode: string;
  studentNumber: string;
  fullName: string;
  email: string | null;
  studentCourse: string | null;
  phone: string | null;
  paymentPhone: string | null;
  paymentStatus: string;
  statusLabel: string;
  paymentSubmittedAt: string | null;
  paymentReviewedAt: string | null;
  paymentReviewedByStudentNumber: string | null;
  paymentReviewNote: string | null;
  paymentTimeline: PaymentTimelineItem[];
  paymentProofPath: string | null;
  ticketPath: string | null;
  whatsAppRedirectUrl: string | null;
  enrolledAt: string;
  receiptPath: string;
}

export interface AdminAuthorizedStudent {
  id: number;
  studentNumber: string;
  team: string;
  role: AdminRole;
  permissions: string;
  isActive: boolean;
  revokedAt?: string | null;
  revokedByStudentNumber?: string | null;
  revocationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccessConflict {
  studentNumber: string;
  issue:
    | "NO_ACTIVE_MEMBERSHIP"
    | "BLOCKED_BY_INACTIVE_MEMBERSHIP"
    | "OFFICIAL_MEMBERSHIP_PRECEDENCE";
  severity: "MEDIUM" | "HIGH";
  accessBlocked: boolean;
  effectiveSource: "ADMIN_AUTHORIZED_STUDENT" | "TEAM_MEMBERSHIP" | "BLOCKED";
  admin: AdminAuthorizedStudent;
  memberships: Array<{
    id: number;
    fullName: string;
    category: string;
    team: string;
    role: string;
    permissions: string;
    status: string;
    updatedAt: string;
  }>;
}

export interface AdminAccessProfile {
  studentNumber: string;
  team: string;
  role: AdminRole;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AdminSecurityOverview {
  authorizedStudents: AdminAuthorizedStudent[];
  recentLogins: StudentProfile[];
  adminAccessConflicts: AdminAccessConflict[];
}

export interface JuryMember {
  id: number;
  name: string;
  phone: string;
  team: string;
  role: AdminRole;
  permissions: string;
  isActive: boolean;
  lastCodeSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JurySendCodeResult {
  success: boolean;
  juryMemberId: number;
  phone: string;
  codeLast4: string;
  expiresAt: string;
  deliveryStatus: string;
}

export interface JuryLoginResponse {
  success: boolean;
  token?: string;
  juryMember?: JuryMember;
  error?: string;
}

export interface TeamCredentialMember {
  id: number;
  teamMembershipId: number | null;
  token: string;
  publicSlug: string;
  category: string;
  categoryLabel: string;
  team: string;
  role: string;
  accessLevel: string;
  permissions: string[];
  status: string;
  statusLabel: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  course: string | null;
  organization: string | null;
  bio: string | null;
  photoUrl: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  consentPhotoCredential: boolean;
  consentPublicProfile: boolean;
  consentSocialLinks: boolean;
  consentSms: boolean;
  consentWhatsapp: boolean;
  sourceSubmissionId: number | null;
  sourceSubmissionRef: string | null;
  sourceSubmissionName: string | null;
  sourceSubmissionType: string | null;
  sourceSubmissionArea: string | null;
  notes: string | null;
  createdByStudentNumber: string | null;
  issuedAt: string | null;
  issuedByStudentNumber: string | null;
  hasIssuedSnapshot: boolean;
  invitationExpiresAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  version: number;
  reissuedFromId: number | null;
  inviteUrl: string;
  profileUrl: string;
  passPdfPath: string;
  passPdfUrl: string | null;
  submittedAt: string | null;
  lastPassIssuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicTeamCredentialMember = Omit<
  TeamCredentialMember,
  "token" | "teamMembershipId"
>;

export interface TeamCredentialRequirement {
  key: string;
  label: string;
  required: boolean;
}

export interface TeamCredentialOverview {
  stats: {
    total: number;
    invited: number;
    profileReady: number;
    disabled: number;
    teams: number;
  };
  members: TeamCredentialMember[];
  teams: Array<{
    name: string;
    total: number;
    profileReady: number;
    invited: number;
    categories: string[];
  }>;
}

export interface TeamCredentialAdminSessionProfile {
  requiresCompletion: boolean;
  reason: string | null;
  completionScore: number;
  missingFields: TeamCredentialRequirement[];
  student: {
    studentNumber: string;
    name: string | null;
    email: string | null;
    course: string | null;
    phone: string | null;
    avatarUrl: string | null;
    bio: string | null;
    address: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    websiteUrl: string | null;
    profileCompletedAt: string | null;
  } | null;
  member: TeamCredentialMember | null;
}

export interface TeamCredentialIncompleteProfiles {
  stats: {
    total: number;
    incomplete: number;
    ready: number;
  };
  members: Array<
    TeamCredentialMember & {
      completionScore: number;
      missingFields: TeamCredentialRequirement[];
    }
  >;
}

export interface TeamMembership {
  id: number;
  studentNumber: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  category: string;
  categoryLabel: string;
  team: string;
  role: string;
  accessLevel: string;
  permissions: string[];
  status: string;
  statusLabel: string;
  version: number;
  mandateLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  source: string;
  notes: string | null;
  createdByStudentNumber: string | null;
  verifiedAt: string | null;
  verifiedByStudentNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamProfilePreset {
  key: string;
  label: string;
  category: string;
  team: string;
  role: string;
  accessLevel: string;
  permissions: string[];
  description: string;
  functions: NucleusFunctionOption[];
}

export interface TeamMembershipSearchResult extends TeamMembership {
  hasCredential: boolean;
  credentialStatus: string | null;
  credentialInviteUrl: string | null;
}

export interface TeamMembershipOverview {
  stats: {
    total: number;
    active: number;
    suspended: number;
    removed: number;
    alumni: number;
    linkedToStudent: number;
    verified: number;
  };
  members: TeamMembership[];
}

export interface NucleusClaimOption {
  key: string;
  label: string;
  description: string;
}

export interface NucleusAreaOption extends NucleusClaimOption {
  team: string;
  permissions: string[];
  functions: NucleusFunctionOption[];
}

export interface NucleusFunctionOption extends NucleusClaimOption {
  areaKey: string;
  team: string;
  accessLevel: string;
  permissions: string[];
}

export interface TeamMembershipClaim {
  id: number;
  studentNumber: string;
  officialName: string | null;
  officialEmail: string | null;
  officialCourse: string | null;
  officialPhone: string | null;
  requestedCategory: string;
  requestedTeam: string;
  requestedRole: string;
  requestedAccessLevel: string;
  requestedPermissions: string[];
  status: string;
  statusLabel: string;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  course: string | null;
  organization: string | null;
  bio: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByStudentNumber: string | null;
  teamMembershipId: number | null;
  credentialId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMembershipClaimOverview {
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  claims: TeamMembershipClaim[];
}

export interface TeamMembershipInput {
  studentNumber?: string | null;
  fullName: string;
  category?: string;
  team?: string;
  role?: string;
  accessLevel?: string;
  permissions?: string[];
  status?: "ACTIVE" | "SUSPENDED" | "REMOVED" | "ALUMNI";
  mandateLabel?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  source?: string;
  notes?: string | null;
}

export type AdminTaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type AdminTaskPriority = "low" | "medium" | "high" | "urgent";

export interface AdminTaskAttachment {
  id: string;
  name: string;
  dataUrl: string;
  addedAt: string;
}

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  category: string;
  assigneeId: number | null;
  assigneeName: string | null;
  assigneePhone: string | null;
  dueDate: string | null;
  attachments: AdminTaskAttachment[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminTaskInput = Pick<
  AdminTask,
  | "title"
  | "description"
  | "priority"
  | "category"
  | "assigneeId"
  | "assigneeName"
  | "assigneePhone"
  | "dueDate"
  | "attachments"
>;

export interface TeamCredentialMembershipMatchCandidate {
  teamMembership: TeamMembership;
  score: number;
  confidence: string;
  reasons: string[];
}

export interface TeamCredentialMembershipMatch {
  credential: TeamCredentialMember;
  candidates: TeamCredentialMembershipMatchCandidate[];
  ambiguous: boolean;
  recommendedTeamMembershipId: number | null;
}

export interface TeamCredentialMembershipMatchOverview {
  stats: {
    totalCredentials: number;
    linkedCredentials: number;
    unlinkedCredentials: number;
    suggested: number;
    ambiguous: number;
    membershipsWithoutStudentNumber: number;
  };
  items: TeamCredentialMembershipMatch[];
}

export interface TeamCredentialInput {
  teamMembershipId?: number | null;
  category?: string;
  team?: string;
  role?: string;
  accessLevel?: string;
  permissions?: string[];
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  course?: string | null;
  organization?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  consentPhotoCredential?: boolean;
  consentPublicProfile?: boolean;
  consentSocialLinks?: boolean;
  consentSms?: boolean;
  consentWhatsapp?: boolean;
  notes?: string | null;
  expiresAt?: string | null;
}

export type TeamCredentialPassPrintMode = "color" | "black-white";
export type TeamCredentialPassSide = "front" | "back" | "both";
export type TeamCredentialPassLayout = "single" | "a4-3up" | "a4-4up" | "a4-2up-landscape";
export type TeamCredentialPassDuplexMode = "long-edge" | "short-edge" | "same-position";

export interface TeamCredentialPassOptions {
  printMode?: TeamCredentialPassPrintMode;
  side?: TeamCredentialPassSide;
  layout?: TeamCredentialPassLayout;
  duplexMode?: TeamCredentialPassDuplexMode;
  marginMm?: number;
  bleedMm?: number;
  laminationMarginMm?: number;
  calibration?: boolean;
}

export interface CredentialPrintTemplate {
  category: string;
  categoryLabel: string;
  primaryColor: string;
  accentColor: string;
  lightColor: string;
  footerLabel: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedByStudentNumber: string | null;
}

export interface CredentialPrintTemplateInput {
  primaryColor: string;
  accentColor: string;
  lightColor: string;
  footerLabel?: string | null;
}

export interface CredentialPrintBatchItem {
  id: number;
  position: number;
  label: string | null;
  itemType: "NOMINAL" | "GENERIC" | string;
  credential: TeamCredentialMember;
  createdAt: string;
}

export interface CredentialPrintBatch {
  id: number;
  code: string;
  title: string;
  mode: "NOMINAL" | "GENERIC" | "MIXED";
  status: string;
  totalItems: number;
  createdByStudentNumber: string | null;
  notes: string | null;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
  items: CredentialPrintBatchItem[];
}

export interface CredentialPrintBatchNominalInput {
  name: string;
  category?: string;
  team?: string;
  role?: string;
  accessLevel?: string;
  permissions?: string[];
  email?: string | null;
  phone?: string | null;
  course?: string | null;
  organization?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  notes?: string | null;
  expiresAt?: string | null;
}

export interface CredentialPrintBatchGenericInput {
  category?: string;
  team?: string;
  role?: string;
  accessLevel?: string;
  permissions?: string[];
  prefix?: string;
  quantity: number;
  startNumber?: number;
  organization?: string | null;
  notes?: string | null;
  expiresAt?: string | null;
}

export interface CredentialPrintBatchInput {
  title: string;
  notes?: string | null;
  nominalItems?: CredentialPrintBatchNominalInput[];
  genericItems?: CredentialPrintBatchGenericInput[];
}

export interface TeamCredentialSiteGuestsSyncResult {
  created: number;
  updated: number;
  skipped: number;
  speakers: number;
}

export interface TeamCredentialPublicSubmission {
  name: string;
  email?: string | null;
  phone?: string | null;
  course?: string | null;
  organization?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  consentPhotoCredential?: boolean;
  consentPublicProfile?: boolean;
  consentSocialLinks?: boolean;
  consentSms?: boolean;
  consentWhatsapp?: boolean;
}

export interface TeamCredentialNucleusContext {
  student: {
    id: number;
    studentNumber: string;
    name: string | null;
    email: string | null;
    course: string | null;
    phone: string | null;
    avatarUrl: string | null;
    academicSyncedAt: string | null;
  };
  suggestedTeamMembershipId: number | null;
  suggestedMatchConfidence:
    | "studentNumber"
    | "exact"
    | "firstLast"
    | "partial"
    | null;
  isBulk?: boolean;
  alreadyClaimed?: boolean;
  claimedCredential?: TeamCredentialMember | null;
  members: TeamMembership[];
  claimOptions: {
    areas: NucleusAreaOption[];
    functions: NucleusFunctionOption[];
  };
  pendingClaim?: TeamMembershipClaim | null;
}

export interface MyTeamCredentialResponse {
  credential: TeamCredentialMember | null;
  membership: TeamMembership | null;
  credentials: TeamCredentialMember[];
  memberships: TeamMembership[];
}

export interface BulkInvitationResponse {
  token: string;
  url: string;
  totalMembers: number;
  claimed: number;
  pending: number;
}

export interface ExpositorSubmissionItem {
  id: number;
  referenceCode: string;
  name: string;
  type: string;
  area: string;
  status: string;
}

export interface ExpositorContextResponse {
  student: {
    id: number;
    studentNumber: string;
    name: string | null;
    email: string | null;
    course: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
  submissions: ExpositorSubmissionItem[];
  suggestedSubmissionId: number | null;
  alreadyClaimed?: boolean;
  claimedCredential?: TeamCredentialMember | null;
}

export interface ProjectPublicComment {
  id: number;
  content: string;
  createdAt: string;
  studentName: string;
  studentAvatarUrl?: string | null;
  course: string | null;
}

export interface ProjectPublicLike {
  id: number;
  createdAt: string;
  studentName: string;
  studentAvatarUrl?: string | null;
  course: string | null;
}

export type ProjectFeedSort = "recent_desc" | "votes_desc" | "likes_desc" | "comments_desc";
export type ProjectFeedView = "cards" | "compact";
export type ProjectFeedAudience = "all" | "competition" | "exhibitions";

export interface ProjectPublicFeedItem {
  id: number;
  slug: string;
  detailPath: string;
  shareUrl: string;
  qrCodeValue: string;
  name: string;
  summary: string;
  area: string;
  description: string;
  course: string | null;
  stage: string | null;
  category: string | null;
  productType: string | null;
  members: string;
  membersList: string[];
  teamSize: number;
  type: string;
  typeLabel: string;
  createdAt: string;
  isWinner: boolean;
  canVote: boolean;
  canLike: boolean;
  eligibleForAward: boolean;
  primaryColor: string;
  secondaryColor: string;
  bannerUrl: string | null;
  repoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  likesCount: number;
  votesCount: number;
  commentsCount: number;
  likes: ProjectPublicLike[];
  comments: ProjectPublicComment[];
}

export interface CourseEnrollment {
  id: number;
  studentNumber: string;
  fullName: string;
  course: string | null;
  phone: string | null;
  paymentPhone: string | null;
  paymentStatus: string;
  statusLabel: string;
  paymentSubmittedAt: string | null;
  paymentReviewedAt: string | null;
  paymentReviewedByStudentNumber: string | null;
  paymentReviewNote: string | null;
  paymentProofPath: string | null;
  whatsAppUrl: string | null;
  enrolledAt: string;
}

export interface CourseEnrollmentInput {
  studentNumber: string;
  fullName?: string | null;
  studentCourse?: string | null;
  phone?: string | null;
  paymentPhone?: string | null;
  paymentStatus?: PaymentStatus;
  note?: string | null;
}

export interface CourseEnrollmentsPayload {
  course: {
    id: number;
    name: string;
    description: string;
    companyName: string;
    companyCategory: string;
    communityUrl: string | null;
    studentCount: number;
  };
  enrollments: CourseEnrollment[];
}

export type CourseEnrollmentsPagedPayload = CourseEnrollmentsPayload &
  PagedResult<CourseEnrollment>;

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuideStep {
  id: number;
  title: string;
  description: string;
  link: string | null;
  linkText: string | null;
  icon: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuideTip {
  id: number;
  content: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Venue {
  id: number;
  name: string;
  description: string;
  capacity: string;
  floor: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuideContent {
  steps: GuideStep[];
  tips: GuideTip[];
  venues: Venue[];
}

export interface HomeCourse {
  id: number;
  title: string;
  description: string;
  icon: string;
  ctaText: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PanelTopic {
  id: number;
  title: string;
  description: string;
  speaker: string;
  time: string;
  local: string;
  day: string;
  dateLabel: string;
  icon: string;
  type: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HomeContent {
  courses: HomeCourse[];
  panelTopics: PanelTopic[];
  socialConfig: HomeSocialConfig;
}

export interface HeroFloatingIcon {
  id: string;
  icon: string;
  top: number;
  left: number;
  size: number;
  rotate: number;
  opacity: number;
}

export interface HomeSponsor {
  id: string;
  name: string;
  imageUrl: string;
  label: string | null;
}

export interface HomeSocialConfig {
  key: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  courseEnrollmentEnabled: boolean;
  firstYearContestEnabled: boolean;
  primaryColor: string;
  primaryGradient: string;
  titleColor: string;
  accentColor: string;
  dashedColor: string;
  dashedOpacity: number;
  heroIconsOpacity: number;
  heroBlobsIntensity: number;
  heroMeshEnabled: boolean;
  heroBadgeText: string;
  heroTitlePrefix: string;
  heroTitleHighlight: string;
  heroSubtitleText: string;
  heroSubtitleColor: string;
  heroTitleMobileSize: string;
  heroTitleTabletSize: string;
  heroTitleDesktopSize: string;
  heroSubtitleMobileSize: string;
  heroSubtitleTabletSize: string;
  heroSubtitleDesktopSize: string;
  heroFloatingIcons: HeroFloatingIcon[];
  sponsors: HomeSponsor[];
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: number;
  name: string;
  description: string;
  preview: string | null;
  communityUrl: string | null;
  companyName: string;
  companyCategory: string;
  companyLogoUrl: string | null;
  companyWebsite: string | null;
  companyInstagram: string | null;
  companyLinkedin: string | null;
  isPaid: boolean;
  priceLabel: string | null;
  studentCount: number;
  likesCount: number;
  accentColor: string;
  accentColorSecondary: string;
  courseColor: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoursesContent {
  courses: Course[];
  topCourses: Course[];
  preview: Course[];
}

export interface TrainerCourseOption {
  id: number;
  name: string;
  description: string;
  companyName: string;
  companyCategory: string;
  isPublished: boolean;
}

export type TrainerRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TrainerRegistrationRequest {
  id: number;
  phone: string;
  name: string;
  email: string | null;
  specialty: string;
  bio: string;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  organization: string | null;
  selectedCourseId: number;
  selectedCourse: TrainerCourseOption;
  status: TrainerRequestStatus;
  reviewedAt: string | null;
  reviewedByStudentNumber: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerRegistrationSubmitInput {
  phone: string;
  name: string;
  email?: string | null;
  specialty: string;
  bio: string;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  organization?: string | null;
  selectedCourseId: number;
}

export interface TrainerDashboard {
  trainer: {
    id: number;
    name: string;
    status: string;
  };
  course: TrainerCourseOption;
  metrics: {
    totalEnrollments: number;
    confirmedPayments: number;
    pendingPayments: number;
    rejectedPayments: number;
  };
  updatedAt: string;
}

export interface CourseEnrollmentPayload {
  paymentProof?: string;
  paymentConfirmed?: true;
  paymentPhone?: string;
}

export type SmsAudienceType =
  | "ALL_STUDENTS"
  | "STUDENT_CLASS"
  | "STUDENT_COURSE"
  | "STUDENT_CLASS_OR_COURSE"
  | "COURSE_ENROLLED"
  | "SUBMISSION_ENROLLED"
  | "COURSE_OR_SUBMISSION_ENROLLED"
  | "EXHIBITORS"
  | "GROUP_REPRESENTATIVES"
  | "COURSE_OR_EXHIBITORS"
  | "WINNERS"
  | "SELECTED_STUDENTS";

export interface SmsAudienceInput {
  type: SmsAudienceType;
  studentClassCodes?: string[];
  studentCourses?: string[];
  courseIds?: number[];
  submissionStatuses?: Array<"PENDING" | "APPROVED" | "REJECTED">;
  selectedStudentNumbers?: string[];
  selectedPhones?: string[];
  includeProviderTos?: string[];
  excludeProviderTos?: string[];
  cookieMarketingOptIn?: boolean;
  cookieAnalyticsOptIn?: boolean;
  activeWithinDays?: number;
}

export interface SmsRecipientPreviewItem {
  studentId: number | null;
  studentNumber: string | null;
  name: string | null;
  course: string | null;
  classCode: string | null;
  phone: string;
  providerTo: string;
  sources: string[];
}

export interface SmsRecipientPreviewPayload {
  totalCandidates: number;
  filteredCandidates: number;
  totalRecipients: number;
  skippedCount: number;
  approvalRequired: boolean;
  approvalToken: string;
  recipients: SmsRecipientPreviewItem[];
  skipped: Array<{
    studentId: number | null;
    studentNumber: string | null;
    name: string | null;
    course: string | null;
    classCode: string | null;
    phone: string | null;
    source: string;
    reason: string;
  }>;
}

export interface SmsCampaignSummary {
  id: number;
  title: string | null;
  sender: string;
  audienceType: string;
  status: string;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  createdByStudentNumber: string;
  createdAt: string;
  sentAt: string | null;
  scheduleAt: string | null;
}

export interface SmsAutomationSetting {
  eventKey: "SUBMISSION_CONTEXT_AUDIENCE" | "LIVE_CHAT_CONTEXT_AUDIENCE";
  label: string;
  description: string;
  enabled: boolean;
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmsOverviewPayload {
  integration: {
    configured: boolean;
    baseUrl: string;
    defaultSender: string | null;
    approvedSenders: string[];
    credits: number | null;
    providerStatus: string;
    providerMessage: string | null;
  };
  audiences: {
    allStudents: { total: number; sendable: number };
    studentClass?: { total: number; sendable: number };
    courseEnrolled: { total: number; sendable: number };
    exhibitors: { total: number; sendable: number };
    winners: { total: number; sendable: number };
    marketingConsented: { total: number; sendable: number };
    activeLast7Days: { total: number; sendable: number };
  };
  automations: SmsAutomationSetting[];
  campaigns: SmsCampaignSummary[];
}

export interface SmsAudienceButton {
  type: SmsAudienceType;
  label: string;
  total: number;
  sendable: number;
}

export interface SmsStudentCourseButton {
  course: string;
  total: number;
  sendable: number;
}

export interface SmsStudentClassButton {
  classCode: string;
  total: number;
  sendable: number;
}

export interface SmsFilterOptionsPayload {
  audienceButtons: SmsAudienceButton[];
  studentClassButtons: SmsStudentClassButton[];
  studentCourseButtons: SmsStudentCourseButton[];
  updatedAt: string;
}

export interface SmsProviderProxyResponse {
  ok: boolean;
  status: number;
  payload: unknown;
}

export interface SmsSendPayload {
  title?: string;
  sender?: string;
  message: string;
  audience: SmsAudienceInput;
  schedule?: string;
  approvalToken?: string;
}

export interface SmsSendResult {
  campaignId: number;
  status: string;
  totalCandidates: number;
  totalRecipients: number;
  skippedCount: number;
  successCount: number;
  failedCount: number;
  sender: string;
  scheduleAt: string | null;
  failures: Array<{
    phone: string;
    providerTo: string;
    reason: string;
  }>;
}

export interface CampaignFailureItem {
  phone: string;
  providerTo: string;
  errorMessage: string | null;
  studentNumber: string | null;
}

export interface SmsCampaignFailuresPayload {
  campaignId: number;
  title: string | null;
  message: string;
  sender: string;
  failures: CampaignFailureItem[];
}

export interface SmsAutomationUpdatePayload {
  enabled: boolean;
  title?: string;
  message?: string;
}

export interface WhatsAppCampaignFailuresPayload {
  campaignId: number;
  title: string | null;
  message: string;
  instanceName: string;
  failures: CampaignFailureItem[];
}

export type WhatsAppAudienceInput = SmsAudienceInput;
export type WhatsAppRecipientPreviewItem = SmsRecipientPreviewItem;
export type WhatsAppRecipientPreviewPayload = SmsRecipientPreviewPayload;

export interface WhatsAppInstanceSummary {
  id: number;
  name: string;
  label: string | null;
  phoneNumber: string | null;
  status: string;
  qrCode: string | null;
  pairingCode: string | null;
  baseUrl: string | null;
  hasCustomApiKey: boolean;
  isDefault: boolean;
  isActive: boolean;
  lastConnectedAt: string | null;
  lastCheckedAt: string | null;
  createdByStudentNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppCampaignSummary {
  id: number;
  title: string | null;
  instanceId: number | null;
  instanceName: string;
  audienceType: string;
  status: string;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  mediaUrl: string | null;
  createdByStudentNumber: string;
  createdAt: string;
  sentAt: string | null;
}

export interface WhatsAppAutomationSetting {
  eventKey:
    | "COURSE_ENROLLMENT_CREATED"
    | "COURSE_ENROLLMENT_STATUS_UPDATED"
    | "SUBMISSION_CREATED"
    | "SUBMISSION_CONTEXT_AUDIENCE"
    | "SUBMISSION_STATUS_UPDATED"
    | "SUBMISSION_ENGAGEMENT_MILESTONE"
    | "SUBMISSION_MARKED_WINNER"
    | "CERTIFICATE_ISSUED"
    | "ATTENDANCE_CHECKED_IN"
    | "LIVE_CHAT_CONTEXT_AUDIENCE";
  label: string;
  description: string;
  enabled: boolean;
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppOverviewPayload {
  integration: {
    configured: boolean;
    baseUrl: string;
    providerStatus: string;
    providerMessage: string | null;
    publicAppUrl: string | null;
  };
  automations: WhatsAppAutomationSetting[];
  instances: WhatsAppInstanceSummary[];
  audiences: SmsOverviewPayload["audiences"];
  campaigns: WhatsAppCampaignSummary[];
}

export interface WhatsAppInstanceInput {
  name: string;
  label?: string;
  phoneNumber?: string;
  baseUrl?: string;
  apiKey?: string;
  token?: string;
  isDefault?: boolean;
}

export interface WhatsAppSendPayload {
  title?: string;
  message: string;
  audience: WhatsAppAudienceInput;
  instanceId?: number;
  delay?: number;
  approvalToken?: string;
  media?: {
    url: string;
    fileName?: string;
    mimeType?: string;
    type?: "image" | "video" | "document";
    caption?: string;
  };
}

export interface WhatsAppSendResult {
  campaignId: number;
  status: string;
  totalCandidates: number;
  totalRecipients: number;
  skippedCount: number;
  successCount: number;
  failedCount: number;
  instanceName: string;
  failures: Array<{
    phone: string;
    providerTo: string;
    reason: string;
  }>;
}

export interface WhatsAppAutomationUpdatePayload {
  enabled: boolean;
  title?: string;
  message?: string;
}

export interface PdfJobQueued {
  id: string;
  kind: string;
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  hasFile?: boolean;
  fileName?: string;
  sizeBytes?: number | null;
  statusPath: string;
  filePath: string;
}

export interface PdfJobStatus {
  id: string;
  kind: string;
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  hasFile?: boolean;
  fileName?: string;
  sizeBytes?: number | null;
  statusPath: string;
  filePath: string;
}

export interface AttendanceCredential {
  id: number;
  token: string;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  label: string;
  eventKey: string;
  eventLabel: string;
  validFrom: string | null;
  validUntil: string | null;
  status: string;
  isValid: boolean;
  validationUrl: string;
  qrImageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceCheckIn {
  id: number;
  credentialId: number;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  eventKey: string;
  eventLabel: string;
  checkedInAt: string;
  checkedInByStudentNumber: string;
  notes: string | null;
}

export interface AttendanceMePayload {
  credential: AttendanceCredential;
  checkedIn: boolean;
  lastCheckIn: AttendanceCheckIn | null;
  checkIns: AttendanceCheckIn[];
  certificatesCount: number;
}

export interface AttendanceOverview {
  totalCredentials: number;
  totalCheckIns: number;
  todayCheckIns: number;
  recentCheckIns: AttendanceCheckIn[];
}

export interface QrActionItem {
  id: number;
  token: string;
  type: string;
  label: string;
  description: string | null;
  targetId: number | null;
  targetMeta: string | null;
  eventKey: string | null;
  eventLabel: string | null;
  active: boolean;
  maxScans: number | null;
  expiresAt: string | null;
  smsOnScan: boolean;
  smsTemplate: string | null;
  smsSender: string | null;
  passportMissionId: number | null;
  scansCount: number;
  qrImageUrl: string;
  createdAt: string;
}

export interface QrActionScanItem {
  id: number;
  studentNumber: string;
  studentName: string | null;
  result: string;
  message: string | null;
  scannedAt: string;
}

export interface QrScanResult {
  success: boolean;
  result: string;
  message: string;
  actionType: string;
  actionLabel: string;
  pointsAwarded?: number;
  requiresAnswer?: boolean;
  challenge?: DigitalPassportChallenge | null;
  surprise?: DigitalPassportSurpriseReveal | null;
}

export interface QrActionsOverview {
  totalActions: number;
  activeActions: number;
  totalScans: number;
  todayScans: number;
  byType: Array<{ type: string; count: number; scans: number }>;
}

export interface StudentScanHistoryItem {
  id: number;
  actionType: string;
  actionLabel: string;
  result: string;
  message: string | null;
  scannedAt: string;
}

export type DigitalPassportMissionStatus =
  | "done"
  | "available"
  | "locked"
  | "expired";

export interface DigitalPassportMission {
  id: number;
  key: string;
  type: string;
  title: string;
  description: string | null;
  points: number;
  pointsEarned: number;
  completions: number;
  status: DigitalPassportMissionStatus;
  completedAt: string | null;
}

export interface DigitalPassportBadge {
  id: number;
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  earned: boolean;
  awardedAt: string | null;
}

export interface DigitalPassportRecentScan {
  id: number;
  missionKey: string | null;
  missionTitle: string | null;
  missionType: string | null;
  result: string;
  pointsAwarded: number;
  message: string | null;
  scannedAt: string;
}

export interface DigitalPassportRecentSurprise {
  id: number;
  displayCode?: string | null;
  name: string;
  description: string | null;
  effectType: string;
  effectValue: number;
  rarity: string;
  beforePoints: number;
  afterPoints: number;
  deltaPoints: number;
  message: string | null;
  appliedAt: string;
}

export interface DigitalPassportSummary {
  studentNumber: string;
  joinedAt: string | null;
  participantCount: number;
  points: number;
  surpriseBonusPoints: number;
  totalAvailablePoints: number;
  pointCaps: {
    missionPoints: number;
    surprisePointsCap: number;
    recoveryPointsCap: number;
    totalAvailablePoints: number;
  };
  completedMissions: number;
  totalMissions: number;
  progressPercent: number;
  ranking: {
    position: number;
    points: number;
  } | null;
  missions: DigitalPassportMission[];
  badges: DigitalPassportBadge[];
  recentScans: DigitalPassportRecentScan[];
  recentSurprises: DigitalPassportRecentSurprise[];
  referral: {
    code: string | null;
    url: string | null;
    inviteCount: number;
    pointsEarned: number;
    nextMilestone: number;
  };
}

export type DigitalPassportConstructiveFeedbackFocus =
  | "clareza"
  | "impacto"
  | "viabilidade"
  | "apresentacao"
  | "experiencia";

export interface DigitalPassportConstructiveFeedbackResult {
  status: string;
  message: string;
  pointsAwarded: number;
  completedCount: number;
  requiredCount: number;
  missionCompleted: boolean;
  comment: {
    id: number;
    content: string;
    createdAt: string;
  } | null;
  submission: {
    id: number;
    name: string;
  } | null;
}

export type ExhibitorPassportMissionStatus =
  | "done"
  | "available"
  | "locked";

export interface ExhibitorPassportMission {
  key: string;
  type: string;
  title: string;
  description: string;
  points: number;
  pointsEarned: number;
  completions: number;
  status: ExhibitorPassportMissionStatus;
  completedAt: string | null;
}

export interface ExhibitorPassportBadge {
  key: string;
  label: string;
  description: string;
  icon: string | null;
  earned: boolean;
  awardedAt: string | null;
}

export interface ExhibitorPassportRecentEvent {
  id: number;
  businessKey: string;
  submissionId: number;
  submissionName: string;
  action: string;
  sourceType: string;
  points: number;
  reason: string | null;
  roundLabel: string | null;
  awardedAt: string;
  effect: "GAIN" | "LOSS" | "NEUTRAL";
}

export interface ExhibitorPassportOpportunity {
  key: string;
  type: string;
  title: string;
  description: string;
  pointsLabel: string;
  icon: string | null;
  completedCount: number;
  pointsEarned: number;
  status: "done" | "available" | "attention" | "locked";
}

export interface ExhibitorPassportRoundFlowItem {
  key: string;
  label: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  status: "ACTIVE" | "FROZEN" | "CLOSED" | "DRAFT";
  phase: "past" | "current" | "next" | "upcoming" | "closed";
  progressPercent: number;
  minutesRemaining: number | null;
  startsInMinutes: number | null;
}

export interface ExhibitorPassportRoundFlow {
  generatedAt: string;
  currentRoundKey: string | null;
  currentLabel: string | null;
  currentMultiplier: number;
  minutesRemaining: number | null;
  items: ExhibitorPassportRoundFlowItem[];
  streakTargets: Array<{
    minCourses: number;
    points: number;
    label: string;
  }>;
}

export interface ExhibitorPassportMemberEffort {
  memberId: number | null;
  name: string;
  studentNumber: string | null;
  role: "RESPONSAVEL" | "MEMBRO";
  confirmed: boolean;
  points: number;
  actions: number;
  positiveActions: number;
  penalties: number;
  level: "Ouro" | "Prata" | "Bronze" | "Sem movimento";
  lastActivityAt: string | null;
}

export interface StudentExhibitorPassportProject {
  submissionId: number;
  referenceCode: string;
  name: string;
  course: string | null;
  type: SubmissionType;
  area: string;
  primaryColor: string;
  secondaryColor: string;
  viewerRole: "RESPONSAVEL" | "MEMBRO";
  score: number;
  ranking: {
    position: number;
    totalProjects: number;
    points: number;
  } | null;
  progressPercent: number;
  completedMissions: number;
  totalMissions: number;
  totalAvailablePoints: number;
  teamTotalMembers: number;
  teamConfirmedMembers: number;
  missions: ExhibitorPassportMission[];
  badges: ExhibitorPassportBadge[];
  continuousActions: ExhibitorPassportOpportunity[];
  bonusOpportunities: ExhibitorPassportOpportunity[];
  teamActivity: ExhibitorPassportMemberEffort[];
  recentEvents: ExhibitorPassportRecentEvent[];
}

export interface StudentExhibitorPassportSummary {
  eventKey: string;
  generatedAt: string;
  hasExhibitorPassport: boolean;
  activeProject: StudentExhibitorPassportProject | null;
  projects: StudentExhibitorPassportProject[];
  roundFlow: ExhibitorPassportRoundFlow | null;
}

export interface DigitalPassportReferralInvite {
  code: string;
  inviterStudentNumber: string;
  inviterName: string;
  inviterCourse: string | null;
}

export interface DigitalPassportAdminMission {
  id: number;
  key: string;
  type: string;
  title: string;
  description: string | null;
  points: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  targetType: string | null;
  targetId: number | null;
  targetKey: string | null;
}

export interface DigitalPassportChallenge {
  id: number;
  type: string;
  question: string;
  options: string[] | null;
  maxAttempts: number;
  version: number;
  explanation: string | null;
}

export interface DigitalPassportNetworkingQr {
  token: string;
  validationUrl: string;
  qrImageUrl: string;
  actionId: number;
  label: string;
}

export interface DigitalPassportSurpriseReveal {
  id: number;
  displayCode: string | null;
  name: string;
  description: string | null;
  effectType: string;
  effectValue: number;
  targetScope: string;
  rarity: string;
  visibility: string;
  beforePoints: number;
  afterPoints: number;
  deltaPoints: number;
  message: string;
  hint?: string | null;
}

export interface DigitalPassportChallengeAnswerResult {
  ok: boolean;
  status: string;
  correct?: boolean;
  pointsAwarded: number;
  attemptsUsed?: number;
  attemptsRemaining?: number;
  message: string;
  challenge?: DigitalPassportChallenge;
}

export interface DigitalPassportAdminChallenge {
  id: number;
  missionId: number | null;
  missionTitle: string | null;
  missionPoints: number | null;
  qrActionId: number | null;
  qrActionLabel: string | null;
  qrActionType: string | null;
  type: string;
  question: string;
  options: string[] | null;
  explanation: string | null;
  maxAttempts: number;
  active: boolean;
  status: string;
  reviewNote: string | null;
  version: number;
  approvedAt: string | null;
  approvedByStudentNumber: string | null;
  pendingApproval: boolean;
  startsAt: string | null;
  endsAt: string | null;
  answersCount: number;
  createdAt: string;
}

export interface DigitalPassportAdminSurpriseQr {
  id: number;
  qrActionId: number;
  token: string;
  validationUrl: string;
  qrImageUrl: string;
  qrActionType: string;
  displayCode: string | null;
  batchCode: string | null;
  name: string;
  description: string | null;
  effectType: string;
  effectValue: number;
  dynamicRules: {
    mode?: "UNIVERSAL_DYNAMIC" | null;
    weights?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
    values?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
    lossAdjustment?: {
      afterLosses?: number | null;
      weights?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
      values?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
    } | null;
    convertAfterLosses?: number | null;
    convertToEffectType?: string | null;
    convertToEffectValue?: number | null;
    hintAfterLoss?: string | null;
  } | null;
  targetScope: string;
  rarity: string;
  visibility: string;
  maxUsesTotal: number | null;
  maxUsesPerStudent: number;
  negativeCapPerStudent: number | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  printedAt: string | null;
  effectsCount: number;
  createdAt: string;
}

export interface DigitalPassportAdminMissionQr {
  id: number;
  token: string;
  type: string;
  label: string;
  description: string | null;
  missionId: number | null;
  missionTitle: string | null;
  validationUrl: string;
  qrImageUrl: string;
  active: boolean;
  maxScans: number | null;
  expiresAt: string | null;
  scansCount: number;
  createdAt: string;
}

export interface DigitalPassportOwnedProjectChallenge {
  submissionId: number;
  submissionName: string;
  submissionType: string;
  status: "MISSING" | "PENDING_APPROVAL" | "APPROVED" | "PAUSED" | "REJECTED";
  qrActionId: number | null;
  validationUrl: string | null;
  qrImageUrl: string | null;
  challenge: {
    id: number;
    question: string;
    options: string[] | null;
    explanation: string | null;
    maxAttempts: number;
    active: boolean;
    status: string;
    reviewNote: string | null;
    version: number;
    approvedAt: string | null;
    approvedByStudentNumber: string | null;
    answersCount: number;
    createdAt: string;
  } | null;
}

export interface DigitalPassportOwnedProjectChallengeInput {
  submissionId: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
  maxAttempts?: number | null;
}

export type DigitalPassportSurpriseConcreteEffect =
  | "ADD_POINTS"
  | "SUBTRACT_POINTS"
  | "MULTIPLY_BONUS"
  | "DIVIDE_BONUS"
  | "NEUTRAL_HINT"
  | "RECOVERY_POINTS";

export interface DigitalPassportSurpriseQrInput {
  name?: string;
  description?: string | null;
  displayCode?: string | null;
  batchCode?: string | null;
  effectType?:
    | "ADD_POINTS"
    | "SUBTRACT_POINTS"
    | "MULTIPLY_BONUS"
    | "DIVIDE_BONUS"
    | "UNIVERSAL_DYNAMIC";
  effectValue?: number;
  dynamicRules?: {
    mode?: "UNIVERSAL_DYNAMIC" | null;
    weights?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
    values?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
    lossAdjustment?: {
      afterLosses?: number | null;
      weights?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
      values?: Partial<Record<DigitalPassportSurpriseConcreteEffect, number>> | null;
    } | null;
    convertAfterLosses?: number | null;
    convertToEffectType?:
      | "ADD_POINTS"
      | "SUBTRACT_POINTS"
      | "MULTIPLY_BONUS"
      | "DIVIDE_BONUS"
      | "NEUTRAL_HINT"
      | "RECOVERY_POINTS"
      | null;
    convertToEffectValue?: number | null;
    hintAfterLoss?: string | null;
  } | null;
  targetScope?: string | null;
  rarity?: "COMMON" | "RARE" | "SECRET" | "TEMPORARY";
  visibility?: "VISIBLE" | "SEMI_HIDDEN" | "SECRET";
  maxUsesTotal?: number | null;
  maxUsesPerStudent?: number | null;
  negativeCapPerStudent?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface DigitalPassportSurpriseQrBatchInput
  extends DigitalPassportSurpriseQrInput {
  name: string;
  effectType:
    | "ADD_POINTS"
    | "SUBTRACT_POINTS"
    | "MULTIPLY_BONUS"
    | "DIVIDE_BONUS"
    | "UNIVERSAL_DYNAMIC";
  effectValue: number;
  quantity: number;
  codePrefix?: string | null;
  startNumber?: number | null;
}

export interface DigitalPassportSurpriseQrBatchResult {
  batchCode: string;
  quantity: number;
  items: DigitalPassportAdminSurpriseQr[];
}

export interface DigitalPassportMissionQrInput {
  missionId: number;
  type:
    | "POINT_BATTLE_QR"
    | "CLUE_CHAIN_QR"
    | "COOPERATIVE_MISSION_QR"
    | "RECOVERY_SMART_QR";
  label: string;
  description?: string | null;
  cooperativeThreshold?: number | null;
  active?: boolean;
  maxScans?: number | null;
  expiresAt?: string | null;
}

export interface DigitalPassportChallengeInput {
  missionId?: number | null;
  qrActionId?: number | null;
  type?: "EXHIBITOR_CHALLENGE" | "SPECIAL_QUIZ";
  question?: string;
  options?: string[] | null;
  correctAnswer?: string;
  explanation?: string | null;
  maxAttempts?: number | null;
  active?: boolean;
  status?: "PENDING_APPROVAL" | "APPROVED" | "PAUSED" | "REJECTED";
  reviewNote?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface DigitalPassportAdminOverview {
  participants: number;
  activePlayers: number;
  totalScans: number;
  totalPoints: number;
  missions: Array<{
    id: number;
    key: string;
    type: string;
    title: string;
    points: number;
    active: boolean;
    scansCount: number;
    ledgerCount: number;
  }>;
  leaderboard: Array<{
    position: number;
    studentNumber: string;
    studentName: string | null;
    studentCourse: string | null;
    points: number;
  }>;
}

export interface DigitalPassportRankingRow {
  position: number;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  points: number;
  diversityScore: number;
  workshops: number;
  completedAt: string | null;
}

export interface DigitalPassportAdminReports {
  ranking: DigitalPassportRankingRow[];
  rankingFrozen: {
    id: number;
    frozenAt: string;
    frozenByStudentNumber: string | null;
    note: string | null;
  } | null;
  byCourse: Array<{ course: string; participants: number; points: number }>;
  byMissionType: Array<{
    type: string;
    title: string;
    points: number;
    entries: number;
  }>;
  byPeriod: Array<{ date: string; points: number; scans: number }>;
  attendanceByActivity: Array<{
    key: string;
    label: string;
    scans: number;
    uniqueStudents: number;
  }>;
  visitorsByExhibitor: Array<{
    key: string;
    label: string;
    scans: number;
    uniqueStudents: number;
  }>;
  operational: {
    scansPerMinuteLast15m: number;
    suspiciousScans: number;
    burstStudents: Array<{ studentNumber: string; scansLast15m: number }>;
  };
}

export interface DigitalPassportWinnersExport {
  generatedAt: string;
  winners: Array<DigitalPassportRankingRow & { prize: string }>;
}

export interface DigitalPassportMissionInput {
  key?: string;
  type?: string;
  title?: string;
  description?: string | null;
  points?: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  maxPointsPerStudent?: number | null;
  targetType?: string | null;
  targetId?: number | null;
  targetKey?: string | null;
  badgeKey?: string | null;
}

export interface CertificateItem {
  id: number;
  code: string;
  validationToken: string;
  type: CertificateType;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  sourceType: string | null;
  sourceId: number | null;
  issuedAt: string;
  issuedByStudentNumber: string;
  status: CertificateStatus;
  revokedAt: string | null;
  revokedReason: string | null;
  version: number;
  reissuedFromId: number | null;
  templateKey: string | null;
  validationUrl: string;
  qrImageUrl: string;
  pdfPath: string;
}

export interface CertificateTemplate {
  key: string;
  type: string;
  title: string;
  description: string;
}

export interface PublicValidationPayload {
  valid: boolean;
  kind: "certificate" | "attendance" | "team_credential";
  status: string;
  title: string;
  validationUrl: string;
  qrImageUrl: string;
  certificate: {
    id: number;
    code: string;
    type: string;
    recipientName: string | null;
    recipientNumber: string | null;
    recipientCourse: string | null;
    issuedAt: string;
    issuedByStudentNumber: string | null;
    revokedAt: string | null;
  } | null;
  attendance: {
    credentialId: number;
    studentNumber: string | null;
    studentName: string | null;
    studentCourse: string | null;
    checkedIn: boolean;
    lastCheckInAt: string | null;
    eventLabel: string | null;
  } | null;
  teamCredential: {
    credentialId: number;
    holderName: string | null;
    category: string;
    team: string;
    role: string;
    accessLevel: string;
    version: number;
    issuedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    revokedReason: string | null;
  } | null;
}

export interface OperationalValidationPayload extends Omit<
  PublicValidationPayload,
  "certificate" | "attendance" | "teamCredential"
> {
  certificate: {
    id: number;
    code: string;
    type: string;
    recipientName: string;
    recipientNumber: string | null;
    recipientCourse: string | null;
    issuedAt: string;
    issuedByStudentNumber: string;
    revokedAt: string | null;
  } | null;
  attendance: {
    credentialId: number;
    studentNumber: string;
    studentName: string | null;
    studentCourse: string | null;
    checkedIn: boolean;
    lastCheckInAt: string | null;
    eventLabel: string | null;
  } | null;
  teamCredential: {
    credentialId: number;
    holderName: string | null;
    studentNumber: string | null;
    email: string | null;
    phone: string | null;
    course: string | null;
    category: string;
    team: string;
    role: string;
    accessLevel: string;
    version: number;
    issuedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    revokedReason: string | null;
  } | null;
}

export interface AdminAuditLog {
  id: number;
  actorStudentNumber: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DataRetentionPolicy {
  auditLogRetentionDays: number;
  credentialValidationLogRetentionDays: number;
  expiredCredentialRetentionDays: number;
}

export interface DataRetentionCleanupResult {
  policy: DataRetentionPolicy;
  cutoffs: {
    auditLogsBefore: string;
    credentialValidationLogsBefore: string;
    expiredCredentialsBefore: string;
  };
  deletedAuditLogs: number;
  deletedCredentialValidationLogs: number;
  minimizedExpiredCredentials: number;
}

export interface ActivityFeedItem {
  id: string;
  type: "vote" | "comment" | "submission";
  message: string;
  actorName: string;
  actorAvatarUrl?: string | null;
  actorCourse: string | null;
  actorCourseColor: string | null;
  subject: string;
  createdAt: string;
}

export interface LiveChatMessage {
  id: number;
  content: string;
  attachmentUrl: string | null;
  attachmentMime: string | null;
  replyTo: {
    id: number;
    content: string;
    studentName: string;
    studentAvatarUrl?: string | null;
  } | null;
  reactionCounts: Record<string, number>;
  isPinned: boolean;
  isHighlighted: boolean;
  createdAt: string;
  studentName: string;
  studentAvatarUrl?: string | null;
  course: string | null;
  courseColor: string | null;
}

export interface AdminModerationProjectComment {
  id: number;
  content: string;
  createdAt: string;
  studentName: string;
  studentNumber: string;
  course: string | null;
  submissionId: number;
  submissionName: string;
  moderationStatus: string;
  feedbackReviewedAt: string | null;
  feedbackReviewedByStudentNumber: string | null;
  feedbackReviewNote: string | null;
  feedbackScoredAt: string | null;
}

export interface AdminModerationLiveChatMessage extends LiveChatMessage {
  studentNumber: string;
  reportCount: number;
  hiddenAt: string | null;
}

export type OdinRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type OdinAiCaseType = "DEVICE" | "STUDENT" | "PROJECT";
export type OdinAiActionType =
  | "MONITOR"
  | "REVIEW"
  | "INVALIDATE_VOTES"
  | "NOTIFY_FOR_APPEAL"
  | "ESCALATE_TO_ORGANIZATION";

export interface OdinDeviceRisk {
  deviceId: string;
  riskScore: number;
  riskLevel: OdinRiskLevel;
  reasons: string[];
  loginCount: number;
  voteCount: number;
  eventCount: number;
  distinctStudents: number;
  distinctProjectsVoted: number;
  lastSeenAt: string;
  lastIp: string | null;
  lastUserAgent: string | null;
  students: Array<{
    studentId: number | null;
    studentNumber: string;
    studentName: string | null;
    studentCourse: string | null;
    eventCount: number;
    voteCount: number;
    lastSeenAt: string;
  }>;
  projects: Array<{
    submissionId: number;
    submissionName: string;
    votes: number;
    students?: number;
  }>;
}

export interface OdinStudentRisk {
  studentId: number | null;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  riskScore: number;
  riskLevel: OdinRiskLevel;
  reasons: string[];
  devices: string[];
  voteCount: number;
  loginCount: number;
  lastSeenAt: string;
  projectsVoted: Array<{
    submissionId: number;
    submissionName: string;
    votes: number;
  }>;
}

export interface OdinProjectPressure {
  submissionId: number;
  submissionName: string;
  suspiciousVotes: number;
  suspiciousDevices: number;
  suspiciousStudents: number;
}

export interface OdinOverview {
  generatedAt: string;
  stats: {
    totalEvents: number;
    deviceCount: number;
    suspiciousDevices: number;
    suspectStudents: number;
    suspectVotes: number;
    multiAccountDevices: number;
    projectPressureCount: number;
  };
  devices: OdinDeviceRisk[];
  students: OdinStudentRisk[];
  projects: OdinProjectPressure[];
  suggestions: string[];
}

export interface OdinExcludeStudentInput {
  reason: string;
  deleteProfile: boolean;
  removeVotes: boolean;
  removeLikes: boolean;
  removeComments: boolean;
  removePassport: boolean;
}

export interface OdinExcludeStudentResult {
  success: true;
  studentId: number;
  studentNumber: string;
  deletedProfile: boolean;
  removed: {
    studentVotes: number;
    studentLikes: number;
    studentComments: number;
    qrActionScans: number;
    passportScans: number;
    passportChallengeAnswers: number;
    passportBadges: number;
    passportSurpriseEffectsRevoked: number;
    passportPointLedgerRevoked: number;
    exhibitorScoreEventsRevoked: number;
  };
}

export interface OdinAiAnalysis {
  id: number;
  caseType: OdinAiCaseType;
  caseId: string;
  riskScore: number;
  riskLevel: OdinRiskLevel;
  narrative: string;
  fraudProbability: number;
  legitimateProbability: number;
  mostLikelyScenario: string;
  alternativeScenario: string;
  recommendation: string;
  confidenceLevel: string;
  actionType: OdinAiActionType;
  modelVersion: string;
  promptVersion: string;
  tokensUsed: number | null;
  createdByStudentNumber: string | null;
  createdAt: string;
  feedbackCount: number;
}

export interface OdinAiFeedbackInput {
  useful: boolean;
  recommendationCorrect?: boolean | null;
  realityMatched?: boolean | null;
  note?: string | null;
}

export interface AnalyticsConsentState {
  essential: true;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  version: string;
}

export interface AnalyticsTrackEvent {
  type: string;
  category:
    | "NAVIGATION"
    | "ENGAGEMENT"
    | "CONVERSION"
    | "LIVE"
    | "AUTH"
    | "MARKETING"
    | "FUNCTIONAL"
    | "CONSENT"
    | "SECURITY";
  pageUrl?: string | null;
  routeName?: string | null;
  referrer?: string | null;
  elementId?: string | null;
  elementLabel?: string | null;
  duration?: number | null;
  scrollDepth?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface AnalyticsConsentPayload {
  visitorId?: string | null;
  sessionId?: string | null;
  source?: string;
  lastVisitedPage?: string | null;
  lastCampaign?: string | null;
  consent: AnalyticsConsentState;
}

export interface AnalyticsTrackPayload {
  visitorId: string;
  sessionId: string;
  deviceId?: string | null;
  pageUrl?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  consent: AnalyticsConsentState;
  events: AnalyticsTrackEvent[];
}

export interface AnalyticsFilterInput {
  from?: string;
  to?: string;
  course?: string;
  audience?: "all" | "anonymous" | "authenticated";
  source?: string;
  consent?: "all" | "analytics" | "functional" | "marketing" | "essential-only";
  search?: string;
  limit?: number;
  page?: number;
}

export interface AnalyticsDashboard {
  filters: {
    from: string;
    to: string;
    course: string;
    audience: "all" | "anonymous" | "authenticated";
    source: string;
    consent:
      | "all"
      | "analytics"
      | "functional"
      | "marketing"
      | "essential-only";
  };
  kpis: {
    visitorsToday: number;
    uniqueVisitors: number;
    uniqueSessions: number;
    authenticatedUsers: number;
    averageSessionDurationSeconds: number;
    conversionRate: number;
    liveEngagementRate: number;
    ticketShares: number;
    coursePageViews: number;
    projectPageViews: number;
  };
  charts: {
    visitorsByDay: Array<{
      date: string;
      visitors: number;
      sessions: number;
      conversions: number;
    }>;
    conversionFunnel: Array<{ step: string; value: number }>;
    topPages: Array<{ label: string; value: number }>;
    topEvents: Array<{ label: string; value: number }>;
    audienceSplit: Array<{ label: string; value: number }>;
    topCourses: Array<{ label: string; value: number }>;
  };
  logistics: {
    expectedOccupancySignal: number;
    ticketInfluenceVisits: number;
    whatsappClicks: number;
  };
  marketing: Array<{
    campaign: string;
    sessions: number;
    conversions: number;
    conversionRate: number;
  }>;
  consent: {
    analytics: number;
    functional: number;
    marketing: number;
    essentialOnly: number;
  };
  recentEvents: Array<{
    id: number;
    createdAt: string;
    eventType: string;
    eventCategory: AnalyticsTrackEvent["category"];
    pageUrl: string | null;
    audience: string;
    studentName: string | null;
    studentCourse: string | null;
    elementLabel: string | null;
    referrer: string | null;
  }>;
  courseOptions: string[];
}

export interface AnalyticsEventsPayload {
  items: Array<{
    id: number;
    createdAt: string;
    eventType: string;
    eventCategory: AnalyticsTrackEvent["category"];
    pageUrl: string | null;
    audience: string;
    studentName: string | null;
    studentCourse: string | null;
    userRole: string | null;
    referrer: string | null;
    elementLabel: string | null;
    duration: number | null;
    scrollDepth: number | null;
  }>;
  total: number;
  page: number;
  totalPages: number;
}

const STUDENT_SESSION_KEY = "uor_student";

function readSessionStudent() {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(STUDENT_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StudentProfile;
  } catch {
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    return null;
  }
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function expireBrowserCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`;
}

export function setSessionStudent(student: StudentProfile | null) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  if (!student) {
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    return;
  }

  sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(student));
}

export function setToken(token: string | null) {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }

  if (!token) {
    sessionHintActive = false;
    setSessionStudent(null);
    expireBrowserCookie(SESSION_HINT_COOKIE);
    expireBrowserCookie(LEGACY_SESSION_HINT_COOKIE);
    expireBrowserCookie(CSRF_COOKIE);
    return;
  }

  sessionHintActive = true;
}

export function getToken() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }

  return sessionHintActive ||
    getCookieValue(SESSION_HINT_COOKIE) === "1" ||
    getCookieValue(LEGACY_SESSION_HINT_COOKIE) === "1"
    ? COOKIE_SESSION_SENTINEL
    : null;
}

export function getSessionStudent() {
  if (!getToken()) {
    return null;
  }

  return readSessionStudent();
}

function storeLoginSession(result: AuthLoginResponse) {
  if (result.success && result.token) {
    setToken(result.token);
  }

  if (result.success && result.student) {
    setSessionStudent(result.student);
  }

  return result;
}

function storeJuryLoginSession(result: JuryLoginResponse) {
  if (result.success && result.token) {
    setSessionStudent(null);
    setToken(result.token);
  }

  return result;
}

function storeTrainerLoginSession<T extends { success?: boolean; token?: string }>(result: T) {
  if (result.success && result.token) {
    setSessionStudent(null);
    setToken(result.token);
  }

  return result;
}

export function isAuthError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 401;
  }

  return (
    error instanceof Error &&
    /unauthorized|missing or invalid token|invalid token/i.test(error.message)
  );
}

export function isForbiddenError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 403;
  }

  return (
    error instanceof Error &&
    /forbidden|access denied|acesso negado/i.test(error.message)
  );
}

function localizeApiErrorMessage(status: number, message: string) {
  const normalized = message.trim();

  if (/response doesn't match the schema/i.test(normalized)) {
    return "O servidor devolveu uma resposta inesperada. A equipa técnica já foi notificada. Tenta novamente.";
  }

  if (/request doesn't match the schema|invalid input/i.test(normalized)) {
    return "Dados inválidos. Revê os campos e tenta novamente.";
  }

  if (/missing or invalid token|unauthorized|invalid token/i.test(normalized)) {
    return "Sessão inválida ou expirada. Inicia sessão novamente.";
  }

  if (/forbidden|access denied/i.test(normalized)) {
    return "Não tens permissão para realizar esta ação.";
  }

  if (/not found/i.test(normalized)) {
    return "Registo não encontrado.";
  }

  if (!normalized || normalized === "Request failed") {
    return status >= 500
      ? "Não foi possível concluir o pedido agora. Tenta novamente em instantes."
      : "Não foi possível concluir o pedido. Revê os dados e tenta novamente.";
  }

  return normalized;
}

function shouldClearStoredAuthTokenOnUnauthorized(path: string) {
  return !/\.pdf(?:$|\?)/i.test(path);
}

async function requestRaw(path: string, options?: RequestInit) {
  const {
    retry: retryInput,
    timeoutMs = 15_000,
    ...fetchOptions
  } = (options ?? {}) as RequestInit & {
    retry?: number;
    timeoutMs?: number;
  };
  const headers = new Headers(fetchOptions.headers);

  headers.set("ngrok-skip-browser-warning", "true");

  const csrf = getCookieValue(CSRF_COOKIE);
  if (csrf && !headers.has("x-csrf-token")) {
    headers.set("x-csrf-token", csrf);
  }

  if (fetchOptions.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (fetchOptions.method ?? "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";
  const maxRetries = canRetry ? Math.max(0, Math.min(retryInput ?? 2, 4)) : 0;
  const maxAttempts = maxRetries + 1;

  const wait = (ms: number) =>
    new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  const retryableStatus = new Set([408, 425, 429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = globalThis.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
    const externalSignal = fetchOptions.signal;
    let cleanupExternal: (() => void) | null = null;

    if (externalSignal) {
      const onAbort = () => controller.abort(externalSignal.reason);
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener("abort", onAbort, { once: true });
        cleanupExternal = () =>
          externalSignal.removeEventListener("abort", onAbort);
      }
    }

    try {
      const res = await fetch(resolveApiRequestUrl(path), {
        credentials: "include",
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      if (res.ok) {
        return res;
      }

      if (
        res.status === 401 &&
        shouldClearStoredAuthTokenOnUnauthorized(path)
      ) {
        setToken(null);
      }

      const errorPayload = await res
        .json()
        .catch(() => ({ message: res.statusText }));
      const rawErrorMessage =
        typeof errorPayload.message === "string"
          ? errorPayload.message
          : typeof errorPayload.error === "string"
            ? errorPayload.error
            : "Request failed";
      const error = new ApiError(
        res.status,
        localizeApiErrorMessage(res.status, rawErrorMessage),
      );

      if (
        attempt < maxAttempts - 1 &&
        canRetry &&
        retryableStatus.has(res.status)
      ) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10) * 1000
          : 0;
        const backoffMs =
          retryAfterMs > 0 ? retryAfterMs : Math.min(800 * 2 ** attempt, 4_000);
        await wait(backoffMs);
        continue;
      }

      throw error;
    } catch (error) {
      const isAbortError =
        error instanceof Error && error.name === "AbortError";
      const isNetworkError = error instanceof TypeError;

      if (didTimeout) {
        throw new ApiError(
          408,
          "O pedido demorou mais do que o esperado. Tenta novamente em instantes.",
        );
      }

      if (
        attempt < maxAttempts - 1 &&
        canRetry &&
        (isAbortError || isNetworkError)
      ) {
        await wait(Math.min(800 * 2 ** attempt, 4_000));
        continue;
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
      if (cleanupExternal) cleanupExternal();
    }
  }

  throw new ApiError(503, "Falha temporária de comunicação com o servidor.");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await requestRaw(path, options);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const res = await requestRaw(path, options);
  return res.blob();
}

function toQueryString(
  input?: Record<string, string | number | boolean | undefined | null>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  media: {
    uploadDataUrl: (
      dataUrl: string,
      purpose: string,
      options?: { allowDocuments?: boolean; maxImageDimension?: number },
    ) =>
      request<MediaUploadResponse>("/media/upload", {
        method: "POST",
        body: JSON.stringify({
          dataUrl,
          purpose,
          ...options,
        }),
      }),
  },

  auth: {
    login: (
      studentNumber: string,
      password: string,
      origin?: "uorconnect",
      provider?: "uor" | "isptec",
      identifierType?: "studentNumber" | "username",
    ) =>
      request<AuthLoginResponse>("/auth/login", {
        method: "POST",
        timeoutMs: 120_000,
        body: JSON.stringify({ studentNumber, password, origin, provider, identifierType }),
      }).then(storeLoginSession),
    juryLogin: (phone: string, code: string) =>
      request<JuryLoginResponse>("/auth/jury/login", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      }).then(storeJuryLoginSession),
    logout: async () => {
      try {
        await request<{ success: boolean }>("/auth/logout", {
          method: "POST",
        });
      } finally {
        setToken(null);
      }
    },
    refreshSession: () =>
      request<{ success: true; role: "student" | "jury" | "trainer" }>(
        "/auth/session/refresh",
        {
          method: "POST",
        },
      ).then((result) => {
        sessionHintActive = true;
        return result;
      }),
    me: () =>
      request<StudentProfile>("/auth/me").then((student) => {
        setSessionStudent(student);
        return student;
      }),
    profileState: () => request<StudentProfileState>("/auth/me/profile-state"),
    updateMe: (data: StudentProfileUpdateInput) =>
      request<StudentProfile>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((student) => {
        setSessionStudent(student);
        return student;
      }),
    completeProfile: (data: CompleteProfileInput) =>
      request<StudentProfile>("/auth/complete-profile", {
        method: "POST",
        body: JSON.stringify(data),
      }).then((student) => {
        setSessionStudent(student);
        return student;
      }),
    myPassPdf: () => requestBlob("/auth/me/pass.pdf"),
  },

  reports: {
    exportOverviewPdf: () => requestBlob("/reports/overview/pdf"),
    createOverviewPdfJob: () =>
      request<PdfJobQueued>("/reports/overview/pdf-jobs", { method: "POST" }),
    getOverviewPdfJob: (jobId: string) =>
      request<PdfJobStatus>(`/reports/overview/pdf-jobs/${jobId}`),
    downloadOverviewPdfJobFile: (jobId: string) =>
      requestBlob(`/reports/overview/pdf-jobs/${jobId}/file`),
  },

  trainers: {
    context: () =>
      request<{ courses: TrainerCourseOption[] }>(
        "/trainers/registration/context",
      ),
    requestCode: (phone: string) =>
      request<{
        success: true;
        phone: string;
        codeLast4: string;
        expiresAt: string;
        deliveryStatus: string;
      }>("/trainers/registration/request-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),
    verifyCode: (phone: string, code: string) =>
      request<{
        success: true;
        verified: true;
        phone: string;
        status: TrainerRequestStatus | null;
        request: TrainerRegistrationRequest | null;
        token?: string;
      }>("/trainers/registration/verify-code", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      }).then(storeTrainerLoginSession),
    submit: (data: TrainerRegistrationSubmitInput) =>
      request<{ success: true; request: TrainerRegistrationRequest }>(
        "/trainers/registration/submit",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    status: (phone: string) =>
      request<{ request: TrainerRegistrationRequest | null }>(
        `/trainers/registration/status${toQueryString({ phone })}`,
      ),
    dashboard: () => request<TrainerDashboard>("/trainers/me/dashboard"),
    adminRequests: () =>
      request<{ requests: TrainerRegistrationRequest[] }>(
        "/trainers/admin/requests",
      ),
    approve: (id: number, selectedCourseId: number, note?: string | null) =>
      request<{ success: true; request: TrainerRegistrationRequest }>(
        `/trainers/admin/requests/${id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ selectedCourseId, note }),
        },
      ),
    reject: (id: number, note: string) =>
      request<{ success: true; request: TrainerRegistrationRequest }>(
        `/trainers/admin/requests/${id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ note }),
        },
      ),
  },

  students: {
    list: () => request<StudentWithStats[]>("/auth/students"),
    listPaged: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      course?: string;
      university?: string;
      accessType?: "OFFICIAL" | "TEMPORARY";
      sort?:
        | "created_desc"
        | "created_asc"
        | "name_asc"
        | "name_desc"
        | "number_asc"
        | "number_desc"
        | "course_asc"
        | "course_desc"
        | "university_asc"
        | "university_desc"
        | "interactions_desc";
    }) =>
      request<StudentsPagedResult>(
        `/auth/students/paged${toQueryString(params)}`,
      ),
    securityOverview: () => request<AdminSecurityOverview>("/auth/security"),
    adminAccess: () => request<AdminAccessProfile>("/auth/admin/access"),
    authorizeAdmin: (
      studentNumber: string,
      access?: { team?: string; role?: string; permissions?: string[] },
    ) =>
      request<AdminAuthorizedStudent>("/auth/security/authorized-students", {
        method: "POST",
        body: JSON.stringify({ studentNumber, ...access }),
      }),
    revokeAdmin: (studentNumber: string) =>
      request<{ success: boolean }>(
        `/auth/security/authorized-students/${studentNumber}`,
        {
          method: "DELETE",
        },
      ),
    remove: (id: number) =>
      request<{ success: boolean }>(`/auth/students/${id}`, {
        method: "DELETE",
      }),
  },

  odin: {
    overview: (params?: { windowHours?: number }) =>
      request<OdinOverview>(
        `/security/odin/overview${toQueryString(params)}`,
      ),
    createSecurityReportPdfJob: (params?: { windowHours?: number }) =>
      request<PdfJobQueued>("/security/odin/report/pdf-jobs", {
        method: "POST",
        body: JSON.stringify(params ?? {}),
      }),
    getSecurityReportPdfJob: (jobId: string) =>
      request<PdfJobStatus>(`/security/odin/report/pdf-jobs/${jobId}`),
    downloadSecurityReportPdfJobFile: (jobId: string) =>
      requestBlob(`/security/odin/report/pdf-jobs/${jobId}/file`),
    analyzeCase: (data: { caseType: OdinAiCaseType; caseId: string; windowHours?: number }) =>
      request<OdinAiAnalysis>("/security/odin/ai/analyze", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    aiAnalyses: (params?: { caseType?: OdinAiCaseType; caseId?: string; limit?: number }) =>
      request<OdinAiAnalysis[]>(
        `/security/odin/ai/analyses${toQueryString(params)}`,
      ),
    sendAiFeedback: (analysisId: number, data: OdinAiFeedbackInput) =>
      request<{ success: true; message: string }>(
        `/security/odin/ai/analyses/${analysisId}/feedback`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    excludeStudent: (studentId: number, data: OdinExcludeStudentInput) =>
      request<OdinExcludeStudentResult>(
        `/security/odin/students/${studentId}/exclude`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
  },

  jury: {
    list: () =>
      request<{ juryMembers: JuryMember[] }>(
        "/auth/security/jury-members",
      ).then((payload) => payload.juryMembers),
    create: (data: {
      name: string;
      phone: string;
      team?: string;
      role?: string;
      permissions?: string[];
    }) =>
      request<JuryMember>("/auth/security/jury-members", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/auth/security/jury-members/${id}`, {
        method: "DELETE",
      }),
    sendCode: (id: number, expiresInMinutes?: number) =>
      request<JurySendCodeResult>(
        `/auth/security/jury-members/${id}/send-code`,
        {
          method: "POST",
          body: JSON.stringify(expiresInMinutes ? { expiresInMinutes } : {}),
        },
      ),
  },

  adminTasks: {
    list: () => request<AdminTask[]>("/admin-tasks"),
    create: (data: AdminTaskInput) =>
      request<AdminTask>("/admin-tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: string,
      data: Partial<AdminTaskInput & { status: AdminTaskStatus }>,
    ) =>
      request<AdminTask>(`/admin-tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ success: boolean }>(`/admin-tasks/${id}`, {
        method: "DELETE",
      }),
  },

  teamCredentials: {
    overview: () =>
      request<TeamCredentialOverview>("/team-credentials/admin/overview"),
    incompleteProfiles: () =>
      request<TeamCredentialIncompleteProfiles>(
        "/team-credentials/admin/incomplete-profiles",
      ),
    passTemplates: () =>
      request<{ templates: CredentialPrintTemplate[] }>(
        "/team-credentials/admin/pass-templates",
      ),
    printBatches: () =>
      request<{ batches: CredentialPrintBatch[] }>(
        "/team-credentials/admin/print-batches",
      ),
    createPrintBatch: (data: CredentialPrintBatchInput) =>
      request<CredentialPrintBatch>("/team-credentials/admin/print-batches", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    printBatchDetail: (id: number) =>
      request<CredentialPrintBatch>(
        `/team-credentials/admin/print-batches/${id}`,
      ),
    downloadPrintBatch: (id: number, options?: TeamCredentialPassOptions) =>
      requestBlob(
        `/team-credentials/admin/print-batches/${id}/pass.pdf${toQueryString(options)}`,
        { timeoutMs: 90_000 } as RequestInit & { timeoutMs: number },
      ),
    downloadPassCalibration: (options?: TeamCredentialPassOptions) =>
      requestBlob(
        `/team-credentials/admin/members/pass-batch.pdf${toQueryString({
          ...options,
          layout: options?.layout ?? "a4-2up-landscape",
          calibration: true,
        })}`,
        { timeoutMs: 90_000 } as RequestInit & { timeoutMs: number },
      ),
    printBatchPdfUrl: (id: number, options?: TeamCredentialPassOptions) =>
      resolveAbsoluteApiUrl(
        `/team-credentials/admin/print-batches/${id}/pass.pdf${toQueryString(options)}`,
      ),
    updatePassTemplate: (
      category: string,
      data: CredentialPrintTemplateInput,
    ) =>
      request<CredentialPrintTemplate>(
        `/team-credentials/admin/pass-templates/${encodeURIComponent(category)}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    profilePresets: () =>
      request<{ presets: TeamProfilePreset[] }>(
        "/team-credentials/admin/team-profile-presets",
      ),
    teamMemberships: () =>
      request<TeamMembershipOverview>(
        "/team-credentials/admin/team-memberships",
      ),
    nucleusClaims: () =>
      request<TeamMembershipClaimOverview>(
        "/team-credentials/admin/nucleus-claims",
      ),
    approveNucleusClaim: (
      id: number,
      data?: {
        note?: string | null;
        category?: string;
        team?: string;
        role?: string;
        accessLevel?: string;
        permissions?: string[];
      },
    ) =>
      request<{
        claim: TeamMembershipClaim;
        membership: TeamMembership;
        credential: TeamCredentialMember;
      }>(`/team-credentials/admin/nucleus-claims/${id}/approve`, {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
    rejectNucleusClaim: (id: number, note: string) =>
      request<TeamMembershipClaim>(
        `/team-credentials/admin/nucleus-claims/${id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ note }),
        },
      ),
    searchTeamMemberships: (q: string) =>
      request<{ memberships: TeamMembershipSearchResult[] }>(
        `/team-credentials/admin/team-memberships/search?q=${encodeURIComponent(q)}`,
      ),
    createTeamMembership: (data: TeamMembershipInput) =>
      request<TeamMembership>("/team-credentials/admin/team-memberships", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateTeamMembership: (id: number, data: Partial<TeamMembershipInput>) =>
      request<TeamMembership>(
        `/team-credentials/admin/team-memberships/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    deleteTeamMembership: (id: number) =>
      request<TeamMembership>(
        `/team-credentials/admin/team-memberships/${id}`,
        {
          method: "DELETE",
        },
      ),
    membershipMatches: () =>
      request<TeamCredentialMembershipMatchOverview>(
        "/team-credentials/admin/membership-matches",
      ),
    linkMembershipMatch: (credentialId: number, teamMembershipId: number) =>
      request<TeamCredentialMember>(
        `/team-credentials/admin/membership-matches/${credentialId}/link`,
        {
          method: "POST",
          body: JSON.stringify({ teamMembershipId }),
        },
      ),
    create: (data: TeamCredentialInput) =>
      request<TeamCredentialMember>("/team-credentials/admin/members", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: TeamCredentialInput & {
        status?:
          | "DRAFT"
          | "INVITED"
          | "ISSUED"
          | "PROFILE_READY"
          | "ACTIVE"
          | "REVOKED"
          | "DISABLED";
      },
    ) =>
      request<TeamCredentialMember>(`/team-credentials/admin/members/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    revoke: (id: number, reason?: string | null) =>
      request<TeamCredentialMember>(
        `/team-credentials/admin/members/${id}/revoke`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
      ),
    reissue: (id: number, expiresAt?: string | null) =>
      request<{ previous: TeamCredentialMember; next: TeamCredentialMember }>(
        `/team-credentials/admin/members/${id}/reissue`,
        {
          method: "POST",
          body: JSON.stringify({ expiresAt }),
        },
      ),
    remove: (id: number) =>
      request<{ success: boolean }>(`/team-credentials/admin/members/${id}`, {
        method: "DELETE",
      }),
    importNucleus: () =>
      request<{
        created: number;
        skipped: number;
        membershipsCreated: number;
        membershipsSkipped: number;
        overview: TeamCredentialOverview;
        membershipOverview: TeamMembershipOverview;
      }>("/team-credentials/admin/import-nucleus", {
        method: "POST",
      }),
    bulkInvitation: () =>
      request<BulkInvitationResponse>(
        "/team-credentials/admin/bulk-invitation",
        {
          method: "POST",
        },
      ),
    importExpositors: () =>
      request<{ created: number; skipped: number; membershipsCreated: number }>(
        "/team-credentials/admin/import-expositors",
        {
          method: "POST",
        },
      ),
    bulkExpositorInvitation: () =>
      request<{
        token: string;
        url: string;
        totalExpositors: number;
        claimed: number;
        pending: number;
      }>("/team-credentials/admin/bulk-expositor-invitation", {
        method: "POST",
      }),
    adminSessionProfile: () =>
      request<TeamCredentialAdminSessionProfile>(
        "/team-credentials/admin/session-profile",
      ),
    myCredential: () =>
      request<MyTeamCredentialResponse>("/team-credentials/me"),
    invitation: (token: string) =>
      request<TeamCredentialMember>(
        `/team-credentials/invitations/${encodeURIComponent(token)}`,
      ),
    submitInvitation: (token: string, data: TeamCredentialPublicSubmission) =>
      request<TeamCredentialMember>(
        `/team-credentials/invitations/${encodeURIComponent(token)}/submit`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    nucleusContext: (token: string) =>
      request<TeamCredentialNucleusContext>(
        `/team-credentials/invitations/${encodeURIComponent(token)}/nucleus-context`,
      ),
    claimNucleus: (
      token: string,
      data: TeamCredentialPublicSubmission & { teamMembershipId: number },
    ) =>
      request<TeamCredentialMember>(
        `/team-credentials/invitations/${encodeURIComponent(token)}/nucleus-claim`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    requestNucleusClaim: (
      token: string,
      data: TeamCredentialPublicSubmission & {
        areaKey: string;
        functionKey: string;
      },
    ) =>
      request<TeamMembershipClaim>(
        `/team-credentials/invitations/${encodeURIComponent(token)}/nucleus-claim-request`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    expositorContext: (token: string) =>
      request<ExpositorContextResponse>(
        `/team-credentials/invitations/${encodeURIComponent(token)}/expositor-context`,
      ),
    claimExpositor: (
      token: string,
      data: TeamCredentialPublicSubmission & { submissionId: number },
    ) =>
      request<TeamCredentialMember>(
        `/team-credentials/invitations/${encodeURIComponent(token)}/expositor-claim`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    profile: (slug: string) =>
      request<PublicTeamCredentialMember>(
        `/team-credentials/members/${encodeURIComponent(slug)}`,
      ),
    downloadPass: (slug: string, options?: TeamCredentialPassOptions) =>
      requestBlob(
        `/team-credentials/members/${encodeURIComponent(slug)}/pass.pdf${toQueryString(options)}`,
        { timeoutMs: 60_000 } as RequestInit & { timeoutMs: number },
      ),
    passPdfUrl: (slug: string, options?: TeamCredentialPassOptions) =>
      resolveAbsoluteApiUrl(
        `/team-credentials/members/${encodeURIComponent(slug)}/pass.pdf${toQueryString(options)}`,
      ),
    downloadPassBatch: (
      options?: TeamCredentialPassOptions & {
        ids?: number[];
        category?: string;
        team?: string;
        includePending?: boolean;
        limit?: number;
      },
    ) =>
      requestBlob(
        `/team-credentials/admin/members/pass-batch.pdf${toQueryString({
          ...options,
          ids: options?.ids?.join(","),
        })}`,
        { timeoutMs: 90_000 } as RequestInit & { timeoutMs: number },
      ),
    passBatchPdfUrl: (
      options?: TeamCredentialPassOptions & {
        ids?: number[];
        category?: string;
        team?: string;
        includePending?: boolean;
        limit?: number;
      },
    ) =>
      resolveAbsoluteApiUrl(
        `/team-credentials/admin/members/pass-batch.pdf${toQueryString({
          ...options,
          ids: options?.ids?.join(","),
        })}`,
      ),
    syncSiteGuests: () =>
      request<TeamCredentialSiteGuestsSyncResult>(
        "/team-credentials/admin/sync-site-guests",
        {
          method: "POST",
        },
      ),
  },

  submissions: {
    config: () => request<SubmissionConfig>("/submissions/config"),
    updateConfig: (
      data: Omit<SubmissionConfig, "key" | "createdAt" | "updatedAt">,
    ) =>
      request<SubmissionConfig>("/submissions/config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    list: (params?: { status?: string; type?: string }) => {
      const qs = new URLSearchParams(
        params as Record<string, string>,
      ).toString();
      return request<
        Array<{
          id: number;
          referenceCode: string;
          name: string;
          status: string;
          type: string;
        }>
      >(`/submissions${qs ? `?${qs}` : ""}`);
    },
    updateStatus: (id: number, status: "PENDING" | "APPROVED" | "REJECTED") =>
      request<{ success: boolean }>(`/submissions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    updateType: (id: number, type: SubmissionType) =>
      request<{
        success: true;
        id: number;
        type: SubmissionType;
        canVote: boolean;
        eligibleForAward: boolean;
        isWinner: boolean;
      }>(`/submissions/${id}/type`, {
        method: "PATCH",
        body: JSON.stringify({ type }),
      }),
    updatePresentation: (
      id: number,
      data: {
        description?: string;
        repoUrl?: string | null;
        websiteUrl?: string | null;
        instagramUrl?: string | null;
        facebookUrl?: string | null;
        linkedinUrl?: string | null;
        githubUrl?: string | null;
        primaryColor?: string;
        secondaryColor?: string;
        bannerUrl?: string | null;
      },
    ) =>
      request<SubmissionPresentationUpdateResult>(
        `/submissions/${id}/presentation`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    updateOwnPresentation: (
      id: number,
      data: {
        description?: string;
        repoUrl?: string | null;
        websiteUrl?: string | null;
        instagramUrl?: string | null;
        facebookUrl?: string | null;
        linkedinUrl?: string | null;
        githubUrl?: string | null;
        primaryColor?: string;
        secondaryColor?: string;
        bannerUrl?: string | null;
      },
    ) =>
      request<SubmissionPresentationUpdateResult>(
        `/submissions/${id}/presentation/mine`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    listDetailed: (params?: { status?: string; type?: string }) => {
      const qs = new URLSearchParams(
        params as Record<string, string>,
      ).toString();
      return request<
        Array<
          {
            id: number;
            slug: string;
            detailPath: string;
            referenceCode: string;
            name: string;
            description: string;
            status: SubmissionStatus;
            type: SubmissionType;
            area: string | null;
            createdAt: string | null;
            course: string | null;
            members: string | null;
            membersList: string[];
            teamSize: number;
            leaderName: string | null;
            leaderPhone: string | null;
            paymentStatus: PaymentStatus;
            paymentStatusLabel: string;
            paymentSubmittedAt: string | null;
            paymentReviewedAt: string | null;
            paymentReviewedByStudentNumber: string | null;
            paymentReviewNote: string | null;
            paymentTimeline: PaymentTimelineItem[];
            needs: string[];
            observations: string | null;
            primaryColor: string;
            secondaryColor: string;
            bannerUrl: string | null;
            isWinner: boolean;
            canVote: boolean;
            eligibleForAward: boolean;
            exhibitorChallengeStatus:
              | "MISSING"
              | "PENDING_APPROVAL"
              | "APPROVED"
              | "REJECTED"
              | "PAUSED";
            exhibitorChallengeQuestion: string | null;
            exhibitorChallengeAnswersCount: number;
            exhibitorChallengeUpdatedAt: string | null;
          } & SubmissionTeamState
        >
      >(`/submissions${qs ? `?${qs}` : ""}`);
    },
    listDetailedPaged: (params?: {
      status?: "PENDING" | "APPROVED" | "REJECTED";
      type?: "PROJECT" | "BUSINESS" | "PRODUCT";
      page?: number;
      limit?: number;
      search?: string;
      sort?:
        | "created_desc"
        | "created_asc"
        | "name_asc"
        | "name_desc"
        | "reference_asc"
        | "reference_desc"
        | "course_asc"
        | "course_desc";
    }) =>
      request<
        PagedResult<
          {
            id: number;
            slug: string;
            detailPath: string;
            referenceCode: string;
            name: string;
            description: string;
            status: SubmissionStatus;
            type: SubmissionType;
            area: string | null;
            createdAt: string | null;
            course: string | null;
            members: string | null;
            membersList: string[];
            teamSize: number;
            leaderName: string | null;
            leaderPhone: string | null;
            paymentStatus: PaymentStatus;
            paymentStatusLabel: string;
            paymentSubmittedAt: string | null;
            paymentReviewedAt: string | null;
            paymentReviewedByStudentNumber: string | null;
            paymentReviewNote: string | null;
            paymentTimeline: PaymentTimelineItem[];
            needs: string[];
            observations: string | null;
            primaryColor: string;
            secondaryColor: string;
            bannerUrl: string | null;
            isWinner: boolean;
            canVote: boolean;
            eligibleForAward: boolean;
            exhibitorChallengeStatus:
              | "MISSING"
              | "PENDING_APPROVAL"
              | "APPROVED"
              | "REJECTED"
              | "PAUSED";
            exhibitorChallengeQuestion: string | null;
            exhibitorChallengeAnswersCount: number;
            exhibitorChallengeUpdatedAt: string | null;
          } & SubmissionTeamState
        >
      >(`/submissions/paged${toQueryString(params)}`),
    remove: (id: number) =>
      request<{ success: boolean }>(`/submissions/${id}`, {
        method: "DELETE",
      }),
    selectWinner: (id: number) =>
      request<{ success: boolean }>(`/submissions/${id}/winner`, {
        method: "PATCH",
      }),
    clearWinner: () =>
      request<{ success: boolean }>(`/submissions/winner`, {
        method: "DELETE",
      }),
    create: (data: CreateSubmissionInput) =>
      request<{
        referenceCode: string;
        status: SubmissionStatus;
        id: number;
        communityUrl: string | null;
        paymentStatus: PaymentStatus;
        paymentStatusLabel: string;
        boardingPassPath: string;
        paymentProofPath: string | null;
        receiptPath: string;
      }>("/submissions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateOwn: (id: number, data: CreateSubmissionInput) =>
      request<StudentSubmissionReceipt>(`/submissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    boardingPassPdf: (id: number) =>
      requestBlob(`/submissions/${id}/boarding-pass.pdf`),
    exhibitorPdf: (id: number) =>
      requestBlob(`/submissions/${id}/exhibitor-pack.pdf`, {
        timeoutMs: 60_000,
      } as RequestInit & { timeoutMs: number }),
    exhibitorPdfLink: (id: number) =>
      request<ExhibitorPdfLinkPayload>(
        `/submissions/${id}/exhibitor-pack/link`,
      ),
    exhibitorPdfRecipients: (id: number) =>
      request<ExhibitorPdfRecipientsPayload>(
        `/submissions/${id}/exhibitor-pack/recipients`,
      ),
    mine: () => request<StudentOwnedSubmissionListItem[]>("/submissions/mine"),
    exhibitorPassportMine: () =>
      request<StudentExhibitorPassportSummary>("/submissions/exhibitor-passport/mine"),
    team: (id: number) =>
      request<SubmissionTeamPayload>(`/submissions/${id}/team`),
    addTeamMember: (id: number, name: string) =>
      request<SubmissionTeamPayload>(`/submissions/${id}/team/members`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    updateTeamMemberStudentNumber: (
      id: number,
      memberId: number,
      studentNumber: string,
    ) =>
      request<SubmissionTeamPayload>(
        `/submissions/${id}/team/members/${memberId}/student-number`,
        {
          method: "PATCH",
          body: JSON.stringify({ studentNumber }),
        },
      ),
    confirmTeamMemberExternal: (
      id: number,
      memberId: number,
      data: {
        name?: string | null;
        phone: string;
        externalOrganization: string;
        externalReason?: string | null;
      },
    ) =>
      request<SubmissionTeamPayload & { credentials: ExternalTeamMemberCredentials }>(
        `/submissions/${id}/team/members/${memberId}/confirm-external`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    removeTeamMember: (id: number, memberId: number) =>
      request<SubmissionTeamPayload>(
        `/submissions/${id}/team/members/${memberId}`,
        {
          method: "DELETE",
        },
      ),
    updateTeamMembers: (id: number, members: string[]) =>
      request<
        {
          success: true;
          members: string | null;
          membersList: string[];
          teamSize: number;
        } & SubmissionTeamState
      >(`/submissions/${id}/team/members`, {
        method: "PATCH",
        body: JSON.stringify({ members }),
      }),
    confirmTeamMemberFromAdmin: (id: number, memberId: number) =>
      request<{ success: true } & SubmissionTeamState>(
        `/submissions/${id}/team/members/${memberId}/confirm`,
        {
          method: "POST",
        },
      ),
    confirmTeamMemberExternalFromAdmin: (
      id: number,
      memberId: number,
      data: {
        name?: string | null;
        phone: string;
        externalOrganization: string;
        externalReason?: string | null;
      },
    ) =>
      request<SubmissionTeamPayload & { credentials: ExternalTeamMemberCredentials }>(
        `/submissions/${id}/team/members/${memberId}/confirm-external`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    updateTeamMemberExternalException: (
      id: number,
      memberId: number,
      data: {
        isExternal: boolean;
        externalOrganization?: string | null;
        externalReason: string;
      },
    ) =>
      request<{ success: true } & SubmissionTeamState>(
        `/submissions/${id}/team/members/${memberId}/external-exception`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    teamInvitation: (token: string) =>
      request<SubmissionTeamPayload>(
        `/submissions/team-invitations/${encodeURIComponent(token)}`,
      ),
    confirmTeamMember: (token: string, memberId: number) =>
      request<{ member: SubmissionTeamMember; team: SubmissionTeamPayload }>(
        `/submissions/team-invitations/${encodeURIComponent(token)}/confirm`,
        {
          method: "POST",
          body: JSON.stringify({ memberId }),
        },
      ),
    receipt: (id: number) =>
      request<StudentSubmissionReceipt>(`/submissions/${id}/receipt`),
    summary: (id: number) =>
      request<SubmissionSummary | null>(`/submissions/${id}/summary`),
    review: (id: number, data: ReviewInput) =>
      request<void>(`/submissions/${id}/review`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updatePaymentStatus: (
      id: number,
      status: PaymentStatus,
      note?: string | null,
    ) =>
      request<{
        success: boolean;
        paymentStatus: PaymentStatus;
        paymentStatusLabel: string;
        paymentReviewedAt: string | null;
        paymentReviewedByStudentNumber: string | null;
        paymentReviewNote: string | null;
        paymentTimeline: PaymentTimelineItem[];
      }>(`/submissions/${id}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      }),
  },

  agenda: {
    list: () => request<AgendaItem[]>("/agenda"),
    live: () => request<AgendaLiveState>("/agenda/live"),
    liveConfig: () => request<AgendaLiveConfig>("/agenda/live-config"),
    updateLiveConfig: (data: AgendaLiveConfigInput) =>
      request<AgendaLiveConfig>("/agenda/live-config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    create: (data: AgendaInput) =>
      request<AgendaItem>("/agenda", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: AgendaInput) =>
      request<AgendaItem>(`/agenda/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/agenda/${id}`, { method: "DELETE" }),
  },

  speakers: {
    list: () => request<Speaker[]>("/speakers"),
    create: (data: SpeakerInput) =>
      request<Speaker>("/speakers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: SpeakerInput) =>
      request<Speaker>(`/speakers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/speakers/${id}`, { method: "DELETE" }),
  },

  faq: {
    list: (includeDrafts = false) =>
      request<FaqItem[]>(`/faq${includeDrafts ? "?includeDrafts=true" : ""}`),
    create: (data: FaqInput) =>
      request<FaqItem>("/faq", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: FaqInput) =>
      request<FaqItem>(`/faq/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/faq/${id}`, { method: "DELETE" }),
  },

  guide: {
    content: (includeDrafts = false) =>
      request<GuideContent>(
        `/guide${includeDrafts ? "?includeDrafts=true" : ""}`,
      ),
    createStep: (data: GuideStepInput) =>
      request<GuideStep>("/guide/steps", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateStep: (id: number, data: GuideStepInput) =>
      request<GuideStep>(`/guide/steps/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    removeStep: (id: number) =>
      request<{ success: boolean }>(`/guide/steps/${id}`, { method: "DELETE" }),
    createTip: (data: GuideTipInput) =>
      request<GuideTip>("/guide/tips", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateTip: (id: number, data: GuideTipInput) =>
      request<GuideTip>(`/guide/tips/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    removeTip: (id: number) =>
      request<{ success: boolean }>(`/guide/tips/${id}`, { method: "DELETE" }),
    createVenue: (data: VenueInput) =>
      request<Venue>("/guide/venues", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateVenue: (id: number, data: VenueInput) =>
      request<Venue>(`/guide/venues/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    removeVenue: (id: number) =>
      request<{ success: boolean }>(`/guide/venues/${id}`, {
        method: "DELETE",
      }),
  },

  homeContent: {
    list: (includeDrafts = false) =>
      request<HomeContent>(
        `/home-content${includeDrafts ? "?includeDrafts=true" : ""}`,
      ),
    createCourse: (data: HomeCourseInput) =>
      request<HomeCourse>("/home-content/courses", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateCourse: (id: number, data: HomeCourseInput) =>
      request<HomeCourse>(`/home-content/courses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    removeCourse: (id: number) =>
      request<{ success: boolean }>(`/home-content/courses/${id}`, {
        method: "DELETE",
      }),
    createPanel: (data: PanelTopicInput) =>
      request<PanelTopic>("/home-content/panels", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updatePanel: (id: number, data: PanelTopicInput) =>
      request<PanelTopic>(`/home-content/panels/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    removePanel: (id: number) =>
      request<{ success: boolean }>(`/home-content/panels/${id}`, {
        method: "DELETE",
      }),
    updateSocialConfig: (data: HomeSocialConfigInput) =>
      request<HomeSocialConfig>("/home-content/social-config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },

  courses: {
    list: (includeDrafts = false) =>
      request<CoursesContent>(
        `/courses${includeDrafts ? "?includeDrafts=true" : ""}`,
      ),
    create: (data: CourseInput) =>
      request<Course>("/courses", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: CourseInput) =>
      request<Course>(`/courses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/courses/${id}`, { method: "DELETE" }),
    enrollments: (id: number) =>
      request<CourseEnrollmentsPayload>(`/courses/${id}/enrollments`),
    enrollmentsPaged: (
      id: number,
      params?: {
        page?: number;
        limit?: number;
        search?: string;
        paymentStatus?:
          | "SUBMITTED_BY_USER"
          | "PENDING_REVIEW"
          | "CONFIRMED_BY_ADMIN"
          | "REJECTED"
          | "CANCELED"
          | "PENDING"
          | "CONFIRMED";
      },
    ) =>
      request<CourseEnrollmentsPagedPayload>(
        `/courses/${id}/enrollments/paged${toQueryString(params)}`,
      ),
    updateEnrollmentStatus: (
      enrollmentId: number,
      status: PaymentStatus,
      note?: string | null,
    ) =>
      request<{ enrollment: CourseEnrollment }>(
        `/courses/enrollments/${enrollmentId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, note }),
        },
      ),
    createEnrollment: (courseId: number, data: CourseEnrollmentInput) =>
      request<{ enrollment: CourseEnrollment }>(
        `/courses/${courseId}/enrollments`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    updateEnrollment: (
      enrollmentId: number,
      data: Partial<CourseEnrollmentInput>,
    ) =>
      request<{ enrollment: CourseEnrollment }>(
        `/courses/enrollments/${enrollmentId}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    removeEnrollment: (enrollmentId: number) =>
      request<{ success: boolean }>(`/courses/enrollments/${enrollmentId}`, {
        method: "DELETE",
      }),
    exportEnrollmentsPdf: (id: number) =>
      requestBlob(`/courses/${id}/enrollments/pdf`),
    createEnrollmentsPdfJob: (id: number) =>
      request<PdfJobQueued>(`/courses/${id}/enrollments/pdf-jobs`, {
        method: "POST",
      }),
    getEnrollmentsPdfJob: (id: number, jobId: string) =>
      request<PdfJobStatus>(`/courses/${id}/enrollments/pdf-jobs/${jobId}`),
    downloadEnrollmentsPdfJobFile: (id: number, jobId: string) =>
      requestBlob(`/courses/${id}/enrollments/pdf-jobs/${jobId}/file`),
    syncStudentCounts: () =>
      request<CoursesContent>("/courses/sync-student-counts", {
        method: "POST",
      }),
    myLikes: () => request<{ likedCourseIds: number[] }>("/courses/liked"),
    myEnrollments: () =>
      request<{ enrolledCourseIds: number[] }>("/courses/enrollments"),
    enrollmentsMine: () =>
      request<StudentEnrollmentListItem[]>("/courses/enrollments/mine"),
    enrollmentReceipt: (id: number) =>
      request<StudentEnrollmentReceipt>(`/courses/enrollments/${id}`),
    enrollmentTicketPdf: (id: number) =>
      requestBlob(`/courses/enrollments/${id}/ticket.pdf`),
    enroll: (id: number, data?: CourseEnrollmentPayload) =>
      request<{
        enrolled: boolean;
        enrollmentId: number | null;
        communityUrl: string | null;
        studentCount: number;
        paymentStatus: string | null;
        paymentProofPath: string | null;
        ticketPath: string | null;
        whatsAppRedirectUrl: string | null;
        receiptPath: string | null;
      }>(`/courses/${id}/enroll`, {
        method: "POST",
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
    like: (id: number) =>
      request<{ liked: boolean; likesCount: number }>(`/courses/${id}/like`, {
        method: "POST",
      }),
  },

  attendance: {
    me: () => request<AttendanceMePayload>("/attendance/me"),
    cardPdf: () =>
      requestBlob("/attendance/me/card.pdf", {
        timeoutMs: 60_000,
      } as RequestInit & { timeoutMs: number }),
    scan: (data: { token: string }) =>
      request<QrScanResult>("/attendance/scan", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    myScans: () => request<StudentScanHistoryItem[]>("/attendance/my-scans"),
    overview: () => request<AttendanceOverview>("/attendance/admin/overview"),
    checkIns: (params?: { page?: number; limit?: number; search?: string }) =>
      request<PagedResult<AttendanceCheckIn>>(
        `/attendance/admin/check-ins${toQueryString(params)}`,
      ),
    checkIn: (data: {
      token?: string;
      studentNumber?: string;
      eventKey?: string;
      eventLabel?: string;
      notes?: string | null;
    }) =>
      request<{
        checkIn: AttendanceCheckIn;
        credential: AttendanceCredential;
        alreadyCheckedIn: boolean;
      }>("/attendance/admin/check-in", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    qrActionsOverview: () =>
      request<QrActionsOverview>("/attendance/admin/qr-actions-overview"),
    qrActions: (params?: {
      page?: number;
      limit?: number;
      type?: string;
      search?: string;
    }) =>
      request<PagedResult<QrActionItem>>(
        `/attendance/admin/qr-actions${toQueryString(params)}`,
      ),
    qrActionDetail: (id: number) =>
      request<{ action: QrActionItem; scans: QrActionScanItem[] }>(
        `/attendance/admin/qr-actions/${id}`,
      ),
    qrActionPdf: (id: number) =>
      requestBlob(`/attendance/admin/qr-actions/${id}/pdf`, {
        timeoutMs: 60_000,
      } as RequestInit & { timeoutMs: number }),
    createQrAction: (data: {
      type: string;
      label: string;
      description?: string | null;
      targetId?: number | null;
      eventKey?: string | null;
      eventLabel?: string | null;
      maxScans?: number | null;
      expiresAt?: string | null;
      smsOnScan?: boolean;
      smsTemplate?: string | null;
      smsSender?: string | null;
      passportMissionId?: number | null;
    }) =>
      request<QrActionItem>("/attendance/admin/qr-actions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateQrAction: (id: number, data: Record<string, unknown>) =>
      request<{ message: string }>(`/attendance/admin/qr-actions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteQrAction: (id: number) =>
      request<{ message: string }>(`/attendance/admin/qr-actions/${id}`, {
        method: "DELETE",
      }),
  },

  passport: {
    me: () => request<DigitalPassportSummary>("/passport/me"),
    challengeManualPdf: () =>
      requestBlob("/passport/me/challenge-manual.pdf", {
        timeoutMs: 60_000,
      } as RequestInit & { timeoutMs: number }),
    networkingQr: () =>
      request<DigitalPassportNetworkingQr>("/passport/me/networking-qr"),
    myProjectChallenges: () =>
      request<DigitalPassportOwnedProjectChallenge[]>(
        "/passport/me/project-challenges",
      ),
    saveProjectChallenge: (data: DigitalPassportOwnedProjectChallengeInput) =>
      request<DigitalPassportOwnedProjectChallenge>(
        "/passport/me/project-challenges",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    referralInvite: (code: string) =>
      request<DigitalPassportReferralInvite>(
        `/passport/referrals/${encodeURIComponent(code)}`,
      ),
    join: (visitorId?: string | null, referralCode?: string | null) =>
      request<{ joinedAt: string; summary: DigitalPassportSummary }>(
        "/passport/join",
        {
          method: "POST",
          body: JSON.stringify({
            visitorId: visitorId ?? null,
            referralCode: referralCode ?? null,
          }),
        },
      ),
    leaderboard: (limit = 10) =>
      request<DigitalPassportRankingRow[]>(
        `/passport/leaderboard?limit=${encodeURIComponent(String(limit))}`,
      ),
    answerChallenge: (id: number, answer: string) =>
      request<DigitalPassportChallengeAnswerResult>(
        `/passport/challenges/${id}/answer`,
        {
          method: "POST",
          body: JSON.stringify({ answer }),
        },
      ),
    constructiveFeedback: (data: {
      submissionId: number;
      content: string;
      focus?: DigitalPassportConstructiveFeedbackFocus | null;
    }) =>
      request<DigitalPassportConstructiveFeedbackResult>(
        "/passport/constructive-feedback",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    overview: () =>
      request<DigitalPassportAdminOverview>("/passport/admin/overview"),
    reports: () =>
      request<DigitalPassportAdminReports>("/passport/admin/reports"),
    missions: () =>
      request<DigitalPassportAdminMission[]>("/passport/admin/missions"),
    challenges: () =>
      request<DigitalPassportAdminChallenge[]>("/passport/admin/challenges"),
    surpriseQrs: () =>
      request<DigitalPassportAdminSurpriseQr[]>("/passport/admin/surprise-qrs"),
    missionQrs: () =>
      request<DigitalPassportAdminMissionQr[]>("/passport/admin/mission-qrs"),
    missionQrPdf: (id: number) =>
      requestBlob(`/passport/admin/mission-qrs/${id}/pdf`, {
        timeoutMs: 60_000,
      } as RequestInit & { timeoutMs: number }),
    surpriseQrPdf: (id: number) =>
      requestBlob(`/passport/admin/surprise-qrs/${id}/pdf`, {
        timeoutMs: 60_000,
      } as RequestInit & { timeoutMs: number }),
    surpriseQrBatchPdf: (batchCode: string) =>
      requestBlob(`/passport/admin/surprise-qrs/batch/${encodeURIComponent(batchCode)}/pdf`, {
        timeoutMs: 60_000,
      } as RequestInit & { timeoutMs: number }),
    createMission: (
      data: Required<
        Pick<DigitalPassportMissionInput, "key" | "type" | "title" | "points">
      > &
        DigitalPassportMissionInput,
    ) =>
      request<DigitalPassportAdminMission>("/passport/admin/missions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateMission: (id: number, data: DigitalPassportMissionInput) =>
      request<DigitalPassportAdminMission>(`/passport/admin/missions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    createChallenge: (
      data: Required<
        Pick<
          DigitalPassportChallengeInput,
          "type" | "question" | "correctAnswer"
        >
      > &
        DigitalPassportChallengeInput,
    ) =>
      request<DigitalPassportAdminChallenge>("/passport/admin/challenges", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateChallenge: (id: number, data: DigitalPassportChallengeInput) =>
      request<DigitalPassportAdminChallenge>(
        `/passport/admin/challenges/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    createSurpriseQr: (
      data: Required<
        Pick<
          DigitalPassportSurpriseQrInput,
          "name" | "effectType" | "effectValue"
        >
      > &
        DigitalPassportSurpriseQrInput,
    ) =>
      request<DigitalPassportAdminSurpriseQr>("/passport/admin/surprise-qrs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createSurpriseQrBatch: (data: DigitalPassportSurpriseQrBatchInput) =>
      request<DigitalPassportSurpriseQrBatchResult>("/passport/admin/surprise-qrs/batch", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createMissionQr: (data: DigitalPassportMissionQrInput) =>
      request<DigitalPassportAdminMissionQr>("/passport/admin/mission-qrs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateSurpriseQr: (id: number, data: DigitalPassportSurpriseQrInput) =>
      request<DigitalPassportAdminSurpriseQr>(
        `/passport/admin/surprise-qrs/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    recalculate: () =>
      request<{
        overview: DigitalPassportAdminOverview;
        reports: DigitalPassportAdminReports;
      }>("/passport/admin/recalculate", {
        method: "POST",
      }),
    requestResetConfirmation: () =>
      request<AdminSmsConfirmationResponse>(
        "/passport/admin/reset/request-confirmation",
        { method: "POST" },
      ),
    confirmReset: (data: { code: string; confirmationText: string }) =>
      request<PassportChallengeResetResult>("/passport/admin/reset/confirm", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    freezeRanking: (note?: string | null) =>
      request<{
        id: number;
        active: boolean;
        note: string | null;
        frozenAt: string;
        frozenByStudentNumber: string | null;
      }>("/passport/admin/ranking/freeze", {
        method: "POST",
        body: JSON.stringify({ note: note ?? null }),
      }),
    exportWinners: (limit = 10) =>
      request<DigitalPassportWinnersExport>(
        `/passport/admin/winners/export?limit=${encodeURIComponent(String(limit))}`,
      ),
  },

  certificates: {
    mine: () => request<CertificateItem[]>("/certificates/mine"),
    list: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      type?: string;
      status?: string;
    }) =>
      request<PagedResult<CertificateItem>>(
        `/certificates/admin/list${toQueryString(params)}`,
      ),
    templates: () =>
      request<{ templates: CertificateTemplate[] }>(
        "/certificates/admin/templates",
      ),
    issue: (data: {
      studentNumber: string;
      type?: string;
      title?: string;
      sourceType?: string;
      sourceId?: number;
      metadata?: Record<string, unknown>;
    }) =>
      request<CertificateItem>("/certificates/admin/issue", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    issueAttendees: (data?: {
      type?: string;
      title?: string;
      eventKey?: string;
    }) =>
      request<{
        issued: number;
        skipped: number;
        certificates: CertificateItem[];
      }>("/certificates/admin/issue-attendees", {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
    issueBulk: (data: {
      mode: "STUDENT_LIST" | "STUDENT_COURSE" | "COURSE_ENROLLMENT" | "PROJECT";
      type?: string;
      title?: string;
      studentNumbers?: string[];
      studentCourse?: string;
      courseId?: number;
      submissionId?: number;
    }) =>
      request<{
        issued: number;
        skipped: number;
        certificates: CertificateItem[];
      }>("/certificates/admin/issue-bulk", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    revoke: (id: number, reason?: string | null) =>
      request<CertificateItem>(`/certificates/admin/${id}/revoke`, {
        method: "PATCH",
        body: JSON.stringify({ reason: reason || undefined }),
      }),
    reissue: (id: number) =>
      request<{ previous: CertificateItem; next: CertificateItem }>(
        `/certificates/admin/${id}/reissue`,
        { method: "POST" },
      ),
    pdf: (id: number) => requestBlob(`/certificates/${id}/pdf`),
  },

  validation: {
    get: (token: string) =>
      request<PublicValidationPayload>(
        `/validation/${encodeURIComponent(token)}`,
      ),
    getOperational: (token: string) =>
      request<OperationalValidationPayload>(
        `/validation/operational/${encodeURIComponent(token)}`,
      ),
  },

  audit: {
    logs: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      action?: string;
      entityType?: string;
      from?: string;
      to?: string;
    }) =>
      request<PagedResult<AdminAuditLog>>(
        `/audit/admin/logs${toQueryString(params)}`,
      ),
    exportCsv: (params?: {
      search?: string;
      action?: string;
      entityType?: string;
      from?: string;
      to?: string;
      limit?: number;
    }) => requestBlob(`/audit/admin/logs/export.csv${toQueryString(params)}`),
    retentionPolicy: () =>
      request<DataRetentionPolicy>("/audit/admin/retention-policy"),
    runRetentionCleanup: () =>
      request<DataRetentionCleanupResult>("/audit/admin/retention-run", {
        method: "POST",
      }),
  },

  sms: {
    filters: () => request<SmsFilterOptionsPayload>("/sms/admin/filters"),
    overview: () => request<SmsOverviewPayload>("/sms/admin/overview"),
    updateAutomation: (
      eventKey: SmsAutomationSetting["eventKey"],
      data: SmsAutomationUpdatePayload,
    ) =>
      request<SmsAutomationSetting>(`/sms/admin/automations/${eventKey}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    campaigns: (page = 0, pageSize = 20) =>
      request<{
        page: number;
        pageSize: number;
        total: number;
        campaigns: SmsCampaignSummary[];
      }>(`/sms/admin/campaigns${toQueryString({ page, pageSize })}`),
    previewRecipients: (data: {
      audience: SmsAudienceInput;
      search?: string;
      limit?: number;
    }) =>
      request<SmsRecipientPreviewPayload>("/sms/admin/preview", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    sendCampaign: (data: SmsSendPayload) =>
      request<SmsSendResult>("/sms/admin/send", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    providerCredits: () =>
      request<SmsProviderProxyResponse>("/sms/admin/provider/credits"),
    providerMessages: (page = 0) =>
      request<SmsProviderProxyResponse>(
        `/sms/admin/provider/messages${toQueryString({ page })}`,
      ),
    providerMessagesByDate: (start: string, end: string, page = 0) =>
      request<SmsProviderProxyResponse>(
        `/sms/admin/provider/messages/date${toQueryString({ start, end, page })}`,
      ),
    providerMessagesByRecipient: (phoneNumber: string, page = 0) =>
      request<SmsProviderProxyResponse>(
        `/sms/admin/provider/messages/recipient${toQueryString({ phoneNumber, page })}`,
      ),
    providerMessageOne: (params: { messageId?: string; id?: string }) =>
      request<SmsProviderProxyResponse>(
        `/sms/admin/provider/messages/one${toQueryString(params)}`,
      ),
    providerDeleteMessage: (messageId: string) =>
      request<SmsProviderProxyResponse>(
        `/sms/admin/provider/messages/${encodeURIComponent(messageId)}`,
        {
          method: "DELETE",
        },
      ),
    providerRecipients: (page = 0) =>
      request<SmsProviderProxyResponse>(
        `/sms/admin/provider/recipients${toQueryString({ page })}`,
      ),
    providerSenders: () =>
      request<SmsProviderProxyResponse>("/sms/admin/provider/senders"),
    providerApprovedSenders: () =>
      request<SmsProviderProxyResponse>("/sms/admin/provider/senders/approved"),
    providerPendingSenders: () =>
      request<SmsProviderProxyResponse>("/sms/admin/provider/senders/pending"),
    providerCreateSender: (name: string) =>
      request<SmsProviderProxyResponse>("/sms/admin/provider/senders", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    providerDeleteSender: (senderId: string) =>
      request<SmsProviderProxyResponse>(
        `/sms/admin/provider/senders/${encodeURIComponent(senderId)}`,
        {
          method: "DELETE",
        },
      ),
    campaignFailures: (id: number) =>
      request<SmsCampaignFailuresPayload>(
        `/sms/admin/campaigns/${id}/failures`,
      ),
  },

  whatsapp: {
    filters: () => request<SmsFilterOptionsPayload>("/whatsapp/admin/filters"),
    overview: () =>
      request<WhatsAppOverviewPayload>("/whatsapp/admin/overview"),
    updateAutomation: (
      eventKey: WhatsAppAutomationSetting["eventKey"],
      data: WhatsAppAutomationUpdatePayload,
    ) =>
      request<WhatsAppAutomationSetting>(
        `/whatsapp/admin/automations/${eventKey}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
      ),
    campaigns: (page = 0, pageSize = 20) =>
      request<{
        page: number;
        pageSize: number;
        total: number;
        campaigns: WhatsAppCampaignSummary[];
      }>(`/whatsapp/admin/campaigns${toQueryString({ page, pageSize })}`),
    createInstance: (data: WhatsAppInstanceInput) =>
      request<{
        instance: WhatsAppInstanceSummary;
        provider: { ok: boolean; status: number; message: string | null };
      }>("/whatsapp/admin/instances", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    connectInstance: (id: number) =>
      request<{
        instance: WhatsAppInstanceSummary;
        provider: { ok: boolean; status: number; message: string | null };
      }>(`/whatsapp/admin/instances/${id}/connect`, {
        method: "POST",
      }),
    refreshInstanceStatus: (id: number) =>
      request<{
        instance: WhatsAppInstanceSummary;
        provider: { ok: boolean; status: number; message: string | null };
      }>(`/whatsapp/admin/instances/${id}/status`, {
        method: "POST",
      }),
    setDefaultInstance: (id: number) =>
      request<WhatsAppInstanceSummary>(
        `/whatsapp/admin/instances/${id}/default`,
        {
          method: "POST",
        },
      ),
    disableInstance: (id: number) =>
      request<WhatsAppInstanceSummary>(`/whatsapp/admin/instances/${id}`, {
        method: "DELETE",
      }),
    previewRecipients: (data: {
      audience: WhatsAppAudienceInput;
      search?: string;
      limit?: number;
    }) =>
      request<WhatsAppRecipientPreviewPayload>("/whatsapp/admin/preview", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    sendCampaign: (data: WhatsAppSendPayload) =>
      request<WhatsAppSendResult>("/whatsapp/admin/send", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    campaignFailures: (id: number) =>
      request<WhatsAppCampaignFailuresPayload>(
        `/whatsapp/admin/campaigns/${id}/failures`,
      ),
  },

  stats: {
    get: () => request<Stats>(`/stats`),
  },

  analytics: {
    consent: (data: AnalyticsConsentPayload) =>
      request<{ success: boolean }>("/analytics/consent", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    track: (data: AnalyticsTrackPayload) =>
      request<{ success: boolean; storedEvents: number }>("/analytics/track", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    dashboard: (filters?: AnalyticsFilterInput) =>
      request<AnalyticsDashboard>(
        `/analytics/dashboard${toQueryString(filters)}`,
      ),
    events: (filters?: AnalyticsFilterInput) =>
      request<AnalyticsEventsPayload>(
        `/analytics/events${toQueryString(filters)}`,
      ),
    exportCsv: (filters?: AnalyticsFilterInput) =>
      requestBlob(`/analytics/events/export.csv${toQueryString(filters)}`),
  },

  interactions: {
    like: (submissionId: number) =>
      request<{ liked: boolean; likesCount: number }>(`/interactions/like`, {
        method: "POST",
        body: JSON.stringify({ submissionId }),
      }),
    vote: (submissionId: number) =>
      request<{
        voted: boolean;
        votesCount: number;
        score: number;
        scoreDelta: number;
        message: string;
        scoringEvents: Array<{ action: string; points: number; reason: string }>;
      }>(`/interactions/vote`, {
        method: "POST",
        body: JSON.stringify({ submissionId }),
      }),
    comment: (submissionId: number, content: string) =>
      request<{
        id: number;
        content: string;
        createdAt: string;
        studentName: string;
        studentAvatarUrl?: string | null;
        course: string | null;
        courseColor: string | null;
      }>(`/interactions/comment`, {
        method: "POST",
        body: JSON.stringify({ submissionId, content }),
      }),
    me: () =>
      request<{
        student: StudentProfile | null;
        jury?: {
          id: number;
          name: string;
          phone: string;
          lastCodeSentAt: string | null;
        } | null;
        stats: { likes: number; votes: number; comments: number };
      }>(`/interactions/me`),
    liveVotes: () =>
      request<PublicLiveVotesOverview>(`/interactions/votes/live`),
    adminVotes: () =>
      request<{
        projects: Array<{
          id: number;
          name: string;
          detailPath: string;
          type: string;
          votes: number;
          score: number;
          comments: number;
          averageRating: number;
          pageViews: number;
          uniqueVisitors: number;
          authenticatedVisitors: number;
        }>;
        votes: Array<{
          id: number;
          studentId: number;
          studentNumber: string;
          studentName: string | null;
          studentEmail: string | null;
          studentCourse: string | null;
          submissionId: number;
          submissionName: string;
          createdAt: string;
        }>;
        courses: Array<{
          course: string;
          votes: number;
          students: number;
          recentVotes: number;
          lastVoteAt: string | null;
        }>;
        control: {
          votingPaused: boolean;
          updatedAt: string;
        };
      }>(`/interactions/admin/votes`),
    adminVotesPaged: (params?: {
      projectsPage?: number;
      projectsLimit?: number;
      votesPage?: number;
      votesLimit?: number;
    }) =>
      request<{
        projects: PagedResult<{
          id: number;
          name: string;
          detailPath: string;
          type: string;
          votes: number;
          score: number;
          comments: number;
          averageRating: number;
          pageViews: number;
          uniqueVisitors: number;
          authenticatedVisitors: number;
        }>;
        votes: PagedResult<{
          id: number;
          studentId: number;
          studentNumber: string;
          studentName: string | null;
          studentEmail: string | null;
          studentCourse: string | null;
          submissionId: number;
          submissionName: string;
          createdAt: string;
        }>;
        courses: Array<{
          course: string;
          votes: number;
          students: number;
          recentVotes: number;
          lastVoteAt: string | null;
        }>;
        control: {
          votingPaused: boolean;
          updatedAt: string;
        };
      }>(`/interactions/admin/votes/paged${toQueryString(params)}`),
    adminModeration: () =>
      request<{
        projectComments: AdminModerationProjectComment[];
        liveChatMessages: AdminModerationLiveChatMessage[];
      }>(`/interactions/admin/moderation`),
    updateVotesControl: (data: { votingPaused: boolean }) =>
      request<{ votingPaused: boolean; updatedAt: string }>(
        `/interactions/admin/votes/control`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    confirmVotesReset: (data: { confirmationText: string }) =>
      request<ProjectVotesResetResult>(
        "/interactions/admin/votes/reset/confirm",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    createScoreEvent: (data: ExhibitorScoreAdjustmentInput) =>
      request<ExhibitorScoreAdjustmentResult>(
        "/interactions/admin/votes/score-events",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    scoringConfig: () =>
      request<ExhibitorScoreConfigPayload>(
        "/interactions/admin/votes/scoring/config",
      ),
    updateScoringConfig: (data: ExhibitorScoreConfigUpdateInput) =>
      request<ExhibitorScoreConfigPayload>(
        "/interactions/admin/votes/scoring/config",
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
    freezeScoringRanking: (data: { reason?: string }) =>
      request<ExhibitorScoreFreezeResult>(
        "/interactions/admin/votes/scoring/freeze",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    recalculateScoring: (data: { reason: string }) =>
      request<ExhibitorScoreRecalculateResult>(
        "/interactions/admin/votes/scoring/recalculate",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    awardMemberLevels: () =>
      request<ExhibitorMemberLevelAwardResult>(
        "/interactions/admin/votes/scoring/member-levels",
        {
          method: "POST",
        },
      ),
    awardAutomaticMissions: () =>
      request<ExhibitorAutomaticMissionAwardResult>(
        "/interactions/admin/votes/scoring/automatic-missions",
        {
          method: "POST",
        },
      ),
    awardTeamBonuses: () =>
      request<ExhibitorTeamBonusAwardResult>(
        "/interactions/admin/votes/scoring/team-bonuses",
        {
          method: "POST",
        },
      ),
    ambassadorRanking: () =>
      request<ExhibitorAmbassadorRanking>(
        "/interactions/admin/votes/scoring/ambassadors",
      ),
    scoringAlerts: () =>
      request<ExhibitorScoringAlerts>(
        "/interactions/admin/votes/scoring/alerts",
      ),
    exportScoringRanking: (params?: { frozenOnly?: boolean }) =>
      request<ExhibitorScoreRankingExport>(
        `/interactions/admin/votes/scoring/export${toQueryString(params)}`,
      ),
    exportScoringRankingCsv: (params?: { frozenOnly?: boolean }) =>
      requestBlob(
        `/interactions/admin/votes/scoring/export.csv${toQueryString(params)}`,
      ),
    exportScoringRankingPdf: (params?: { frozenOnly?: boolean }) =>
      requestBlob(
        `/interactions/admin/votes/scoring/export.pdf${toQueryString(params)}`,
      ),
    recordMemberDuty: (data: ExhibitorMemberDutyInput) =>
      request<ExhibitorScoreAdjustmentResult>(
        "/interactions/admin/votes/member-duty",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    recordEmptyStandPenalty: (data: ExhibitorEmptyStandPenaltyInput) =>
      request<ExhibitorScoreAdjustmentResult>(
        "/interactions/admin/votes/stand-empty-penalty",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    deleteProjectComment: (id: number) =>
      request<{ success: boolean }>(`/interactions/admin/comments/${id}`, {
        method: "DELETE",
      }),
    reviewQualifiedFeedback: (
      id: number,
      data: { action: "APPROVE" | "REJECT" | "REVOKE"; note: string },
    ) =>
      request<{ success: true; action: string; scoreDelta: number }>(
        `/interactions/admin/comments/${id}/qualified-feedback`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    deleteLiveChatMessage: (id: number) =>
      request<{ success: boolean }>(`/interactions/admin/live-chat/${id}`, {
        method: "DELETE",
      }),
    updateLiveChatMessage: (
      id: number,
      data: { isPinned?: boolean; isHighlighted?: boolean; hidden?: boolean },
    ) =>
      request<{ success: boolean }>(`/interactions/admin/live-chat/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    activityFeed: () =>
      request<ActivityFeedItem[]>(`/interactions/activity-feed`),
    liveChat: () => request<LiveChatMessage[]>(`/interactions/live-chat`),
    sendLiveChat: (data: {
      content: string;
      attachment?: { dataUrl: string; fileName?: string } | null;
      replyToMessageId?: number | null;
    }) =>
      request<LiveChatMessage>(`/interactions/live-chat`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    reactLiveChat: (id: number, type: "like" | "applause" | "love") =>
      request<{ reacted: boolean; reactionCounts: Record<string, number> }>(
        `/interactions/live-chat/${id}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({ type }),
        },
      ),
    reportLiveChat: (id: number) =>
      request<{ success: boolean }>(`/interactions/live-chat/${id}/report`, {
        method: "POST",
      }),
    projects: (params?: {
      page?: number;
      limit?: number;
      likesLimit?: number;
      commentsLimit?: number;
      sort?: ProjectFeedSort;
      view?: ProjectFeedView;
      q?: string;
      course?: string;
      audience?: ProjectFeedAudience;
    }) =>
      request<PagedResult<ProjectPublicFeedItem>>(
        `/interactions/projects${toQueryString(params)}`,
      ),
    projectBySlug: (slug: string, params?: { likesLimit?: number; commentsLimit?: number }) =>
      request<ProjectPublicFeedItem>(`/interactions/projects/${slug}${toQueryString(params)}`),
  },
};

export interface CreateSubmissionInput {
  name: string;
  description: string;
  members: string[] | string;
  leaderName: string;
  leaderPhone: string;
  leaderEmail?: string;
  needs: string[];
  paymentProof: string;
  paymentConfirmed: true;
  repoUrl?: string;
  websiteUrl?: string;
  observations?: string;
  agreeRules: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  bannerUrl?: string | null;
  type: "PROJECT" | "BUSINESS" | "PRODUCT";
  area: string;
  course?: string;
  stage?: string;
  category?: string;
  productType?: string;
}

export interface SubmissionSummary {
  id: number;
  referenceCode: string;
  name: string;
  status: string;
  type: string;
  votes: number;
  averageRating: number;
  reviews: Array<{
    user: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }>;
}

export interface ReviewInput {
  email: string;
  rating: number;
  comment?: string;
}

export interface SubmissionConfig {
  key: string;
  isOpen: boolean;
  iban: string;
  accountName: string;
  paymentAmount: string;
  paymentInstructions: string | null;
  projectCommunityUrl: string | null;
  businessCommunityUrl: string | null;
  productCommunityUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaItem {
  id: number;
  day: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  local: string;
  speaker: string;
  description: string;
  type: string;
  theme: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgendaInput {
  day: "DAY1" | "DAY2";
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  local: string;
  speaker: string;
  description: string;
  type: "PANEL" | "WORKSHOP" | "PRESENTATION" | "CEREMONY" | "BREAK";
  theme: string;
}

export interface AgendaLiveState {
  current: AgendaItem | null;
  next: AgendaItem | null;
  mode: "AGENDA" | "MANUAL";
  source: "agenda" | "admin";
}

export interface AgendaLiveConfig {
  key: string;
  mode: "AGENDA" | "MANUAL";
  current: AgendaInput | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaLiveConfigInput {
  mode: "AGENDA" | "MANUAL";
  current: AgendaInput | null;
}

export interface Speaker {
  id: number;
  name: string;
  bio: string;
  specialty: string;
  talk: string;
  day: string;
  linkedin: string;
  avatarUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpeakerInput {
  name: string;
  bio: string;
  specialty: string;
  talk: string;
  day: string;
  linkedin: string;
  avatarUrl?: string | null;
}

export interface FaqInput {
  question: string;
  answer: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface GuideStepInput {
  title: string;
  description: string;
  link?: string | null;
  linkText?: string | null;
  icon: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface GuideTipInput {
  content: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface VenueInput {
  name: string;
  description: string;
  capacity: string;
  floor: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface HomeCourseInput {
  title: string;
  description: string;
  icon: string;
  ctaText?: string | null;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface CourseInput {
  name: string;
  description: string;
  preview?: string | null;
  communityUrl?: string | null;
  companyName: string;
  companyCategory: string;
  companyLogoUrl?: string | null;
  companyWebsite?: string | null;
  companyInstagram?: string | null;
  companyLinkedin?: string | null;
  isPaid?: boolean;
  priceLabel?: string | null;
  accentColor?: string;
  accentColorSecondary?: string;
  courseColor?: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface PanelTopicInput {
  title: string;
  description: string;
  speaker: string;
  time: string;
  local: string;
  day: string;
  dateLabel: string;
  icon: string;
  type: string;
  sortOrder?: number;
  isPublished?: boolean;
}

export interface HomeSocialConfigInput {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  courseEnrollmentEnabled?: boolean;
  firstYearContestEnabled?: boolean;
  primaryColor?: string;
  primaryGradient?: string;
  titleColor?: string;
  accentColor?: string;
  dashedColor?: string;
  dashedOpacity?: number;
  heroIconsOpacity?: number;
  heroBlobsIntensity?: number;
  heroMeshEnabled?: boolean;
  heroBadgeText?: string;
  heroTitlePrefix?: string;
  heroTitleHighlight?: string;
  heroSubtitleText?: string;
  heroSubtitleColor?: string;
  heroTitleMobileSize?: string;
  heroTitleTabletSize?: string;
  heroTitleDesktopSize?: string;
  heroSubtitleMobileSize?: string;
  heroSubtitleTabletSize?: string;
  heroSubtitleDesktopSize?: string;
  heroFloatingIcons?: HeroFloatingIcon[];
  sponsors?: HomeSponsor[];
}

export interface Stats {
  participants: number;
  submissions: number;
  approved: number;
  votes: number;
  avgRating: number;
}
