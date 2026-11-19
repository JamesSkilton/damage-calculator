import type { ReactNode } from 'react';
import type { GraphMovePrediction, ViewNode } from 'ai/runAndBunGraph';

interface Block {
  w: number;
  h: number;
  draw: (cx: number, y: number) => ReactNode;
}
interface Ctx {
  reach: Record<string, number>;
  selected?: string;
  onSelect: (node: ViewNode) => void;
}

const BLUE = '#2F5BD8';
const GREY = '#B9B6AC';
const FORK = 34;
const MERGE = 22;
const COL_GAP = 24;
const SEQ_GAP = 22;
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
const signed = (score: number) => (score < 0 ? `−${-score}` : `+${score}`);

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + word.length < max)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

const line = (key: string, d: string, active: boolean) => (
  <path
    key={key}
    d={d}
    fill="none"
    stroke={active ? BLUE : GREY}
    strokeWidth={active ? 2.5 : 1.5}
    strokeDasharray={active ? undefined : '4 4'}
  />
);

function sequence(nodes: ViewNode[], ctx: Ctx, emptyLabel: string): Block {
  if (nodes.length === 0) {
    return {
      w: 120,
      h: 26,
      draw: (cx, y) => (
        <g key={`empty-${y}`} fontSize="11" textAnchor="middle" fill="#5B6068">
          <rect
            x={cx - 60}
            y={y}
            width={120}
            height={26}
            rx={13}
            fill="#F1EFE8"
            stroke={GREY}
          />
          <text x={cx} y={y + 17}>
            {emptyLabel}
          </text>
        </g>
      ),
    };
  }
  const blocks = nodes.map((node) => block(node, ctx));
  return {
    w: Math.max(...blocks.map((b) => b.w)),
    h: blocks.reduce((sum, b) => sum + b.h, 0) + SEQ_GAP * (blocks.length - 1),
    draw: (cx, y) => {
      let top = y;
      return blocks.map((b, i) => {
        const at = top;
        top += b.h + SEQ_GAP;
        const active = (ctx.reach[nodes[i].id] ?? 0) > 0;
        return (
          <g key={nodes[i].id}>
            {i > 0 && line('in', `M${cx} ${at - SEQ_GAP}V${at}`, active)}
            {b.draw(cx, at)}
          </g>
        );
      });
    },
  };
}

function fork(
  head: { w: number; h: number; draw: (cx: number, y: number) => ReactNode },
  node: ViewNode,
  branches: { label: string; nodes: ViewNode[]; empty: string; key: string }[],
  ctx: Ctx,
): Block {
  const cols = branches.map((b) => sequence(b.nodes, ctx, b.empty));
  const total =
    cols.reduce((sum, c) => sum + c.w, 0) + COL_GAP * (cols.length - 1);
  const maxH = Math.max(...cols.map((c) => c.h));
  const reached = ctx.reach[node.id] ?? 0;
  return {
    w: Math.max(head.w, total),
    h: head.h + FORK + maxH + MERGE,
    draw: (cx, y) => {
      const bottom = y + head.h;
      const colTop = bottom + FORK;
      const mergeY = colTop + maxH + MERGE / 2;
      let left = cx - total / 2;
      return (
        <g key={node.id}>
          {head.draw(cx, y)}
          {branches.map((branch, i) => {
            const col = cols[i];
            const colCx = left + col.w / 2;
            left += col.w + COL_GAP;
            const taken = ctx.reach[`${node.id}:${branch.key}`] ?? 0;
            const active = taken > 0;
            return (
              <g key={branch.key}>
                {line(
                  'down',
                  `M${cx} ${bottom}V${bottom + 8}H${colCx}V${colTop}`,
                  active,
                )}
                <text
                  x={colCx + 6}
                  y={bottom + 24}
                  fontSize="10"
                  fontWeight="600"
                  fill={active ? BLUE : '#5B6068'}
                >
                  {branch.label}
                  {reached > 0 && active
                    ? ` · ${percent(taken / reached)}`
                    : ''}
                </text>
                <g opacity={active ? 1 : 0.4}>{col.draw(colCx, colTop)}</g>
                {line(
                  'merge',
                  `M${colCx} ${colTop + col.h}V${mergeY}H${cx}V${mergeY + MERGE / 2}`,
                  active,
                )}
              </g>
            );
          })}
        </g>
      );
    },
  };
}

function leaf(
  node: ViewNode,
  ctx: Ctx,
  text: string,
  tone: 'good' | 'bad',
): Block {
  const w = 200;
  const h = 28;
  const colors =
    tone === 'good'
      ? { fill: '#E3F3EA', stroke: '#1F7A4D', text: '#14533A' }
      : { fill: '#FBE9E7', stroke: '#B42318', text: '#8E1B10' };
  return {
    w,
    h,
    draw: (cx, y) => (
      <g
        key={node.id}
        role="button"
        tabIndex={0}
        aria-label={text}
        style={{ cursor: 'pointer' }}
        opacity={(ctx.reach[node.id] ?? 0) > 0 ? 1 : 0.45}
        onClick={() => ctx.onSelect(node)}
        onKeyDown={(event) => event.key === 'Enter' && ctx.onSelect(node)}
      >
        <rect
          x={cx - w / 2}
          y={y}
          width={w}
          height={h}
          rx={6}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={ctx.selected === node.id ? 3 : 1}
        />
        <text
          x={cx}
          y={y + 18}
          fontSize="11"
          fontWeight="600"
          textAnchor="middle"
          fill={colors.text}
        >
          {text}
        </text>
      </g>
    ),
  };
}

