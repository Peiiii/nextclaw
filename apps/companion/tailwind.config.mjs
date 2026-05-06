/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "rgb(203 213 225 / <alpha-value>)",
        background: "rgb(248 250 252 / <alpha-value>)",
        foreground: "rgb(15 23 42 / <alpha-value>)",
        muted: "rgb(241 245 249 / <alpha-value>)",
        "muted-foreground": "rgb(71 85 105 / <alpha-value>)",
        accent: "rgb(255 255 255 / <alpha-value>)",
        primary: "rgb(37 99 235 / <alpha-value>)",
        success: "rgb(22 163 74 / <alpha-value>)",
        danger: "rgb(220 38 38 / <alpha-value>)"
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem"
      },
      boxShadow: {
        companion: "0 18px 44px rgba(15, 23, 42, 0.18)"
      }
    }
  },
  plugins: []
};
