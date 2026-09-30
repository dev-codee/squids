import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Foxzil design system. Ivory canvas, navy text, orange primary action.
        canvas: {
          DEFAULT: "#FAF9F5",
          sunk: "#F4F2EC",
        },
        ink: {
          DEFAULT: "#18243A",
          soft: "#4A5568",
          muted: "#727C8C",
        },
        brand: {
          DEFAULT: "#BF481C",
          hover: "#A43C15",
          soft: "#FDF1EC",
          border: "#F2D5C8",
        },
        line: {
          DEFAULT: "#E6E3DB",
          strong: "#D6D2C8",
        },
        accent: {
          DEFAULT: "#BF481C",
          hover: "#A43C15",
          soft: "#FDF1EC",
        },
      },
      borderRadius: {
        card: "12px",
      },
      maxWidth: {
        shell: "1200px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(24 36 58 / 0.04), 0 1px 3px 0 rgb(24 36 58 / 0.06)",
        "card-hover": "0 4px 12px -2px rgb(24 36 58 / 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
