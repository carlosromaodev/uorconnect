import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type ProfileConsentValues = {
  consentPublicProfile: boolean;
  consentPhotoCredential: boolean;
  consentSocialLinks: boolean;
  consentSms: boolean;
  consentWhatsapp: boolean;
};

type VisibilityOption<Key extends string> = {
  key: Key;
  label: string;
};

type ProfileConsentControlsProps<Key extends string = string> = {
  values: ProfileConsentValues;
  onChange: <Field extends keyof ProfileConsentValues>(field: Field, value: ProfileConsentValues[Field]) => void;
  title?: string;
  description?: string;
  className?: string;
  publicProfileLabel?: string;
  visibility?: Record<Key, boolean>;
  visibilityOptions?: Array<VisibilityOption<Key>>;
  onVisibilityChange?: (field: Key, value: boolean) => void;
};

export function ProfileConsentControls<Key extends string = string>({
  values,
  onChange,
  title = "Privacidade e consentimento",
  description = "Podes ativar ou retirar estas autorizações sem apagar os teus dados.",
  className,
  publicProfileLabel = "Autorizo mostrar a minha bio e informação pública no perfil UOR Connect.",
  visibility,
  visibilityOptions,
  onVisibilityChange,
}: ProfileConsentControlsProps<Key>) {
  return (
    <div className={cn("space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4", className)}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <label className="flex items-start gap-3 rounded-lg bg-white p-3">
        <Checkbox
          checked={values.consentPublicProfile}
          onCheckedChange={(value) => onChange("consentPublicProfile", Boolean(value))}
          className="mt-0.5"
        />
        <span className="text-sm leading-snug text-slate-700">{publicProfileLabel}</span>
      </label>
      <label className="flex items-start gap-3 rounded-lg bg-white p-3">
        <Checkbox
          checked={values.consentPhotoCredential}
          onCheckedChange={(value) => onChange("consentPhotoCredential", Boolean(value))}
          className="mt-0.5"
        />
        <span className="text-sm leading-snug text-slate-700">Autorizo usar a minha fotografia em credenciais digitais ou impressas.</span>
      </label>
      <label className="flex items-start gap-3 rounded-lg bg-white p-3">
        <Checkbox
          checked={values.consentSocialLinks}
          onCheckedChange={(value) => onChange("consentSocialLinks", Boolean(value))}
          className="mt-0.5"
        />
        <span className="text-sm leading-snug text-slate-700">Autorizo mostrar as minhas redes sociais no perfil público.</span>
      </label>
      {visibility && visibilityOptions?.length && onVisibilityChange ? (
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Visibilidade pública</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {visibilityOptions.map((option) => (
              <label key={option.key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <Checkbox
                  checked={visibility[option.key]}
                  disabled={!values.consentPublicProfile}
                  onCheckedChange={(value) => onVisibilityChange(option.key, Boolean(value))}
                />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg bg-white p-3">
          <Checkbox
            checked={values.consentSms}
            onCheckedChange={(value) => onChange("consentSms", Boolean(value))}
            className="mt-0.5"
          />
          <span className="text-sm leading-snug text-slate-700">Aceito receber SMS não essenciais.</span>
        </label>
        <label className="flex items-start gap-3 rounded-lg bg-white p-3">
          <Checkbox
            checked={values.consentWhatsapp}
            onCheckedChange={(value) => onChange("consentWhatsapp", Boolean(value))}
            className="mt-0.5"
          />
          <span className="text-sm leading-snug text-slate-700">Aceito receber WhatsApp não essencial.</span>
        </label>
      </div>
    </div>
  );
}
