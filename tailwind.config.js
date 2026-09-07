/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand teal — sidebar, top bar, primary buttons (KB §24)
        brand: {
          primary: '#0E5E68',
          'primary-dark': '#0A454D',
          'primary-light': '#1C7C8C',
        },
        // Accent mint/emerald — logo "X", online status dot, positive accents
        accent: '#34D399',
        // Links / secondary actions
        link: '#17A2B8',
        // Info/notice callouts
        info: {
          bg: '#DCE9FB',
          text: '#1D4ED8',
        },
        // Neutrals
        surface: '#FFFFFF',
        heading: '#0B4F58',
        body: '#374151',
        border: '#E5E7EB',
        avatar: {
          green: '#10B981',
        },
        // Bed/room/complaint status colors
        status: {
          available: '#34D399',
          occupied: '#EF4444',
          reserved: '#F59E0B',
          unavailable: '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
      },
    },
  },
  plugins: [],
}
