'use client';

import { useMemo } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface FUTCardProps {
  player: {
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
    elo: number;
    v2_answers?: {
      q2?: number;
      q3?: number;
      q4?: number;
      q5?: number;
      q6?: number;
      q8?: number;
      q9?: number;
    } | null;
  };
  size?: 'sm' | 'md' | 'lg';
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const DISPLAY: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 900,
  textTransform: 'uppercase' as const,
};

const SIZES = {
  sm: { w: 150, h: 210, ovr: 36, name: 13, stat: 10, label: 7, type: 7, hex: 36, gap: 1 },
  md: { w: 220, h: 308, ovr: 54, name: 18, stat: 14, label: 9, type: 10, hex: 56, gap: 2 },
  lg: { w: 300, h: 420, ovr: 72, name: 24, stat: 18, label: 12, type: 13, hex: 76, gap: 3 },
};

const TIERS = {
  bronze: {
    bg1: '#2A1F14', bg2: '#1A1208', accent: '#CD7F32', accentRgb: '205,127,50',
    glow: 'rgba(205,127,50,0.3)', shine: 'rgba(205,127,50,0.08)', label: 'BRONZE',
  },
  silver: {
    bg1: '#1E2025', bg2: '#12131A', accent: '#A8B4C4', accentRgb: '168,180,196',
    glow: 'rgba(168,180,196,0.3)', shine: 'rgba(168,180,196,0.06)', label: 'ARGENT',
  },
  gold: {
    bg1: '#2A2410', bg2: '#1A1608', accent: '#FFD700', accentRgb: '255,215,0',
    glow: 'rgba(255,215,0,0.35)', shine: 'rgba(255,215,0,0.08)', label: 'OR',
  },
  elite: {
    bg1: '#0F1A0A', bg2: '#080D05', accent: '#AAFF00', accentRgb: '170,255,0',
    glow: 'rgba(170,255,0,0.4)', shine: 'rgba(170,255,0,0.06)', label: 'ÉLITE',
  },
};

function getTier(elo: number) {
  if (elo >= 1000) return TIERS.elite;
  if (elo >= 800) return TIERS.gold;
  if (elo >= 600) return TIERS.silver;
  return TIERS.bronze;
}

function scaleStat(v: number | undefined): number {
  if (v === undefined || v === null) return 50;
  return Math.round(((v - 1) / 3) * 99);
}

function getPlayerType(stats: { vit: number; tir: number; pas: number; dri: number; def: number; phy: number }) {
  const map: [string, string, number][] = [
    ['VIT', 'SPEEDSTER', stats.vit],
    ['TIR', 'FINISSEUR', stats.tir],
    ['PAS', 'MAESTRO', stats.pas],
    ['DRI', 'DRIBBLEUR', stats.dri],
    ['DEF', 'ROCHE', stats.def],
    ['PHY', 'TANK', stats.phy],
  ];
  map.sort((a, b) => b[2] - a[2]);
  return map[0][1];
}

/* ─── Hexagon Radar ─────────────────────────────────────────────────────── */

