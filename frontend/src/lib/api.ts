const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api";
const TOKEN_KEY = "uor_token";

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

export interface StudentOwnedSubmissionListItem {
  id: number;
  referenceCode: string;
  name: string;
  status: string;
  statusLabel: string;
  type: string;
  typeLabel: string;
  createdAt: string;
  receiptPath: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AdminSecurityOverview {
  authorizedStudents: AdminAuthorizedStudent[];
  recentLogins: StudentProfile[];
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

export interface HomeSocialConfig {
  key: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
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
  const token = getToken();
  const headers = new Headers(options?.headers);

  headers.set("ngrok-skip-browser-warning", "true");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
    }
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, error.message || error.error || "Request failed");
  }

  return res;
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

export const api = {
  health: () => request<{ status: string }>("/health"),

  auth: {
    login: (studentNumber: string, password: string, origin?: "uorconnect" | "laboratorio") =>
      request<AuthLoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ studentNumber, password, origin }),
      }).then(storeLoginSession),
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
  },

  students: {
    list: () => request<StudentWithStats[]>("/auth/students"),
    securityOverview: () => request<AdminSecurityOverview>("/auth/security"),
    authorizeAdmin: (studentNumber: string) =>
      request<AdminAuthorizedStudent>("/auth/security/authorized-students", {
        method: "POST",
        body: JSON.stringify({ studentNumber }),
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
    exportEnrollmentsPdf: (id: number) =>
      requestBlob(`/courses/${id}/enrollments/pdf`),
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
    enroll: (id: number) =>
      request<{ enrolled: boolean; communityUrl: string | null; studentCount: number }>(`/courses/${id}/enroll`, { method: "POST" }),
    like: (id: number) =>
      request<{ liked: boolean; likesCount: number }>(`/courses/${id}/like`, { method: "POST" }),
  },

  stats: {
    get: () =>
      request<Stats>(`/stats`),
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
      request<{ student: StudentProfile | null; stats: { likes: number; votes: number; comments: number } }>(`/interactions/me`),
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
}

export interface Stats {
  participants: number;
  submissions: number;
  approved: number;
  votes: number;
  avgRating: number;
}
