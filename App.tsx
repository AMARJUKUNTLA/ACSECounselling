
import React, { useState, useMemo, useEffect } from 'react';
import { Student } from './types';
import StudentCard from './components/StudentCard';
import AdminDashboard from './components/AdminDashboard';
import FileUpload from './components/FileUpload';
import * as CloudDB from './services/databaseService';

const DB_KEY = 'student_explorer_db';
const PWD_KEY = 'student_explorer_pwd';
const DEFAULT_PWD = 'admin123';

type Role = 'user' | 'admin' | null;

const App: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem('app_role') as Role) || null);
  
  // Modals & Menu State
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPwdChangeModal, setShowPwdChangeModal] = useState(false);
  const [showCloudSettingsModal, setShowCloudSettingsModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [sheetUrlInput, setSheetUrlInput] = useState(CloudDB.getSheetUrl());

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<'search' | 'admin'>('search');

  // Load data on startup - prioritizing GLOBAL CLOUD FETCH
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        console.log("Attempting Global Cloud Sync...");
        // 1. Force fetch the master link from the cloud bin
        const cloudMasterUrl = await CloudDB.fetchGlobalSheetUrl();
        
        // If we found a cloud link, use it. Otherwise fallback to local.
        const finalUrl = cloudMasterUrl || CloudDB.getSheetUrl();

        if (finalUrl) {
          // Sync all local states with the cloud value
          localStorage.setItem('edubase_google_sheet_url', finalUrl);
          setSheetUrlInput(finalUrl);
          
          console.log("Synchronizing with Master Cloud Link:", finalUrl);
          const data = await CloudDB.fetchFromGoogleSheets(finalUrl);
          setStudents(data);
          localStorage.setItem(DB_KEY, JSON.stringify(data));
        } else {
          // Check local cache if no URL at all
          const local = localStorage.getItem(DB_KEY);
          if (local) setStudents(JSON.parse(local));
        }
      } catch (e) {
        console.error("Initialization error:", e);
        // If network is down, try to load from the last known successful local cache
        const local = localStorage.getItem(DB_KEY);
        if (local) setStudents(JSON.parse(local));
      } finally {
        setLoading(false);
      }
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
      (s.phone1 && s.phone1.includes(lowerQuery)) ||
      (s.phone2 && s.phone2.includes(lowerQuery)) ||
      (s.branch && s.branch.toLowerCase().includes(lowerQuery)) ||
      (s.section && s.section.toLowerCase().includes(lowerQuery)) ||
      (s.year && s.year.toLowerCase().includes(lowerQuery)) ||
      (s.counsellor && s.counsellor.toLowerCase().includes(lowerQuery))
    );
  }, [students, searchQuery]);

  const handleDataLoaded = (data: Student[]) => {
    setStudents(data);
    localStorage.setItem(DB_KEY, JSON.stringify(data));
    setShowUploadModal(false);
    setIsMenuOpen(false);
  };

  const handleSaveSheetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.includes('docs.google.com/spreadsheets')) {
      return alert("Please enter a valid Google Sheets URL.");
    }

    setSyncing(true);
    try {
      // 1. Update Global Cloud Master
      await CloudDB.saveSheetUrl(sheetUrlInput);
      
      // 2. Fetch data from the new link immediately
      const data = await CloudDB.fetchFromGoogleSheets(sheetUrlInput);
      setStudents(data);
      localStorage.setItem(DB_KEY, JSON.stringify(data));
      
      alert("MASTER LINK SAVED GLOBALLY! All devices will now sync to this database.");
      setShowCloudSettingsModal(false);
    } catch (e) {
      alert("Sync failed. Check your internet connection or ensure the Sheet is set to 'Anyone with link can view'.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Refresh global URL first
      const cloudUrl = await CloudDB.fetchGlobalSheetUrl();
      const activeUrl = cloudUrl || CloudDB.getSheetUrl();
      
      if (!activeUrl) {
        alert("No Master Link is configured.");
        setShowCloudSettingsModal(true);
        return;
      }
      
      const data = await CloudDB.fetchFromGoogleSheets(activeUrl);
      setStudents(data);
      localStorage.setItem(DB_KEY, JSON.stringify(data));
      setSheetUrlInput(activeUrl);
      alert(`Global Master Sync successful! ${data.length} records updated.`);
    } catch (e) {
      alert("Global Sync failed. Ensure the sheet is accessible.");
    } finally {
      setSyncing(false);
      setIsMenuOpen(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPwd = localStorage.getItem(PWD_KEY) || DEFAULT_PWD;
    if (passwordInput === storedPwd) {
      setRole('admin');
      setView('admin');
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 4) return alert("Password must be at least 4 characters.");
    if (newPwd !== confirmPwd) return alert("Passwords do not match.");
    CloudDB.updateAdminPassword(newPwd);
    setNewPwd('');
    setConfirmPwd('');
    setShowPwdChangeModal(false);
    setIsMenuOpen(false);
    alert("Admin credentials updated locally.");
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl text-white shadow-2xl mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">EduBase Pro</h1>
            <p className="text-slate-500 mt-2 text-lg">Centralized Student Hub</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button onClick={() => setRole('user')} className="group bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 text-left hover:border-indigo-500 hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Student Search</h3>
              <p className="text-slate-500">Access shared database instantly.</p>
            </button>
            <button onClick={() => setShowPasswordPrompt(true)} className="group bg-slate-900 p-10 rounded-[2.5rem] text-left hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Admin Dashboard</h3>
              <p className="text-slate-400">Configure global settings & analytics.</p>
            </button>
          </div>
        </div>

        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowPasswordPrompt(false)} />
            <form onSubmit={handleAdminLogin} className="relative bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-slate-800 mb-2 text-center">Admin Verification</h3>
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Enter Admin Password"
                className={`w-full p-4 rounded-xl border-2 mb-4 focus:outline-none text-center text-lg tracking-widest ${passwordError ? 'border-red-500 animate-shake' : 'border-slate-100'}`} autoFocus />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95">Enter Admin Space</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('search')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">EduBase Pro</h1>
          </div>

          <div className="flex items-center space-x-6">
            <nav className="flex items-center space-x-1">
              <button onClick={() => setView('search')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'search' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Search</button>
              {role === 'admin' && (
                <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'admin' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>Admin</button>
              )}
            </nav>

            <div className="relative" onMouseEnter={() => setIsMenuOpen(true)} onMouseLeave={() => setIsMenuOpen(false)}>
              <button className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </button>
              
              {isMenuOpen && (
                <div className="absolute right-0 top-full pt-2 w-56 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden p-2">
                    <div className="px-4 py-3 border-b border-slate-50 mb-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Session</p>
                       <p className="text-sm font-bold text-slate-800">{role === 'admin' ? 'Cloud Admin' : 'Guest User'}</p>
                    </div>
                    {role === 'admin' && (
                      <>
                        <button onClick={() => {setShowCloudSettingsModal(true); setIsMenuOpen(false);}} className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                          <span>Master Link Setup</span>
                        </button>
                        <button onClick={handleSync} disabled={syncing} className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all">
                          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15"></path></svg>
                          <span>{syncing ? 'Connecting...' : 'Global Sync'}</span>
                        </button>
                        <button onClick={() => {setShowUploadModal(true); setIsMenuOpen(false);}} className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                          <span>Manual Override</span>
                        </button>
                        <div className="h-px bg-slate-50 my-1"></div>
                      </>
                    )}
                    <button onClick={() => setRole(null)} className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                      <span>End Session</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-8 flex-1 w-full overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 font-bold space-y-4">
             <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             <p className="animate-pulse tracking-[0.2em] text-[10px] uppercase">Connecting to Cloud Master...</p>
          </div>
        ) : view === 'admin' && role === 'admin' ? (
          <AdminDashboard students={students} isLoading={loading} />
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-slate-900 mb-8">Student Search</h2>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Student Name, SID, Parent Contact..."
                  className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 rounded-3xl shadow-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-lg transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <svg className="w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Global Database Active</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(100vh-340px)] custom-scrollbar pr-2 pb-10">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <StudentCard key={student.id} student={student} />
                ))
              ) : searchQuery && (
                <div className="col-span-full text-center py-24 bg-white rounded-3xl border border-slate-100 text-slate-400 font-bold shadow-inner">
                  No matching student records found.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Global Cloud Master Sync Modal */}
      {showCloudSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCloudSettingsModal(false)} />
          <form onSubmit={handleSaveSheetUrl} className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95 duration-200">
             <button type="button" onClick={() => setShowCloudSettingsModal(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
             <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Master Cloud Connection</h3>
             </div>
             <p className="text-slate-500 mb-8 text-sm leading-relaxed">
               Updating this URL changes the data source for <strong>every device</strong> that opens this app. 
               The change is permanent and globally reflected instantly.
             </p>
             <div className="space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Google Sheet Link (Public)</label>
                 <input 
                   type="text" 
                   value={sheetUrlInput} 
                   onChange={(e) => setSheetUrlInput(e.target.value)} 
                   placeholder="https://docs.google.com/spreadsheets/d/..."
                   className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:border-indigo-500 font-medium transition-colors shadow-inner"
                 />
               </div>
               <button type="submit" disabled={syncing} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center space-x-3 active:scale-[0.97]">
                 {syncing && <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>}
                 <span>{syncing ? 'Pushing Master Config...' : 'Update Globally for All Devices'}</span>
               </button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
