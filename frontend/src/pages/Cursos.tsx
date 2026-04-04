import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { FeaturedCourseCard } from "@/components/courses/FeaturedCourseCard";
import { api, type Course, type StudentEnrollmentListItem, getToken, isAuthError, setToken } from "@/lib/api";

function withAlpha(color: string, alpha = "22") {
  return `${color}${alpha}`;
}

function openExternal(url?: string | null, emptyMessage = "Link não disponível.") {
  if (!url) {
    toast.error(emptyMessage);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export default function Cursos() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [topCourses, setTopCourses] = useState<Course[]>([]);
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

  const handleCommunity = (course: Course) => {
    if (!enrolledCourseIds.has(course.id)) {
      toast.warning("Precisas estar inscrito no curso antes de entrar na comunidade.");
      return;
    }

    openExternal(course.communityUrl, "A comunidade deste curso ainda não foi configurada.");
  };

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4 space-y-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-3">Cursos</h1>
          <p className="max-w-3xl text-base md:text-lg text-muted-foreground">
            Cada curso é gerido por uma empresa parceira. A inscrição é feita aqui no site com os teus dados de estudante e, depois disso, podes entrar na comunidade do curso.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="space-y-5">
              <h2 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                Top Cursos
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {topCourses.map((course, index) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border p-5"
                    style={{
                      borderColor: withAlpha(course.courseColor, "44"),
                      background: `linear-gradient(135deg, ${withAlpha(course.accentColor)}, ${withAlpha(course.accentColorSecondary)})`
                    }}
                  >
                    <p className="text-xs md:text-sm font-bold mb-2" style={{ color: course.courseColor }}>Top #{index + 1}</p>
                    <p className="font-heading text-lg md:text-xl font-bold">{course.name}</p>
                    <p className="text-sm md:text-base text-muted-foreground mt-2">{course.studentCount} inscritos</p>
                    <p className="text-sm mt-2" style={{ color: course.courseColor }}>{course.likesCount} curtidas</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <h2 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-3">
                <GraduationCap className="h-6 w-6 text-primary" />
                Todos os Cursos
              </h2>
              {courses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8 text-base text-muted-foreground">
                  Ainda não existem cursos publicados.
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                      className="h-full"
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
                        onCommunity={() => handleCommunity(course)}
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
