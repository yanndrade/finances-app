export type UiDensity = "comfort" | "compact" | "dense";

export const UI_DENSITY_STORAGE_KEY = "finance.ui-density";
export const DEFAULT_UI_DENSITY: UiDensity = "compact";

export const UI_DENSITY_OPTIONS: Array<{
  value: UiDensity;
  label: string;
  description: string;
}> = [
  {
    value: "comfort",
    label: "Conforto",
    description: "Mais respiro visual para leitura prolongada.",
  },
  {
    value: "compact",
    label: "Compacto",
    description: "Equilíbrio entre legibilidade e densidade desktop.",
  },
  {
    value: "dense",
    label: "Denso",
    description: "Maximiza informação acima da dobra em 1080p.",
  },
];

export function normalizeUiDensity(value: unknown): UiDensity {
  if (value === "comfort" || value === "compact" || value === "dense") {
    return value;
  }

  return DEFAULT_UI_DENSITY;
}

export function readStoredUiDensity(): UiDensity {
  if (typeof window === "undefined") {
    return DEFAULT_UI_DENSITY;
  }

  return normalizeUiDensity(window.localStorage.getItem(UI_DENSITY_STORAGE_KEY));
}
