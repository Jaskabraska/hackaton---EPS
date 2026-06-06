import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        grid: {
          bg: "#070b12",
          panel: "#0e141f",
          raised: "#141c2a",
          edge: "#1d2735",
          line: "#26344a"
        },
        accent: {
          DEFAULT: "#22d3ee",
          soft: "#0e7490"
        },
        status: {
          ok: "#34d399",
          warn: "#fbbf24",
          high: "#fb923c",
          crit: "#f87171"
        }
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)"
      }
    }
  },
  plugins: []
}

export default config
