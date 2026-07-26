import type { MoodleApplication } from "../../moodle/application/ports";
import type { UorStudentIdentity } from "../application/ports";

export class UorStudentLearningApplication {
  constructor(private readonly moodle: MoodleApplication) {}
  #student(student: UorStudentIdentity) { return { id: student.id, studentNumber: student.studentNumber }; }
  getProfile(student: UorStudentIdentity) { return this.moodle.getProfile(this.#student(student)); }
  getOverview(student: UorStudentIdentity) { return this.moodle.getOverview(this.#student(student)); }
  listCourses(student: UorStudentIdentity, page: { limit: number; cursor?: string }) { return this.moodle.listCourses(this.#student(student), page); }
  getCourse(student: UorStudentIdentity, courseId: string) { return this.moodle.getCourse(this.#student(student), courseId); }
  listSections(student: UorStudentIdentity, courseId: string, page: { limit: number; cursor?: string }) { return this.moodle.listSections(this.#student(student), courseId, page); }
  listMaterials(student: UorStudentIdentity, courseId: string | null, page: { limit: number; cursor?: string }) { return this.moodle.listMaterials(this.#student(student), courseId, page); }
  openMaterial(student: UorStudentIdentity, materialId: string, range?: string) { return this.moodle.openMaterial(this.#student(student), materialId, range); }
}
