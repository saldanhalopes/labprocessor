import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import { Clock, AlertTriangle, CheckCircle2, FileBarChart, BarChart3, Table as TableIcon, FlaskConical, Bug } from 'lucide-react';
import { TimeDistributionChart } from './TimeDistributionChart';
import { isMicrobiology } from '../utils/calculations';

interface ResultsTableProps {
  data: AnalysisResult;
  onReset: () => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ data, onReset }) => {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  return (
    <div className="w-full max-w-5xl mx-auto animate-fade-in">
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tempo Total</p>
            <p className="text-2xl font-bold text-slate-800">{data.totalTime.toFixed(1)} h</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-teal-100 p-3 rounded-lg">
            <FlaskConical className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Físico-Químico</p>
            <p className="text-2xl font-bold text-slate-800">{data.totalTimePhysChem.toFixed(1)} h</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-pink-100 p-3 rounded-lg">
            <Bug className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Microbiologia</p>
            <p className="text-2xl font-bold text-slate-800">{data.totalTimeMicro.toFixed(1)} h</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-lg">
            <FileBarChart className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total de Ensaios</p>
            <p className="text-2xl font-bold text-slate-800">{data.rows.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Detalhamento Analítico por Lote</h3>
          
          <div className="flex bg-slate-200 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title="Visualização em Tabela"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              title="Visualização Gráfica"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-0">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 w-16">Nº</th>
                    <th className="px-6 py-3">Ensaio / Teste</th>
                    <th className="px-6 py-3">Técnica</th>
                    <th className="px-6 py-3 w-1/3">Detalhes Operacionais</th>
                    <th className="px-6 py-3 text-right">Tempo (h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row, index) => {
                    const isMicro = isMicrobiology(row);
                    return (
                      <tr key={index} className={`hover:bg-slate-50 transition-colors ${isMicro ? 'bg-pink-50/30' : ''}`}>
                        <td className="px-6 py-4 text-slate-500 font-mono">{row.id}</td>
                        <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-2">
                          {isMicro && <Bug className="w-3 h-3 text-pink-500" />}
                          {row.testName}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isMicro ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-800'}`}>
                            {row.technique}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs leading-relaxed">{row.details}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-700">
                          {row.totalTimeHours.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-right uppercase tracking-wider text-xs">Tempo Total por Lote</td>
                    <td className="px-6 py-4 text-right text-lg text-teal-700">{data.totalTime.toFixed(1)} h</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <h4 className="text-sm font-medium text-slate-500 mb-4 text-center">Distribuição de Tempo por Ensaio</h4>
              <TimeDistributionChart data={data.rows} />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pb-12">
        <button
          onClick={onReset}
          className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-md font-medium"
        >
          Analisar Novo Documento
        </button>
      </div>
    </div>
  );
};
