export const APP_THEME_STORAGE_KEY = "finance.app-theme";
export const APP_DARK_MODE_STORAGE_KEY = "finance.app-dark-mode";

export const THEME_PRESET_OPTIONS = [
  {
    value: "#0f5ea8",
    label: "Azul",
    description: "Mantém a identidade atual com contraste forte.",
  },
  {
    value: "#0f766e",
    label: "Verde petróleo",
    description: "Mais sóbrio e financeiro.",
  },
  {
    value: "#b45309",
    label: "Ambar",
    description: "Mais quente, sem perder destaque.",
  },
  {
    value: "#c2410c",
    label: "Laranja queimado",
    description: "Tom enérgico para ações e destaques.",
  },
  {
    value: "#be123c",
    label: "Rubi",
    description: "Mais intenso para um visual marcante.",
  },
] as const;

export const DEFAULT_THEME_COLOR = THEME_PRESET_OPTIONS[0].value;

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const match = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  return `#${match[1].toLowerCase()}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }

  h /= 6;

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function normalizeThemeColor(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_THEME_COLOR;
  }

  return normalizeHexColor(value) ?? DEFAULT_THEME_COLOR;
}

export function readStoredThemeColor(): string {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_COLOR;
  }

  return normalizeThemeColor(window.localStorage.getItem(APP_THEME_STORAGE_KEY));
}

export function readStoredDarkMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = window.localStorage.getItem(APP_DARK_MODE_STORAGE_KEY);
  return stored === "true";
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

export function applyThemeColor(themeColor: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const normalized = normalizeThemeColor(themeColor);
  const { h, s, l } = hexToHsl(normalized);
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");

  if (isDark) {
    // Dark mode: use high-lightness primaries so they read on dark backgrounds
    const primaryL = Math.max(62, Math.min(76, l + 30));
    const accentL = Math.max(55, Math.min(70, l + 22));
    const softL = Math.max(22, Math.min(32, l - 8));
    const hex = hslToHex(h, Math.min(100, s + 10), primaryL);
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);

    root.style.setProperty("--primary", `${h} ${Math.min(100, s + 10)}% ${primaryL}%`);
    root.style.setProperty("--primary-accent", `${h} ${Math.min(100, s + 5)}% ${accentL}%`);
    root.style.setProperty("--primary-soft", `${h} ${Math.max(50, s - 10)}% ${softL}%`);
    root.style.setProperty("--ring", `${h} ${Math.min(100, s + 5)}% ${accentL}%`);
    root.style.setProperty("--chart-primary", `${h} ${Math.min(100, s + 5)}% ${accentL}%`);
    root.style.setProperty("--theme-primary-hex", hex);
    root.style.setProperty("--theme-primary-rgb", `${red}, ${green}, ${blue}`);
    root.style.setProperty("--focus-ring", `rgba(${red}, ${green}, ${blue}, 0.5)`);
    root.style.setProperty("--focus-ring-shadow", `0 0 0 4px rgba(${red}, ${green}, ${blue}, 0.15)`);
    root.style.setProperty("--input-focus-border", `rgba(${red}, ${green}, ${blue}, 0.45)`);
  } else {
    // Light mode: keep the existing low-lightness logic
    const red = parseInt(normalized.slice(1, 3), 16);
    const green = parseInt(normalized.slice(3, 5), 16);
    const blue = parseInt(normalized.slice(5, 7), 16);

    root.style.setProperty("--primary", `${h} ${Math.min(100, s + 8)}% ${Math.max(22, l - 10)}%`);
    root.style.setProperty("--primary-accent", `${h} ${Math.min(100, s)}% ${Math.max(32, l)}%`);
    root.style.setProperty("--primary-soft", `${h} ${Math.max(50, s - 18)}% ${Math.min(94, l + 34)}%`);
    root.style.setProperty("--ring", `${h} ${Math.min(100, s)}% ${Math.max(32, l)}%`);
    root.style.setProperty("--chart-primary", `${h} ${Math.min(100, s)}% ${Math.max(32, l)}%`);
    root.style.setProperty("--theme-primary-hex", normalized);
    root.style.setProperty("--theme-primary-rgb", `${red}, ${green}, ${blue}`);
    root.style.setProperty("--focus-ring", `rgba(${red}, ${green}, ${blue}, 0.5)`);
    root.style.setProperty("--focus-ring-shadow", `0 0 0 4px rgba(${red}, ${green}, ${blue}, 0.12)`);
    root.style.setProperty("--input-focus-border", `rgba(${red}, ${green}, ${blue}, 0.4)`);
  }
}

export function applyDarkMode(isDark: boolean, themeColor?: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  if (isDark) {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }

  applyThemeColor(themeColor ?? DEFAULT_THEME_COLOR);
}
