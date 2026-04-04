import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { api, type HomeSocialConfig } from "@/lib/api";
import { defaultHomeSocialConfig } from "@/lib/home-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type HomeFeatureFlag = keyof Pick<HomeSocialConfig, "courseEnrollmentEnabled" | "firstYearContestEnabled">;

interface HomeFeatureGateProps {
  feature: HomeFeatureFlag;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  children: ReactNode;
}

export function HomeFeatureGate({
  feature,
  title,
  description,
  ctaLabel,
  ctaTo,
  children,
}: HomeFeatureGateProps) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;

    api.homeContent.list()
      .then((content) => {
        if (!active) return;
        setEnabled(content.socialConfig[feature] ?? true);
      })
      .catch(() => {
        if (!active) return;
        setEnabled(defaultHomeSocialConfig[feature] ?? true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [feature]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="h-9 w-9 animate-spin text-primary" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12">
        <Card className="w-full overflow-hidden border-border/70 bg-card/95 shadow-lg">
          <div className="h-1.5 bg-[linear-gradient(90deg,#fd8305,#0284c7)]" />
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">acesso temporariamente fechado</p>
                  <h1 className="mt-2 text-2xl font-heading font-bold text-foreground">{title}</h1>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
                </div>
              </div>
              <Button asChild className="rounded-xl">
                <Link to={ctaTo}>{ctaLabel}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
