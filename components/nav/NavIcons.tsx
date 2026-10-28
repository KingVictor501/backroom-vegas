/*
  FILE: components/nav/NavIcons.tsx
  WHAT IT'S FOR: The three small pictures in the menu (a house, a ticket, a gear).
  They're drawn with SVG (shapes written as code), so we don't need image files
  or an extra icon library.
  WHO USES IT: components/nav/AppNav.tsx puts one above each menu label.
  WHY THIS NAME: "NavIcons" = the icons for navigation (the menu). It ends in .tsx
  because these are components that draw something on screen.
*/

/*
  Settings shared by all three icons:
  - aria-hidden: screen readers skip the picture, because the text label
    ("Home", "Bet Slips", "Settings") already says what the button is.
  - currentColor: the icon takes the color of the text around it, so it turns
    gold together with the label when that page is selected.
*/
const iconProps = {
  "aria-hidden": true,
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/* HomeIcon: a simple house outline. */
export function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  );
}

/* BetSlipIcon: a ticket with a dashed tear line, like a printed bet slip. */
export function BetSlipIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z" />
      <path d="M14 5v2M14 11v2M14 17v2" />
    </svg>
  );
}

/* ProfileIcon: a person (head and shoulders). */
export function ProfileIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20.5c0-3.6 3.6-6 8-6s8 2.4 8 6" />
    </svg>
  );
}

/* SettingsIcon: a gear. */
export function SettingsIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
