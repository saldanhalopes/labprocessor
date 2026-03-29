import React from 'react';
import { GlobalSettings, Language } from '../../types';
import { Save, Database, Trash2 } from 'lucide-react';
import { translations } from '../../utils/translations';
import { useToast } from '../../context/ToastContext';

interface SettingsViewProps {
  settings: GlobalSettings;
  onSave: (newSettings: GlobalSettings) => void;
  onClearDb: () => void;
  language: Language;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, onClearDb, language }) => {
  const [localSettings, setLocalSettings] = React.useState<GlobalSettings>(settings);
  const { showToast } = useToast();
  const t = translations[language].settings;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localSettings);
    showToast(t.toastSuccess, "success");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      
      {/* Calculation Parameters */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-6">{t.title}</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.labArea}</label>
              <input
                type="number"
                name="area"
                value={localSettings.area}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.velocity}</label>
              <input
                type="number"
                name="velocity"
                value={localSettings.velocity}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.alpha}</label>
              <input
                type="number"
                name="alpha"
                value={localSettings.alpha}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.setupFactor}</label>
              <input
                type="number"
                name="setupFactor"
                value={localSettings.setupFactor}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.registerFactor}</label>
              <input
                type="number"
                step="0.1"
                name="registerFactor"
                value={localSettings.registerFactor}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Management Parameters (HH) */}
          <div className="pt-6 border-t border-slate-100 space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-widest text-xs">
              <Database className="w-4 h-4" />
              <span>{t.labels.managementParams}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.efficiency}</label>
                <input
                  type="number"
                  step="0.01"
                  name="labEfficiency"
                  value={localSettings.labEfficiency}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t.help.efficiency}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.dailyWorkday}</label>
                <input
                  type="number"
                  name="dailyAvailableMinutes"
                  value={localSettings.dailyAvailableMinutes}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t.help.workday}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.runIntervention}</label>
                <input
                  type="number"
                  step="0.01"
                  name="factorRun"
                  value={localSettings.factorRun}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t.help.run}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t.labels.incubationIntervention}</label>
                <input
                  type="number"
                  step="0.01"
                  name="factorIncubation"
                  value={localSettings.factorIncubation}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">{t.help.incubation}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              <Save className="w-5 h-5" />
              {t.saveParams}
            </button>
          </div>
        </form>
        
        <div className="mt-6 bg-slate-50 p-4 rounded-lg text-xs text-slate-500 space-y-2">
          <p className="font-semibold mb-1 uppercase tracking-wider text-[10px] text-slate-400">{t.formulasTitle}</p>
          <p><strong>{t.formulaLocomotion}:</strong> (Alpha * √Area) / Velocidade</p>
          <p><strong>{t.formulaTotalLeadTime}:</strong> {t.formulaLocomotion} + {t.formulaSetup} + {t.formulaPrep} + Análise + {t.formulaRun} + {t.formulaCalc} + ({t.formulaCalc} * {t.formulaFactorRegister}) + {t.formulaIncubation}</p>
          <p><strong>{t.formulaTotalHH}:</strong> {t.formulaLocomotion} + {t.formulaSetup} + {t.formulaPrep} + Análise + ({t.formulaRun} * {t.formulaFactorRun}) + {t.formulaCalc} + ({t.formulaCalc} * {t.formulaFactorRegister}) + ({t.formulaIncubation} * {t.formulaFactorIncubation})</p>
          <p><strong>{t.formulaHeadcount}:</strong> (Σ{t.formulaTotalHH} * 60) / (Jornada * Eficiência)</p>
        </div>
      </div>

      {/* Database Management */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-teal-600" />
          <h3 className="text-xl font-bold text-slate-800">{t.dbTitle}</h3>
        </div>
        
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-800">{t.dbSectionTitle}</p>
            <p className="text-xs text-red-600">{t.dbSectionSubtitle}</p>
          </div>
          <button
            onClick={onClearDb}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            {t.clearDb}
          </button>
        </div>
      </div>

    </div>
  );
};
