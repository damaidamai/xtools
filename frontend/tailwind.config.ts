import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "#0d1118",
        surface: "#131a24",
        border: "#1b2431",
        foreground: "#e4e9f2",
        muted: "#9aa5b7",
        primary: "#8fb6ff",
        destructive: "#e06464",
        success: "#58c48f",
        warning: "#d7b775",
      },
      borderRadius: {
        lg: "12px",
      },
      boxShadow: {
        subtle: "0 0 0 1px rgba(42,42,42,0.9)",
      },
    },
  },
  plugins: [],
};

export default config;
