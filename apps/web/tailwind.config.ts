import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        background: "hsl(210 40% 98%)",
        foreground: "hsl(222 47% 11%)",
        primary: "hsl(202 80% 24%)",
        accent: "hsl(168 62% 31%)",
        warning: "hsl(38 92% 42%)",
        danger: "hsl(0 72% 42%)"
      },
      boxShadow: {
        panel: "0 8px 24px rgb(15 23 42 / 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
