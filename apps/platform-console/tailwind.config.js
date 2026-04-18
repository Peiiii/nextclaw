/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1f4ec',
          100: '#e3e8d7',
          200: '#c8d1b3',
          300: '#a9b68a',
          400: '#87965f',
          500: '#5f6b43',
          600: '#4d5637',
          700: '#41482f',
          800: '#343a26',
          900: '#232719'
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
