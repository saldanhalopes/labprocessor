import React, { useState } from 'react';
import { AnalysisResult } from '../../types';
import { FlaskConical, ScrollText, LayoutGrid, Cpu } from 'lucide-react';
import { ReagentsView } from './ReagentsView';
import StandardsView from './StandardsView';
import ChromatographicColumnsView from './ChromatographicColumnsView';

interface MaterialsViewProps {
  results: AnalysisResult[];
}

type SubTab = 'reagents' | 'standards' | 'columns' | 'equipments';

export const MaterialsView: React.FC<MaterialsViewProps> = ({ results }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('reagents');

  const subTabs = [
    { id: 'reagents', label: 'Reagentes e Materiais', icon: FlaskConical },
    { id: 'standards', label: 'Padrões de Referência', icon: ScrollText },
    { id: 'columns', label: 'Colunas Cromatográficas', icon: LayoutGrid },
    { id: 'equipments', label: 'Equipamentos', icon: Cpu },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Sub-Navigation Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex gap-1 shadow-inner">
          {subTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as SubTab)}
                className={`
                  px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2
                  ${isActive 
                    ? 'bg-white text-teal-700 shadow-md ring-1 ring-slate-200' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Sub-Views */}
      <div className="transition-all duration-300">
        {activeSubTab === 'reagents' && <ReagentsView results={results} forceMode="materials" />}
        {activeSubTab === 'standards' && <StandardsView results={results} />}
        {activeSubTab === 'columns' && <ChromatographicColumnsView results={results} />}
        {activeSubTab === 'equipments' && <ReagentsView results={results} forceMode="equipments" />}
      </div>
    </div>
  );
};
