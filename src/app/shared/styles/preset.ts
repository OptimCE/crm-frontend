import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const OptimcePreset = definePreset(Aura, {
  primitive: {
    // Optimce — green palette from logo
    brandgreen: {
      50: '#e8f5e9',
      100: '#c8e6c9',
      200: '#a5d6a7',
      300: '#81c784', // logo lightest
      400: '#66bb6a', // logo light
      500: '#43a047', // logo mid — main primary
      600: '#2e7d32', // logo dark
      700: '#1b5e20', // logo darkest
      800: '#145218',
      900: '#0d3b11',
      950: '#072508',
    },

    fontFamily:
      '"DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },

  semantic: {
    fontFamily: '{fontFamily}',

    primary: {
      50: '{brandgreen.50}',
      100: '{brandgreen.100}',
      200: '{brandgreen.200}',
      300: '{brandgreen.300}',
      400: '{brandgreen.400}',
      500: '{brandgreen.500}',
      600: '{brandgreen.600}',
      700: '{brandgreen.700}',
      800: '{brandgreen.800}',
      900: '{brandgreen.900}',
      950: '{brandgreen.950}',
    },

    colorScheme: {
      light: {
        primary: {
          color: '{brandgreen.500}',
          inverseColor: '#ffffff',
          hoverColor: '{brandgreen.600}',
          activeColor: '{brandgreen.700}',
        },
        highlight: {
          background: '{brandgreen.50}',
          focusBackground: '{brandgreen.100}',
          color: '{brandgreen.700}',
          focusColor: '{brandgreen.700}',
        },
        surface: {
          0: '#ffffff',
          50: '#f8faf8',
          100: '#f0f4f0',
          200: '#e2e8e3',
          300: '#c9d3ca',
          400: '#9ba89d',
          500: '#6e7e70',
          600: '#4a5a4c',
          700: '#374038',
          800: '#252d26',
          900: '#181e18',
          950: '#0e120e',
        },
      },
      dark: {
        primary: {
          color: '{brandgreen.400}',
          inverseColor: '{brandgreen.950}',
          hoverColor: '{brandgreen.300}',
          activeColor: '{brandgreen.200}',
        },
        highlight: {
          background: 'rgba(67, 160, 71, 0.16)',
          focusBackground: 'rgba(67, 160, 71, 0.24)',
          color: '{brandgreen.300}',
          focusColor: '{brandgreen.200}',
        },
      },
    },

    /* ------------------------------------------------------------------
       Severity tokens
       These drive p-button[severity="success|warn|danger|info"],
       p-message, p-toast, p-tag, p-badge, etc.

       Uncomment any block below to override Aura's defaults.
       ------------------------------------------------------------------ */

    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },

    warn: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },

    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a',
    },

    /* Focus ring — brand green */
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{brandgreen.400}',
      offset: '2px',
    },
  },
});
