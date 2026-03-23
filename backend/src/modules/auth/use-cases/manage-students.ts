import { type StudentWithStats } from "../domain/student";

export interface StudentManagementRepository {
  listAllWithStats(): Promise<StudentWithStats[]>;
  findByIdWithStats(id: number): Promise<StudentWithStats | null>;
  deleteWithRelations(id: number): Promise<void>;
}

export class ListStudentsWithStatsUseCase {
  constructor(private readonly studentRepository: StudentManagementRepository) {}

  async execute() {
    return this.studentRepository.listAllWithStats();
  }
}

export class DeleteStudentUseCase {
  constructor(private readonly studentRepository: StudentManagementRepository) {}

  async execute(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false as const, error: "Invalid student id" };
    }

    const student = await this.studentRepository.findByIdWithStats(id);
    if (!student) {
      return { success: false as const, error: "Student not found" };
    }

    await this.studentRepository.deleteWithRelations(id);
    return { success: true as const };
  }
}
