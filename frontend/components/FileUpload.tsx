import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, X } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { checkFileExists } from '../services/dbService';
import { useToast } from '../context/ToastContext';

interface SelectedFile {
  file: File;
  isDuplicate: boolean;
}

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  isLoading: boolean;
  progress: number;
  language: Language;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFilesSelect, 
  isLoading, 
  progress, 
  language
}) => {
  const { showToast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  
  const t = translations[language].upload;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) {
      const checkedFiles = await Promise.all(files.map(async f => {
        const { exists } = await checkFileExists(f.name);
        return { file: f, isDuplicate: exists };
      }));
      setSelectedFiles(prev => [...prev, ...checkedFiles]);
    } else {
      showToast("Por favor, envie apenas arquivos PDF.", "warning");
    }
  }, [showToast]);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files).filter(f => f.type === 'application/pdf');
      const checkedFiles = await Promise.all(newFiles.map(async f => {
        const { exists } = await checkFileExists(f.name);
        return { file: f, isDuplicate: exists };
      }));
      setSelectedFiles(prev => [...prev, ...checkedFiles]);
    }
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = () => {
    if (selectedFiles.length > 0) {
      onFilesSelect(selectedFiles.map(sf => sf.file));
      setSelectedFiles([]); // Clear after sending
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 ease-in-out
          flex flex-col items-center justify-center text-center cursor-pointer
          ${isDragging 
            ? 'border-teal-500 bg-teal-50 scale-[1.02]' 
            : 'border-slate-300 bg-white hover:border-teal-400 hover:bg-slate-50'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isLoading}
        />
        
        <div className="bg-teal-100 p-4 rounded-full mb-4">
          <Upload className="w-8 h-8 text-teal-600" />
        </div>

        <div>
          <p className="text-lg font-semibold text-slate-700">{t.dragDrop}</p>
          <p className="text-sm text-slate-500 mt-1">{t.clickSelect}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="mb-6 animate-fade-in">
          <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
            <span>{t.processing}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-teal-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && !isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">{t.selectedFiles} ({selectedFiles.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
            {selectedFiles.map((sf, idx) => (
              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-sm border ${sf.isDuplicate ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <FileText className={`w-4 h-4 flex-shrink-0 ${sf.isDuplicate ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span className={`truncate ${sf.isDuplicate ? 'text-amber-900 font-medium' : 'text-slate-700'}`}>{sf.file.name}</span>
                  {sf.isDuplicate && (
                    <span className="bg-amber-100 text-amber-700 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 whitespace-nowrap">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Já Processado
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => removeFile(idx)}
                  className="text-slate-400 hover:text-red-500 p-1 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={handleProcess}
            disabled={isLoading}
            className="w-full mt-4 bg-teal-600 text-white py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {t.processBtn}
          </button>
        </div>
      )}
      
      <div className="flex items-start gap-2 text-xs text-slate-500 px-4">
        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <p>{t.info}</p>
      </div>
    </div>
  );
};
