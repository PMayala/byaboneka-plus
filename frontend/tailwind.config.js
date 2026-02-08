/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#E8F0F7",
          100: "#D1E1EF",
          200: "#A3C3DF",
          300: "#75A5CF",
          400: "#4787BF",
          500: "#1E3A5F", // Main primary
          600: "#183050",
          700: "#122640",
          800: "#0C1C30",
          900: "#061220",
        },
        trust: {
          50: "#E8F5E9",
          100: "#C8E6C9",
          200: "#A5D6A7",
          300: "#81C784",
          400: "#66BB6A",
          500: "#2E7D32", // Trust green
          600: "#27702D",
          700: "#1F5E26",
          800: "#184D1E",
          900: "#103C17",
        },
        accent: {
          50: "#FFF3E0",
          100: "#FFE0B2",
          200: "#FFCC80",
          300: "#FFB74D",
          400: "#FFA726",
          500: "#FF6B35", // Warm orange
          600: "#E65C2F",
          700: "#CC4D29",
          800: "#B33E23",
          900: "#992F1D",
        },
      },
      fontFamily: {
        sans: ["Satoshi", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
