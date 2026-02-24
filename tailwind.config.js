/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          900: '#0a1628',
          800: '#0f2035',
          700: '#153045',
          600: '#1a3f55',
        },
        neon: {
          pink: '#ff6b9d',
          cyan: '#00e5ff',
          green: '#39ff14',
          yellow: '#ffe66d',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
