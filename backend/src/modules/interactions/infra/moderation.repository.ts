import { prisma } from "../../../shared/prisma";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import type {
  InteractionModerationRepository,
  ModerationLiveChatMessage,
  ModerationProjectComment
} from "../use-cases/manage-moderation";

function normalizeCourseName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export class PrismaInteractionModerationRepository implements InteractionModerationRepository {
  async listProjectComments(): Promise<ModerationProjectComment[]> {
    const comments = await prisma.studentComment.findMany({
      include: {
        student: true,
        submission: true
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return comments.map((comment) => {
      const profile = normalizeStudentProfile(comment.student);

      return {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        studentName: profile.name ?? `Estudante ${comment.student.studentNumber}`,
        studentNumber: comment.student.studentNumber,
        course: profile.course ?? null,
        submissionId: comment.submissionId,
        submissionName: comment.submission.name
      };
    });
  }

  async listLiveChatMessages(): Promise<ModerationLiveChatMessage[]> {
    const [messages, courses] = await Promise.all([
      prisma.liveChatMessage.findMany({
        include: { student: true },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.course.findMany({
        select: {
          name: true,
          courseColor: true
        }
      })
    ]);

    const courseColorMap = new Map(courses.map((course) => [normalizeCourseName(course.name), course.courseColor]));

    return messages.map((message) => {
      const profile = normalizeStudentProfile(message.student);

      return {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        studentName: profile.name ?? `Estudante ${message.student.studentNumber}`,
        studentNumber: message.student.studentNumber,
        course: profile.course ?? null,
        courseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null
      };
    });
  }

  async hasProjectComment(id: number): Promise<boolean> {
    const comment = await prisma.studentComment.findUnique({
      where: { id },
      select: { id: true }
    });

    return Boolean(comment);
  }

  async deleteProjectComment(id: number): Promise<void> {
    await prisma.studentComment.delete({
      where: { id }
    });
  }

  async hasLiveChatMessage(id: number): Promise<boolean> {
    const message = await prisma.liveChatMessage.findUnique({
      where: { id },
      select: { id: true }
    });

    return Boolean(message);
  }

  async deleteLiveChatMessage(id: number): Promise<void> {
    await prisma.liveChatMessage.delete({
      where: { id }
    });
  }
}
