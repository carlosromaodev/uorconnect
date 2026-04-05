import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSafeRedirectPath } from "@/lib/auth-routing";
import { getContestAbsoluteUrl, getContestLinkPath, isContestContext } from "@/lib/contest-lab";
import { PortalLoginPage } from "@/portal/pages/PortalLoginPage";

function ContestLoginRedirect({ redirectTo }: { redirectTo: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const href = getContestAbsoluteUrl(`/login?redirect=${encodeURIComponent(redirectTo)}`);
    if (window.location.href !== href) {
      window.location.replace(href);
    }
  }, [redirectTo]);

  return null;
}

export default function Login() {
  const location = useLocation();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const redirectCandidate = new URLSearchParams(location.search).get("redirect");
  const contestContext = isContestContext(location.pathname, hostname, redirectCandidate);

  if (contestContext) {
    const redirectTo = getSafeRedirectPath(
      getContestLinkPath(redirectCandidate ?? "/", "laboratorio.uorconnect.space"),
      "/",
    );
    return <ContestLoginRedirect redirectTo={redirectTo} />;
  }

  const redirectTo = getSafeRedirectPath(redirectCandidate, "/projetos");
  return <PortalLoginPage redirectTo={redirectTo} />;
}
