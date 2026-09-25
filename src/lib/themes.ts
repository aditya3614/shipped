export interface CardTheme {
  id: string;
  name: string;
  /** CSS background for the card. */
  bg: string;
  /** Heatmap colors for contribution levels 0–4. */
  levels: [string, string, string, string, string];
  /** Persona highlight color. */
  accent: string;
  /** Text and glass tokens, applied as CSS variables on the card. */
  vars: Record<string, string>;
}

const lightText = { '--fg': '#ffffff', '--fg-muted': 'rgba(255,255,255,.62)', '--fg-faint': 'rgba(255,255,255,.45)' };
const darkGlass = {
  '--glass-a': 'rgba(255,255,255,.18)',
  '--glass-b': 'rgba(255,255,255,.05)',
  '--glass-border': 'rgba(255,255,255,.28)',
  '--glass-shine': 'rgba(255,255,255,.45)',
  '--glass-sheen': 'rgba(255,255,255,.16)',
};

export const THEMES: CardTheme[] = [
  {
    id: 'crimson',
    name: 'Crimson',
    bg: 'radial-gradient(40% 50% at 12% 8%, rgba(255,150,170,.85), transparent 70%), radial-gradient(30% 40% at 92% 6%, rgba(95,211,138,.55), transparent 70%), radial-gradient(55% 60% at 60% 55%, rgba(200,45,75,.7), transparent 70%), radial-gradient(50% 60% at 100% 100%, rgba(60,8,20,.9), transparent 70%), linear-gradient(160deg, #a52a3c 0%, #6e1726 60%, #3a0a14 100%)',
    levels: ['rgba(255,255,255,.14)', '#9c2d45', '#e0506c', '#ff9aae', '#ffe3e9'],
    accent: '#ffc2cf',
    vars: { ...lightText, ...darkGlass },
  },
  {
    id: 'cream',
    name: 'Cream',
    bg: 'radial-gradient(40% 55% at 10% 10%, rgba(255,190,205,.9), transparent 70%), radial-gradient(35% 45% at 95% 8%, rgba(170,235,195,.9), transparent 70%), radial-gradient(45% 55% at 85% 100%, rgba(255,160,180,.55), transparent 70%), linear-gradient(160deg, #fdf6ef 0%, #f7efe6 100%)',
    levels: ['rgba(90,26,38,.08)', '#f7b6c2', '#ec6f87', '#c7334f', '#6e1627'],
    accent: '#b73049',
    vars: {
      '--fg': '#17161a',
      '--fg-muted': 'rgba(23,22,26,.6)',
      '--fg-faint': 'rgba(23,22,26,.42)',
      '--glass-a': 'rgba(255,255,255,.72)',
      '--glass-b': 'rgba(255,255,255,.38)',
      '--glass-border': 'rgba(255,255,255,.9)',
      '--glass-shine': 'rgba(255,255,255,1)',
      '--glass-sheen': 'rgba(255,255,255,.55)',
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    bg: 'radial-gradient(40% 50% at 12% 8%, rgba(160,240,190,.7), transparent 70%), radial-gradient(30% 40% at 92% 6%, rgba(232,98,122,.5), transparent 70%), radial-gradient(55% 60% at 55% 55%, rgba(30,140,80,.6), transparent 70%), linear-gradient(160deg, #1f5c3a 0%, #0f3322 60%, #06170f 100%)',
    levels: ['rgba(255,255,255,.14)', '#1f7a4a', '#34b36b', '#7ce3a3', '#d6fbe4'],
    accent: '#b6f5cd',
    vars: { ...lightText, ...darkGlass },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bg: 'radial-gradient(40% 50% at 12% 8%, rgba(170,180,255,.6), transparent 70%), radial-gradient(30% 40% at 92% 6%, rgba(232,98,122,.45), transparent 70%), radial-gradient(55% 60% at 55% 55%, rgba(80,70,220,.55), transparent 70%), linear-gradient(160deg, #1e1b4b 0%, #0f0d2e 60%, #060514 100%)',
    levels: ['rgba(255,255,255,.14)', '#3b3a8f', '#5b57d6', '#9aa2ff', '#e0e4ff'],
    accent: '#c7d0ff',
    vars: { ...lightText, ...darkGlass },
  },
  {
    id: 'classic',
    name: 'Classic',
    bg: 'radial-gradient(45% 55% at 12% 8%, rgba(57,211,83,.28), transparent 70%), radial-gradient(40% 50% at 95% 100%, rgba(57,211,83,.12), transparent 70%), linear-gradient(160deg, #161b22 0%, #0d1117 100%)',
    levels: ['rgba(255,255,255,.1)', '#0e4429', '#006d32', '#26a641', '#39d353'],
    accent: '#7ee787',
    vars: { ...lightText, ...darkGlass },
  },
];
