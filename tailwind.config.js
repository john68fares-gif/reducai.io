/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // required for next-themes
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0b0c10", // dark mode bg
          light: "#ffffff",   // light mode bg
        },
        foreground: {
          DEFAULT: "#ffffff", // dark mode text
          light: "#0b0c10",   // light mode text
        },
        // Primary brand (GREEN)
        accent: {
          green: "#00ffc2", // neon green
          soft: "#6af7d1",  // softer green
        },
        // NEW: Support accent (PURPLE) – matches your screenshots
        plum: {
          DEFAULT: "#6B62FF",
          50:  "#F0EFFF",
          100: "#E3E1FF",
          200: "#C6C4FF",
          300: "#A9A4FF",
          400: "#8C85FF",
          500: "#6B62FF",
          600: "#574FE3",
          700: "#463FBD",
          800: "#373190",
          900: "#2B276F",
        },
        // Semantic aliases (easy swap per-section if needed)
        brand: { DEFAULT: "#00ffc2" },   // main brand (green)
        brandAlt: { DEFAULT: "#6B62FF" } // support accent (purple)
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"], // default
        movatif: ["Manrope", "sans-serif"], // Movatif fallback → Manrope
      },
    },
  },
  plugins: [],
};
