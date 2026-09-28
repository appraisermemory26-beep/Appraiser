import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0d1117",
        "bg-sidebar": "#161b22",
        "bg-card": "#161b22",
        "border-default": "#30363d",
        "accent-green": "#4ade80",
        "accent-yellow": "#f0b429",
        "accent-red": "#f85149",
        "accent-blue": "#58a6ff",
        "accent-orange": "#d29922",
        "accent-purple": "#bc8cff",
        "text-primary": "#e6edf3",
        "text-secondary": "#8b949e",
        "text-muted": "#6e7681",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
