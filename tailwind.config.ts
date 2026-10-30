import type { Config } from "tailwindcss";

/** Direction artistique alignée sur le Cybersup Vulhub Launcher / vms.cybersup.ai. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0d18",
        surface: "#10141f",
        "surface-2": "#161b29",
        line: "#232a3d",
        "line-strong": "#323b55",
        fg: "#eceef3",
        muted: "#9aa3b7",
        faint: "#7c859b",
        accent: "#fd7119",
        "accent-light": "#ffa364",
        ok: "#34d399",
        warn: "#fbbf24",
        danger: "#f87171",
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
