import React, { useState, useEffect } from 'react';
import { Lock, User, UserPlus, LogIn } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    try {
      if (isRegistering) {
        // Registration Logic
        if (password !== confirmPassword) {
          setError('As senhas não coincidem.');
          return;
        }

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Erro ao criar conta.');
          return;
        }

        setSuccess('Conta criada com sucesso! Entrando...');
        setTimeout(() => {
          onLogin(username);
        }, 1000);

      } else {
        // Login Logic
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
          onLogin(username);
        } else {
          setError(data.error || 'Usuário ou senha incorretos.');
        }
      }
    } catch (err) {
      console.error('Erro na autenticação:', err);
      setError('Erro de conexão com o servidor.');
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setSuccess('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">LabProcessor</h1>
          <p className="text-slate-500 mt-2">
            {isRegistering ? 'Crie sua conta para começar' : 'Faça login para acessar o sistema'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Usuário</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                placeholder="Escolha um usuário"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                placeholder="Sua senha"
                required
              />
            </div>
          </div>

          {isRegistering && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="Repita sua senha"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg border border-red-100 animate-pulse">
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-lg border border-green-100">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {isRegistering ? (
              <>
                <UserPlus className="w-5 h-5" /> Registrar
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> Entrar
              </>
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            onClick={toggleMode}
            className="text-sm text-teal-600 hover:text-teal-800 font-medium hover:underline transition-colors"
          >
            {isRegistering 
              ? 'Já tem uma conta? Faça login' 
              : 'Não tem conta? Registre-se agora'}
          </button>
        </div>

        {!isRegistering && (
          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            <p>Credenciais padrão: admin / admin</p>
          </div>
        )}
      </div>
    </div>
  );
};
