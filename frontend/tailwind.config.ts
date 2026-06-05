import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        grid: {
          bg: "#0b0f17",
          panel: "#141a24",
          edge: "#1f2937"
        }
      }
    }
  },
  plugins: []
}

export default config
