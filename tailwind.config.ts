import type { Config } from "tailwindcss";

/** Direction artistique alignée sur le Cybersup Vulhub Launcher / vms.cybersup.ai. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Interface claire (16/11) : fond blanc cassé, cartes blanches, texte bleu nuit de la charte.
        bg: "#f4f6fb",
        surface: "#ffffff",
        "surface-2": "#f7f8fc",
        line: "#e2e6ef",
        "line-strong": "#c9d0de",
        fg: "#141a33",
        muted: "#525c75",
        faint: "#7a8399",
        accent: "#e8600b",
        "accent-light": "#fd7119",
        ok: "#0f9d58",
        warn: "#b45309",
        danger: "#d93025",
        cream: "#f6e9e0",
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
