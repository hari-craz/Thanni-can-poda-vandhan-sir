---
name: Hydronix Intelligence
colors:
  surface: '#f6f8f8'
  surface-dim: '#d6dbde'
  surface-bright: '#f5fafd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4f8'
  surface-container: '#eaeef2'
  surface-container-high: '#e4e9ec'
  surface-container-highest: '#dee3e7'
  on-surface: '#171c1f'
  on-surface-variant: '#3d484e'
  inverse-surface: '#2c3134'
  inverse-on-surface: '#edf1f5'
  outline: '#6d797f'
  outline-variant: '#bdc8cf'
  surface-tint: '#006782'
  primary: '#006782'
  on-primary: '#ffffff'
  primary-container: '#11aad4'
  on-primary-container: '#003a4a'
  inverse-primary: '#5dd4ff'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#8a5100'
  on-tertiary: '#ffffff'
  tertiary-container: '#db8b2b'
  on-tertiary-container: '#4f2c00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bbeaff'
  primary-fixed-dim: '#5dd4ff'
  on-primary-fixed: '#001f29'
  on-primary-fixed-variant: '#004d62'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#ffb86e'
  on-tertiary-fixed: '#2c1600'
  on-tertiary-fixed-variant: '#693c00'
  background: '#f5fafd'
  on-background: '#171c1f'
  surface-variant: '#dee3e7'
  border-subtle: '#e2e8f0'
  status-critical: '#ef4444'
  status-warning: '#f59e0b'
  status-nominal: '#22c55e'
  on-status-critical: '#fee2e2'
  on-status-nominal: '#dcfce7'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-padding: 2rem
  stack-gap: 1.5rem
  sidebar-width: 15rem
  gutter: 1.5rem
---

## Brand & Style
Hydronix embodies a **Corporate Modern** aesthetic tailored for industrial IoT and environmental monitoring. The brand personality is precise, authoritative, and reliable, evoking the feeling of a mission-critical "mission control" center. 

The visual style leverages high-clarity typography and a strict structural grid to organize complex telemetry data. It utilizes a clean, professional foundation with targeted use of high-signal color coding (Critical/Warning/Nominal) to provide immediate cognitive shortcuts for operators. The interface prioritizes functional density without sacrificing legibility, using a light-mode primary interface to maintain a high-energy, "daytime" operational feel.

## Colors
The palette is rooted in a professional "Slate" neutral base, accented by a vibrant **Cyan-Blue Primary** (#11aad4) used for active states and brand identification. 

- **Backgrounds:** The application uses a very light cool-grey (`#f6f8f8`) for the main canvas, contrasting against pure white (`#ffffff`) for elevated surface containers and cards.
- **Semantic Colors:** A strict traffic-light system is employed. Red (#ef4444) for critical failures, Amber (#f59e0b) for warnings, and Green (#22c55e) for healthy nodes.
- **Text:** Primary headings use a deep slate (#0f172a) for maximum contrast, while secondary metadata uses a mid-tone slate (#64748b).

## Typography
The system uses **Hanken Grotesk** across all roles to maintain a sharp, contemporary feel. The type scale relies on heavy weights (Bold 700) for structural headings to establish clear hierarchy in data-dense environments.

- **Display & Headlines:** Use negative letter-spacing for large titles to maintain a "tight," engineered look.
- **Labels:** Small labels and status indicators use uppercase with increased tracking for better legibility at small sizes.
- **Numerical Data:** Critical metrics (like WQI scores) use the largest weights in the system to ensure they are the first thing an operator's eye lands on.

## Layout & Spacing
The layout follows a **Hybrid Fixed-Fluid Model**. A fixed-width sidebar (240px) anchors the left, while the main content area utilizes a fluid grid that reflows based on viewport width.

- **Desktop:** Employs a 70/30 split between the main monitoring grid and the live alert sidebar.
- **Grid System:** Card layouts use a standard 24px (1.5rem) gap.
- **Internal Padding:** Component cards utilize 24px internal padding to provide breathability to complex data visualizations.
- **Mobile:** The 70/30 split stacks vertically, with the Alert Feed moving below the Node Grid.

## Elevation & Depth
Depth is communicated through **Low-Contrast Outlines** and subtle **Ambient Shadows**.

- **Cards:** Use a 1px border (`#e2e8f0`) and a "shadow-sm" (tight, low-blur) to suggest elevation without cluttering the screen with heavy gradients.
- **Interactive States:** Hovering over node cards increases the shadow spread (to "shadow-md") and provides a slight background shift.
- **Overlays:** Tooltips and dropdowns use a high-contrast dark surface (Slate-900) with a "shadow-lg" to physically separate them from the monitoring plane.

## Shapes
The shape language is **Strict & Precise**. 
- **Standard Radius:** 4px (0.25rem) is used for buttons, input fields, and standard cards to maintain an industrial, "instrument-panel" feel.
- **Large Radius:** 8px (0.5rem) is reserved for the sidebar and major content containers.
- **Pill Shapes:** Status badges and indicators use a full-round pill shape to distinguish them from structural UI elements.

## Components
- **Buttons:** Primary buttons use solid Cyan-Blue. Secondary buttons use a transparent background with a 1px slate border.
- **Status Chips:** High-contrast background/foreground pairings (e.g., Green-100 bg with Green-800 text) with a leading 6px dot to indicate live status.
- **Data Gauges:** Circular SVG gauges with an 8px stroke. The background track is light grey (`#f1f5f9`), and the value track is semantic (Green for >80, Red for <50).
- **Alert Feed:** Vertical timeline-style list with color-coded 4px left-accent borders to denote severity levels.
- **Sidebar Navigation:** Active items utilize a 10% opacity primary color background and bold text for high-visibility selection.
- **Node Cards:** Must include a top-accent bar (4px height) that matches the semantic status of the node for immediate visual scanning.