/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#0a0a0a',
    tint: '#2f95dc',

    // Core surfaces
    background: '#FFF9EC',
    foreground: '#17324D',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#17324D',

    // Primary action color (buttons, links, active states)
    primary: '#2477D4',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E7F5FF',
    secondaryForeground: '#17324D',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#FFF0B8',
    mutedForeground: '#5C6B76',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#FFE07A',
    accentForeground: '#17324D',

    // Destructive actions (delete, error states)
    destructive: '#E95757',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#DDE7EE',
    input: '#DDE7EE',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 20,
};

export default colors;
