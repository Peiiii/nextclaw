import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 18px 60px rgba(20, 20, 18, 0.07)",
      },
    },
  },
  plugins: [],
} satisfies Config;
