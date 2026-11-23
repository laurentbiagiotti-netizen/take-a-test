import type { Config } from "tailwindcss";

/** Direction artistique alignée sur le Cybersup Vulhub Launcher / vms.cybersup.ai. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Interface claire (16/11) : fond blanc cassé, cartes blanches, texte bleu nuit de la charte.
        bg: "#f3efe8",
        surface: "#fffdf9",
        "surface-2": "#f8f4ed",
        line: "#e9e2d6",
        "line-strong": "#d6ccbc",
        fg: "#0f1640",
        muted: "#555c7a",
        faint: "#8b8fa5",
        accent: "#e8600b",
        "accent-light": "#fd7119",
        ok: "#0f9d58",
        warn: "#b45309",
        danger: "#d93025",
        cream: "#f6e9e0",
        navy: "#0a1047",
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
