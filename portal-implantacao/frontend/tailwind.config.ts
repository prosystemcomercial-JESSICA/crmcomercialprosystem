import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        prosystem: { 400: '#4B8EC8', 500: '#2E6EAB', 600: '#1A4E82', 900: '#0D2C52' },
      },
    },
  },
  plugins: [],
} satisfies Config;
