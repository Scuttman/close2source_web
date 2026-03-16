import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          main: "#FF6A1A",    // vivid deep orange
          dark: "#1D3557",   // deep indigo
          warm: "#E07A5F",   // terracotta
          green: "#81B29A",  // growth
          yellow: "#F2CC8F", // sunlight
          sand: "#FAF9F6"    // neutral bg
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
} satisfies Config;