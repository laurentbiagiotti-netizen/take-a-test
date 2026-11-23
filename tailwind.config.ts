import type { Config } from "tailwindcss";

/** Direction artistique alignée sur le Cybersup Vulhub Launcher / vms.cybersup.ai. */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Interface claire (16/11) : fond blanc cassé, cartes blanches, texte bleu nuit de la charte.
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--c-surface-2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        "line-strong": "rgb(var(--c-line-strong) / <alpha-value>)",
        fg: "rgb(var(--c-fg) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        faint: "rgb(var(--c-faint) / <alpha-value>)",
        accent: "#e8600b",
        "accent-light": "#fd7119",
        ok: "#0f9d58",
        warn: "#b45309",
        danger: "#d93025",
        cream: "#f6e9e0",
        navy: "rgb(var(--c-navy) / <alpha-value>)",
      },

      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Archivo Black"', '"DM Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
