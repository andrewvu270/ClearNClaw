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
          900: 'var(--color-base-900, #0a1628)',
          800: 'var(--color-base-800, #0f2035)',
          700: '#153045',
          600: '#1a3f55',
        },
        neon: {
          pink: 'var(--color-neon-pink, #ff6b9d)',
          cyan: 'var(--color-neon-cyan, #00e5ff)',
          green: 'var(--color-neon-green, #39ff14)',
          yellow: 'var(--color-neon-yellow, #ffe66d)',
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
