import { MoodleError } from "../domain/errors";
import type { MoodleRepository } from "../domain/repository";
import { connectionView } from "./moodle-presenters";
import type { MoodleApplication } from "./ports";

function disabled(): never {
  throw new MoodleError(
    "MOODLE_INTEGRATION_DISABLED",
    "A integração Moodle ainda não está habilitada neste ambiente.",
    503,
    false,
    "contact_support",
  );
}

export class DisabledMoodleApplication implements MoodleApplication {
  constructor(private readonly repository: MoodleRepository) {}

  connect: MoodleApplication["connect"] = async () => disabled();
  retryStoredConnection: MoodleApplication["retryStoredConnection"] = async () => disabled();
  disconnect: MoodleApplication["disconnect"] = async (student) => (
    connectionView(await this.repository.disconnectAndPurge(student.id))
  );
  terminateSession: MoodleApplication["terminateSession"] = async (student) => (
    connectionView(await this.repository.terminateSession(student.id))
  );
  getConnection: MoodleApplication["getConnection"] = async (student) => (
    connectionView(await this.repository.getConnection(student.id))
  );
  getProfile: MoodleApplication["getProfile"] = async () => disabled();
  getOverview: MoodleApplication["getOverview"] = async () => disabled();
  listCourses: MoodleApplication["listCourses"] = async () => disabled();
  getCourse: MoodleApplication["getCourse"] = async () => disabled();
  listSections: MoodleApplication["listSections"] = async () => disabled();
  listMaterials: MoodleApplication["listMaterials"] = async () => disabled();
  openMaterial: MoodleApplication["openMaterial"] = async () => disabled();
  startSync: MoodleApplication["startSync"] = async () => disabled();
  getSyncStatus: MoodleApplication["getSyncStatus"] = async () => disabled();
}
