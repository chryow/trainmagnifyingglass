import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ruby — primary brand colour (jewel-tone palette for "Hidden Gems")
        primary: {
          50: '#fff0f5',
          100: '#ffe1eb',
          200: '#ffc2d6',
          300: '#ff94b5',
          400: '#fb5a8c',
          500: '#f0336f',
          600: '#e11d5c',
          700: '#bc1049',
          800: '#9b1140',
          900: '#80123a',
          950: '#48041c',
        },
        // Sapphire — secondary
        accent: {
          50: '#eef1ff',
          100: '#e0e5ff',
          200: '#c6ceff',
          300: '#a1abff',
          400: '#7a7ffc',
          500: '#5a5cf6',
          600: '#3346f0',
          700: '#2a35d4',
          800: '#252eaa',
          900: '#252d86',
          950: '#161a4e',
        },
        // Citrine — small highlights only
        citrine: {
          100: '#fff4cc',
          300: '#ffd866',
          400: '#ffc531',
          500: '#f5ae0b',
          700: '#a86b00',
        },
        // Neutrals: cool plum-tinted greys replace Tailwind's warm stone
        stone: {
          50: '#f8f6ff',
          100: '#f0edfa',
          200: '#e3def2',
          300: '#cbc4e0',
          400: '#9a91b5',
          500: '#736a8f',
          600: '#564e70',
          700: '#403957',
          800: '#2a2440',
          900: '#1c1433',
          950: '#110b22',
        },
        // Full scales (pages use shades the old partial scales were missing)
        success: colors.emerald,
        warning: colors.amber,
        error: colors.red,
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      // Tinted (plum) shadows instead of flat grey
      boxShadow: {
        card: '0 1px 2px 0 rgb(28 20 51 / 0.05), 0 4px 16px -6px rgb(28 20 51 / 0.10)',
        'card-hover': '0 2px 4px 0 rgb(28 20 51 / 0.06), 0 18px 40px -12px rgb(28 20 51 / 0.22)',
        glow: '0 12px 32px -10px rgb(225 29 92 / 0.55), 0 6px 18px -8px rgb(51 70 240 / 0.45)',
      },
      backgroundImage: {
        // The signature "faceted gem" gradient: ruby → amethyst → sapphire
        gem: 'linear-gradient(135deg, #f0336f 0%, #b23be6 52%, #3346f0 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
