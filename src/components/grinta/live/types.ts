export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  elo: number;
  team: 'A' | 'B' | null;
}

export interface GoalEvent {
  id: string;
  team: 'A' | 'B';
  scorer: Player | null;
  ownGoalPlayer: Player | null;
  assist: Player | null;
  timestamp: number;
  is_own_goal: boolean;
}

export type GameState = 'LOADING' | 'PRE' | 'LIVE' | 'POST';
export type SelectionStep = 'SCORER' | 'ASSIST';

export const TEAM_A_COLOR = '#3B82F6';
export const TEAM_A_RGB = '59,130,246';
export const TEAM_B_COLOR = '#EF4444';
export const TEAM_B_RGB = '239,68,68';
export const LIME = '#AAFF00';
export const VOID = '#080808';
export const SURFACE = '#111111';
export const BORDER = '#1C1C1C';

export const DISPLAY: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 900,
  textTransform: 'uppercase' as const,
  letterSpacing: '-0.01em',
};

export const ROOT: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: VOID,
  color: '#F0F0F0',
  fontFamily: "'DM Sans', sans-serif",
  overflow: 'hidden',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
};

export function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function initials(p: Player): string {
  return `${(p.first_name[0] || '?')}${(p.last_name[0] || '')}`.toUpperCase();
}