function block(node: ViewNode, ctx: Ctx): Block {
  if (node.kind === 'add')
    return leaf(
      node,
      ctx,
      `${signed(node.score)} · ${node.label}`,
      node.score < 0 ? 'bad' : 'good',
    );
  if (node.kind === 'never')
    return leaf(node, ctx, `NEVER · −20 · ${node.label}`, 'bad');

  const selected = ctx.selected === node.id;
  const select = () => ctx.onSelect(node);
  if (node.kind === 'condition') {
    const lines = wrap(node.label, 24);
    const head = {
      w: 240,
      h: 64 + Math.max(0, lines.length - 2) * 14,
      draw: (cx: number, y: number) => {
        const h = 64 + Math.max(0, lines.length - 2) * 14;
        return (
          <g
            role="button"
            tabIndex={0}
            aria-label={node.label}
            style={{ cursor: 'pointer' }}
            onClick={select}
            onKeyDown={(event) => event.key === 'Enter' && select()}
          >
            <polygon
              points={`${cx - 120},${y + h / 2} ${cx},${y} ${cx + 120},${y + h / 2} ${cx},${y + h}`}
              fill="#fff"
              stroke={BLUE}
              strokeWidth={selected ? 4 : 2}
            />
            <text
              fontSize="11"
              fontWeight="500"
              textAnchor="middle"
              fill="#1B1D21"
            >
              {lines.map((text, i) => (
                <tspan
                  key={i}
                  x={cx}
                  y={y + h / 2 + 4 - (lines.length - 1) * 6.5 + i * 13}
                >
                  {text}
                </tspan>
              ))}
            </text>
          </g>
        );
      },
    };
    return fork(
      head,
      node,
      [
        { label: 'Yes', nodes: node.yes, empty: 'no change', key: 'yes' },
        { label: 'No', nodes: node.no, empty: 'no change', key: 'no' },
      ],
      ctx,
    );
  }

  const head = {
    w: 60,
    h: 40,
    draw: (cx: number, y: number) => (
      <g
        role="button"
        tabIndex={0}
        aria-label="Chance node"
        style={{ cursor: 'pointer' }}
        onClick={select}
        onKeyDown={(event) => event.key === 'Enter' && select()}
      >
        <circle
          cx={cx}
          cy={y + 20}
          r={20}
          fill="#FFF4DC"
          stroke="#B7791F"
          strokeWidth={selected ? 4 : 2}
        />
        <text
          x={cx}
          y={y + 24}
          fontSize="11"
          fontWeight="600"
          textAnchor="middle"
          fill="#8A5A00"
        >
          RNG
        </text>
      </g>
    ),
  };
  return fork(
    head,
    node,
    node.branches.map((branch, i) => ({
      label: `${percent(branch.probability)} chance`,
      nodes: branch.nodes,
      empty: 'no change',
      key: String(i),
    })),
    ctx,
  );
}

export default function FlowGraph({
  move,
  selected,
  onSelect,
}: {
  move: GraphMovePrediction;
  selected?: string;
  onSelect: (node: ViewNode) => void;
}) {
  const ctx: Ctx = { reach: move.reach, selected, onSelect };
  const body = sequence(move.nodes, ctx, 'no rules');
  const result = move.scores
    .map(({ score, probability }) => `${score} at ${percent(probability)}`)
    .join(' · ');
  const width = Math.max(body.w, 320) + 40;
  const cx = width / 2;
  const startH = 34;
  const gap = 24;
  const endH = 56;
  const height = startH + gap + body.h + gap + endH + 8;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Decision graph for ${move.name}. Result: ${result}`}
      style={{
        width: '100%',
        minWidth: Math.min(width, 520),
        height: 'auto',
        display: 'block',
      }}
      fontFamily="inherit"
    >
      {line('start', `M${cx} ${startH}V${startH + gap}`, true)}
      <rect
        x={cx - 140}
        y={0}
        width={280}
        height={startH}
        rx={17}
        fill={BLUE}
      />
      <text
        x={cx}
        y={22}
        fontSize="13"
        fontWeight="600"
        textAnchor="middle"
        fill="#fff"
      >
        {move.name} · start at +0
      </text>
      {body.draw(cx, startH + gap)}
      {line(
        'end',
        `M${cx} ${startH + gap + body.h}V${startH + 2 * gap + body.h}`,
        true,
      )}
      <rect
        x={cx - 150}
        y={startH + 2 * gap + body.h}
        width={300}
        height={endH}
        rx={12}
        fill="#1B1D21"
      />
      <text
        x={cx}
        y={startH + 2 * gap + body.h + 22}
        fontSize="11"
        textAnchor="middle"
        fill="#C9C7BF"
      >
        Resulting score
      </text>
      <text
        x={cx}
        y={startH + 2 * gap + body.h + 42}
        fontSize="14"
        fontWeight="600"
        textAnchor="middle"
        fill="#fff"
      >
        {result}
      </text>
    </svg>
  );
}
