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
          50: '#fcf3f6',
          100: '#f9e6ec',
          200: '#f2cbd7',
          300: '#e7a8bb',
          400: '#d9849e',
          500: '#c96685',
          600: '#b4506f',
          700: '#96425c',
          800: '#7c3a4f',
          900: '#673445',
          950: '#3a1a24',
        },
        // Sapphire — secondary
        accent: {
          50: '#f3f4fc',
          100: '#e7e9f8',
          200: '#d0d5f1',
          300: '#b0b8e6',
          400: '#8d96d8',
          500: '#727bc9',
          600: '#5e64b8',
          700: '#4f539c',
          800: '#43477e',
          900: '#3b3e66',
          950: '#23253c',
        },
        // Citrine — small highlights only
        citrine: {
          100: '#fbf3dd',
          300: '#f0d898',
          400: '#e6c675',
          500: '#d4ae52',
          700: '#8a6a1f',
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
        glow: '0 8px 22px -12px rgb(150 66 92 / 0.45), 0 4px 12px -8px rgb(94 100 184 / 0.30)',
      },
      backgroundImage: {
        // The signature "faceted gem" gradient: soft rose → amethyst → periwinkle
        gem: 'linear-gradient(135deg, #c96685 0%, #8f74c2 52%, #5e6ec2 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
        // Small "it worked" bounce on save / react
        pop: 'pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        pop: { '0%': { transform: 'scale(1)' }, '45%': { transform: 'scale(1.3)' }, '100%': { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
