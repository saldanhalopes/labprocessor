import React, { useState, useEffect, useRef } from 'react';
import { Upload, Eye, BarChart3, History, Settings, Download, Loader2, Cpu, FlaskConical, LogOut, UserCircle, Shield, Globe, AlertTriangle, ScrollText, MessageSquare, Calculator, ChevronLeft, ChevronRight } from 'lucide-react';
import { FileUpload } from '../FileUpload';
import { ResultsView } from './ResultsView';
import { ChartsView } from './ChartsView';
import { SettingsView } from './SettingsView';
import { HistoryView } from './HistoryView';
import { MaterialsView } from './MaterialsView';
import { ReagentsView } from './ReagentsView';
import { ProfileView } from './ProfileView';
import { AdminView } from './AdminView';
import StandardsView from './StandardsView';
import { PlanningView } from './PlanningView';
import { SummaryDashboardView } from './SummaryDashboardView';
import { DashboardChat } from '../DashboardChat';
import { analyzeDocument } from '../../services/geminiService';
import { extractPdfImages } from '../../utils/pdfImages';
import { saveToPinecone } from '../../services/pineconeService';
import { saveResultToDb, getResultsFromDb, deleteResultFromDb, clearDbResults, checkFileExists, updateResultInDb } from '../../services/dbService';
import { AnalysisResult, GlobalSettings, HistoryItem, User, Language } from '../../types';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_SETTINGS, generateCSV, recalculateRow, isMicrobiology, calculateParallelLeadTime } from '../../utils/calculations';
import { auth } from '../../firebase';
import { getIdToken } from 'firebase/auth';
import { translations } from '../../utils/translations';

type Tab = 'dashboard' | 'upload' | 'view' | 'planning' | 'reagents' | 'standards' | 'charts' | 'history' | 'settings' | 'profile' | 'admin' | 'download' | 'chat';

interface DashboardProps {
  onLogout: () => void;
  user: User;
  onUpdateUser: (user: User) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Dashboard = ({ onLogout, user, onUpdateUser, language, onLanguageChange }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [hoveredTab, setHoveredTab] = useState<{ label: string, top: number } | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const t = translations[language];

  // Load from backend SQLite on mount, fallback to localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('pharmaqc_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    const savedHistory = localStorage.getItem('pharmaqc_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    // Load results from Firestore backend
    const loadResults = async () => {
      try {
        const token = user?.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);
        const dbResults = await getResultsFromDb(token || undefined);
        
        if (dbResults && dbResults.length > 0) {
        // Ensure all results have HH calculated (Migration check)
        const recalculatedResults = dbResults.map(res => ({
          ...res,
          rows: (res.rows || []).map(row => recalculateRow(row, settings))
        }));
        
        setResults(recalculatedResults);
        console.log(`[Dashboard] Loaded ${dbResults.length} results from SQLite (Recalculated HH)`);
        
        // Populate history from results
        setHistory(prev => {
          // Sync if length differs OR if history was empty
          // We map the recalculated results to history items to ensure consistency with now HH data
          const syncHistory: HistoryItem[] = recalculatedResults.map(res => {
            const physChemRows = (res.rows || []).filter(row => !isMicrobiology(row));
            const microRows = (res.rows || []).filter(row => isMicrobiology(row));
            const pcMax = physChemRows.length > 0 ? Math.max(...physChemRows.map(r => r.totalTimeHours || 0)) : 0;
            const mMax = microRows.length > 0 ? Math.max(...microRows.map(r => r.totalTimeHours || 0)) : 0;
            const leadTime = calculateParallelLeadTime(res.rows || []);
            const workload = (res.rows || []).reduce((acc, r) => acc + (r.totalTimeHours || 0), 0);
            const manHours = (res.rows || []).reduce((acc, r) => acc + (r.manHours || 0), 0);

            return {
              id: res.fileId,
              date: res.timestamp ? new Date(res.timestamp).toISOString() : new Date().toISOString(),
              fileName: res.fileName,
              productName: res.product?.productName || "Produto Desconhecido",
              totalTime: leadTime || res.totalTime || 0,
              workloadTime: workload || 0,
              manHours: manHours,
              totalTimePhysChem: res.totalTimePhysChem || pcMax,
              totalTimeMicro: res.totalTimeMicro || mMax
            };
          });
          
          // Sort by date desc
          syncHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          // Save to localStorage so it's available next time immediately
          localStorage.setItem('pharmaqc_history', JSON.stringify(syncHistory));
          return syncHistory;
        });
      } else {
        // Fallback to localStorage if backend has no data
        const savedResults = localStorage.getItem('labprocessor_methods_db');
        if (savedResults) setResults(JSON.parse(savedResults));
      }
    } catch (error) {
      console.error("[Dashboard] Error in loadResults:", error);
      throw error; // Re-throw so the outer .catch handles it
    }
  };

