/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
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
