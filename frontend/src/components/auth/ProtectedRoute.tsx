import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "@/lib/api";
import { buildRoutePath, storeIntendedRoute } from "@/lib/auth-routing";

export function ProtectedRoute({
  children,
  loginPath = "/login",
}: {
  children: ReactNode;
  loginPath?: string;
}) {
  const location = useLocation();

  if (!getToken()) {
    const intendedPath = buildRoutePath(location.pathname, location.search, location.hash);
    storeIntendedRoute(intendedPath);

    return (
      <Navigate
        replace
        to={`${loginPath}?redirect=${encodeURIComponent(intendedPath)}`}
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
}
