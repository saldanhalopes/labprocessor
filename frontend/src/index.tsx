import React from 'react';
console.log("[Index] Script started (from src/)");
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { Toast } from './components/Toast';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
console.log("[Index] Rendering App...");
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
      <Toast />
    </ToastProvider>
  </React.StrictMode>
);
