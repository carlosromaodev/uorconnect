import React from "react";
import { getHeroIconByName } from "@/lib/phosphor-icons";

export function PhosphorIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = getHeroIconByName(name);
  return <Icon size={size} />;
}

export default PhosphorIcon;
