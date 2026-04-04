import { useLocation } from "react-router-dom";
import { getSafeRedirectPath } from "@/lib/auth-routing";
import { getContestLinkPath, isContestContext } from "@/lib/contest-lab";
import { PortalLoginPage } from "@/portal/pages/PortalLoginPage";
import { LaboratorioLoginPage } from "@/laboratorio/pages/LaboratorioLoginPage";

export default function Login() {
  const location = useLocation();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const redirectCandidate = new URLSearchParams(location.search).get("redirect");
  const contestContext = isContestContext(location.pathname, hostname, redirectCandidate);

  if (contestContext) {
    const redirectTo = getSafeRedirectPath(redirectCandidate, getContestLinkPath("/", hostname));
    return <LaboratorioLoginPage redirectTo={redirectTo} />;
  }

  const redirectTo = getSafeRedirectPath(redirectCandidate, "/projetos");
  return <PortalLoginPage redirectTo={redirectTo} />;
}
