export type MoodleGatewayFailureCode =
  | "MOODLE_AUTH_FAILED"
  | "MOODLE_SESSION_EXPIRED"
  | "MOODLE_UNAVAILABLE"
  | "MOODLE_UPSTREAM_CHANGED"
  | "MOODLE_RESOURCE_NOT_FOUND"
  | "MOODLE_PERMISSION_DENIED"
  | "MOODLE_UNSAFE_REDIRECT"
  | "MOODLE_RESPONSE_TOO_LARGE"
  | "MOODLE_MATERIAL_UNSUPPORTED"
  | "MOODLE_ENVELOPE_INVALID"
  | "MOODLE_KEY_UNAVAILABLE"
  | "MOODLE_CONFIGURATION_INVALID";

const SAFE_GATEWAY_MESSAGES: Record<MoodleGatewayFailureCode, string> = {
  MOODLE_AUTH_FAILED: "As credenciais Moodle foram rejeitadas.",
  MOODLE_SESSION_EXPIRED: "A sessão Moodle expirou.",
  MOODLE_UNAVAILABLE: "O Moodle está temporariamente indisponível.",
  MOODLE_UPSTREAM_CHANGED: "A resposta do Moodle não é compatível com a integração.",
  MOODLE_RESOURCE_NOT_FOUND: "O recurso Moodle não foi encontrado.",
  MOODLE_PERMISSION_DENIED: "O Moodle recusou o acesso ao recurso.",
  MOODLE_UNSAFE_REDIRECT: "O Moodle devolveu um destino não permitido.",
  MOODLE_RESPONSE_TOO_LARGE: "A resposta Moodle excede o limite permitido.",
  MOODLE_MATERIAL_UNSUPPORTED: "Este tipo de material não pode ser aberto com segurança.",
  MOODLE_ENVELOPE_INVALID: "Não foi possível ler os dados protegidos da integração.",
  MOODLE_KEY_UNAVAILABLE: "A chave necessária para a integração não está disponível.",
  MOODLE_CONFIGURATION_INVALID: "A integração Moodle não está configurada corretamente.",
};

/** Adapter-level failure. The application layer maps it to the public MoodleError contract. */
export class MoodleGatewayFailure extends Error {
  readonly name = "MoodleGatewayFailure";
  readonly retryable: boolean;

  constructor(
    readonly code: MoodleGatewayFailureCode,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(SAFE_GATEWAY_MESSAGES[code], { cause: options?.cause });
    this.retryable = options?.retryable ?? code === "MOODLE_UNAVAILABLE";
  }
}

export type MoodleGatewayCredentials = {
  username: string;
  password: string;
};

export type MoodleGatewaySession = {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: string | null;
    secure: boolean;
    httpOnly: boolean;
    sameSite: "Strict" | "Lax" | "None" | null;
  }>;
  sesskey: string | null;
  authenticatedAt: string;
  expiresAt: string | null;
};

export type MoodleGatewayProfile = {
  externalUserKey: string;
  studentNumber: string;
  displayName: string;
  email: string | null;
  timezone: string | null;
};

export type MoodleGatewayCourse = {
  externalKey: string;
  name: string;
  shortName: string;
  category: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  progressAvailable: boolean;
  progressPercent: number | null;
  visible: boolean;
  hiddenByStudent: boolean;
  favourite: boolean;
};

export type MoodleGatewayCourseList = {
  courses: MoodleGatewayCourse[];
  /** True only when the adapter proved it reached the end of pagination. */
  complete: boolean;
  source: "ajax" | "html";
};

export type MoodleGatewayModule = {
  externalKey: string;
  type: string;
  title: string;
  available: boolean;
};

export type MoodleGatewaySection = {
  externalKey: string;
  courseExternalKey: string;
  position: number;
  title: string;
  summary: string | null;
  visible: boolean;
  available: boolean;
  modules: MoodleGatewayModule[];
};

export type MoodleGatewayMaterialType =
  | "file" | "folder" | "page" | "book" | "url" | "video" | "audio"
  | "image" | "scorm" | "h5p" | "lti" | "other";

export type MoodleGatewayStreamLocator =
  | { kind: "course-module"; moduleType: "resource"; courseModuleKey: string }
  | { kind: "plugin-file"; path: string };

export type MoodleGatewayMaterial = {
  externalKey: string;
  courseExternalKey: string;
  sectionExternalKey: string;
  type: MoodleGatewayMaterialType;
  title: string;
  description: string | null;
  available: boolean;
  openAvailable: boolean;
  downloadAvailable: boolean;
  mimeType: string | null;
  sizeBytes: number | null;
  updatedAt: string | null;
  /** Infrastructure-only; it is encrypted before persistence and never presented. */
  locator: MoodleGatewayStreamLocator | null;
};

export type MoodleGatewayCourseContent = {
  course: MoodleGatewayCourse;
  sections: MoodleGatewaySection[];
  materials: MoodleGatewayMaterial[];
  /** False when content came from HTML fallback or traversal hit a safety cap. */
  complete: boolean;
  source: "ajax" | "html";
};

export type MoodleGatewayAuthenticatedSession = {
  session: MoodleGatewaySession;
  profile: MoodleGatewayProfile;
};

export type MoodleGatewaySessionValidation =
  | { valid: true; session: MoodleGatewaySession; profile: MoodleGatewayProfile | null }
  | { valid: false; reason: "expired" };

export type MoodleGatewayStreamRequest = { range?: string };

export type MoodleGatewayStreamResult = {
  body: ReadableStream<Uint8Array>;
  status: 200 | 206;
  contentType: string;
  contentLength: number | null;
  contentRange: string | null;
  filename: string;
};

/** Source abstraction used by application services; no Moodle URL crosses it. */
export interface MoodleGateway {
  authenticate(credentials: MoodleGatewayCredentials): Promise<MoodleGatewayAuthenticatedSession>;
  validateSession(session: MoodleGatewaySession): Promise<MoodleGatewaySessionValidation>;
  getProfile(session: MoodleGatewaySession): Promise<MoodleGatewayProfile>;
  listCourses(session: MoodleGatewaySession): Promise<MoodleGatewayCourseList>;
  getCourse(session: MoodleGatewaySession, courseExternalKey: string): Promise<MoodleGatewayCourse>;
  getCourseContent(session: MoodleGatewaySession, courseExternalKey: string): Promise<MoodleGatewayCourseContent>;
  logout(session: MoodleGatewaySession): Promise<void>;
  openStream(
    session: MoodleGatewaySession,
    locator: MoodleGatewayStreamLocator,
    request?: MoodleGatewayStreamRequest,
  ): Promise<MoodleGatewayStreamResult>;
}
