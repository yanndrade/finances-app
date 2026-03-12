/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "!./src/**/node_modules/**",
    "!./src/my-app/**",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist Sans"', '"Inter"', '"Segoe UI"', "sans-serif"],
      },
      fontSize: {
        xs: ["0.8rem", { lineHeight: "1.2" }],
        sm: ["0.925rem", { lineHeight: "1.4" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--primary-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--primary-foreground))",
        },

        finance: {
          income: "hsl(var(--finance-income))",
          expense: "hsl(var(--finance-expense))",
          transfer: "hsl(var(--finance-transfer))",
          investment: "hsl(var(--finance-investment))",
          review: "hsl(var(--finance-review))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          navy: "hsl(var(--accent-navy))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          elevated: "hsl(var(--surface-elevated))",
          paper: "hsl(var(--surface-paper))",
        },
        lifecycle: {
          forecast: "hsl(var(--lifecycle-forecast))",
          pending: "hsl(var(--lifecycle-pending))",
          cleared: "hsl(var(--lifecycle-cleared))",
          cancelled: "hsl(var(--lifecycle-cancelled))",
          voided: "hsl(var(--lifecycle-voided))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          primary: "hsl(var(--chart-primary))",
          income: "hsl(var(--chart-income))",
          expense: "hsl(var(--chart-expense))",
          transfer: "hsl(var(--chart-transfer))",
          1: "hsl(var(--chart-primary))",
          2: "hsl(var(--chart-income))",
          3: "hsl(var(--chart-expense))",
          4: "hsl(var(--chart-transfer))",
          5: "hsl(var(--primary-soft))",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
