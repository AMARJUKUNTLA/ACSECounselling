
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student } from './types';
import StudentCard from './components/StudentCard';
import AdminDashboard from './components/AdminDashboard';
import FileUpload from './components/FileUpload';
import { getGeminiInsights } from './services/geminiService';
import * as CloudDB from './services/databaseService';

const DB_KEY = 'student_explorer_db';
const PWD_KEY = 'student_explorer_pwd';
const DEFAULT_PWD = 'admin123';

type Role = 'user' | 'admin' | null;

const App: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem('app_role') as Role) || null);
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [view, setView] = useState<'search' | 'admin'>('search');

  // Load data on startup
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const sheetUrl = CloudDB.getSheetUrl();
      
      if (sheetUrl) {
        try {
          const cloudData = await CloudDB.fetchFromGoogleSheets(sheetUrl);
          setStudents(cloudData);
          localStorage.setItem(DB_KEY, JSON.stringify(cloudData));
        } catch (e) {
          const local = localStorage.getItem(DB_KEY);
          if (local) setStudents(JSON.parse(local));
        }
      } else {
        const local = localStorage.getItem(DB_KEY);
        if (local) setStudents(JSON.parse(local));
      }
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (role) sessionStorage.setItem('app_role', role);
    else sessionStorage.removeItem('app_role');
  }, [role]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(lowerQuery) || 
      s.regNo.toLowerCase().includes(lowerQuery) ||
      s.phone1.includes(lowerQuery) ||
      s.phone2.includes(lowerQuery) ||
      s.branch.toLowerCase().includes(lowerQuery) ||
      s.section.toLowerCase().includes(lowerQuery) ||
      s.year.toLowerCase().includes(lowerQuery) ||
      s.counsellor.toLowerCase().includes(lowerQuery)
    );
  }, [students, searchQuery]);

  const handleDataLoaded = (data: Student[]) => {
    setStudents(data);
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    setView('admin');
  };

  const clearDatabase = () => {
    if (confirm("Clear cache? This will log you out and remove stored data on this device.")) {
      setStudents([]);
      localStorage.removeItem(DB_KEY);
      setRole(null);
    }
  };

  const handleLogout = () => {
    setRole(null);
    setView('search');
    sessionStorage.removeItem('app_role');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPwd = localStorage.getItem(PWD_KEY) || DEFAULT_PWD;
    if (passwordInput === storedPwd) {
      setRole('admin');
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl text-white shadow-2xl mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">EduBase Pro</h1>
            <p className="text-slate-500 mt-2 text-lg">Student Directory Search</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            <button onClick={() => setRole('user')} className="group bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 text-left hover:border-indigo-500 hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Search Portal</h3>
              <p className="text-slate-500">Quickly find student and parent contact info.</p>
            </button>
            <button onClick={() => setShowPasswordPrompt(true)} className="group bg-slate-900 p-10 rounded-[2.5rem] text-left hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Admin Panel</h3>
              <p className="text-slate-400">Manage database & sync with Google Sheets.</p>
            </button>
          </div>
        </div>
        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowPasswordPrompt(false)} />
            <form onSubmit={handleAdminLogin} className="relative bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-slate-800 mb-2">Admin Login</h3>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter Password"
                className={`w-full p-4 rounded-xl border-2 mb-4 focus:outline-none ${passwordError ? 'border-red-500 animate-shake' : 'border-slate-100'}`} autoFocus />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">Login</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('search')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">EduBase Pro</h1>
          </div>

          <div className="flex items-center space-x-4">
            <nav className="flex items-center space-x-1">
              <button onClick={() => setView('search')} className={`px-4 py-2 rounded-lg text-sm font-bold ${view === 'search' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Search</button>
              {role === 'admin' && (
                <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-lg text-sm font-bold ${view === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>Admin</button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-10 flex-1 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 font-bold space-y-4">
             <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             <p>Syncing Directory...</p>
          </div>
        ) : view === 'admin' && role === 'admin' ? (
          <AdminDashboard 
            students={students} 
            onDataLoaded={handleDataLoaded} 
            onClearDatabase={clearDatabase} 
            onLogout={handleLogout}
            isLoading={loading}
          />
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-slate-900 mb-8">Directory Search</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter Student Name, SID, or Phone..."
                  className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 rounded-3xl shadow-xl focus:border-indigo-500 outline-none text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <svg className="w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <StudentCard key={student.id} student={student} />
                ))
              ) : searchQuery && (
                <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-slate-100 text-slate-400 font-bold">
                  No records found for "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
