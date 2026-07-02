import type { LabLayout } from '../../services/layoutTypes';

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash;
}

export function getExecucaoBaseColor(execucao: string | null | undefined): string {
  return execucao === 'MO' ? '#d97706' : '#2563eb';
}

export function getRotaColor(rota: string | null | undefined, execucao?: string | null, layout?: LabLayout | null): string {
  if (!rota) return '#64748b';
  const idx = layout?.rotas.findIndex((item) => item.rota === rota) ?? -1;
  const seed = idx >= 0 ? idx : hashString(rota) % 19;
  const hue = Math.round((seed * 360) / 19) % 360;
  const kind = execucao || layout?.rotas.find((item) => item.rota === rota)?.execucao || 'MAQ';
  const saturation = kind === 'MO' ? 72 : 78;
  const lightness = kind === 'MO' ? 46 : 50;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function getNodeFill(rota: string | null | undefined, execucao?: string | null, layout?: LabLayout | null): string {
  const color = getRotaColor(rota, execucao, layout);
  return color.startsWith('hsl(') ? color.replace(/%\)$/, '%, 0.12)') : color;
}

export function getBottleneckStyles(active: boolean): { stroke: string; glow: string } {
  return active
    ? { stroke: '#dc2626', glow: 'rgba(220, 38, 38, 0.18)' }
    : { stroke: '#cbd5e1', glow: 'rgba(37, 99, 235, 0.08)' };
}

