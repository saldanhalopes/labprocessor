import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast, Toast as ToastType } from '../context/ToastContext';

export const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-md w-full sm:w-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastType; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyle = () => {
    switch (toast.type) {
      case 'success': return 'bg-emerald-50 border-emerald-100/50 text-emerald-900';
      case 'error': return 'bg-rose-50 border-rose-100/50 text-rose-900';
      case 'warning': return 'bg-amber-50 border-amber-100/50 text-amber-900';
      default: return 'bg-blue-50 border-blue-100/50 text-blue-900';
    }
  };

  return (
    <div 
      className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl shadow-black/5 backdrop-blur-xl transition-all duration-300 transform ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'
      } ${getStyle()}`}
    >
      <div className="shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-sm font-bold leading-relaxed whitespace-pre-wrap break-words">
          {toast.message}
        </p>
      </div>
      <button 
        onClick={handleRemove}
        className="shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors -mr-1"
      >
        <X className="w-4 h-4 opacity-40 hover:opacity-100" />
      </button>
    </div>
  );
};