    loadResults().catch((err) => {
      console.error("[Dashboard] Error loading from DB:", err);
      // If backend is unavailable, use localStorage
      const savedResults = localStorage.getItem('labprocessor_methods_db');
      if (savedResults) setResults(JSON.parse(savedResults));
    }).finally(() => {
      setIsInitialLoading(false);
    });
  }, []);

  // Save results to localStorage as backup
  useEffect(() => {
    localStorage.setItem('labprocessor_methods_db', JSON.stringify(results));
  }, [results]);

  // Calculate limits for UI
  const plan = user.plan || 'free';
  let limit = 1;
  if (plan === 'basic') limit = 5;
  if (plan === 'pro') limit = Infinity;
  
  const uploadsToday = user.uploadsToday || 0;
  // Check if limit is reached (only if not pro)
  const isLimitReached = plan !== 'pro' && uploadsToday >= limit;

  const checkUploadLimit = (fileCount: number): boolean => {
    const today = new Date().toISOString().slice(0, 10);
    let currentUploads = user.uploadsToday || 0;
    
    // Reset counter if it's a new day
    if (user.lastUploadDate !== today) {
      currentUploads = 0;
    }

    if (plan !== 'pro' && currentUploads + fileCount > limit) {
      showToast(`Limite de uploads diários atingido para o plano ${plan.toUpperCase()}. (${currentUploads}/${limit})\nAtualize seu plano para continuar.`, 'warning');
      return false;
    }
    return true;
  };

  const incrementUploadCount = (count: number) => {
    const today = new Date().toISOString().slice(0, 10);
    let currentUploads = user.uploadsToday || 0;
    
    if (user.lastUploadDate !== today) {
      currentUploads = 0;
    }

    const updatedUser = {
      ...user,
      uploadsToday: currentUploads + count,
      lastUploadDate: today
    };

    onUpdateUser(updatedUser);
    
    // Also update in "database" of users
    const storedUsers = JSON.parse(localStorage.getItem('labprocessor_users') || '[]');
    const updatedUsersList = storedUsers.map((u: any) => 
      u.username === user.username ? { ...u, uploadsToday: updatedUser.uploadsToday, lastUploadDate: today } : u
    );
    localStorage.setItem('labprocessor_users', JSON.stringify(updatedUsersList));
  };

  const handleFilesSelect = async (files: File[]) => {
    if (!checkUploadLimit(files.length)) return;

    setIsLoading(true);
    setProgress(0);
    const newResults: AnalysisResult[] = [];
    let processedCount = 0;

    const token = user?.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);

    // Check for duplicates in the entire batch first
    const duplicateFiles: string[] = [];
    for (const file of files) {
      const { exists } = await checkFileExists(file.name, token || undefined);
      if (exists) duplicateFiles.push(file.name);
    }

    let filesToProcess = [...files];
    if (duplicateFiles.length > 0) {
      const msg = duplicateFiles.length === 1 
        ? `O arquivo "${duplicateFiles[0]}" já foi processado anteriormente.\n\nDeseja ignorar este arquivo e processar apenas os novos?`
        : `${duplicateFiles.length} arquivos já foram processados anteriormente.\n\nDeseja ignorar os arquivos duplicados e processar apenas os novos?`;
      
      const skipDuplicates = window.confirm(msg);
      if (skipDuplicates) {
        filesToProcess = files.filter(f => !duplicateFiles.includes(f.name));
      }
      
      if (filesToProcess.length === 0) {
        setIsLoading(false);
        return;
      }
    }

    for (const file of filesToProcess) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        
        // Extract images from PDF with a timeout to prevent blocking
        console.log("[Dashboard] Starting image extraction for:", file.name);
        let images: string[] = [];
        try {
          // Promise that rejects after 10 seconds
          const timeoutPromise = new Promise<string[]>((_, reject) => 
            setTimeout(() => reject(new Error("Image extraction timed out")), 10000)
          );
          
          images = await Promise.race([
            extractPdfImages(file),
            timeoutPromise
          ]);
          console.log(`[Dashboard] Extracted ${images.length} images from:`, file.name);
        } catch (imgError) {
          console.error("[Dashboard] Image extraction failed or timed out, proceeding without images:", imgError);
          images = [];
        }
        
        // Use the current language state for processing
        console.log("[Dashboard] Sending to Gemini analysis:", file.name);
        const result = await analyzeDocument(base64Data, file.type, file.name, settings, language, images, token);
        console.log("Analysis Result received in Dashboard:", result);
        newResults.push(result);

        // Sync to Pinecone (Vector DB)
        try {
          await saveToPinecone(result, token);
        } catch (pineError) {
          console.error("Failed to sync to Pinecone:", pineError);
        }

        // Save to Firestore Backend
        try {
          await saveResultToDb(result, token || undefined);
        } catch (dbError) {
          console.error("Failed to save to Firestore:", dbError);
          showToast(`Erro ao sincronizar ${file.name} com a nuvem.`, 'warning');
        }

        // Calculate Lead Time and Workload for history
        const physChemRows = result.rows.filter(row => !isMicrobiology(row));
        const microRows = result.rows.filter(row => isMicrobiology(row));
        const pcMax = physChemRows.length > 0 ? Math.max(...physChemRows.map(r => r.totalTimeHours)) : 0;
        const mMax = microRows.length > 0 ? Math.max(...microRows.map(r => r.totalTimeHours)) : 0;
        const currentLeadTime = Math.max(pcMax, mMax);
        const currentWorkload = result.rows.reduce((acc, r) => acc + r.totalTimeHours, 0);

        // Add to history log
        const historyItem: HistoryItem = {
          id: result.fileId,
          date: new Date().toISOString(),
          fileName: result.fileName,
          productName: result.product.productName,
          totalTime: currentLeadTime,
          workloadTime: currentWorkload,
          totalTimePhysChem: result.totalTimePhysChem,
          totalTimeMicro: result.totalTimeMicro
        };
        setHistory(prev => {
          const updated = [historyItem, ...prev];
          localStorage.setItem('pharmaqc_history', JSON.stringify(updated));
          return updated;
        });

      } catch (error: any) {
        console.error(`[Dashboard] Error processing ${file.name}:`, error);
        const stackMsg = error.stack ? `\n\nStack: ${error.stack.substring(0, 100)}...` : '';
        showToast(`Erro ao processar ${file.name}: ${error.message || 'Erro desconhecido'}${stackMsg}`, 'error', 10000);
      }
 finally {
        processedCount++;
        setProgress(Math.round((processedCount / files.length) * 100));
      }
    }

    // Append new results to the existing "database"
    setResults(prev => [...newResults, ...prev]);
    
    // Update upload count
    incrementUploadCount(files.length);
    
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
      setActiveTab('view');
    }, 500);
  };

  const handleSettingsSave = (newSettings: GlobalSettings) => {
    setSettings(newSettings);
    localStorage.setItem('pharmaqc_settings', JSON.stringify(newSettings));
    
    // Recalculate existing results in the database
    const updatedResults = results.map(res => {
      const updatedRows = res.rows.map(row => recalculateRow(row, newSettings));
      
      let totalTimePhysChem = 0;
      let totalTimeMicro = 0;
      let maxPhysChem = 0;
      let maxMicro = 0;

      updatedRows.forEach(row => {
        const isMicro = isMicrobiology(row);
        const incubationDisplay = isMicro ? (row.t_incubation || 0).toFixed(2) : "0.00 (N/A)";
        const rowHH = row.manHours || 0;
        const rowLeadTime = row.totalTimeHours || 0;
        const activeEffortPct = rowLeadTime > 0 ? (rowHH / rowLeadTime) * 100 : 0;
        
        if (isMicro) {
          totalTimeMicro += row.totalTimeHours;
          maxMicro = Math.max(maxMicro, row.totalTimeHours);
        } else {
          totalTimePhysChem += row.totalTimeHours;
          maxPhysChem = Math.max(maxPhysChem, row.totalTimeHours);
        }
      });
      const leadTime = Math.max(maxPhysChem, maxMicro);

      return { ...res, rows: updatedRows, totalTime: leadTime, totalTimePhysChem, totalTimeMicro };
    });
    setResults(updatedResults);
  };

  const handleDeleteResult = async (fileId: string) => {
    if (window.confirm(t.results.deleteConfirm)) {
      try {
        const token = user?.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);
        setResults(prev => prev.filter(r => r.fileId !== fileId));
        await deleteResultFromDb(fileId, token || undefined);
        showToast('Resultado excluído com sucesso.', 'success');
      } catch (e) {
        console.error('Failed to delete from Firestore:', e);
        showToast('Erro ao excluir resultado do servidor.', 'error');
      }
    }
  };

  const handleUpdateResult = async (updatedResult: AnalysisResult) => {
    try {
      const token = user?.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);
      const fileId = updatedResult.fileId;
      await updateResultInDb(fileId, updatedResult, token || undefined);
      setResults(prev => prev.map(r => r.fileId === fileId ? updatedResult : r));
      showToast('Resultado atualizado com sucesso!', 'success');
    } catch (err) {
      console.error("[Dashboard] Error updating result:", err);
      showToast("Erro ao atualizar resultado.", "error");
    }
  };

  const handleClearDatabase = async () => {
    if (window.confirm(translations[language].settings.clearDbConfirm)) {
      try {
        const token = user?.token || (auth.currentUser ? await getIdToken(auth.currentUser) : null);
        setResults([]);
        localStorage.removeItem('labprocessor_methods_db');
        await clearDbResults(token || undefined);
        showToast(translations[language].settings.successClear, 'success');
      } catch (e) {
        console.error('Failed to clear Firestore:', e);
        showToast('Erro ao limpar banco de dados no servidor.', 'error');
      }
    }
  };

  const handleDownload = () => {
    const csv = generateCSV(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `labprocessor_db_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('pharmaqc_history');
  };

  const tabs = [
    { id: 'dashboard', label: t.nav.dashboard, icon: BarChart3 },
    { id: 'upload', label: t.nav.upload, icon: Upload },
    { id: 'view', label: t.nav.view, icon: Eye },
    { id: 'planning', label: t.nav.planning, icon: Calculator },
    { id: 'chat', label: t.nav.chat, icon: MessageSquare },
    { id: 'reagents', label: t.nav.reagents, icon: FlaskConical },
    { id: 'charts', label: t.nav.charts, icon: BarChart3 },
    { id: 'history', label: t.nav.history, icon: History },
    { id: 'settings', label: t.nav.settings, icon: Settings },
    { id: 'profile', label: t.nav.profile, icon: UserCircle },
    ...(user.isAdmin ? [{ id: 'admin', label: t.nav.admin, icon: Shield }] : []),
    { id: 'download', label: t.nav.download, icon: Download },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className={`
        ${isSidebarCollapsed ? 'w-20' : 'w-64'} 
        bg-slate-900 flex flex-col shrink-0 border-r border-slate-800 shadow-xl z-30 transition-all duration-300 ease-in-out
      `}>
        {/* Logo Section */}
        <div className={`p-4 border-b border-slate-800/50 flex flex-col gap-4 relative ${isSidebarCollapsed ? 'items-center' : ''}`}>
          <div className={`flex items-center gap-3 min-w-0 ${isSidebarCollapsed ? 'justify-center w-full' : 'justify-between'}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-teal-500 p-2 rounded-xl shadow-lg shadow-teal-500/20 shrink-0">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              {!isSidebarCollapsed && (
                <div className="animate-fade-in truncate">
                  <h1 className="text-xl font-bold text-white tracking-tight">LabProcessor</h1>
                  <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest leading-none mt-1">Analytics Pro</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Floating Edge Toggle */}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`
              absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 
              bg-teal-500 text-white rounded-full flex items-center justify-center 
              shadow-lg shadow-teal-500/30 hover:bg-teal-400 hover:scale-110 
              transition-all duration-300 z-50 group border border-teal-400/50
            `}
            title={isSidebarCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            
            {/* Custom Tooltip for Toggle */}
            <div className={`absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-xl border border-slate-700 z-50 translate-x-2 group-hover:translate-x-0 ${isSidebarCollapsed ? 'block' : 'hidden md:block'}`}>
              {isSidebarCollapsed ? 'Expandir Sidebar' : 'Recolher Sidebar'}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800"></div>
            </div>

            {/* Pulsing indicator when collapsed */}
            {isSidebarCollapsed && <div className="absolute inset-0 rounded-full animate-ping bg-teal-400/30 -z-10"></div>}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className={`flex-1 py-6 px-4 space-y-1.5 overflow-y-auto no-scrollbar`}>
          {!isSidebarCollapsed && <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-4 animate-fade-in">Menu Principal</div>}
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => tab.id === 'download' ? handleDownload() : setActiveTab(tab.id as Tab)}
                onMouseEnter={(e) => {
                  if (isSidebarCollapsed) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredTab({ label: tab.label, top: rect.top + rect.height / 2 });
                  }
                }}
                onMouseLeave={() => setHoveredTab(null)}
                className={`
                  w-full flex items-center py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative
                  ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}
                  ${isActive 
                    ? 'bg-teal-600/10 text-teal-400 border border-teal-600/20 shadow-lg shadow-teal-900/40' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                  }
                `}
              >
                <Icon className={`w-5 h-5 transition-colors ${isSidebarCollapsed ? '' : 'mr-3'} ${isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {!isSidebarCollapsed && <span className="animate-fade-in">{tab.label}</span>}
                
                {isActive && !isSidebarCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400 shadow-glow shadow-teal-400/50"></div>
                )}
              </button>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {tabs.find(t => t.id === activeTab)?.label || activeTab}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {activeTab === 'upload' && (
              <div className={`px-4 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 shadow-sm transition-all ${
                isLimitReached 
                  ? 'bg-red-50 text-red-700 border-red-200 ring-2 ring-red-100' 
                  : 'bg-white text-slate-600 border-slate-200'
              }`}>
                {isLimitReached && <AlertTriangle className="w-3 h-3 text-red-500" />}
                <span>Uploads:</span> 
                <span className="font-mono text-sm">{uploadsToday}</span>
                <span className="text-slate-300">/</span>
                <span className="font-mono text-sm">{plan === 'pro' ? '∞' : limit}</span>
              </div>
            )}
            
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            
            {/* Language Selector in Header */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
              {(['pt', 'es', 'en'] as Language[]).map(lang => (
                <button 
                  key={lang}
                  onClick={() => onLanguageChange(lang)}
                  className={`
                    text-[10px] font-black px-2 py-1 rounded-lg transition-all
                    ${language === lang 
                      ? 'bg-white text-teal-600 shadow-sm ring-1 ring-slate-200' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                    }
                  `}
                >
                  <span className="flex items-center gap-1">
                    <img 
                      src={`https://flagcdn.com/w40/${lang === 'pt' ? 'br' : lang === 'es' ? 'es' : 'us'}.png`} 
                      className="w-3.5 h-2.5 object-cover rounded-[1px] shadow-sm" 
                      alt={lang}
                    />
                    <span>{lang.toUpperCase()}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-3 pl-4 border-l border-slate-200 hover:bg-slate-50 transition-all rounded-lg p-1 group ${isUserMenuOpen ? 'bg-slate-50' : ''}`}
              >
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-sm font-bold text-slate-800 leading-none group-hover:text-teal-600 transition-colors">{user.fullName || user.username}</span>
                  <span className={`text-[9px] font-black uppercase mt-1 px-1.5 py-0.5 rounded-md ${
                    user.plan === 'pro' ? 'bg-teal-500/10 text-teal-600' : 
                    user.plan === 'basic' ? 'bg-blue-500/10 text-blue-600' : 
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {user.plan || 'Free'}
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border transition-all shadow-sm ${isUserMenuOpen ? 'border-teal-200 ring-2 ring-teal-50' : 'border-slate-200 group-hover:border-teal-200'}`}>
                  <UserCircle className={`w-7 h-7 transition-colors ${isUserMenuOpen ? 'text-teal-500' : 'text-slate-400 group-hover:text-teal-500'}`} />
                </div>

                {/* Header Profile Tooltip */}
                {!isUserMenuOpen && (
                  <div className="absolute top-full right-0 mt-3 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap shadow-xl border border-slate-700 z-50 translate-y-2 group-hover:translate-y-0">
                    Menu do Usuário
                    <div className="absolute bottom-full right-4 border-8 border-transparent border-b-slate-800"></div>
                  </div>
                )}
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fade-in-up origin-top-right">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1 sm:hidden">
                    <p className="text-sm font-bold text-slate-800 truncate">{user.fullName || user.username}</p>
                    <p className="text-[10px] text-slate-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-teal-600 transition-all"
                  >
                    <UserCircle className="w-4 h-4 mr-3" />
                    {t.nav.profile}
                  </button>
                  <div className="h-px bg-slate-100 my-1 mx-2"></div>
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    {t.nav.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Content area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 no-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <SummaryDashboardView 
                results={results} 
                settings={settings}
                onNavigate={setActiveTab} 
                isLoading={isInitialLoading}
                token={user.token}
              />
            )}
            {activeTab === 'upload' && (
              <div className="animate-fade-in-up">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t.upload.title}</h2>
                  <p className="text-slate-500 mt-2">{t.upload.subtitle}</p>
                  
                  {!((import.meta as any).env?.VITE_GEMINI_API_KEY) && (
                    <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 max-w-md mx-auto">
                      <AlertTriangle className="w-5 h-5" />
                      <span><strong>Erro:</strong> Chave da API (VITE_GEMINI_API_KEY) não encontrada no ambiente.</span>
                    </div>
                  )}
                </div>

                <FileUpload 
                  onFilesSelect={handleFilesSelect} 
                  isLoading={isLoading} 
                  progress={progress} 
                  language={language}
                />

                {isLoading && (
                  <div className="flex flex-col items-center mt-12 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 max-w-md mx-auto">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-teal-500 rounded-full animate-spin"></div>
                      <Loader2 className="w-8 h-8 text-teal-600 animate-pulse" />
                    </div>
                    <p className="text-slate-800 font-bold mt-6 text-lg">{t.upload.processing}</p>
                    <p className="text-slate-400 text-sm mt-1">{progress}% concluído</p>
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-6 overflow-hidden">
                      <div className="bg-teal-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'view' && (
              <ResultsView 
                results={results} 
                settings={settings}
                language={language} 
                onDeleteResult={handleDeleteResult} 
                onUpdateResult={handleUpdateResult}
              />
            )}
            
            {activeTab === 'planning' && (
              <PlanningView 
                results={results} 
                settings={settings} 
                language={language} 
              />
            )}
            
            {activeTab === 'reagents' && <MaterialsView results={results} />}

            {activeTab === 'charts' && <ChartsView results={results} />}
            
            {activeTab === 'history' && <HistoryView history={history} onClear={clearHistory} />}
            
            {activeTab === 'settings' && (
              <SettingsView 
                settings={settings} 
                onSave={handleSettingsSave} 
                onClearDb={handleClearDatabase}
                language={language}
              />
            )}

            { activeTab === 'profile' && <ProfileView user={user} onUpdateUser={onUpdateUser} language={language} />}

            {activeTab === 'admin' && user.isAdmin && <AdminView currentUser={user} language={language} />}

            {activeTab === 'chat' && (
              <div className="h-[calc(100vh-10rem)]">
                <DashboardChat token={user.token} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Shared Sidebar Tooltip (Fixed) */}
      {hoveredTab && (
        <div 
          className="fixed left-[84px] px-3 py-1.5 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-xl border border-slate-700 z-[100] transition-all duration-200 whitespace-nowrap -translate-y-1/2 animate-fade-in"
          style={{ top: `${hoveredTab.top}px` }}
        >
          {hoveredTab.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800"></div>
        </div>
      )}
    </div>
  );
};
