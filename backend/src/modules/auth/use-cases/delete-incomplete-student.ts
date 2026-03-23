import { type StudentDeletionResult, type StudentWithStats } from "../domain/student";

export interface StudentDeletionRepository {
  findByIdWithStats(id: number): Promise<StudentWithStats | null>;
  deleteWithRelations(id: number): Promise<void>;
}

export class DeleteIncompleteStudentUseCase {
  constructor(private studentRepository: StudentDeletionRepository) {}

  async execute(id: number): Promise<StudentDeletionResult> {
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: "Invalid student id" };
    }

    const student = await this.studentRepository.findByIdWithStats(id);
    if (!student) {
      return { success: false, error: "Student not found" };
    }

    await this.studentRepository.deleteWithRelations(id);
    return { success: true };
  }
}
