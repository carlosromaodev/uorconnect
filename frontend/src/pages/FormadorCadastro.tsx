import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  ApiError,
  api,
  type TrainerCourseOption,
  type TrainerRegistrationRequest,
  type TrainerRegistrationSubmitInput,
} from "@/lib/api";

type Step = "phone" | "code" | "profile" | "sent";

const emptyProfile: Omit<TrainerRegistrationSubmitInput, "phone" | "selectedCourseId"> & {
  selectedCourseId: string;
} = {
  name: "",
  email: "",
  specialty: "",
  bio: "",
  linkedinUrl: "",
  portfolioUrl: "",
  organization: "",
  selectedCourseId: "",
};

function friendlyError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "Sem ligação ao servidor. Tenta novamente em instantes.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Não foi possível concluir esta etapa.";
}

function statusCopy(request: TrainerRegistrationRequest | null) {
  if (!request) return null;
  if (request.status === "APPROVED") {
    return {
      icon: CheckCircle2,
      title: "Cadastro aprovado",
      body: "O teu acesso de formador já está ativo. Podes abrir o painel limitado do curso.",
      tone: "emerald",
    };
  }
  if (request.status === "REJECTED") {
    return {
      icon: XCircle,
      title: "Pedido recusado",
      body: request.reviewNote || "A organização recusou este pedido. Revê os dados e contacta a equipa UOR Connect.",
      tone: "rose",
    };
  }
  return {
    icon: Clock3,
    title: "Pedido em validação",
    body: "Recebemos o teu perfil. A equipa vai validar o curso escolhido e liberar o acesso quando estiver tudo certo.",
    tone: "amber",
  };
}

