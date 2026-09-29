import type { Config } from 'tailwindcss'

/**
 * All semantic color tokens point to CSS custom properties.
 * The actual values live in globals.css under :root (light) and .dark (dark).
 * Swapping the `dark` class on <html> switches every color simultaneously.
 */
const config: Config = {
  darkMode: 'class',
  content:  ['./index.html', './src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      // ── Color tokens — all CSS variables ─────────────────────────────────

      colors: {
        bg: {
          base:     'var(--bg-base)',
          surface:  'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          overlay:  'var(--bg-overlay)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle:  'var(--border-subtle)',
          strong:  'var(--border-strong)',
        },
        text: {
          DEFAULT:  'var(--text)',
          muted:    'var(--text-muted)',
          subtle:   'var(--text-subtle)',
          inverted: 'var(--text-inverted)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          strong:  'var(--brand-strong)',
          dim:     'var(--brand-dim)',
          ring:    'var(--brand-ring)',
        },
        success: { DEFAULT: 'var(--success)', dim: 'var(--success-dim)' },
        warning: { DEFAULT: 'var(--warning)', dim: 'var(--warning-dim)' },
        danger:  { DEFAULT: 'var(--danger)',  dim: 'var(--danger-dim)'  },
        info:    { DEFAULT: 'var(--info)',    dim: 'var(--info-dim)'    },

        // Status badge foreground colours — same semantic meaning across modes,
        // CSS vars let us slightly adjust saturation per mode.
        status: {
          inquiry:             'var(--status-inquiry)',
          submitted:           'var(--status-submitted)',
          under_review:        'var(--status-under-review)',
          more_info_needed:    'var(--status-more-info)',
          interview_scheduled: 'var(--status-interview)',
          accepted:            'var(--status-accepted)',
          waitlisted:          'var(--status-waitlisted)',
          rejected:            'var(--status-rejected)',
          admitted:            'var(--status-admitted)',
          withdrawn:           'var(--status-withdrawn)',
          hired:               'var(--status-hired)',
          offer_sent:          'var(--status-offer-sent)',
          active:              'var(--status-active)',
          inactive:            'var(--status-inactive)',
          archived:            'var(--status-archived)',
          draft:               'var(--status-draft)',
        },
      },

      // ── Shadows (CSS vars so dark mode can use darker shadows) ────────────

      boxShadow: {
        card:    'var(--shadow-card)',
        'card-md':'var(--shadow-card-md)',
        modal:   'var(--shadow-modal)',
        ring:    'var(--shadow-ring)',
        glow:    'var(--shadow-glow)',
        sidebar: 'var(--shadow-sidebar)',
        header:  'var(--shadow-header)',
        xs:      '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        '2xs':   '0 1px 1px 0 rgba(0, 0, 0, 0.03)',
        '3xs':   '0 0.5px 1px 0 rgba(0, 0, 0, 0.02)',
      },

      // ── Typography ────────────────────────────────────────────────────────

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      fontSize: {
        // ponytail: alias 3xs and 2xs to 12px (0.75rem) floor for WCAG compliance
        '3xs': ['0.75rem',  { lineHeight: '1rem'     }],
        '2xs': ['0.75rem',  { lineHeight: '1rem'     }],
        xs:    ['0.75rem',  { lineHeight: '1rem'     }],
        sm:    ['0.875rem', { lineHeight: '1.25rem'  }],
        base:  ['1rem',     { lineHeight: '1.5rem'   }],
        lg:    ['1.125rem', { lineHeight: '1.75rem'  }],
        xl:    ['1.25rem',  { lineHeight: '1.75rem'  }],
        '2xl': ['1.5rem',   { lineHeight: '2rem'     }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem'  }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem'   }],
        '5xl': ['3rem',     { lineHeight: '1'        }],
      },

      // ── Spacing ───────────────────────────────────────────────────────────

      spacing: { sidebar: '240px', header: '52px', 18: '4.5rem' },

      // ── Borders ───────────────────────────────────────────────────────────

      borderRadius: {
        sm:      '4px',
        DEFAULT: '6px',
        md:      '8px',
        lg:      '10px',
        xl:      '14px',
        '2xl':   '18px',
      },

      // ── Animation ─────────────────────────────────────────────────────────

      keyframes: {
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) scale(0.96)' },
          to:   { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition:  '200% 0' },
        },
        'slide-left': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },

      animation: {
        'slide-down': 'slide-down 150ms ease-out',
        'slide-up':   'slide-up 150ms ease-out',
        'fade-in':    'fade-in 150ms ease-out',
        'scale-in':   'scale-in 150ms ease-out',
        shimmer:      'shimmer 1.5s infinite linear',
        'slide-left': 'slide-left 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },

  plugins: [],
}

export default config
