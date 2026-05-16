import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Gamepad2,
  Loader2,
  MapPin,
  Send,
  Trophy,
  UserPlus,
  Vote,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  api,
  getToken,
  isAuthError,
  type DigitalPassportReferralInvite,
} from "@/lib/api";
import { getCookie } from "@/lib/browser-cookies";
import {
  buildPassportReferralAcceptedPath,
  clearPassportReferralAccepted,
  markPassportReferralAccepted,
} from "@/lib/passport-referral-flow";

export default function PassportReferralInvite() {
  const { code: rawCode } = useParams();
  const navigate = useNavigate();
  const referralCode = useMemo(() => {
    if (!rawCode) return "";
    try {
      return decodeURIComponent(rawCode).trim();
    } catch {
      return rawCode.trim();
    }
  }, [rawCode]);
  const [invite, setInvite] = useState<DigitalPassportReferralInvite | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!referralCode) {
      setLoading(false);
      setInvite(null);
      return;
    }

    let active = true;
    setLoading(true);
    api.passport
      .referralInvite(referralCode)
      .then((nextInvite) => {
        if (active) setInvite(nextInvite);
      })
      .catch(() => {
        if (active) setInvite(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [referralCode]);

  const challengeRedirect = referralCode
    ? buildPassportReferralAcceptedPath("/minha-area?tab=desafio", referralCode)
    : "/minha-area?tab=desafio";

  const goToLoginForChallenge = () => {
    navigate(`/login?redirect=${encodeURIComponent(challengeRedirect)}`, {
      replace: true,
    });
  };

  const handleAccept = async () => {
    if (!referralCode) return;

    markPassportReferralAccepted(referralCode);
    if (!getToken()) {
      goToLoginForChallenge();
      return;
    }

    setAccepting(true);
    try {
      await api.passport.join(getCookie("uor_visitor_id"), referralCode);
      clearPassportReferralAccepted();
      navigate("/minha-area?tab=desafio", { replace: true });
    } catch (error) {
      if (isAuthError(error)) {
        goToLoginForChallenge();
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível aceitar este convite.",
      );
    } finally {
      setAccepting(false);
    }
  };

  const handlePreferVoting = () => {
    clearPassportReferralAccepted();
    setDeclining(true);
    const projectsPath = "/projetos";
    if (getToken()) {
      navigate(projectsPath, { replace: true });
      return;
    }

    navigate(`/login?redirect=${encodeURIComponent(projectsPath)}`, {
      replace: true,
    });
  };

  const inviterName = invite?.inviterName?.trim() || "um estudante";

  return (
    <main className="passport-invite flex items-center justify-center px-4 py-8">
      <div className="passport-invite__bg-grid" aria-hidden="true" />

      <motion.div
        className="passport-invite__card"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="passport-invite__glow" aria-hidden="true" />
        <div className="passport-invite__stamp" aria-hidden="true" />
        <div className="passport-invite__perforation" aria-hidden="true" />
        <div className="passport-invite__notch passport-invite__notch--top" aria-hidden="true" />
        <div className="passport-invite__notch passport-invite__notch--bottom" aria-hidden="true" />

        {/* Stub — left side */}
        <div className="passport-invite__stub" aria-hidden="true">
          <div className="passport-invite__ring">
            <Send className="h-6 w-6 passport-invite__ring-icon" />
          </div>
        </div>

        {/* Header strip */}
        <div className="passport-invite__header-strip">
          <span className="passport-invite__header-label">
            <Gamepad2 className="h-3 w-3" />
            Boarding Pass · Convite
          </span>
          <span className="passport-invite__header-serial">
            UOR-{new Date().getFullYear()}-INV
          </span>
        </div>

        {/* Content */}
        <div className="passport-invite__content">
          {/* Title */}
          <div>
            <h1 className="text-lg font-black leading-tight sm:text-xl">
              Passaporte UOR Connect
            </h1>
            <p className="mt-1 text-[13px] text-white/50">
              {loading
                ? "A validar o convite antes de continuares."
                : invite
                  ? "Foste convidado para o desafio interativo da atividade."
                  : "Este convite não foi encontrado ou já não está disponível."}
            </p>
          </div>

          {/* Route FROM → TO */}
          <div className="passport-invite__route">
            <div className="passport-invite__route-point">
              <span>Partida</span>
              <strong>CONVITE</strong>
            </div>
            <div className="passport-invite__route-line" />
            <div className="passport-invite__route-point">
              <span>Destino</span>
              <strong>DESAFIO</strong>
            </div>
          </div>

          {loading ? (
            <div className="passport-invite__info-card flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-white/40" />
              <span className="text-sm font-semibold text-white/60">A validar o convite...</span>
            </div>
          ) : invite ? (
            <>
              {/* Inviter info */}
              <div className="passport-invite__info-card">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                  Convidado por
                </p>
                <p className="mt-1.5 text-sm font-bold text-white">
                  {inviterName}
                </p>
                {invite.inviterCourse ? (
                  <p className="mt-0.5 text-xs font-semibold text-white/45">
                    {invite.inviterCourse}
                  </p>
                ) : null}
              </div>

              {/* Prize info */}
              <div className="passport-invite__info-card">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <Trophy className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">
                      Prémio oficial
                    </p>
                    <p className="mt-1 text-xs font-medium leading-5 text-white/50">
                      O prémio inclui pagamento de 1 recurso para estudante
                      elegível, perfis de 1 mês de{" "}
                      <span className="font-black" style={{ color: "#00A8E1" }}>Prime Video</span>,{" "}
                      <span className="font-black" style={{ color: "#A855F7" }}>HBO</span> e{" "}
                      <span className="font-black" style={{ color: "#58CC02" }}>Duolingo Super</span>.
                      Certificado Top 3 para os melhores classificados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="passport-invite__actions">
                <button
                  type="button"
                  className="passport-invite__btn passport-invite__btn--decline"
                  disabled={accepting || declining}
                  onClick={handlePreferVoting}
                >
                  {declining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Vote className="h-4 w-4" />
                  )}
                  Não, prefiro votar
                </button>
                <button
                  type="button"
                  className="passport-invite__btn passport-invite__btn--accept"
                  disabled={accepting || declining}
                  onClick={() => void handleAccept()}
                >
                  {accepting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Aceitar e entrar no desafio
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="passport-invite__info-card">
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 shrink-0 text-white/30" />
                  <p className="text-sm font-semibold text-white/60">
                    O convite pode ter expirado, sido copiado de forma
                    incompleta ou não existir.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="passport-invite__btn passport-invite__btn--accept"
                onClick={handlePreferVoting}
              >
                <ArrowRight className="h-4 w-4" />
                Ir para projetos
              </button>
            </>
          )}
        </div>

        {/* Barcode strip */}
        <div className="passport-invite__barcode" aria-hidden="true">
          <div className="passport-invite__barcode-lines">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: `${i % 3 === 0 ? 3 : i % 5 === 0 ? 1 : 2}px`,
                  height: `${12 + (i * 5) % 8}px`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
          <span className="passport-invite__barcode-text">
            UOR CONNECT · CONVITE · {new Date().getFullYear()}
          </span>
        </div>
      </motion.div>
    </main>
  );
}