function HexRadar({ stats, radius, accent, accentRgb }: {
  stats: number[];
  radius: number;
  accent: string;
  accentRgb: string;
}) {
  const cx = radius + 4;
  const cy = radius + 4;
  const svgSize = (radius + 4) * 2;

  const hexPoint = (i: number, r: number) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const hexPath = (r: number) =>
    Array.from({ length: 6 }, (_, i) => hexPoint(i, r))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(' ') + ' Z';

  const statPath = stats
    .map((v, i) => hexPoint(i, (v / 99) * radius))
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ') + ' Z';

  return (
    <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
      {/* Grid rings */}
      {[0.33, 0.66, 1].map((s) => (
        <path key={s} d={hexPath(radius * s)} fill="none" stroke={`rgba(${accentRgb},0.08)`} strokeWidth="0.5" />
      ))}
      {/* Axis lines */}
      {Array.from({ length: 6 }, (_, i) => {
        const [x, y] = hexPoint(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={`rgba(${accentRgb},0.06)`} strokeWidth="0.5" />;
      })}
      {/* Stat fill */}
      <path d={statPath} fill={`rgba(${accentRgb},0.15)`} stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Stat dots */}
      {stats.map((v, i) => {
        const [x, y] = hexPoint(i, (v / 99) * radius);
        return <circle key={i} cx={x} cy={y} r="2" fill={accent} />;
      })}
    </svg>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export function FUTCard({ player, size = 'md' }: FUTCardProps) {
  const s = SIZES[size];
  const tier = getTier(player.elo);

  const stats = useMemo(() => {
    const a = player.v2_answers;
    const vit = scaleStat(a?.q2);
    const tir = scaleStat(a?.q9);
    const pas = Math.round((scaleStat(a?.q4) + scaleStat(a?.q5)) / 2);
    const dri = scaleStat(a?.q3);
    const def = scaleStat(a?.q8);
    const phy = scaleStat(a?.q6);
    return { vit, tir, pas, dri, def, phy };
  }, [player.v2_answers]);

  const playerType = useMemo(() => getPlayerType(stats), [stats]);
  const initials = `${player.first_name.charAt(0)}${player.last_name.charAt(0)}`;

  const statEntries: [string, number][] = [
    ['VIT', stats.vit],
    ['TIR', stats.tir],
    ['PAS', stats.pas],
    ['DRI', stats.dri],
    ['DEF', stats.def],
    ['PHY', stats.phy],
  ];

  // Card clip-path: FUT card shield shape
  const clipPath = `polygon(
    8% 0%, 92% 0%, 100% 4%, 100% 88%,
    92% 96%, 50% 100%, 8% 96%, 0% 88%, 0% 4%
  )`;

  return (
    <div
      style={{
        width: s.w,
        height: s.h,
        position: 'relative',
        filter: `drop-shadow(0 0 ${size === 'lg' ? 24 : 12}px ${tier.glow})`,
        userSelect: 'none',
      }}
    >
      {/* Outer glow border */}
      <div
        style={{
          position: 'absolute',
          inset: -1,
          clipPath,
          background: `linear-gradient(160deg, ${tier.accent}40, ${tier.accent}10 40%, ${tier.accent}08 60%, ${tier.accent}30)`,
        }}
      />

      {/* Card body */}
      <div
        style={{
          position: 'absolute',
          inset: 1,
          clipPath,
          background: `linear-gradient(175deg, ${tier.bg1} 0%, ${tier.bg2} 60%, ${tier.bg1} 100%)`,
          overflow: 'hidden',
        }}
      >
        {/* Diagonal shine */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '-30%',
            width: '60%',
            height: '100%',
            background: `linear-gradient(105deg, transparent, ${tier.shine} 40%, transparent 60%)`,
            transform: 'skewX(-15deg)',
            pointerEvents: 'none',
          }}
        />

        {/* Subtle pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent ${s.gap + 3}px,
              rgba(255,255,255,0.008) ${s.gap + 3}px,
              rgba(255,255,255,0.008) ${s.gap + 4}px
            )`,
            pointerEvents: 'none',
          }}
        />

        {/* Top section: OVR + Type + Avatar */}
        <div
          style={{
            display: 'flex',
            padding: `${s.gap * 4 + 8}px ${s.gap * 4 + 6}px ${s.gap * 2 + 2}px`,
            gap: s.gap * 2 + 4,
            alignItems: 'flex-start',
          }}
        >
          {/* Left: ELO + type */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.gap + 1 }}>
            <div
              style={{
                ...DISPLAY,
                fontSize: s.ovr,
                lineHeight: 0.9,
                color: tier.accent,
                letterSpacing: '-0.02em',
                textShadow: `0 0 20px rgba(${tier.accentRgb},0.4)`,
              }}
            >
              {player.elo}
            </div>
            <div
              style={{
                ...DISPLAY,
                fontSize: s.type,
                color: `rgba(${tier.accentRgb},0.5)`,
                letterSpacing: '0.12em',
                lineHeight: 1,
              }}
            >
              {tier.label}
            </div>
          </div>

          {/* Right: Avatar */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt=""
                style={{
                  width: s.hex * 1.6,
                  height: s.hex * 1.6,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid rgba(${tier.accentRgb},0.25)`,
                  boxShadow: `0 0 16px rgba(${tier.accentRgb},0.15)`,
                }}
              />
            ) : (
              <div
                style={{
                  width: s.hex * 1.6,
                  height: s.hex * 1.6,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, rgba(${tier.accentRgb},0.12), rgba(${tier.accentRgb},0.04))`,
                  border: `2px solid rgba(${tier.accentRgb},0.2)`,
                  ...DISPLAY,
                  fontSize: s.hex * 0.55,
                  color: tier.accent,
                  letterSpacing: '0.02em',
                }}
              >
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* Name bar */}
        <div
          style={{
            textAlign: 'center',
            padding: `${s.gap + 2}px ${s.gap * 3 + 6}px`,
            borderTop: `1px solid rgba(${tier.accentRgb},0.1)`,
            borderBottom: `1px solid rgba(${tier.accentRgb},0.1)`,
            background: `rgba(${tier.accentRgb},0.03)`,
          }}
        >
          <div
            style={{
              ...DISPLAY,
              fontSize: s.name,
              color: '#F0F0F0',
              letterSpacing: '0.08em',
              lineHeight: 1.1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {player.first_name} {player.last_name}
          </div>
          <div
            style={{
              ...DISPLAY,
              fontSize: s.type,
              color: tier.accent,
              letterSpacing: '0.2em',
              marginTop: s.gap,
              lineHeight: 1,
            }}
          >
            {playerType}
          </div>
        </div>

        {/* Bottom section: Radar + Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${s.gap * 2 + 4}px ${s.gap * 3 + 4}px`,
            gap: s.gap * 2 + 4,
          }}
        >
          {/* Hex radar */}
          <div style={{ flexShrink: 0 }}>
            <HexRadar
              stats={[stats.vit, stats.tir, stats.pas, stats.dri, stats.def, stats.phy]}
              radius={s.hex}
              accent={tier.accent}
              accentRgb={tier.accentRgb}
            />
          </div>

          {/* Stats columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: `${s.gap + 1}px ${s.gap * 3 + 8}px`,
              flex: 1,
            }}
          >
            {statEntries.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: s.gap + 2 }}>
                <span
                  style={{
                    ...DISPLAY,
                    fontSize: s.stat,
                    color: value >= 80 ? tier.accent : value >= 50 ? '#CCC' : '#666',
                    lineHeight: 1,
                    minWidth: s.stat * 1.8,
                    textAlign: 'right',
                  }}
                >
                  {value}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: s.label,
                    fontWeight: 500,
                    color: `rgba(${tier.accentRgb},0.4)`,
                    letterSpacing: '0.06em',
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
