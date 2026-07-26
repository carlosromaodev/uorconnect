import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, api } from "@/lib/api";

function safeStudentRedirect(value: string | null) {
  if (!value) return "/estudante";
  try {
    const decoded = decodeURIComponent(value);
    return decoded === "/estudante" || decoded.startsWith("/estudante/") ? decoded : "/estudante";
  } catch {
    return "/estudante";
  }
}

export default function UorStudentLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const number = studentNumber.replace(/\D/g, "");
    if (number.length < 8 || number.length > 12) {
      setError("Indica um número de estudante válido, entre 8 e 12 dígitos.");
      return;
    }
    if (!password) {
      setError("Indica a palavra-passe da Secretaria.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.auth.login(number, password, "uorconnect", "uor", "studentNumber");
      if (!result.success) throw new Error(result.error || "Credenciais inválidas.");
      navigate(safeStudentRedirect(new URLSearchParams(location.search).get("redirect")), { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401
        ? "Número de estudante ou palavra-passe inválidos."
        : cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível entrar. Verifica a ligação e tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="uor-student-scope relative min-h-screen overflow-hidden bg-[#FAF7F3] px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:p-0">
      <div className="uor-student-login-orbit" aria-hidden="true" />
      <section className="relative z-10 hidden min-h-screen flex-col justify-between overflow-hidden bg-[#050505] p-12 text-white lg:flex">
        <div className="absolute -right-44 -top-44 h-[34rem] w-[34rem] rounded-full border border-[#FF5A00]/60" aria-hidden="true" />
        <div className="absolute -right-12 top-24 h-5 w-5 rounded-full bg-[#FF5A00]" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white"><img src="/uor-estudante-mark.svg" alt="" className="h-10 w-10" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">UOR Connect</p><p className="text-xl font-extrabold">Estudante</p></div>
        </div>
        <div className="max-w-xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#FF8A4C]">A tua universidade, num só lugar</p>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.04] tracking-[-0.055em]">Vida académica clara. Dados oficiais protegidos.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/60">Secretaria, Moodle, desempenho, finanças e agenda numa experiência privada feita para o estudante.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-white/45"><ShieldCheck className="h-4 w-4 text-emerald-400" />Sessões externas cifradas · sincronização automática</div>
      </section>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center lg:min-h-screen">
        <div className="w-full rounded-[2rem] border border-[#E7E1DA] bg-white/95 p-6 shadow-[0_24px_80px_rgba(36,24,12,0.10)] backdrop-blur sm:p-8 lg:border-0 lg:bg-transparent lg:shadow-none">
          <div className="mb-8 lg:hidden">
            <img src="/uor-estudante-logo.png" alt="UOR Estudante, by UOR Connect" className="mx-auto h-auto w-52" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF5A00]">Área privada</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-[#050505]">Entra como estudante</h2>
          <p className="mt-3 text-sm leading-6 text-[#6F6963]">Usa o mesmo número e palavra-passe da Secretaria UOR. O Moodle é ligado automaticamente; uma falha no Moodle não bloqueia a entrada.</p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="uor-student-number" className="text-sm font-bold text-[#292521]">Número de estudante</label>
              <input
                id="uor-student-number"
                name="studentNumber"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                required
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value.replace(/\D/g, "").slice(0, 12))}
                className="mt-2 min-h-12 w-full rounded-2xl border border-[#D8D0C8] bg-white px-4 text-base font-semibold outline-none transition placeholder:text-[#A69D95] focus:border-[#FF5A00] focus:ring-4 focus:ring-[#FF5A00]/15"
                placeholder="Ex: 20240000"
                aria-describedby="student-number-help"
              />
              <p id="student-number-help" className="mt-1.5 text-xs text-[#817870]">Entre 8 e 12 dígitos.</p>
            </div>
            <div>
              <label htmlFor="uor-student-password" className="text-sm font-bold text-[#292521]">Palavra-passe da Secretaria</label>
              <div className="relative mt-2">
                <input
                  id="uor-student-password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-2xl border border-[#D8D0C8] bg-white px-4 pr-12 text-base font-semibold outline-none transition focus:border-[#FF5A00] focus:ring-4 focus:ring-[#FF5A00]/15"
                />
                <button type="button" onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-1 grid min-h-11 min-w-11 place-items-center rounded-xl text-[#6F6963] hover:bg-[#FAF7F3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A00]/20" aria-label={visible ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>
                  {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="min-h-6" aria-live="polite">
              {error ? <p className="flex items-start gap-2 text-sm font-semibold text-red-700" role="alert"><span aria-hidden="true">●</span>{error}</p> : null}
            </div>
            <button type="submit" disabled={loading} className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#050505] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#24211E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A00]/35 disabled:cursor-wait disabled:opacity-60">
              <LockKeyhole className="h-5 w-5" />
              {loading ? "A validar na Secretaria…" : "Entrar na UOR Estudante"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-[#817870]">A UOR Estudante não apresenta nem regista a tua palavra-passe em logs. A sessão institucional é armazenada num envelope cifrado.</p>
        </div>
      </section>
    </main>
  );
}
