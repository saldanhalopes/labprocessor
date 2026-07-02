import React from 'react';
import type { LabLayout } from '../../services/layoutTypes';
import type { RouteTreeModel } from '../../services/routeTree';
import { getRotaColor } from './routeVisuals';

interface Props {
  model: RouteTreeModel;
  layout: LabLayout | null;
  selectedRoute: string | null;
  mode: 'structure' | 'gargalo' | 'layout';
  onRouteSelect: (rota: string) => void;
}

export const RouteTreeMiniMap: React.FC<Props> = ({ model, layout, selectedRoute, mode, onRouteSelect }) => {
  if (!layout) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Mini mapa indisponivel. O layout do laboratorio nao foi carregado.
      </div>
    );
  }

  const usedRoutes = new Set(model.orderedRoutes);
  const scale = 0.28;
  const width = layout.canvas.width * scale;
  const height = layout.canvas.height * scale;

  const orderMap = new Map<string, number>();
  model.orderedRoutes.forEach((rota, index) => orderMap.set(rota, index + 1));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3">
        <h4 className="text-sm font-bold text-slate-800">Mini mapa do laboratorio</h4>
        <p className="mt-1 text-xs text-slate-500">Rotas destacadas no espaco fisico do layout.</p>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {layout.zones.map((zone) => (
          <g key={zone.nome}>
            <rect
              x={zone.x * scale}
              y={zone.y * scale}
              width={zone.width * scale}
              height={zone.height * scale}
              rx={10}
              fill={zone.color}
              fillOpacity={mode === 'layout' ? 0.12 : 0.06}
              stroke={zone.color}
              strokeOpacity="0.25"
            />
            <text x={zone.x * scale + 8} y={zone.y * scale + 14} fontSize="8" fontWeight="700" fill="#334155">
              {zone.nome}
            </text>
          </g>
        ))}

        {model.orderedRoutes.map((rota, index) => {
          const current = layout.rotas.find((item) => item.rota === rota);
          const next = layout.rotas.find((item) => item.rota === model.orderedRoutes[index + 1]);
          if (!current || !next) return null;
          return (
            <line
              key={`${rota}-${index}`}
              x1={(current.x + layout.stationWidth / 2) * scale}
              y1={(current.y + layout.stationHeight / 2) * scale}
              x2={(next.x + layout.stationWidth / 2) * scale}
              y2={(next.y + layout.stationHeight / 2) * scale}
              stroke={selectedRoute === rota || selectedRoute === next.rota ? '#0f172a' : '#94a3b8'}
              strokeWidth={selectedRoute === rota || selectedRoute === next.rota ? 2.5 : 1.2}
              strokeDasharray="4 3"
              strokeOpacity="0.8"
            />
          );
        })}

        {layout.rotas.map((rota) => {
          const used = usedRoutes.has(rota.rota);
          if (!used) {
            return (
              <rect
                key={rota.rota}
                x={rota.x * scale}
                y={rota.y * scale}
                width={layout.stationWidth * scale}
                height={layout.stationHeight * scale}
                rx={6}
                fill="#f8fafc"
                stroke="#e2e8f0"
              />
            );
          }
          const active = selectedRoute === rota.rota;
          const color = getRotaColor(rota.rota, rota.execucao, layout);
          return (
            <g key={rota.rota} onClick={() => onRouteSelect(rota.rota)} style={{ cursor: 'pointer' }}>
              <rect
                x={rota.x * scale}
                y={rota.y * scale}
                width={layout.stationWidth * scale}
                height={layout.stationHeight * scale}
                rx={7}
                fill={color}
                fillOpacity={active || mode === 'layout' ? 0.22 : 0.14}
                stroke={active ? '#0f172a' : color}
                strokeWidth={active ? 2 : 1.4}
              />
              <text x={rota.x * scale + 6} y={rota.y * scale + 14} fontSize="7.5" fontWeight="700" fill="#0f172a">
                {rota.rota.length > 16 ? `${rota.rota.slice(0, 16)}...` : rota.rota}
              </text>
              <circle
                cx={(rota.x + layout.stationWidth - 16) * scale}
                cy={(rota.y + 16) * scale}
                r={8}
                fill="#ffffff"
                stroke={color}
              />
              <text
                x={(rota.x + layout.stationWidth - 16) * scale}
                y={(rota.y + 18) * scale}
                fontSize="7"
                fontWeight="800"
                textAnchor="middle"
                fill="#0f172a"
              >
                {orderMap.get(rota.rota)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

