import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Building2, Globe, GraduationCap, Heart, Instagram, Loader2, Lock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
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
                    <motion.article
                      key={course.id}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.06, type: "spring", stiffness: 200 }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                      className="relative overflow-hidden rounded-2xl border bg-card p-5 md:p-7 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
                      style={{
                        borderColor: withAlpha(course.courseColor, "44"),
                        background: `linear-gradient(140deg, ${withAlpha(course.accentColor)}, ${withAlpha(course.accentColorSecondary)})`
                      }}
                    >
                      <div className="relative z-10">
                        <div className="mb-6 flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/72 shadow-sm ring-1 ring-white/60">
                              {course.companyLogoUrl ? (
                                <img src={course.companyLogoUrl} alt={course.companyName} className="h-9 w-9 rounded-xl object-cover" />
                              ) : (
                                <BookOpen className="h-6 w-6" style={{ color: course.courseColor }} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs md:text-sm font-bold uppercase tracking-[0.16em]" style={{ color: course.courseColor }}>
                                {course.isPaid ? course.priceLabel || "Pago" : "Gratuito"}
                              </p>
                              <h3 className="font-heading text-xl md:text-[1.8rem] font-bold leading-tight">{course.name}</h3>
                              <p className="mt-1 truncate text-sm md:text-base font-medium text-foreground/80">{course.companyName}</p>
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs md:text-sm font-semibold shadow-sm" style={{ color: course.courseColor }}>
                            <Heart className="h-3.5 w-3.5 fill-current" />
                            {course.likesCount}
                          </span>
                        </div>

                        <p className="text-base md:text-[1.05rem] leading-7 text-foreground/90">{course.description}</p>
                        {course.preview && <p className="mt-3 text-sm md:text-base leading-7 text-muted-foreground">{course.preview}</p>}

                        <div className="mt-5 rounded-2xl border border-white/60 bg-white/72 p-4.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: withAlpha(course.courseColor, "22") }}>
                              <Building2 className="h-5 w-5" style={{ color: course.courseColor }} />
                            </div>
                            <div>
                              <p className="text-base md:text-lg font-semibold">{course.companyName}</p>
                              <p className="text-sm md:text-base text-muted-foreground">{course.companyCategory}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3 text-sm md:text-base">
                            {course.companyWebsite && (
                              <button className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground" onClick={() => openExternal(course.companyWebsite)}>
                                <Globe className="h-4 w-4" /> Website
                              </button>
                            )}
                            {course.companyInstagram && (
                              <button className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground" onClick={() => openExternal(course.companyInstagram)}>
                                <Instagram className="h-4 w-4" /> Instagram
                              </button>
                            )}
                            {course.companyLinkedin && (
                              <button className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground" onClick={() => openExternal(course.companyLinkedin)}>
                                <Globe className="h-4 w-4" /> LinkedIn
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm md:text-base">
                          <span className="rounded-full bg-white/80 px-3 py-1.5 font-semibold shadow-sm">{course.studentCount} inscritos</span>
                          {enrollment && (
                            <span className="rounded-full px-3 py-1.5 font-semibold" style={{ backgroundColor: withAlpha(course.courseColor, "1c"), color: course.courseColor }}>
                              {enrollment.statusLabel}
                            </span>
                          )}
                        </div>

                        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                          <Button
                            size="sm"
                            className="h-auto min-h-10 w-full min-w-0 rounded-xl px-3 py-2 text-center text-sm font-semibold leading-tight shadow-sm whitespace-normal md:text-base"
                            onClick={() => {
                              if (enrollment?.receiptPath) {
                                navigate(enrollment.receiptPath);
                                return;
                              }
                              void handleEnroll(course);
                            }}
                          >
                            {enrolled ? "Ver inscrição" : "Inscrever"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-auto min-h-10 w-full min-w-0 rounded-xl bg-white/70 px-3 py-2 text-center text-sm font-semibold leading-tight whitespace-normal md:text-base" onClick={() => handleCommunity(course)} disabled={!enrolled}>
                            {enrolled ? "Entrar na comunidade" : "Comunidade bloqueada"}
                          </Button>
                          <Button size="sm" variant={likedCourseIds.has(course.id) ? "default" : "outline"} className="h-auto min-h-10 rounded-xl px-3 py-2 text-sm font-semibold leading-tight sm:col-span-2 md:text-base" onClick={() => void handleLike(course.id)}>
                            <Heart className="mr-1.5 h-4 w-4" />
                            {likedCourseIds.has(course.id) ? "Curtido" : "Curtir"}
                          </Button>
                        </div>

                        {!enrolled && (
                          <p className="mt-3 flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                            <Lock className="h-4 w-4" />
                            A comunidade do curso só abre depois da inscrição.
                          </p>
                        )}
                      </div>
                    </motion.article>
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
