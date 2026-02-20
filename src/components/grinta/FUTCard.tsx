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

const BODY: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
};

const SIZES = {
  sm: { w: 150, h: 230, ovr: 32, name: 11, stat: 11, label: 6, type: 6, avatar: 40, hex: 28, pad: 8 },
  md: { w: 220, h: 340, ovr: 48, name: 16, stat: 15, label: 8, type: 9, avatar: 60, hex: 40, pad: 12 },
  lg: { w: 300, h: 460, ovr: 64, name: 22, stat: 19, label: 10, type: 12, avatar: 80, hex: 55, pad: 16 },
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
  const map: [string, number][] = [
    ['SPEEDSTER', stats.vit],
    ['FINISSEUR', stats.tir],
    ['MAESTRO', stats.pas],
    ['DRIBBLEUR', stats.dri],
    ['ROCHE', stats.def],
    ['TANK', stats.phy],
  ];
  map.sort((a, b) => b[1] - a[1]);
  return map[0][0];
}

/* ─── Hexagon Radar with Labels ─────────────────────────────────────────── */

function HexRadar({ stats, labels, radius, accent, accentRgb, labelSize }: {
  stats: number[];
  labels: string[];
  radius: number;
  accent: string;
  accentRgb: string;
  labelSize: number;
}) {
  const margin = labelSize + 10;
  const cx = radius + margin;
  const cy = radius + margin;
  const svgSize = (radius + margin) * 2;

  const hexPoint = (i: number, r: number): [number, number] => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const hexPath = (r: number) =>
    Array.from({ length: 6 }, (_, i) => hexPoint(i, r))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(' ') + ' Z';

  const statPath = stats
    .map((v, i) => hexPoint(i, Math.max((v / 99) * radius, 2)))
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ') + ' Z';

  return (
    <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
      {[0.33, 0.66, 1].map((s) => (
        <path key={s} d={hexPath(radius * s)} fill="none" stroke={`rgba(${accentRgb},0.1)`} strokeWidth="0.6" />
      ))}
      {Array.from({ length: 6 }, (_, i) => {
        const [x, y] = hexPoint(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={`rgba(${accentRgb},0.07)`} strokeWidth="0.5" />;
      })}
      <path d={statPath} fill={`rgba(${accentRgb},0.18)`} stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
      {stats.map((v, i) => {
        const [x, y] = hexPoint(i, Math.max((v / 99) * radius, 2));
        return <circle key={i} cx={x} cy={y} r="2.5" fill={accent} />;
      })}
      {/* Vertex labels */}
      {labels.map((label, i) => {
        const [x, y] = hexPoint(i, radius + labelSize + 2);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              ...DISPLAY,
              fontSize: labelSize,
              fill: `rgba(${accentRgb},0.5)`,
              letterSpacing: '0.05em',
            }}
          >
            {label}
          </text>
        );
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

  const statGrid: [string, number][] = [
    ['VIT', stats.vit], ['TIR', stats.tir], ['PAS', stats.pas],
    ['DRI', stats.dri], ['DEF', stats.def], ['PHY', stats.phy],
  ];

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
        filter: `drop-shadow(0 0 ${size === 'lg' ? 20 : 10}px ${tier.glow})`,
        userSelect: 'none',
      }}
    >
      {/* Border glow */}
      <div
        style={{
          position: 'absolute',
          inset: -1,
          clipPath,
          background: `linear-gradient(160deg, ${tier.accent}50, ${tier.accent}10 40%, ${tier.accent}08 60%, ${tier.accent}35)`,
        }}
      />

      {/* Card body */}
      <div
        style={{
          position: 'absolute',
          inset: 1,
          clipPath,
          background: `linear-gradient(175deg, ${tier.bg1} 0%, ${tier.bg2} 55%, ${tier.bg1} 100%)`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Shine streak */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '-40%',
            width: '50%',
            height: '100%',
            background: `linear-gradient(108deg, transparent 30%, ${tier.shine} 50%, transparent 70%)`,
            transform: 'skewX(-12deg)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Scanline texture */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px)`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* ── Top: ELO + Avatar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            padding: `${s.pad}px ${s.pad}px ${s.pad * 0.5}px`,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* ELO + tier */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flexShrink: 0 }}>
            <div
              style={{
                ...DISPLAY,
                fontSize: s.ovr,
                lineHeight: 0.85,
                color: tier.accent,
                letterSpacing: '-0.03em',
                textShadow: `0 0 24px rgba(${tier.accentRgb},0.5)`,
              }}
            >
              {player.elo}
            </div>
            <div
              style={{
                ...DISPLAY,
                fontSize: s.type,
                color: `rgba(${tier.accentRgb},0.45)`,
                letterSpacing: '0.15em',
                marginTop: 2,
              }}
            >
              {tier.label}
            </div>
          </div>

          {/* Avatar — centered in remaining space */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt=""
                style={{
                  width: s.avatar,
                  height: s.avatar,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid rgba(${tier.accentRgb},0.25)`,
                  boxShadow: `0 0 16px rgba(${tier.accentRgb},0.2)`,
                }}
              />
            ) : (
              <div
                style={{
                  width: s.avatar,
                  height: s.avatar,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, rgba(${tier.accentRgb},0.15), rgba(${tier.accentRgb},0.04))`,
                  border: `2px solid rgba(${tier.accentRgb},0.2)`,
                  ...DISPLAY,
                  fontSize: s.avatar * 0.38,
                  color: tier.accent,
                }}
              >
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* ── Name bar ── */}
        <div
          style={{
            textAlign: 'center',
            padding: `${size === 'sm' ? 3 : 5}px ${s.pad}px`,
            borderTop: `1px solid rgba(${tier.accentRgb},0.1)`,
            borderBottom: `1px solid rgba(${tier.accentRgb},0.1)`,
            background: `rgba(${tier.accentRgb},0.03)`,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            style={{
              ...DISPLAY,
              fontSize: s.name,
              color: '#F0F0F0',
              letterSpacing: '0.06em',
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
              letterSpacing: '0.18em',
              marginTop: 1,
              lineHeight: 1,
            }}
          >
            {playerType}
          </div>
        </div>

        {/* ── Hex Radar (centered) ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
            minHeight: 0,
          }}
        >
          <HexRadar
            stats={[stats.vit, stats.tir, stats.pas, stats.dri, stats.def, stats.phy]}
            labels={['VIT', 'TIR', 'PAS', 'DRI', 'DEF', 'PHY']}
            radius={s.hex}
            accent={tier.accent}
            accentRgb={tier.accentRgb}
            labelSize={s.label}
          />
        </div>

        {/* ── Stats Grid (3×2) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            padding: `0 ${s.pad}px ${s.pad + 4}px`,
            gap: size === 'sm' ? 2 : 4,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {statGrid.map(([label, value]) => (
            <div
              key={label}
              style={{
                textAlign: 'center',
                padding: size === 'sm' ? '2px 0' : '3px 0',
                borderRadius: 4,
                background: `rgba(${tier.accentRgb},0.04)`,
              }}
            >
              <div
                style={{
                  ...DISPLAY,
                  fontSize: s.stat,
                  lineHeight: 1.1,
                  color: value >= 80 ? tier.accent : value >= 60 ? '#DDD' : value >= 40 ? '#999' : '#555',
                }}
              >
                {value}
              </div>
              <div
                style={{
                  ...BODY,
                  fontSize: s.label,
                  fontWeight: 600,
                  color: `rgba(${tier.accentRgb},0.35)`,
                  letterSpacing: '0.08em',
                  lineHeight: 1,
                  marginTop: 1,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
