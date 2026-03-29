import React, { useState, useEffect } from 'react';
import { Upload, Eye, BarChart3, History, Settings, Download, Loader2, Cpu, FlaskConical, LogOut, UserCircle, Shield, Globe, AlertTriangle, ScrollText, MessageSquare, Calculator, TrendingUp } from 'lucide-react';
import { FileUpload } from '../FileUpload';
import { ResultsView } from './ResultsView';
import { PlanningView } from './PlanningView';
import { SettingsView } from './SettingsView';
import { analyzeDocument } from '../../services/geminiService';
import { extractPdfImages } from '../../utils/pdfImages';
import { saveToPinecone } from '../../services/pineconeService';
import { saveResultToDb, getResultsFromDb, deleteResultFromDb, clearDbResults, checkFileExists, updateResultInDb } from '../../services/dbService';
import { AnalysisResult, GlobalSettings, HistoryItem, User, Language } from '../../types';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_SETTINGS, generateCSV, recalculateRow, isMicrobiology, calculateParallelLeadTime } from '../../utils/calculations';
import { translations } from '../../utils/translations';
import { auth } from '../../firebase';
import { getIdToken } from 'firebase/auth';

type Tab = 'dashboard' | 'upload' | 'view' | 'planning' | 'reagents' | 'standards' | 'charts' | 'history' | 'settings' | 'profile' | 'admin' | 'download';

interface DashboardProps {
  onLogout: () => void;
  user: User;
  onUpdateUser: (user: User) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Dashboard = ({ onLogout, user, onUpdateUser, language, onLanguageChange }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  console.log("[Dashboard] Active Tab:", activeTab);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const t = translations[language];

  useEffect(() => {
    const loadInitialData = async () => {
      const savedSettings = localStorage.getItem('pharmaqc_settings');
      if (savedSettings) setSettings(JSON.parse(savedSettings));

      const token = user.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);

      getResultsFromDb(token).then(dbResults => {
        if (dbResults && dbResults.length > 0) {
          setResults(dbResults);
        }
      }).finally(() => {
        setIsInitialLoading(false);
      });
    };

    loadInitialData();
  }, [user]);

  const handleFilesSelect = async (files: File[]) => {
    setIsLoading(true);
    setProgress(0);
    const newResults: AnalysisResult[] = [];
    let processedCount = 0;

    const token = user.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);

    for (const file of files) {
      try {
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });

        const images = await extractPdfImages(file);
        const result = await analyzeDocument(base64Data, file.type, file.name, settings, language, images, token);
        newResults.push(result);

        await saveToPinecone(result, token);
        await saveResultToDb(result, token);

      } catch (error: any) {
        console.error(`Error processing ${file.name}:`, error);
        showToast(`Erro ao processar ${file.name}: ${error.message || 'Erro desconhecido'}`, 'error');
      } finally {
        processedCount++;
        setProgress(Math.round((processedCount / files.length) * 100));
      }
    }

    setResults(prev => [...newResults, ...prev]);
    setIsLoading(false);
    setActiveTab('view');
  };

  const handleDeleteResult = async (fileId: string) => {
    const token = user.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);
    if (window.confirm(t.results.deleteConfirm)) {
      setResults(prev => prev.filter(r => r.fileId !== fileId));
      await deleteResultFromDb(fileId, token);
    }
  };

  const handleUpdateResult = async (updatedResult: AnalysisResult) => {
    const token = user.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);
    await updateResultInDb(updatedResult.fileId, updatedResult, token);
    setResults(prev => prev.map(r => r.fileId === updatedResult.fileId ? updatedResult : r));
  };

  const handleSaveSettings = (newSettings: GlobalSettings) => {
    setSettings(newSettings);
    localStorage.setItem('pharmaqc_settings', JSON.stringify(newSettings));
  };

  const handleClearDb = async () => {
    const token = user.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);
    if (window.confirm(t.settings.clearDbConfirm)) {
      try {
        await clearDbResults(token);
        setResults([]);
        showToast(t.settings.successClear, 'success');
      } catch (error) {
        showToast("Erro ao limpar banco de dados", "error");
      }
    }
  };

  const tabs = [
    { id: 'dashboard', label: t.nav.dashboard, icon: BarChart3 },
    { id: 'planning', label: t.nav.planning || 'Planejamento', icon: Calculator },
    { id: 'reagents', label: t.nav.reagents || 'Materiais', icon: FlaskConical },
    { id: 'charts', label: t.nav.charts || 'Gráficos', icon: TrendingUp },
    { id: 'upload', label: t.nav.upload, icon: Upload },
    { id: 'view', label: t.nav.view, icon: Eye },
    { id: 'history', label: t.nav.history, icon: History },
    { id: 'settings', label: t.nav.settings, icon: Settings },
    { id: 'profile', label: t.nav.profile, icon: UserCircle },
    { id: 'logout', label: t.nav.logout, icon: LogOut },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-64 bg-slate-900 flex flex-col shrink-0 border-r border-slate-800 shadow-xl z-30">
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="bg-teal-500 p-2 rounded-xl shadow-lg shadow-teal-500/20">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">LabProcessor</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto no-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => tab.id === 'logout' ? onLogout() : setActiveTab(tab.id as Tab)}
                className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'bg-teal-600/10 text-teal-400 border border-teal-600/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 capitalize">{activeTab}</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'upload' && (
              <FileUpload onFilesSelect={handleFilesSelect} isLoading={isLoading} progress={progress} language={language} token={user.token} />
            )}
            {activeTab === 'view' && (
              <ResultsView results={results} settings={settings} language={language} onDeleteResult={handleDeleteResult} onUpdateResult={handleUpdateResult} />
            )}
            {activeTab === 'planning' && (
              <PlanningView results={results} settings={settings} language={language} />
            )}
            {activeTab === 'reagents' && (
               <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <FlaskConical className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-400 font-display">{t.nav.reagents}</h3>
                <p className="text-slate-400 text-sm mt-1">Módulo em desenvolvimento.</p>
              </div>
            )}
            {activeTab === 'charts' && (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <TrendingUp className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-400 font-display">{t.nav.charts}</h3>
                <p className="text-slate-400 text-sm mt-1">Gráficos de desempenho em breve.</p>
              </div>
            )}
            {activeTab === 'settings' && (
              <SettingsView settings={settings} onSave={handleSaveSettings} onClearDb={handleClearDb} language={language} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
