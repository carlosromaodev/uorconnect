import { resolveApiRequestUrl } from "@/lib/runtime-config";

const TOKEN_KEY = "uor_token";
const CSRF_COOKIE = "uor_csrf";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface StudentProfile {
  id: number;
  studentNumber: string;
  name: string | null;
  email: string | null;
  course: string | null;
  birthDate: string | null;
  nationality: string | null;
  phone: string | null;
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
}

export interface AuthLoginResponse {
  success: boolean;
  studentNumber?: string;
  student?: StudentProfile;
  token?: string;
  error?: string;
}

export interface StudentWithStats extends StudentProfile {
  _count: {
    likes: number;
    votes: number;
    comments: number;
  };
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StudentOwnedSubmissionListItem {
  id: number;
  referenceCode: string;
  name: string;
  status: string;
  statusLabel: string;
  type: string;
  typeLabel: string;
  createdAt: string;
  detailPath: string;
  bannerUrl: string | null;
  receiptPath: string;
}

export interface SubmissionPresentationUpdateResult {
  id: number;
  slug: string;
  detailPath: string;
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
  status: string;
  statusLabel: string;
  type: string;
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
  primaryColor: string;
  secondaryColor: string;
  bannerUrl: string | null;
  communityUrl: string | null;
  boardingPassPath: string;
  paymentProofPath: string | null;
  receiptPath: string;
  detailPath: string;
  canEdit: boolean;
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
  role: "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER" | string;
  permissions: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccessProfile {
  studentNumber: string;
  team: string;
  role: "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER" | string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AdminSecurityOverview {
  authorizedStudents: AdminAuthorizedStudent[];
  recentLogins: StudentProfile[];
}

export interface JuryMember {
  id: number;
  name: string;
  phone: string;
  team: string;
  role: "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER" | string;
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

export interface ProjectPublicComment {
  id: number;
  content: string;
  createdAt: string;
  studentName: string;
  course: string | null;
}

export interface ProjectPublicLike {
  id: number;
  createdAt: string;
  studentName: string;
  course: string | null;
}

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
  paymentProofPath: string | null;
  whatsAppUrl: string | null;
  enrolledAt: string;
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

export type CourseEnrollmentsPagedPayload = CourseEnrollmentsPayload & PagedResult<CourseEnrollment>;

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

export interface CourseEnrollmentPayload {
  paymentProof?: string;
  paymentConfirmed?: true;
  paymentPhone?: string;
}

export type SmsAudienceType =
  | "ALL_STUDENTS"
  | "STUDENT_COURSE"
  | "COURSE_ENROLLED"
  | "SUBMISSION_ENROLLED"
  | "COURSE_OR_SUBMISSION_ENROLLED"
  | "EXHIBITORS"
  | "COURSE_OR_EXHIBITORS"
  | "WINNERS"
  | "SELECTED_STUDENTS";

export interface SmsAudienceInput {
  type: SmsAudienceType;
  studentCourses?: string[];
  courseIds?: number[];
  submissionStatuses?: Array<"PENDING" | "APPROVED" | "REJECTED">;
  selectedStudentNumbers?: string[];
  selectedPhones?: string[];
  cookieMarketingOptIn?: boolean;
  cookieAnalyticsOptIn?: boolean;
  activeWithinDays?: number;
}

export interface SmsRecipientPreviewItem {
  studentId: number | null;
  studentNumber: string | null;
  name: string | null;
  course: string | null;
  phone: string;
  providerTo: string;
  sources: string[];
}

export interface SmsRecipientPreviewPayload {
  totalCandidates: number;
  filteredCandidates: number;
  totalRecipients: number;
  skippedCount: number;
  recipients: SmsRecipientPreviewItem[];
  skipped: Array<{
    studentId: number | null;
    studentNumber: string | null;
    name: string | null;
    course: string | null;
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
    courseEnrolled: { total: number; sendable: number };
    exhibitors: { total: number; sendable: number };
    winners: { total: number; sendable: number };
    marketingConsented: { total: number; sendable: number };
    activeLast7Days: { total: number; sendable: number };
  };
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

export interface SmsFilterOptionsPayload {
  audienceButtons: SmsAudienceButton[];
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

export interface PdfJobQueued {
  id: string;
  kind: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  statusPath: string;
  filePath: string;
}

export interface PdfJobStatus {
  id: string;
  kind: string;
  status: "queued" | "processing" | "completed" | "failed";
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  hasFile?: boolean;
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
  certificatesCount: number;
}

export interface AttendanceOverview {
  totalCredentials: number;
  totalCheckIns: number;
  todayCheckIns: number;
  recentCheckIns: AttendanceCheckIn[];
}

export interface CertificateItem {
  id: number;
  code: string;
  validationToken: string;
  type: string;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  sourceType: string | null;
  sourceId: number | null;
  issuedAt: string;
  issuedByStudentNumber: string;
  status: string;
  revokedAt: string | null;
  validationUrl: string;
  qrImageUrl: string;
  pdfPath: string;
}

export interface PublicValidationPayload {
  valid: boolean;
  kind: "certificate" | "attendance";
  status: string;
  title: string;
  validationUrl: string;
  qrImageUrl: string;
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

export interface ActivityFeedItem {
  id: string;
  type: "vote" | "comment" | "submission";
  message: string;
  actorName: string;
  actorCourse: string | null;
  actorCourseColor: string | null;
  subject: string;
  createdAt: string;
}

export interface LiveChatMessage {
  id: number;
  content: string;
  createdAt: string;
  studentName: string;
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
}

export interface AdminModerationLiveChatMessage extends LiveChatMessage {
  studentNumber: string;
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
  category: "NAVIGATION" | "ENGAGEMENT" | "CONVERSION" | "LIVE" | "AUTH" | "MARKETING" | "FUNCTIONAL" | "CONSENT" | "SECURITY";
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
    consent: "all" | "analytics" | "functional" | "marketing" | "essential-only";
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
    visitorsByDay: Array<{ date: string; visitors: number; sessions: number; conversions: number }>;
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
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    setSessionStudent(null);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

export function getSessionStudent() {
  if (!getToken()) {
    return null;
  }

  return readSessionStudent();
}

function storeLoginSession(result: AuthLoginResponse) {
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

export function isAuthError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 401;
  }

  return error instanceof Error && /unauthorized|missing or invalid token|invalid token/i.test(error.message);
}

export function isForbiddenError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 403;
  }

  return error instanceof Error && /forbidden|access denied|acesso negado/i.test(error.message);
}

async function requestRaw(path: string, options?: RequestInit) {
  const { retry: retryInput, timeoutMs = 15_000, ...fetchOptions } = (options ?? {}) as RequestInit & {
    retry?: number;
    timeoutMs?: number;
  };
  const token = getToken();
  const headers = new Headers(fetchOptions.headers);

  headers.set("ngrok-skip-browser-warning", "true");

  const csrf = getCookieValue(CSRF_COOKIE);
  if (csrf && !headers.has("x-csrf-token")) {
    headers.set("x-csrf-token", csrf);
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (fetchOptions.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (fetchOptions.method ?? "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";
  const maxRetries = canRetry ? Math.max(0, Math.min(retryInput ?? 2, 4)) : 0;
  const maxAttempts = maxRetries + 1;

  const wait = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  const retryableStatus = new Set([408, 425, 429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
    const externalSignal = fetchOptions.signal;
    let cleanupExternal: (() => void) | null = null;

    if (externalSignal) {
      const onAbort = () => controller.abort(externalSignal.reason);
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener("abort", onAbort, { once: true });
        cleanupExternal = () => externalSignal.removeEventListener("abort", onAbort);
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

      if (res.status === 401) {
        setToken(null);
      }

      const errorPayload = await res.json().catch(() => ({ message: res.statusText }));
      const error = new ApiError(res.status, errorPayload.message || errorPayload.error || "Request failed");

      if (attempt < (maxAttempts - 1) && canRetry && retryableStatus.has(res.status)) {
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10) * 1000
          : 0;
        const backoffMs = retryAfterMs > 0 ? retryAfterMs : Math.min(800 * (2 ** attempt), 4_000);
        await wait(backoffMs);
        continue;
      }

      throw error;
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === "AbortError";
      const isNetworkError = error instanceof TypeError;

      if (attempt < (maxAttempts - 1) && canRetry && (isAbortError || isNetworkError)) {
        await wait(Math.min(800 * (2 ** attempt), 4_000));
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

function toQueryString(input?: Record<string, string | number | boolean | undefined | null>) {
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

  auth: {
    login: (studentNumber: string, password: string, origin?: "uorconnect" | "laboratorio") =>
      request<AuthLoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ studentNumber, password, origin }),
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
    me: () =>
      request<StudentProfile>("/auth/me").then((student) => {
        setSessionStudent(student);
        return student;
      }),
    updateMe: (data: StudentProfileUpdateInput) =>
      request<StudentProfile>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((student) => {
        setSessionStudent(student);
        return student;
      }),
  },

  contest: {
    login: (studentNumber: string, password: string) =>
      request<AuthLoginResponse>("/contest/auth/login", {
        method: "POST",
        body: JSON.stringify({ studentNumber, password }),
      }).then(storeLoginSession),
    me: () =>
      request<StudentProfile>("/contest/me").then((student) => {
        setSessionStudent(student);
        return student;
      }),
    securityOverview: () =>
      request<AdminSecurityOverview>("/contest/security"),
    authorizeAdmin: (studentNumber: string) =>
      request<AdminAuthorizedStudent>("/contest/security/authorized-students", {
        method: "POST",
        body: JSON.stringify({ studentNumber }),
      }),
    revokeAdmin: (studentNumber: string) =>
      request<{ success: boolean }>(`/contest/security/authorized-students/${studentNumber}`, {
        method: "DELETE",
      }),
  },

  reports: {
    exportOverviewPdf: () =>
      requestBlob("/reports/overview/pdf"),
    createOverviewPdfJob: () =>
      request<PdfJobQueued>("/reports/overview/pdf-jobs", { method: "POST" }),
    getOverviewPdfJob: (jobId: string) =>
      request<PdfJobStatus>(`/reports/overview/pdf-jobs/${jobId}`),
    downloadOverviewPdfJobFile: (jobId: string) =>
      requestBlob(`/reports/overview/pdf-jobs/${jobId}/file`),
  },

  students: {
    list: () => request<StudentWithStats[]>("/auth/students"),
    listPaged: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      course?: string;
      sort?:
        | "created_desc"
        | "created_asc"
        | "name_asc"
        | "name_desc"
        | "number_asc"
        | "number_desc"
        | "course_asc"
        | "course_desc"
        | "interactions_desc";
    }) => request<PagedResult<StudentWithStats>>(`/auth/students/paged${toQueryString(params)}`),
    securityOverview: () => request<AdminSecurityOverview>("/auth/security"),
    adminAccess: () => request<AdminAccessProfile>("/auth/admin/access"),
    authorizeAdmin: (studentNumber: string, access?: { team?: string; role?: string; permissions?: string[] }) =>
      request<AdminAuthorizedStudent>("/auth/security/authorized-students", {
        method: "POST",
        body: JSON.stringify({ studentNumber, ...access }),
      }),
    revokeAdmin: (studentNumber: string) =>
      request<{ success: boolean }>(`/auth/security/authorized-students/${studentNumber}`, {
        method: "DELETE",
      }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/auth/students/${id}`, {
        method: "DELETE",
      }),
  },

  jury: {
    list: () =>
      request<{ juryMembers: JuryMember[] }>("/auth/security/jury-members")
        .then((payload) => payload.juryMembers),
    create: (data: { name: string; phone: string; team?: string; role?: string; permissions?: string[] }) =>
      request<JuryMember>("/auth/security/jury-members", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/auth/security/jury-members/${id}`, {
        method: "DELETE",
      }),
    sendCode: (id: number, expiresInMinutes?: number) =>
      request<JurySendCodeResult>(`/auth/security/jury-members/${id}/send-code`, {
        method: "POST",
        body: JSON.stringify(
          expiresInMinutes ? { expiresInMinutes } : {}
        ),
      }),
  },

  submissions: {
    config: () =>
      request<SubmissionConfig>("/submissions/config"),
    updateConfig: (data: Omit<SubmissionConfig, "key" | "createdAt" | "updatedAt">) =>
      request<SubmissionConfig>("/submissions/config", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    list: (params?: { status?: string; type?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request<Array<{ id: number; referenceCode: string; name: string; status: string; type: string }>>(
        `/submissions${qs ? `?${qs}` : ""}`
      );
    },
    updateStatus: (id: number, status: "PENDING" | "APPROVED" | "REJECTED") =>
      request<{ success: boolean }>(`/submissions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    updatePresentation: (
      id: number,
      data: { primaryColor?: string; secondaryColor?: string; bannerUrl?: string | null }
    ) =>
      request<SubmissionPresentationUpdateResult>(`/submissions/${id}/presentation`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    updateOwnPresentation: (
      id: number,
      data: { primaryColor?: string; secondaryColor?: string; bannerUrl?: string | null }
    ) =>
      request<SubmissionPresentationUpdateResult>(`/submissions/${id}/presentation/mine`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    listDetailed: (params?: { status?: string; type?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request<Array<{
        id: number;
        slug: string;
        detailPath: string;
        referenceCode: string;
        name: string;
        description: string;
        status: string;
        type: string;
        area: string | null;
        createdAt: string | null;
        course: string | null;
        members: string | null;
        membersList: string[];
        teamSize: number;
        leaderName: string | null;
        leaderPhone: string | null;
        needs: string[];
        observations: string | null;
        primaryColor: string;
        secondaryColor: string;
        bannerUrl: string | null;
        isWinner: boolean;
        canVote: boolean;
        eligibleForAward: boolean;
      }>>(
        `/submissions${qs ? `?${qs}` : ""}`
      );
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
      request<PagedResult<{
        id: number;
        slug: string;
        detailPath: string;
        referenceCode: string;
        name: string;
        description: string;
        status: string;
        type: string;
        area: string | null;
        createdAt: string | null;
        course: string | null;
        members: string | null;
        membersList: string[];
        teamSize: number;
        leaderName: string | null;
        leaderPhone: string | null;
        needs: string[];
        observations: string | null;
        primaryColor: string;
        secondaryColor: string;
        bannerUrl: string | null;
        isWinner: boolean;
        canVote: boolean;
        eligibleForAward: boolean;
      }>>(`/submissions/paged${toQueryString(params)}`),
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
        status: string;
        id: number;
        communityUrl: string | null;
        boardingPassPath: string;
        paymentProofPath: string | null;
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
    mine: () =>
      request<StudentOwnedSubmissionListItem[]>("/submissions/mine"),
    receipt: (id: number) =>
      request<StudentSubmissionReceipt>(`/submissions/${id}/receipt`),
    summary: (id: number) =>
      request<SubmissionSummary | null>(`/submissions/${id}/summary`),
    review: (id: number, data: ReviewInput) =>
      request<void>(`/submissions/${id}/review`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  agenda: {
    list: () =>
      request<AgendaItem[]>("/agenda"),
    live: () =>
      request<AgendaLiveState>("/agenda/live"),
    liveConfig: () =>
      request<AgendaLiveConfig>("/agenda/live-config"),
    updateLiveConfig: (data: AgendaLiveConfigInput) =>
      request<AgendaLiveConfig>("/agenda/live-config", { method: "PUT", body: JSON.stringify(data) }),
    create: (data: AgendaInput) =>
      request<AgendaItem>("/agenda", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: AgendaInput) =>
      request<AgendaItem>(`/agenda/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/agenda/${id}`, { method: "DELETE" }),
  },

  speakers: {
    list: () =>
      request<Speaker[]>("/speakers"),
    create: (data: SpeakerInput) =>
      request<Speaker>("/speakers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: SpeakerInput) =>
      request<Speaker>(`/speakers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/speakers/${id}`, { method: "DELETE" }),
  },

  faq: {
    list: (includeDrafts = false) =>
      request<FaqItem[]>(`/faq${includeDrafts ? "?includeDrafts=true" : ""}`),
    create: (data: FaqInput) =>
      request<FaqItem>("/faq", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: FaqInput) =>
      request<FaqItem>(`/faq/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) =>
      request<{ success: boolean }>(`/faq/${id}`, { method: "DELETE" }),
  },

  guide: {
    content: (includeDrafts = false) =>
      request<GuideContent>(`/guide${includeDrafts ? "?includeDrafts=true" : ""}`),
    createStep: (data: GuideStepInput) =>
      request<GuideStep>("/guide/steps", { method: "POST", body: JSON.stringify(data) }),
    updateStep: (id: number, data: GuideStepInput) =>
      request<GuideStep>(`/guide/steps/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    removeStep: (id: number) =>
      request<{ success: boolean }>(`/guide/steps/${id}`, { method: "DELETE" }),
    createTip: (data: GuideTipInput) =>
      request<GuideTip>("/guide/tips", { method: "POST", body: JSON.stringify(data) }),
    updateTip: (id: number, data: GuideTipInput) =>
      request<GuideTip>(`/guide/tips/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    removeTip: (id: number) =>
      request<{ success: boolean }>(`/guide/tips/${id}`, { method: "DELETE" }),
    createVenue: (data: VenueInput) =>
      request<Venue>("/guide/venues", { method: "POST", body: JSON.stringify(data) }),
    updateVenue: (id: number, data: VenueInput) =>
      request<Venue>(`/guide/venues/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    removeVenue: (id: number) =>
      request<{ success: boolean }>(`/guide/venues/${id}`, { method: "DELETE" }),
  },

  homeContent: {
    list: (includeDrafts = false) =>
      request<HomeContent>(`/home-content${includeDrafts ? "?includeDrafts=true" : ""}`),
    createCourse: (data: HomeCourseInput) =>
      request<HomeCourse>("/home-content/courses", { method: "POST", body: JSON.stringify(data) }),
    updateCourse: (id: number, data: HomeCourseInput) =>
      request<HomeCourse>(`/home-content/courses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    removeCourse: (id: number) =>
      request<{ success: boolean }>(`/home-content/courses/${id}`, { method: "DELETE" }),
    createPanel: (data: PanelTopicInput) =>
      request<PanelTopic>("/home-content/panels", { method: "POST", body: JSON.stringify(data) }),
    updatePanel: (id: number, data: PanelTopicInput) =>
      request<PanelTopic>(`/home-content/panels/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    removePanel: (id: number) =>
      request<{ success: boolean }>(`/home-content/panels/${id}`, { method: "DELETE" }),
    updateSocialConfig: (data: HomeSocialConfigInput) =>
      request<HomeSocialConfig>("/home-content/social-config", { method: "PUT", body: JSON.stringify(data) }),
  },

  courses: {
    list: (includeDrafts = false) =>
      request<CoursesContent>(`/courses${includeDrafts ? "?includeDrafts=true" : ""}`),
    create: (data: CourseInput) =>
      request<Course>("/courses", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: CourseInput) =>
      request<Course>(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
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
        paymentStatus?: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELED";
      }
    ) =>
      request<CourseEnrollmentsPagedPayload>(`/courses/${id}/enrollments/paged${toQueryString(params)}`),
    updateEnrollmentStatus: (
      enrollmentId: number,
      status: "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELED"
    ) =>
      request<{ enrollment: CourseEnrollment }>(`/courses/enrollments/${enrollmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    exportEnrollmentsPdf: (id: number) =>
      requestBlob(`/courses/${id}/enrollments/pdf`),
    createEnrollmentsPdfJob: (id: number) =>
      request<PdfJobQueued>(`/courses/${id}/enrollments/pdf-jobs`, { method: "POST" }),
    getEnrollmentsPdfJob: (id: number, jobId: string) =>
      request<PdfJobStatus>(`/courses/${id}/enrollments/pdf-jobs/${jobId}`),
    downloadEnrollmentsPdfJobFile: (id: number, jobId: string) =>
      requestBlob(`/courses/${id}/enrollments/pdf-jobs/${jobId}/file`),
    syncStudentCounts: () =>
      request<CoursesContent>("/courses/sync-student-counts", { method: "POST" }),
    myLikes: () =>
      request<{ likedCourseIds: number[] }>("/courses/liked"),
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
      request<{ liked: boolean; likesCount: number }>(`/courses/${id}/like`, { method: "POST" }),
  },

  attendance: {
    me: () =>
      request<AttendanceMePayload>("/attendance/me"),
    overview: () =>
      request<AttendanceOverview>("/attendance/admin/overview"),
    checkIns: (params?: { page?: number; limit?: number; search?: string }) =>
      request<PagedResult<AttendanceCheckIn>>(`/attendance/admin/check-ins${toQueryString(params)}`),
    checkIn: (data: { token?: string; studentNumber?: string; eventKey?: string; eventLabel?: string; notes?: string | null }) =>
      request<{ checkIn: AttendanceCheckIn; credential: AttendanceCredential; alreadyCheckedIn: boolean }>("/attendance/admin/check-in", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  certificates: {
    mine: () =>
      request<CertificateItem[]>("/certificates/mine"),
    list: (params?: { page?: number; limit?: number; search?: string; type?: string; status?: string }) =>
      request<PagedResult<CertificateItem>>(`/certificates/admin/list${toQueryString(params)}`),
    issue: (data: { studentNumber: string; type?: string; title?: string; sourceType?: string; sourceId?: number; metadata?: Record<string, unknown> }) =>
      request<CertificateItem>("/certificates/admin/issue", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    issueAttendees: (data?: { type?: string; title?: string; eventKey?: string }) =>
      request<{ issued: number; skipped: number; certificates: CertificateItem[] }>("/certificates/admin/issue-attendees", {
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
      request<{ issued: number; skipped: number; certificates: CertificateItem[] }>("/certificates/admin/issue-bulk", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    revoke: (id: number) =>
      request<CertificateItem>(`/certificates/admin/${id}/revoke`, { method: "PATCH" }),
    pdf: (id: number) =>
      requestBlob(`/certificates/${id}/pdf`),
  },

  validation: {
    get: (token: string) =>
      request<PublicValidationPayload>(`/validation/${encodeURIComponent(token)}`),
  },

  audit: {
    logs: (params?: { page?: number; limit?: number; search?: string; action?: string; entityType?: string; from?: string; to?: string }) =>
      request<PagedResult<AdminAuditLog>>(`/audit/admin/logs${toQueryString(params)}`),
    exportCsv: (params?: { search?: string; action?: string; entityType?: string; from?: string; to?: string; limit?: number }) =>
      requestBlob(`/audit/admin/logs/export.csv${toQueryString(params)}`),
  },

  sms: {
    filters: () =>
      request<SmsFilterOptionsPayload>("/sms/admin/filters"),
    overview: () =>
      request<SmsOverviewPayload>("/sms/admin/overview"),
    campaigns: (page = 0, pageSize = 20) =>
      request<{ page: number; pageSize: number; total: number; campaigns: SmsCampaignSummary[] }>(`/sms/admin/campaigns${toQueryString({ page, pageSize })}`),
    previewRecipients: (data: { audience: SmsAudienceInput; search?: string; limit?: number }) =>
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
      request<SmsProviderProxyResponse>(`/sms/admin/provider/messages${toQueryString({ page })}`),
    providerMessagesByDate: (start: string, end: string, page = 0) =>
      request<SmsProviderProxyResponse>(`/sms/admin/provider/messages/date${toQueryString({ start, end, page })}`),
    providerMessagesByRecipient: (phoneNumber: string, page = 0) =>
      request<SmsProviderProxyResponse>(`/sms/admin/provider/messages/recipient${toQueryString({ phoneNumber, page })}`),
    providerMessageOne: (params: { messageId?: string; id?: string }) =>
      request<SmsProviderProxyResponse>(`/sms/admin/provider/messages/one${toQueryString(params)}`),
    providerDeleteMessage: (messageId: string) =>
      request<SmsProviderProxyResponse>(`/sms/admin/provider/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
      }),
    providerRecipients: (page = 0) =>
      request<SmsProviderProxyResponse>(`/sms/admin/provider/recipients${toQueryString({ page })}`),
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
      request<SmsProviderProxyResponse>(`/sms/admin/provider/senders/${encodeURIComponent(senderId)}`, {
        method: "DELETE",
      }),
  },

  stats: {
    get: () =>
      request<Stats>(`/stats`),
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
      request<AnalyticsDashboard>(`/analytics/dashboard${toQueryString(filters)}`),
    events: (filters?: AnalyticsFilterInput) =>
      request<AnalyticsEventsPayload>(`/analytics/events${toQueryString(filters)}`),
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
      request<{ voted: boolean; votesCount: number }>(`/interactions/vote`, {
        method: "POST",
        body: JSON.stringify({ submissionId }),
      }),
    comment: (submissionId: number, content: string) =>
      request<{ id: number; content: string; createdAt: string; studentName: string; course: string | null; courseColor: string | null }>(`/interactions/comment`, {
        method: "POST",
        body: JSON.stringify({ submissionId, content }),
      }),
    me: () =>
      request<{ student: StudentProfile | null; jury?: { id: number; name: string; phone: string; lastCodeSentAt: string | null } | null; stats: { likes: number; votes: number; comments: number } }>(`/interactions/me`),
    adminVotes: () =>
      request<{
        projects: Array<{ id: number; name: string; type: string; votes: number; comments: number; averageRating: number }>;
        votes: Array<{
          id: number;
          studentId: number;
          studentNumber: string;
          studentName: string | null;
          studentEmail: string | null;
          submissionId: number;
          submissionName: string;
          createdAt: string;
        }>;
      }>(`/interactions/admin/votes`),
    adminVotesPaged: (params?: {
      projectsPage?: number;
      projectsLimit?: number;
      votesPage?: number;
      votesLimit?: number;
    }) =>
      request<{
        projects: PagedResult<{ id: number; name: string; type: string; votes: number; comments: number; averageRating: number }>;
        votes: PagedResult<{
          id: number;
          studentId: number;
          studentNumber: string;
          studentName: string | null;
          studentEmail: string | null;
          submissionId: number;
          submissionName: string;
          createdAt: string;
        }>;
      }>(`/interactions/admin/votes/paged${toQueryString(params)}`),
    adminModeration: () =>
      request<{
        projectComments: AdminModerationProjectComment[];
        liveChatMessages: AdminModerationLiveChatMessage[];
      }>(`/interactions/admin/moderation`),
    deleteProjectComment: (id: number) =>
      request<{ success: boolean }>(`/interactions/admin/comments/${id}`, {
        method: "DELETE",
      }),
    deleteLiveChatMessage: (id: number) =>
      request<{ success: boolean }>(`/interactions/admin/live-chat/${id}`, {
        method: "DELETE",
      }),
    activityFeed: () =>
      request<ActivityFeedItem[]>(`/interactions/activity-feed`),
    liveChat: () =>
      request<LiveChatMessage[]>(`/interactions/live-chat`),
    sendLiveChat: (content: string) =>
      request<LiveChatMessage>(`/interactions/live-chat`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    projects: () =>
      request<ProjectPublicFeedItem[]>(`/interactions/projects`),
    projectBySlug: (slug: string) =>
      request<ProjectPublicFeedItem>(`/interactions/projects/${slug}`)
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
  reviews: Array<{ user: string; rating: number; comment: string | null; createdAt: string }>;
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
