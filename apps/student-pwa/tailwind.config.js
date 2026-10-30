/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1A3C6E',
          light: '#2B5BA0',
          dark: '#0F2647',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#FFFFFF',
        },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
