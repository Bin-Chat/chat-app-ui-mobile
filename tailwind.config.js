/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0068FF',
        'primary-dark': '#0055d4',
        'primary-light': '#EBF3FF',
      },
    },
  },
  plugins: [],
};
