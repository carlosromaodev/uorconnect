import { useState } from "react";
import { Linkedin, Twitter, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface ShareButtonsProps {
  url: string;
  title: string;
  description?: string;
  compact?: boolean;
  className?: string;
}

export function ShareButtons({ url, title, description, compact, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || title);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const size = compact ? "icon" : "sm";
  const variant = "ghost";
  const iconSize = compact ? 15 : 16;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant={variant}
        size={size}
        className="h-8 w-8 text-muted-foreground hover:text-[#0A66C2]"
        onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, "_blank", "noopener,noreferrer,width=600,height=500")}
        title="Partilhar no LinkedIn"
      >
        <Linkedin size={iconSize} />
      </Button>
      <Button
        variant={variant}
        size={size}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => window.open(`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedDesc}`, "_blank", "noopener,noreferrer,width=600,height=500")}
        title="Partilhar no X"
      >
        <Twitter size={iconSize} />
      </Button>
      <Button
        variant={variant}
        size={size}
        className="h-8 w-8 text-muted-foreground hover:text-primary"
        onClick={handleCopy}
        title="Copiar link"
      >
        {copied ? <Check size={iconSize} className="text-success" /> : <Link2 size={iconSize} />}
      </Button>
    </div>
  );
}
