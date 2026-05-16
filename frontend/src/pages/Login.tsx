import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getSafeRedirectPath } from "@/lib/auth-routing";
import { api, type DigitalPassportReferralInvite } from "@/lib/api";
import { getPassportReferralCodeFromPath } from "@/lib/passport-referral-flow";
import { PortalLoginPage } from "@/portal/pages/PortalLoginPage";

export default function Login() {
  const location = useLocation();
  const redirectCandidate = new URLSearchParams(location.search).get("redirect");
  const redirectTo = getSafeRedirectPath(redirectCandidate, "/projetos");
  const referralCode = useMemo(
    () => getPassportReferralCodeFromPath(redirectTo),
    [redirectTo],
  );
  const [referralInvite, setReferralInvite] =
    useState<DigitalPassportReferralInvite | null>(null);
  const [referralLoading, setReferralLoading] = useState(Boolean(referralCode));

  useEffect(() => {
    if (!referralCode) {
      setReferralInvite(null);
      setReferralLoading(false);
      return;
    }

    let active = true;
    setReferralLoading(true);
    api.passport
      .referralInvite(referralCode)
      .then((invite) => {
        if (active) setReferralInvite(invite);
      })
      .catch(() => {
        if (active) setReferralInvite(null);
      })
      .finally(() => {
        if (active) setReferralLoading(false);
      });

    return () => {
      active = false;
    };
  }, [referralCode]);

  return (
    <PortalLoginPage
      redirectTo={redirectTo}
      referralCode={referralCode}
      referralInvite={referralInvite}
      referralLoading={referralLoading}
    />
  );
}
