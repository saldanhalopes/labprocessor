import React, { useState } from 'react';
import { AnalysisResult, Language, GlobalSettings } from '../../types';
import { Search, Beaker, FileText, ChevronDown, ChevronUp, Download, Save, Pill, ScrollText, Tag, FlaskConical, Bug, Trash2, Edit2, Check, X } from 'lucide-react';
import { generateCSV, isMicrobiology, calculateParallelLeadTime, recalculateRow } from '../../utils/calculations';
import { translations } from '../../utils/translations';

interface ResultsViewProps {
  results: AnalysisResult[];
  settings: GlobalSettings;
  language: Language;
  onDeleteResult: (fileId: string) => void;
  onUpdateResult: (result: AnalysisResult) => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ results, settings, language, onDeleteResult, onUpdateResult }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AnalysisResult | null>(null);
  
  const t = translations[language].results;

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEdit = (result: AnalysisResult) => {
    setEditingId(result.fileId);
    setEditForm({ ...result });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editingId && editForm) {
      onUpdateResult(editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    if (!editForm) return;
    
    // Support nested product updates
    if (field.startsWith('product.')) {
      const productField = field.split('.')[1];
      setEditForm({
        ...editForm,
        product: {
          ...editForm.product,
          [productField]: value
        }
      });
    } else {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const handleRowChange = (rowIndex: number, field: string, value: any) => {
    if (!editForm) return;
    const updatedRows = [...editForm.rows];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    
    // Recalcular a linha
    updatedRows[rowIndex] = recalculateRow(updatedRows[rowIndex], settings);
    
    setEditForm({ ...editForm, rows: updatedRows });
  };

  const handleDownloadCSV = () => {
    const csv = generateCSV(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `labprocessor_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveJSON = () => {
    const json = JSON.stringify(results, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `labprocessor_data_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResults = results.filter(res => 
    res.product.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    res.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Nenhum resultado para exibir. Carregue arquivos na aba "Carregar".</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleSaveJSON}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{t.saveJson}</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t.exportCsv}</span>
          </button>
        </div>
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 gap-6">
        {filteredResults.map((res) => {
          const physChemRows = res.rows.filter(row => !isMicrobiology(row));
          const microRows = res.rows.filter(row => isMicrobiology(row));

          const physChemSum = physChemRows.reduce((acc, r) => acc + r.totalTimeHours, 0);
          const physChemMax = physChemRows.length > 0 ? Math.max(...physChemRows.map(r => r.totalTimeHours)) : 0;

          const microSum = microRows.reduce((acc, r) => acc + r.totalTimeHours, 0);
          const microMax = microRows.length > 0 ? Math.max(...microRows.map(r => r.totalTimeHours)) : 0;

          const leadTime = calculateParallelLeadTime(res.rows);
          const totalWorkload = physChemSum + microSum;

          const physChemSumHH = physChemRows.reduce((acc, r) => acc + (r.manHours || 0), 0);
          const microSumHH = microRows.reduce((acc, r) => acc + (r.manHours || 0), 0);

          return (
          <div key={res.fileId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative group">
            {/* Delete Button (Absolute Position for better UX) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteResult(res.fileId);
              }}
              className="absolute top-4 right-4 p-2 bg-white text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shadow-sm border border-slate-100 z-10 opacity-0 group-hover:opacity-100"
              title={t.deleteBtn}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Card Header */}
            <div 
              className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-start justify-between cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => toggleRow(res.fileId)}
            >
              <div className="flex items-start gap-4 flex-1 pr-12"> {/* Added padding-right to avoid overlap with delete button */}
                <div className="bg-teal-100 p-3 rounded-lg hidden sm:block">
                  <Beaker className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {editingId === res.fileId ? (
                      <input
                        type="text"
                        value={editForm?.product.productName || ""}
                        onChange={(e) => handleFieldChange('product.productName', e.target.value)}
                        className="text-lg font-bold text-slate-800 bg-white border border-slate-300 px-2 py-1 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 className="text-lg font-bold text-slate-800">{res.product.productName || "Produto Desconhecido"}</h3>
                    )}
                    {editingId === res.fileId ? (
                      <input
                        type="text"
                        value={editForm?.product.code || ""}
                        onChange={(e) => handleFieldChange('product.code', e.target.value)}
                        placeholder="Cód"
                        className="px-2 py-1 bg-white border border-slate-300 text-slate-600 text-xs font-mono rounded w-20 outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      res.product.code && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs font-mono rounded">
                          {res.product.code}
                        </span>
                      )
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600 mt-2">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-slate-400" />
                      {editingId === res.fileId ? (
                        <input
                          type="text"
                          value={editForm?.product.pharmaceuticalForm || ""}
                          onChange={(e) => handleFieldChange('product.pharmaceuticalForm', e.target.value)}
                          placeholder="Forma Farmacêutica"
                          className="flex-1 bg-white border border-slate-300 px-2 py-1 rounded text-xs outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span>{res.product.pharmaceuticalForm || "-"}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-slate-400" />
                      {editingId === res.fileId ? (
                        <input
                          type="text"
                          value={editForm?.product.activePrinciples || ""}
                          onChange={(e) => handleFieldChange('product.activePrinciples', e.target.value)}
                          placeholder="Princípios Ativos"
                          className="flex-1 bg-white border border-slate-300 px-2 py-1 rounded text-xs outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate max-w-[200px]" title={res.product.activePrinciples}>
                          {res.product.activePrinciples || "-"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="truncate max-w-[200px]">{res.fileName}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 md:mt-0 flex flex-col items-end gap-3 pl-6 border-l border-slate-200 min-w-[220px]">
                <div className="text-right space-y-3 w-full">
                  <div title="Maior tempo entre Físico-Químico e Microbiologia (Análise em Paralelo)">
                    <p className="text-[10px] text-teal-600 uppercase font-black tracking-widest mb-1">{t.totalTime}</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">
                      {leadTime.toFixed(2)}
                      <span className="text-sm font-medium ml-1 text-slate-500">h</span>
                    </p>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-100" title="Soma de todos os tempos individuais (Análise Sequencial)">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">{t.workloadTime}</p>
                    <p className="text-base font-bold text-slate-600 leading-none">
                      {totalWorkload.toFixed(1)}
                      <span className="text-[10px] font-medium ml-0.5 text-slate-400">h</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 w-full mt-1">
                  <div className="flex items-center justify-between gap-3 px-2 py-1 bg-white border border-slate-100 rounded-lg shadow-sm" title={t.physChem}>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">{t.physChem}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-teal-600" title="Individual Máximo (Lead Time)">{physChemMax.toFixed(1)}h</span>
                      <span className="text-[8px] text-slate-400" title="Soma da Carga">{physChemSum.toFixed(1)}h</span>
                      <span className="text-[8px] text-indigo-400 font-bold" title="Soma de Horas-Homem">{physChemSumHH.toFixed(1)} HH</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-2 py-1 bg-pink-50/50 border border-pink-100 rounded-lg shadow-xs" title={t.micro}>
                    <div className="flex items-center gap-1.5 text-pink-600">
                      <Bug className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-tight">{t.micro}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black text-pink-700" title="Individual Máximo (Lead Time)">{microMax.toFixed(1)}h</span>
                      <span className="text-[8px] text-pink-300" title="Soma da Carga">{microSum.toFixed(1)}h</span>
                      <span className="text-[8px] text-indigo-400 font-bold" title="Soma de Horas-Homem">{microSumHH.toFixed(1)} HH</span>
                    </div>
                  </div>
                </div>

                <div className="mt-1 flex gap-2">
                  {editingId === res.fileId ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                        className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm flex items-center gap-1 text-xs font-bold"
                      >
                        <Check className="w-4 h-4" />
                        <span>Salvar</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                        className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 flex items-center gap-1 text-xs font-bold"
                      >
                        <X className="w-4 h-4" />
                        <span>Cancelar</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(res); }}
                      className="p-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs flex items-center gap-1 text-xs font-bold transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                  )}
                  <div className="ml-2 flex items-center">
                    {expandedRows[res.fileId] ? <ChevronUp className="text-slate-400 w-5 h-5" /> : <ChevronDown className="text-slate-400 w-5 h-5" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedRows[res.fileId] && (
              <div className="p-0 border-t border-slate-100">
                {/* Composition Section */}
                {res.product.composition && (
                  <div className="px-6 py-4 bg-slate-50/30 border-b border-slate-100 flex items-start gap-3 text-sm text-slate-600">
                    <ScrollText className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <p><span className="font-bold text-slate-700">{t.composition}:</span> {res.product.composition}</p>
                  </div>
                )}

                {/* Table Section helper */}
                {(() => {
                  const sourceRows = (editingId === res.fileId && editForm) ? editForm.rows : res.rows;
                  const physChemRows = sourceRows.filter(row => !isMicrobiology(row));
                  const microRows = sourceRows.filter(row => isMicrobiology(row));

                  const renderTable = (rows: any[], title: string, icon: React.ReactNode, type: 'phys' | 'micro') => (
                    <div className="mt-4">
                      <div className={`px-6 py-2 flex items-center gap-2 ${type === 'phys' ? 'bg-teal-50 text-teal-800' : 'bg-pink-50 text-pink-800'} border-y border-slate-100`}>
                        {icon}
                        <h4 className="font-bold text-xs uppercase tracking-widest">{title}</h4>
                        <span className="ml-auto text-[10px] font-bold bg-white/50 px-2 py-0.5 rounded-full border border-current opacity-70">
                          {rows.length} {rows.length === 1 ? 'Teste' : 'Testes'}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50/50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-3">{t.table.test}</th>
                              <th className="px-6 py-3">{t.table.technique}</th>
                              <th className="px-6 py-3 text-right">{t.table.prep}</th>
                              <th className="px-6 py-3 text-right">{t.table.run}</th>
                              <th className="px-6 py-3 text-right">{t.table.calc}</th>
                              <th className="px-6 py-3 text-right">{t.table.incub}</th>
                              <th className="px-6 py-3 text-right">{t.table.total}</th>
                              <th className="px-6 py-3 text-right">HH</th>
                              <th className="px-6 py-3 w-1/4">{t.table.rationale}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map((row, idx) => {
                              // Find original index in sourceRows for handleRowChange
                              const originalIdx = sourceRows.findIndex(r => r === row);
                              const isEditingItem = editingId === res.fileId;

                              return (
                                <tr key={idx} className={`hover:bg-slate-50 transition-colors ${type === 'micro' ? 'bg-pink-50/10' : ''}`}>
                                  <td className="px-6 py-4 font-bold text-slate-800">
                                    {isEditingItem ? (
                                      <input
                                        type="text"
                                        value={row.testName}
                                        onChange={(e) => handleRowChange(originalIdx, 'testName', e.target.value)}
                                        className="w-full bg-white border border-slate-300 px-2 py-1 rounded text-sm outline-none font-bold"
                                      />
                                    ) : row.testName}
                                  </td>
                                  <td className="px-6 py-4">
                                    {isEditingItem ? (
                                      <input
                                        type="text"
                                        value={row.technique}
                                        onChange={(e) => handleRowChange(originalIdx, 'technique', e.target.value)}
                                        className="w-full bg-white border border-slate-300 px-2 py-1 rounded text-[10px] uppercase font-bold outline-none"
                                      />
                                    ) : (
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                                        type === 'micro' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-teal-50 text-teal-700 border-teal-100'
                                      }`}>
                                        {row.technique}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right text-slate-600 font-mono text-xs">
                                    {isEditingItem ? (
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={row.t_prep}
                                        onChange={(e) => handleRowChange(originalIdx, 't_prep', parseFloat(e.target.value) || 0)}
                                        className="w-16 text-right bg-white border border-slate-300 px-1 py-1 rounded text-xs outline-none font-mono"
                                      />
                                    ) : row.t_prep}
                                  </td>
                                  <td className="px-6 py-4 text-right text-slate-600 font-mono text-xs">
                                    {isEditingItem ? (
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={row.t_run}
                                        onChange={(e) => handleRowChange(originalIdx, 't_run', parseFloat(e.target.value) || 0)}
                                        className="w-16 text-right bg-white border border-slate-300 px-1 py-1 rounded text-xs outline-none font-mono"
                                      />
                                    ) : row.t_run}
                                  </td>
                                  <td className="px-6 py-4 text-right text-slate-600 font-mono text-xs">
                                    {isEditingItem ? (
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={row.t_calc}
                                        onChange={(e) => handleRowChange(originalIdx, 't_calc', parseFloat(e.target.value) || 0)}
                                        className="w-16 text-right bg-white border border-slate-300 px-1 py-1 rounded text-xs outline-none font-mono"
                                      />
                                    ) : row.t_calc}
                                  </td>
                                  <td className={`px-6 py-4 text-right font-mono text-xs ${type === 'micro' ? 'text-pink-600 font-bold' : 'text-slate-300'}`}>
                                    {isEditingItem ? (
                                      type === 'micro' ? (
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={row.t_incubation || 0}
                                          onChange={(e) => handleRowChange(originalIdx, 't_incubation', parseFloat(e.target.value) || 0)}
                                          className="w-16 text-right bg-white border border-slate-300 px-1 py-1 rounded text-xs outline-none font-mono font-bold text-pink-600"
                                        />
                                      ) : '-'
                                    ) : (type === 'micro' ? row.t_incubation : '-')}
                                  </td>
                                  <td className={`px-6 py-4 text-right font-black ${type === 'micro' ? 'text-pink-700' : 'text-slate-900'}`}>
                                    {isEditingItem ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={row.totalTimeHours}
                                        onChange={(e) => handleRowChange(originalIdx, 'totalTimeHours', parseFloat(e.target.value) || 0)}
                                        className="w-20 text-right bg-teal-50 border border-teal-200 px-1 py-1 rounded text-xs outline-none font-black"
                                      />
                                    ) : row.totalTimeHours.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                      <span className="text-indigo-600 font-black text-xs font-mono">
                                        {(row.manHours || 0).toFixed(2)}h
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-400">
                                        {row.totalTimeHours > 0 ? ((row.manHours / row.totalTimeHours) * 100).toFixed(0) : 0}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-xs text-slate-500 italic leading-snug">
                                    {isEditingItem ? (
                                      <textarea
                                        value={row.rationale}
                                        onChange={(e) => handleRowChange(originalIdx, 'rationale', e.target.value)}
                                        className="w-full bg-white border border-slate-300 px-2 py-1 rounded text-[10px] outline-none h-10 resize-none"
                                      />
                                    ) : row.rationale}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );

                  return (
                    <div className="pb-4">
                      {physChemRows.length > 0 && renderTable(physChemRows, t.physChem, <FlaskConical className="w-4 h-4" />, 'phys')}
                      {microRows.length > 0 && renderTable(microRows, t.micro, <Bug className="w-4 h-4" />, 'micro')}

                      {/* Images Gallery */}
                      {res.images && res.images.length > 0 && (
                        <div className="mt-8 px-6 pb-6">
                          <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-4 h-4 text-teal-600" />
                            <h4 className="font-bold text-xs uppercase tracking-widest text-slate-700">{t.imagesTitle}</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {res.images.map((img, index) => (
                              <div key={index} className="group relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                <img 
                                  src={img.startsWith('http') ? img : `http://localhost:5000/images/${img}`} 
                                  alt={`Extração ${index + 1}`}
                                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=Imagem+indisponivel';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <a 
                                    href={img.startsWith('http') ? img : `http://localhost:5000/images/${img}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2 bg-white rounded-full text-slate-800 hover:bg-teal-50 shadow-lg"
                                  >
                                    <Download className="w-5 h-5" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 font-medium">
                  {t.footer}
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};
