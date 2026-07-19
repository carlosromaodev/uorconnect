import type { Readable } from "node:stream";
import type {
  MoodleConnectionView,
  MoodleCourse,
  MoodleListResult,
  MoodleMaterial,
  MoodleOverview,
  MoodleProfile,
  MoodleSection,
  MoodleSyncView,
} from "../domain/models";

export type MoodleStudentIdentity = {
  id: number;
  studentNumber: string;
};

export type MoodleConnectInput = {
  username: string;
  password: string;
  rememberCredentials: true;
};

export type MoodleConnectResult = {
  connection: MoodleConnectionView;
  initialSyncRunId: string | null;
  created: boolean;
};

export type MoodlePageInput = {
  limit: number;
  cursor?: string;
};

export type MoodleDownload = {
  stream: Readable;
  status: 200 | 206;
  contentType: string;
  fileName: string;
  contentLength: number | null;
  acceptRanges: boolean;
  contentRange: string | null;
};

export interface MoodleApplication {
  connect(student: MoodleStudentIdentity, input: MoodleConnectInput): Promise<MoodleConnectResult>;
  disconnect(student: MoodleStudentIdentity): Promise<MoodleConnectionView>;
  getConnection(student: MoodleStudentIdentity): Promise<MoodleConnectionView>;
  getProfile(student: MoodleStudentIdentity): Promise<MoodleProfile>;
  getOverview(student: MoodleStudentIdentity): Promise<{ data: MoodleOverview; syncedAt: Date | null; stale: boolean; snapshotVersion: number | null }>;
  listCourses(student: MoodleStudentIdentity, page: MoodlePageInput): Promise<MoodleListResult<MoodleCourse>>;
  getCourse(student: MoodleStudentIdentity, courseId: string): Promise<{ data: MoodleCourse; syncedAt: Date; stale: boolean; snapshotVersion: number }>;
  listSections(student: MoodleStudentIdentity, courseId: string, page: MoodlePageInput): Promise<MoodleListResult<MoodleSection>>;
  listMaterials(student: MoodleStudentIdentity, courseId: string | null, page: MoodlePageInput): Promise<MoodleListResult<MoodleMaterial>>;
  openMaterial(student: MoodleStudentIdentity, materialId: string, range?: string): Promise<MoodleDownload>;
  startSync(student: MoodleStudentIdentity, reason: string): Promise<MoodleSyncView>;
  getSyncStatus(student: MoodleStudentIdentity): Promise<MoodleSyncView | null>;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}
