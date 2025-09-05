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
        accent: {
          green: "#00ffc2", // neon green
          soft: "#6af7d1",  // softer green
        },
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"], // default
        movatif: ["Manrope", "sans-serif"], // Movatif fallback → Manrope
      },
    },
  },
  plugins: [],
};
