/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        "2.5xl": "1200px",
        "3xl": "1440px",
        "4xl": "1680px",
      },
      fontFamily: {
        sans: ["Figtree"],
      },
      animation: {
        "pulse-scale": "pulse-scale 2s infinite",
      },
      keyframes: {
        "pulse-scale": {
          "0%": { transform: "scale(1.05)", opacity: "0.5" },
          "100%": { transform: "scale(1.4)", opacity: "0.3" },
        },
      },
    },
  },
  plugins: [],
};
