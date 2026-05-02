/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Tajawal', 'sans-serif'],
      },
      colors: {
        primary: '#6366f1',
        secondary: '#64748b',
        accent: '#10b981',
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
        },
      },
      boxShadow: {
        soft: '0 2px 20px -5px rgba(0, 0, 0, 0.05)',
        premium: '0 20px 50px -12px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-up': 'scaleUp 0.2s ease-out',
        marquee: 'marquee 40s linear infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        /** أيقونات شريط التطبيق — حركة لمرة واحدة عند hover */
        'header-bell-nudge': 'headerBellNudge 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) 1',
        'header-sun-wink': 'headerSunWink 0.65s ease-out 1',
        'header-server-breathe': 'headerServerBreathe 2.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleUp: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        headerBellNudge: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-14deg)' },
          '40%': { transform: 'rotate(12deg)' },
          '60%': { transform: 'rotate(-8deg)' },
          '80%': { transform: 'rotate(4deg)' },
        },
        headerSunWink: {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '35%': { transform: 'rotate(-18deg) scale(1.08)' },
          '65%': { transform: 'rotate(14deg) scale(1.05)' },
        },
        headerServerBreathe: {
          '0%, 100%': { filter: 'drop-shadow(0 0 0 transparent)' },
          '50%': { filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.45))' },
        },
      },
    },
  },
  plugins: [],
};
