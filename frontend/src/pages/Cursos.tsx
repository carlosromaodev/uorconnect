import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { FeaturedCourseCard } from "@/components/courses/FeaturedCourseCard";
import { api, type Course, type StudentEnrollmentListItem, getToken, isAuthError, setToken } from "@/lib/api";

function openExternal(url?: string | null, emptyMessage = "Link não disponível.") {
  if (!url) {
    toast.error(emptyMessage);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function hasCourseEngagement(course: Course) {
  return course.likesCount > 0 || course.studentCount > 0;
}

function getCourseEngagementScore(course: Course) {
  return course.studentCount + course.likesCount;
}

function compareNewestCourse(left: Course, right: Course) {
  const rightTime = new Date(right.createdAt).getTime();
  const leftTime = new Date(left.createdAt).getTime();
  const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;
  const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;

  if (safeRightTime !== safeLeftTime) return safeRightTime - safeLeftTime;
  return right.id - left.id;
}

export default function Cursos() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [topCourses, setTopCourses] = useState<Course[]>([]);
  const [topMode, setTopMode] = useState<"featured" | "voted">("featured");
  const [likedCourseIds, setLikedCourseIds] = useState<Set<number>>(new Set());
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<number>>(new Set());
  const [enrollmentsByCourse, setEnrollmentsByCourse] = useState<Record<number, StudentEnrollmentListItem>>({});
  const [loading, setLoading] = useState(true);

  const redirectToLogin = (message: string) => {
    toast.warning(message);
    navigate("/login?redirect=/cursos");
  };

  const handleCourseAccessError = (error: unknown, fallbackMessage: string) => {
    if (isAuthError(error)) {
      setToken(null);
      redirectToLogin("Inicia sessão para continuar com o curso.");
      return true;
    }

    toast.error(error instanceof Error ? error.message : fallbackMessage);
    return false;
  };

  const refreshMyEnrollments = async () => {
    if (!getToken()) {
      setEnrollmentsByCourse({});
      setEnrolledCourseIds(new Set());
      return;
    }

    const enrollmentItems = await api.courses.enrollmentsMine();
    setEnrollmentsByCourse(
      enrollmentItems.reduce<Record<number, StudentEnrollmentListItem>>((acc, item) => {
        acc[item.courseId] = item;
        return acc;
      }, {})
    );
    setEnrolledCourseIds(new Set(enrollmentItems.map((item) => item.courseId)));
  };

  useEffect(() => {
    api.courses.list()
      .then((data) => {
        setCourses(data.courses);
        setTopCourses(data.topCourses);
      })
      .catch(() => {
        setCourses([]);
        setTopCourses([]);
      })
      .finally(() => setLoading(false));

    api.courses.myLikes()
      .then((data) => setLikedCourseIds(new Set(data.likedCourseIds)))
      .catch(() => undefined);

    void refreshMyEnrollments().catch(() => undefined);
  }, []);

  const handleLike = async (courseId: number) => {
    if (!getToken()) {
      redirectToLogin("Inicia sessão para curtir um curso.");
      return;
    }

    try {
      const result = await api.courses.like(courseId);
      setLikedCourseIds((current) => {
        const next = new Set(current);
        if (result.liked) next.add(courseId);
        else next.delete(courseId);
        return next;
      });
      setCourses((current) => current.map((course) => course.id === courseId ? { ...course, likesCount: result.likesCount } : course));
      setTopCourses((current) => current.map((course) => course.id === courseId ? { ...course, likesCount: result.likesCount } : course));
    } catch (error) {
      handleCourseAccessError(error, "Erro ao curtir curso.");
    }
  };

  const handleEnroll = async (course: Course) => {
    if (!getToken()) {
      redirectToLogin("Inicia sessão para te inscreveres num curso.");
      return;
    }

    if (course.isPaid) {
      navigate(`/cursos/${course.id}/inscricao`);
      return;
    }

    try {
      const result = await api.courses.enroll(course.id);
      setCourses((current) => current.map((item) => item.id === course.id ? { ...item, studentCount: result.studentCount } : item));
      setTopCourses((current) => current.map((item) => item.id === course.id ? { ...item, studentCount: result.studentCount } : item));
      await refreshMyEnrollments();
      toast.success(`Inscrição ${course.isPaid ? "registada" : "confirmada"} no curso.`);
    } catch (error) {
      handleCourseAccessError(error, "Erro ao inscrever no curso.");
    }
  };

  const topCourseSource = courses.length ? courses : topCourses;
  const visibleTopCourses = [...topCourseSource]
    .sort((left, right) => {
      if (topMode === "featured") return compareNewestCourse(left, right);

      const leftEngaged = hasCourseEngagement(left);
      const rightEngaged = hasCourseEngagement(right);
      if (leftEngaged !== rightEngaged) return leftEngaged ? -1 : 1;

      const likesDiff = right.likesCount - left.likesCount;
      if (likesDiff !== 0) return likesDiff;

      const scoreDiff = getCourseEngagementScore(right) - getCourseEngagementScore(left);
      if (scoreDiff !== 0) return scoreDiff;

      return compareNewestCourse(left, right);
    })
    .slice(0, 6);

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4 space-y-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <GraduationCap className="h-3.5 w-3.5" />
            Formação
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-2">Cursos</h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground">
            Inscreve-te nos cursos geridos por empresas parceiras e acompanha a tua inscrição com acesso rápido ao recibo.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {visibleTopCourses.length > 0 ? (
              <section className="space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2.5 font-heading text-xl font-bold md:text-2xl">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--area-negocio))]/10">
                        <Users className="h-4 w-4 text-[hsl(var(--area-negocio))]" />
                      </div>
                      Top Cursos
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                      Os cursos mais procurados pela comunidade.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTopMode("featured")}
                      className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${topMode === "featured" ? "bg-primary text-primary-foreground" : "border border-border bg-white text-foreground hover:bg-muted/40"}`}
                    >
                      Destaques
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopMode("voted")}
                      className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${topMode === "voted" ? "bg-primary text-primary-foreground" : "border border-border bg-white text-foreground hover:bg-muted/40"}`}
                    >
                      Mais votados agora
                    </button>
                  </div>
                </div>

                <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                  {visibleTopCourses.map((course, index) => (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, scale: 0.96, y: 16 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05, type: "spring", stiffness: 220, damping: 24 }}
                      className="h-full snap-start w-[88vw] max-w-[340px] sm:w-[350px] sm:max-w-[350px] lg:w-[380px] lg:max-w-[380px]"
                    >
                      <FeaturedCourseCard
                        course={course}
                        liked={likedCourseIds.has(course.id)}
                        enrolled={enrolledCourseIds.has(course.id)}
                        enrollmentStatusLabel={enrollmentsByCourse[course.id]?.statusLabel}
                        className="h-full"
                        onEnroll={() => {
                          const enrollment = enrollmentsByCourse[course.id];
                          if (enrollment?.receiptPath) {
                            navigate(enrollment.receiptPath);
                            return;
                          }
                          void handleEnroll(course);
                        }}
                        onLike={() => void handleLike(course.id)}
                        onOpenExternal={openExternal}
                      />
                    </motion.div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-5">
              <h2 className="text-xl md:text-2xl font-heading font-bold flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                Todos os Cursos
              </h2>
              {courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8 text-base text-muted-foreground">
                  Ainda não existem cursos publicados.
                </div>
              ) : (
                <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
                  {courses.map((course, index) => (
                    (() => {
                      const enrollment = enrollmentsByCourse[course.id];
                      const enrolled = Boolean(enrollment);

                      return (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.06, type: "spring", stiffness: 200 }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                      className="h-full snap-start w-[88vw] max-w-[340px] sm:w-[350px] sm:max-w-[350px] lg:w-[380px] lg:max-w-[380px]"
                    >
                      <FeaturedCourseCard
                        course={course}
                        liked={likedCourseIds.has(course.id)}
                        enrolled={enrolled}
                        enrollmentStatusLabel={enrollment?.statusLabel}
                        className="h-full shadow-sm"
                        onEnroll={() => {
                          if (enrollment?.receiptPath) {
                            navigate(enrollment.receiptPath);
                            return;
                          }

                          void handleEnroll(course);
                        }}
                        onLike={() => void handleLike(course.id)}
                        onOpenExternal={openExternal}
                      />
                    </motion.div>
                      );
                    })()
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