export default function FormadorCadastro() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<TrainerCourseOption[]>([]);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [request, setRequest] = useState<TrainerRegistrationRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.trainers
      .context()
      .then((payload) => {
        if (active) setCourses(payload.courses);
      })
      .catch((err) => {
        if (active) setError(friendlyError(err));
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === profile.selectedCourseId) ?? null,
    [courses, profile.selectedCourseId],
  );
  const copy = statusCopy(request);

  const requestCode = async () => {
    setError(null);
    if (phone.replace(/\D/g, "").length < 8) {
      setError("Informe um telefone válido para receber o SMS.");
      return;
    }
    setBusy("code");
    try {
      const payload = await api.trainers.requestCode(phone);
      setPhone(payload.phone);
      setStep("code");
      toast.success("Código enviado por SMS.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Informe o código de 6 dígitos recebido por SMS.");
      return;
    }
    setBusy("verify");
    try {
      const payload = await api.trainers.verifyCode(phone, code.trim());
      setPhone(payload.phone);
      setRequest(payload.request);
      if (payload.status === "APPROVED" && payload.token) {
        toast.success("Acesso de formador confirmado.");
        navigate("/formadores/painel", { replace: true });
        return;
      }
      if (payload.request) {
        setStep("sent");
        return;
      }
      setStep("profile");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setError(null);
    const selectedCourseId = Number(profile.selectedCourseId);
    if (!profile.name.trim() || !profile.specialty.trim() || !profile.bio.trim() || !selectedCourseId) {
      setError("Preenche nome, especialidade, biografia e curso antes de enviar.");
      return;
    }

    setBusy("submit");
    try {
      const payload = await api.trainers.submit({
        phone,
        name: profile.name.trim(),
        email: profile.email?.trim() || null,
        specialty: profile.specialty.trim(),
        bio: profile.bio.trim(),
        linkedinUrl: profile.linkedinUrl?.trim() || null,
        portfolioUrl: profile.portfolioUrl?.trim() || null,
        organization: profile.organization?.trim() || null,
        selectedCourseId,
      });
      setRequest(payload.request);
      setStep("sent");
      toast.success("Pedido enviado para validação.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f8f4] px-4 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <section className="rounded-[2rem] border border-emerald-900/10 bg-[#07130d] p-6 text-white shadow-2xl shadow-emerald-950/15 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Cadastro de formador
          </div>

          <h1 className="mt-8 max-w-xl text-3xl font-black leading-tight sm:text-5xl">
            Um acesso próprio para acompanhar o teu curso.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-white/68 sm:text-base">
            Valida o telefone, completa um perfil profissional curto e escolhe o curso que vais ministrar. A organização confirma o pedido antes de liberar o painel.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: MessageSquareText, label: "SMS seguro" },
              { icon: UserRoundCheck, label: "Perfil simples" },
              { icon: BookOpenCheck, label: "Curso limitado" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <item.icon className="h-5 w-5 text-emerald-300" />
                <p className="mt-3 text-sm font-bold text-white/85">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-emerald-300/15 bg-emerald-300/8 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/80">
              Acesso protegido
            </p>
            <p className="mt-3 text-sm leading-6 text-white/65">
              O formador aprovado vê apenas indicadores agregados do curso atribuído. Dados sensíveis dos estudantes, comprovativos e áreas administrativas globais ficam fora deste painel.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/8 sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">UOR Connect</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Credencial de formador</h2>
            </div>
            <Link to="/formadores/painel" className="text-sm font-bold text-emerald-700 hover:text-emerald-900">
              Já fui aprovado
            </Link>
          </div>

          {error ? (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}

          {step === "phone" ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">Telefone</label>
                <Input
                  value={phone}
                  inputMode="tel"
                  placeholder="Ex: 937 000 000"
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <Button
                type="button"
                className="h-12 w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={busy === "code"}
                onClick={() => void requestCode()}
              >
                {busy === "code" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                Receber código por SMS
              </Button>
            </div>
          ) : null}

          {step === "code" ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                Enviámos o código para {phone}. Ele expira em poucos minutos.
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">Código SMS</label>
                <Input
                  value={code}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                <Button type="button" variant="outline" className="h-12 rounded-2xl" onClick={() => setStep("phone")}>
                  Alterar telefone
                </Button>
                <Button
                  type="button"
                  className="h-12 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={busy === "verify"}
                  onClick={() => void verifyCode()}
                >
                  {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                  Validar telefone
                </Button>
              </div>
            </div>
          ) : null}

          {step === "profile" ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-800">Nome completo</label>
                  <Input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800">Especialidade</label>
                  <Input value={profile.specialty} placeholder="Ex: Redes, Marketing, Finanças" onChange={(event) => setProfile((current) => ({ ...current, specialty: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800">Email opcional</label>
                  <Input value={profile.email ?? ""} type="email" onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-800">Curso que vais ministrar</label>
                  <select
                    value={profile.selectedCourseId}
                    onChange={(event) => setProfile((current) => ({ ...current, selectedCourseId: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-input/80 bg-white px-4 text-sm font-semibold text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,0.04)] outline-none transition focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="">Selecionar curso</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                  {selectedCourse ? (
                    <p className="text-xs leading-5 text-slate-500">{selectedCourse.companyName} · {selectedCourse.companyCategory}</p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-800">Mini biografia profissional</label>
                  <Textarea
                    value={profile.bio}
                    rows={5}
                    placeholder="Resume a tua experiência, área de atuação e o tipo de formação que vais conduzir."
                    onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800">LinkedIn opcional</label>
                  <Input value={profile.linkedinUrl ?? ""} placeholder="https://linkedin.com/in/..." onChange={(event) => setProfile((current) => ({ ...current, linkedinUrl: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800">Portfólio opcional</label>
                  <Input value={profile.portfolioUrl ?? ""} placeholder="https://..." onChange={(event) => setProfile((current) => ({ ...current, portfolioUrl: event.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-bold text-slate-800">Empresa ou instituição opcional</label>
                  <Input value={profile.organization ?? ""} onChange={(event) => setProfile((current) => ({ ...current, organization: event.target.value }))} />
                </div>
              </div>
              <Button
                type="button"
                className="h-12 w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={busy === "submit"}
                onClick={() => void submit()}
              >
                {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Enviar para validação
              </Button>
            </div>
          ) : null}

          {step === "sent" && copy ? (
            <div className="space-y-5">
              <div className={`rounded-3xl border p-5 ${
                copy.tone === "emerald"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : copy.tone === "rose"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
              }`}>
                <copy.icon className="h-7 w-7" />
                <h3 className="mt-4 text-lg font-black">{copy.title}</h3>
                <p className="mt-2 text-sm leading-6 opacity-80">{copy.body}</p>
                {request ? (
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] opacity-60">
                    {request.selectedCourse.name}
                  </p>
                ) : null}
              </div>
              {request?.status === "APPROVED" ? (
                <Button
                  type="button"
                  className="h-12 w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => navigate("/formadores/painel")}
                >
                  Abrir painel
                </Button>
              ) : (
                <Button type="button" variant="outline" className="h-12 w-full rounded-2xl" onClick={() => setStep("phone")}>
                  Consultar com outro telefone
                </Button>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
