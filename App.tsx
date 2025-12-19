
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
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [adminPassword, setAdminPassword] = useState<string>(() => localStorage.getItem(PWD_KEY) || DEFAULT_PWD);
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem('app_role') as Role) || null);
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [view, setView] = useState<'search' | 'admin'>('search');

  // Menu and Modal states
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isChangePwdModalOpen, setIsChangePwdModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load data on startup
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const cloudReady = CloudDB.initCloud();
      setIsCloudEnabled(!!cloudReady);

      if (cloudReady) {
        const cloudData = await CloudDB.getStudentsFromCloud();
        setStudents(cloudData);
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

  // Keep local storage as a fallback, but cloud is primary if enabled
  useEffect(() => {
    if (students.length > 0) {
      localStorage.setItem(DB_KEY, JSON.stringify(students));
    }
  }, [students]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleDataLoaded = async (data: Student[]) => {
    setLoading(true);
    setStudents(data);
    
    if (isCloudEnabled) {
      try {
        await CloudDB.saveStudentsToCloud(data);
      } catch (err) {
        alert("Data saved locally, but cloud sync failed. Check your configuration.");
      }
    }

    setTimeout(() => {
      setLoading(false);
      setIsUploadModalOpen(false);
      setView('admin');
    }, 800);
  };

  const clearDatabase = async () => {
    if (confirm("Are you sure you want to delete all records globally?")) {
      setStudents([]);
      localStorage.removeItem(DB_KEY);
      if (isCloudEnabled) await CloudDB.clearCloudDatabase();
      setIsProfileMenuOpen(false);
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
            <p className="text-slate-500 mt-2 text-lg">Cross-Device Student Management</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            <button onClick={() => setRole('user')} className="group bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 text-left hover:border-indigo-500 hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Search Portal</h3>
              <p className="text-slate-500">Access directory from any device.</p>
            </button>
            <button onClick={() => setShowPasswordPrompt(true)} className="group bg-slate-900 p-10 rounded-[2.5rem] text-left hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Management</h3>
              <p className="text-slate-400">Secure admin tools & cloud sync.</p>
            </button>
          </div>
        </div>
        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowPasswordPrompt(false)} />
            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === adminPassword) {
                setRole('admin');
                setShowPasswordPrompt(false);
                setPasswordInput('');
              } else {
                setPasswordError(true);
              }
            }} className="relative bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-slate-800 mb-2">Admin Login</h3>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter Password"
                className={`w-full p-4 rounded-xl border-2 mb-4 focus:outline-none ${passwordError ? 'border-red-500' : 'border-slate-100'}`} autoFocus />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">Login</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('search')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">EduBase Pro</h1>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isCloudEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{isCloudEnabled ? 'Cloud Sync Online' : 'Local Mode'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <nav className="hidden sm:flex items-center space-x-1 mr-2">
              <button onClick={() => setView('search')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'search' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Search</button>
              {role === 'admin' && (
                <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'admin' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Admin</button>
              )}
            </nav>

            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </button>
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                   <div className="p-5 bg-slate-50 border-b border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Accessing as</p>
                    <p className="text-sm font-black text-slate-900 uppercase">{role === 'admin' ? 'Administrator' : 'Student/Staff'}</p>
                  </div>
                  <div className="p-2">
                    {role === 'admin' && (
                      <button onClick={() => { setIsUploadModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                        <svg className="w-4 h-4 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        Upload Excel Data
                      </button>
                    )}
                    <button onClick={() => setRole(null)} className="w-full flex items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)} />
          <div className="relative bg-white w-full max-w-xl p-8 rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-slate-900">Import Student Directory</h3>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
             </div>
             <FileUpload onDataLoaded={handleDataLoaded} isLoading={loading} />
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 pt-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-bold animate-pulse">Syncing Cloud Records...</p>
          </div>
        ) : view === 'admin' && role === 'admin' ? (
          <AdminDashboard 
            students={students} 
            onDataLoaded={handleDataLoaded} 
            onClearDatabase={clearDatabase} 
            isLoading={loading} 
            onSyncCloud={() => CloudDB.initCloud()}
          />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 tracking-tight">Global Directory</h2>
              <div className="mt-8 relative group">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-indigo-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by Name, SID, Phone..."
                  className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 focus:outline-none focus:border-indigo-500 transition-all text-lg text-slate-800 font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-6">
                {students.length === 0 ? (
                   <div className="bg-white p-12 rounded-[2rem] border border-slate-100 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-2xl text-slate-300 mb-6">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                    <h4 className="text-xl font-bold text-slate-800">No Data Available</h4>
                    <p className="text-slate-500 mt-2">Database is empty. Please upload student records.</p>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <div className="space-y-6">
                    {filteredStudents.map((student) => (
                      <StudentCard key={student.id} student={student} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-16 rounded-[2rem] text-center shadow-sm">
                    <p className="text-slate-500 font-bold">No results for "{searchQuery}"</p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-indigo-900 rounded-[2rem] p-8 text-white shadow-xl">
                  <h3 className="font-bold text-xl mb-4">Cloud Sync</h3>
                  <p className="text-indigo-200 text-sm mb-6">Access your data seamlessly across all devices using our secure cloud backbone.</p>
                  <button
                    onClick={async () => {
                      setInsightsLoading(true);
                      const res = await getGeminiInsights(students, searchQuery || "Summarize this data");
                      setInsights(res);
                      setInsightsLoading(false);
                    }}
                    className="w-full bg-white text-indigo-900 font-black py-4 rounded-xl hover:bg-indigo-50 transition-all"
                  >
                    {insightsLoading ? 'Thinking...' : 'AI Insights'}
                  </button>
                  {insights && <p className="mt-4 p-4 bg-white/10 rounded-lg text-xs leading-relaxed">{insights}</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
