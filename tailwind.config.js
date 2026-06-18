/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0A0E13",
        surface: "#121922",
        surface2: "#1A2330",
        line: "#28313D",
        signal: "#3FE6CE",
        signaldim: "#1B5A52",
        amber: "#F0A93D",
        amberdim: "#4A3819",
        danger: "#E2585A",
        dangerdim: "#4A1E1F",
        hi: "#ECF4F3",
        lo: "#7E8B93"
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      borderRadius: {
        xl2: "26px"
      },
      keyframes: {
        sweep: { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
        pulse2: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.35 } }
      },
      animation: {
        sweep: "sweep 4s linear infinite",
        pulse2: "pulse2 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
