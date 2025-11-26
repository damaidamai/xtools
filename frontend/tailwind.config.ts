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
        background: "#121212",
        surface: "#1E1E1E",
        border: "#2A2A2A",
        foreground: "#E0E0E0",
        muted: "#A0A0A0",
        primary: "#3B82F6",
        destructive: "#E53E3E",
        success: "#22C55E",
        warning: "#F6C23E",
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
