import logoUor from "@/assets/logo-uor.png";

export default function Footer() {
  return (
    <footer className="border-t border-border py-6">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src={logoUor} alt="UOR" className="h-5" />
          <span className="text-xs text-muted-foreground">© 2026 3ª edição da Feira do Dia das Telecomunicações — UOR</span>
        </div>
        <p className="text-[11px] text-muted-foreground">NEIC — Núcleo de Engenharia Informática e Comunicações</p>
      </div>
    </footer>
  );
}
