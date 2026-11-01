import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyberDark: "#080a10",
        cyberNavy: "#0c101d",
        cyberCard: "#101626",
        cyberBorder: "#1c243a",
        neonPurple: "#8b5cf6",
        neonBlue: "#38bdf8",
        neonGreen: "#10b981",
        neonRed: "#ef4444",
        background: "#0a0d14",
        foreground: "#f9fafb",
        card: {
          DEFAULT: "#111827",
          foreground: "#f3f4f6",
        },
        border: "#1f2937",
        redTeam: {
          DEFAULT: "#ef4444",
          dark: "#991b1b",
          light: "#f87171",
        },
        blueTeam: {
          DEFAULT: "#3b82f6",
          dark: "#1e40af",
          light: "#60a5fa",
        },
        guardian: {
          low: "#10b981",
          medium: "#f59e0b",
          high: "#f97316",
          critical: "#ef4444",
        },
        policy: {
          allow: "#10b981",
          block: "#ef4444",
          approval: "#f59e0b",
        },
        neon: {
          purple: "#7c3aed",
          "purple-bright": "#a855f7",
          "purple-glow": "#8b5cf6",
        },
        alert: {
          red: "#dc2626",
          "red-dim": "#991b1b",
        },
      },
      boxShadow: {
        "neon-purple": "0 0 15px rgba(124, 58, 237, 0.5)",
        "neon-red": "0 0 20px rgba(239, 68, 68, 0.4)",
        "glow-blue": "0 0 10px rgba(59, 130, 246, 0.4)",
        "glow-green": "0 0 10px rgba(16, 185, 129, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;

