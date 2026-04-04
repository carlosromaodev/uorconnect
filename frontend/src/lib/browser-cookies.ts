type CookieOptions = {
  days?: number;
  path?: string;
  sameSite?: "Strict" | "Lax" | "None";
  secure?: boolean;
};

export function getCookie(name: string) {
  if (typeof document === "undefined") return null;

  const value = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return value ? decodeURIComponent(value.split("=").slice(1).join("=")) : null;
}

export function setCookie(name: string, value: string, options: CookieOptions = {}) {
  if (typeof document === "undefined") return;

  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  if (typeof options.days === "number") {
    const expires = new Date();
    expires.setDate(expires.getDate() + options.days);
    parts.push(`Expires=${expires.toUTCString()}`);
  }

  const shouldUseSecure = options.secure ?? window.location.protocol === "https:";
  if (shouldUseSecure) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

export function deleteCookie(name: string, options: Pick<CookieOptions, "path" | "sameSite" | "secure"> = {}) {
  setCookie(name, "", { ...options, days: -1 });
}
