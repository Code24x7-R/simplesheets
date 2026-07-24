/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        grid: {
          border: '#e0e0e0',
          header: '#f8f9fa',
          selected: '#e3f2fd',
          'selected-border': '#1976d2',
          frozen: '#f0f4f8',
        },
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
