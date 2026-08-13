import React, { useState, useEffect } from 'react';
import { AppUser } from '../types';
import { loginUser, subscribeToUsers } from '../services/databaseService';

interface LoginFormProps {
  onLoginSuccess: (user: AppUser) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToUsers((users) => {
      setUsersList(users);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrUser.trim() || !password.trim()) {
      setErrorMessage("Please fill in both email/username and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await loginUser(emailOrUser, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setEmailOrUser(user);
    setPassword(pass);
    setErrorMessage(null);
  };

  const counsellors = usersList.filter(u => u.role === 'faculty');

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Dynamic Background accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-in zoom-in-95 duration-300">
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 p-8 sm:p-10">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">EduNexus</h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Authorized Access Only</p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3 text-red-600 text-xs font-bold animate-shake">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Username / Email / Counsellor Name</label>
              <input 
                type="text"
                value={emailOrUser}
                onChange={(e) => setEmailOrUser(e.target.value)}
                placeholder="e.g. Dr. A. Kumar or admin"
                required
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Passkey / Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-indigo-100 flex items-center justify-center space-x-2 active:scale-95"
            >
              {isLoading && <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>}
              <span>{isLoading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            </button>
          </form>

          {/* Quick-Fill / Counsellor Select for Demonstration */}
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Quick Authorized Login Demo</p>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => handleQuickFill('admin@edubase.edu', 'admin123')}
                className="p-3 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 border border-slate-100 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-900 group-hover:bg-indigo-600"></span>
                  <span className="text-xs font-black text-slate-800 group-hover:text-indigo-600">Admin</span>
                </div>
                <p className="text-[9px] text-slate-400 font-bold mt-1">admin@edubase.edu</p>
              </button>

              <button 
                type="button"
                onClick={() => handleQuickFill('faculty@edubase.edu', 'faculty123')}
                className="p-3 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-100 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-black text-slate-800 group-hover:text-emerald-600">Default Faculty</span>
                </div>
                <p className="text-[9px] text-slate-400 font-bold mt-1">faculty@edubase.edu</p>
              </button>
            </div>

            {counsellors.length > 0 && (
              <div className="mt-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Select Counsellor from Data:</label>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handleQuickFill(e.target.value, 'faculty123');
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Counsellor Account --</option>
                  {counsellors.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 font-medium mt-1">Passkey for all data counsellors defaults to <code className="text-indigo-600 font-bold">faculty123</code></p>
              </div>
            )}
          </div>

        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-500 font-medium mt-6">
          EduNexus Directory • Protected by Firebase Cloud Authentication
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
