import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, getToken, isAuthError, isForbiddenError, setToken, type AdminAccessProfile } from "@/lib/api";

const AdminWorkspace = lazy(() => import("@/features/admin/AdminWorkspace"));

function AdminAccessFallback({ message = "A preparar painel administrativo..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-background px-4 pt-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="site-loading-bar" role="status" aria-label={message}>
          <span className="site-loading-bar__track">
            <span className="site-loading-bar__progress" />
          </span>
          <span className="site-loading-bar__label">{message}</span>
        </div>
      </div>
    </div>
  );
}

function AdminAccessDenied({ forbidden }: { forbidden: boolean }) {
  return (
    <div className="min-h-screen py-12 md:py-16">
      <div className="container mx-auto px-4">
        <Card className="mx-auto max-w-2xl border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {forbidden ? <AlertTriangle className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Acesso restrito</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {forbidden
                  ? "A tua conta não tem permissão para aceder a esta área."
                  : "Inicia sessão com uma conta autorizada."}
              </p>
            </div>
            <div className="flex justify-center">
              <Button asChild>
                <Link to="/login?redirect=/admin">Entrar com conta autorizada</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Admin() {
  const [state, setState] = useState<"checking" | "allowed" | "unauthenticated" | "forbidden">("checking");
  const [adminAccess, setAdminAccess] = useState<AdminAccessProfile | null>(null);

  useEffect(() => {
    let active = true;

    if (!getToken()) {
      setState("unauthenticated");
      return;
    }

    api.students.adminAccess()
      .then((profile) => {
        if (active) {
          setAdminAccess(profile);
          setState("allowed");
        }
      })
      .catch((error) => {
        if (!active) return;
        if (isAuthError(error)) {
          setToken(null);
          setAdminAccess(null);
          setState("unauthenticated");
          return;
        }
        if (isForbiddenError(error)) {
          setAdminAccess(null);
          setState("forbidden");
          return;
        }
        setAdminAccess(null);
        setState("forbidden");
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === "checking") return <AdminAccessFallback />;
  if (state === "unauthenticated" || state === "forbidden") {
    return <AdminAccessDenied forbidden={state === "forbidden"} />;
  }

  return (
    <Suspense fallback={<AdminAccessFallback message="A carregar módulos administrativos..." />}>
      <AdminWorkspace adminAccess={adminAccess} />
    </Suspense>
  );
}
