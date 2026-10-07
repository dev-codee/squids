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
        // Orange-red brand with purple offer actions.
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
          DEFAULT: "#FF4D00",
          hover: "#D94100",
          soft: "#FFF1EB",
          border: "#FFD0BC",
        },
        offer: {
          DEFAULT: "#300A6E",
          hover: "#0B00CF",
        },
        "store-header": "#F0F8FF",
        line: {
          DEFAULT: "#E6E3DB",
          strong: "#D6D2C8",
        },
        accent: {
          DEFAULT: "#FF4D00",
          hover: "#D94100",
          soft: "#FFF1EB",
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
