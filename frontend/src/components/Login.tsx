import React, { useState } from 'react';
import { Lock, Mail, UserPlus, LogIn } from 'lucide-react';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password || (isRegistering && !username)) {
      setError('Preencha todos os campos.');
      return;
    }

    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('As senhas não coincidem.');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        
        setSuccess('Conta criada com sucesso! Entrando...');
        setTimeout(() => {
          onLogin(email);
        }, 1000);

      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onLogin(email);
      }
    } catch (err: any) {
      console.error('Erro na autenticação:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Erro na autenticação. Verifique os dados.');
      }
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setSuccess('');
    setEmail('');
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
            <label className="block text-sm font-medium text-slate-700 mb-2">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>

          {isRegistering && (
            <div className="animate-fade-in">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nome de Usuário</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="Seu nome"
                  required
                />
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
};
