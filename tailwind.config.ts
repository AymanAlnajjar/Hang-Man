import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        // legacy alias so any leftover `font-cairo` keeps resolving
        cairo: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        background: "#f7f1e6",
        surface: "#fffaf1",
        "surface-strong": "#ffffff",
        ink: "#20243d",
        "ink-soft": "#5d6075",
        primary: {
          DEFAULT: "#5267e8",
          dark: "#3f50c4",
          soft: "#e5e9ff",
        },
        coral: {
          DEFAULT: "#ff806c",
          soft: "#ffe2dc",
        },
        yellow: {
          DEFAULT: "#ffd369",
          soft: "#fff1bd",
        },
        success: {
          DEFAULT: "#78ad8a",
          soft: "#dcecdf",
        },
        danger: {
          DEFAULT: "#d86868",
          soft: "#f7dddd",
        },
        muted: "#ded9cf",
        disabled: "#b8b4ad",
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "22px",
        pill: "999px",
      },
      boxShadow: {
        card: "4px 4px 0 #20243d",
        "card-sm": "2px 2px 0 #20243d",
        "card-pressed": "1px 1px 0 #20243d",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "bounce-up": {
          "0%": { transform: "translateY(0)" },
          "45%": { transform: "translateY(-6px)" },
          "100%": { transform: "translateY(0)" },
        },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        flip: {
          "0%": { transform: "rotateX(0deg)" },
          "50%": { transform: "rotateX(90deg)" },
          "100%": { transform: "rotateX(0deg)" },
        },
        stamp: {
          "0%": { transform: "scale(1.6) rotate(-14deg)", opacity: "0" },
          "60%": { transform: "scale(0.92) rotate(-8deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-8deg)", opacity: "1" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 0.18s ease-out",
        floaty: "floaty 3.4s ease-in-out infinite",
        "bounce-up": "bounce-up 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        shake: "shake 0.32s ease-in-out",
        flip: "flip 0.32s ease-in-out",
        stamp: "stamp 0.36s cubic-bezier(0.34,1.56,0.64,1) both",
        "sheet-up": "sheet-up 0.28s cubic-bezier(0.2,0.8,0.2,1)",
        "toast-in": "toast-in 0.2s cubic-bezier(0.2,0.8,0.2,1)",
      },
    },
  },
  plugins: [],
};

export default config;
