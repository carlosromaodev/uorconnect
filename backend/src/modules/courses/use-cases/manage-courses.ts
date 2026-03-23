import { prisma } from "../../../shared/prisma";

export type CourseInput = {
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
};

export class ListCourses {
  async execute(includeDrafts = false) {
    const courses = await prisma.course.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      include: {
        _count: {
          select: {
            likes: true,
            enrollments: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    const normalizedCourses = courses.map(({ _count, ...course }) => ({
      ...course,
      studentCount: _count.enrollments,
      likesCount: _count.likes
    }));

    const topCourses = [...normalizedCourses]
      .sort((a, b) => b.studentCount - a.studentCount || a.name.localeCompare(b.name))
      .slice(0, 5);

    const preview = topCourses.some((course) => course.studentCount > 0)
      ? topCourses.slice(0, 3)
      : normalizedCourses.slice(0, 3);

    return { courses: normalizedCourses, topCourses, preview };
  }
}

export class CreateCourse {
  async execute(data: CourseInput) {
    const course = await prisma.course.create({
      data: {
        name: data.name,
        description: data.description,
        preview: data.preview ?? null,
        communityUrl: data.communityUrl ?? null,
        companyName: data.companyName,
        companyCategory: data.companyCategory,
        companyLogoUrl: data.companyLogoUrl ?? null,
        companyWebsite: data.companyWebsite ?? null,
        companyInstagram: data.companyInstagram ?? null,
        companyLinkedin: data.companyLinkedin ?? null,
        isPaid: data.isPaid ?? false,
        priceLabel: data.priceLabel ?? null,
        accentColor: data.accentColor ?? "#f97316",
        accentColorSecondary: data.accentColorSecondary ?? "#fb923c",
        courseColor: data.courseColor ?? "#2563eb",
        studentCount: 0,
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });

    return {
      ...course,
      likesCount: 0
    };
  }
}

export class UpdateCourse {
  async execute(id: number, data: CourseInput) {
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) throw new Error("Course not found");

    const course = await prisma.course.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        preview: data.preview ?? null,
        communityUrl: data.communityUrl ?? null,
        companyName: data.companyName,
        companyCategory: data.companyCategory,
        companyLogoUrl: data.companyLogoUrl ?? null,
        companyWebsite: data.companyWebsite ?? null,
        companyInstagram: data.companyInstagram ?? null,
        companyLinkedin: data.companyLinkedin ?? null,
        isPaid: data.isPaid ?? false,
        priceLabel: data.priceLabel ?? null,
        accentColor: data.accentColor ?? "#f97316",
        accentColorSecondary: data.accentColorSecondary ?? "#fb923c",
        courseColor: data.courseColor ?? "#2563eb",
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });

    return {
      ...course,
      studentCount: await prisma.courseEnrollment.count({ where: { courseId: id } }),
      likesCount: await prisma.courseLike.count({ where: { courseId: id } })
    };
  }
}

export class DeleteCourse {
  async execute(id: number) {
    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) throw new Error("Course not found");
    await prisma.course.delete({ where: { id } });
  }
}

export class SyncCourseStudentCounts {
  async execute() {
    const grouped = await prisma.student.groupBy({
      by: ["course"],
      where: {
        course: {
          not: null
        }
      },
      _count: {
        _all: true
      }
    });

    const normalized = grouped
      .map((entry) => ({
        name: (entry.course ?? "").trim(),
        count: entry._count._all
      }))
      .filter((entry) => entry.name.length > 0);

    const existing = await prisma.course.findMany({
      select: { id: true, name: true, description: true, preview: true, sortOrder: true, isPublished: true }
    });

    const mapExisting = new Map(existing.map((item) => [item.name.toLowerCase(), item]));

    for (const item of normalized) {
      const found = mapExisting.get(item.name.toLowerCase());
      if (found) {
        await prisma.course.update({
          where: { id: found.id },
          data: { studentCount: item.count }
        });
        continue;
      }

      await prisma.course.create({
        data: {
          name: item.name,
          description: `Curso ${item.name}`,
          preview: `Visão geral do curso ${item.name}.`,
          communityUrl: null,
          companyName: "Parceiro por definir",
          companyCategory: "Empresa parceira",
          companyLogoUrl: null,
          companyWebsite: null,
          companyInstagram: null,
          companyLinkedin: null,
          isPaid: false,
          priceLabel: "Gratuito",
          accentColor: "#f97316",
          accentColorSecondary: "#fb923c",
          courseColor: "#2563eb",
          studentCount: 0,
          sortOrder: 0,
          isPublished: true
        }
      });
    }

    return new ListCourses().execute(true);
  }
}
