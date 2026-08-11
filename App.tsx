import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Student } from './types';
import StudentCard from './components/StudentCard';
import AdminDashboard from './components/AdminDashboard';
import * as CloudDB from './services/databaseService';
import { getGeminiInsights } from './services/geminiService';

const PWD_KEY = 'student_explorer_pwd';
const DEFAULT_PWD = 'admin123';

type Role = 'user' | 'admin' | null;

const App: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [role, setRole] = useState<Role>(() => (sessionStorage.getItem('app_role') as Role) || null);
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showCloudSettingsModal, setShowCloudSettingsModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'offline'>('online');
  const [view, setView] = useState<'search' | 'admin'>('search');

  // SUBSCRIBE TO FIREBASE REAL-TIME FIRESTORE DATA
  useEffect(() => {
    setLoading(true);

    // 1. Subscribe to Real-Time Students collection in Firebase Cloud Firestore
    const unsubscribeStudents = CloudDB.subscribeToStudents(
      (data) => {
        setStudents(data);
        setCloudStatus('online');
        setLoading(false);
      },
      (err) => {
        console.error("Firebase connection error:", err);
        setCloudStatus('offline');
        setLoading(false);
      }
    );

    // 2. Subscribe to Real-Time Config document in Firebase Cloud Firestore
    const unsubscribeConfig = CloudDB.subscribeToConfig((config) => {
      if (config.sheetUrl) {
        setSheetUrlInput(config.sheetUrl);
      }
      if (config.lastUpdated) {
        setLastUpdated(config.lastUpdated);
      }
    });

    return () => {
      unsubscribeStudents();
      unsubscribeConfig();
    };
  }, []);

  useEffect(() => {
    if (role) sessionStorage.setItem('app_role', role);
    else sessionStorage.removeItem('app_role');
  }, [role]);

  // AI SEARCH INSIGHTS
  const performCloudSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setAiInsights(null);
      return;
    }

    setIsSearching(true);
    try {
      const filtered = students.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase()) || 
        s.regNo.toLowerCase().includes(query.toLowerCase()) ||
        (s.phone1 && s.phone1.includes(query)) ||
        (s.phone2 && s.phone2.includes(query)) ||
        (s.counsellor && s.counsellor.toLowerCase().includes(query.toLowerCase())) ||
        (s.branch && s.branch.toLowerCase().includes(query.toLowerCase()))
      );
      
      if (filtered.length > 0) {
        const insights = await getGeminiInsights(filtered, query);
        setAiInsights(insights);
      } else {
        setAiInsights("The Firebase cloud database returned no matching student records.");
      }
    } catch (e) {
      console.warn("AI Insights generation error:", e);
    } finally {
      setIsSearching(false);
    }
  }, [students]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) performCloudSearch(searchQuery);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery, performCloudSearch]);

  const handleSaveSheetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) return;
    setSyncing(true);
    try {
      await CloudDB.fetchFromGoogleSheets(sheetUrlInput.trim());
      alert("SUCCESS! Google Sheet data synced into Firebase Cloud Firestore.");
      setShowCloudSettingsModal(false);
    } catch (e: any) {
      alert(`Failed to sync: ${e.message || 'Check link permissions'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleExcelUpload = async (newStudents: Student[]) => {
    await CloudDB.saveStudentsToFirebase(newStudents);
  };

  const handleGoogleSheetSync = async (url: string) => {
    await CloudDB.fetchFromGoogleSheets(url);
  };

  const handleAddStudent = async (student: Omit<Student, 'id'>) => {
    await CloudDB.addStudentToFirebase(student);
  };

  const handleUpdateStudent = async (id: string, updated: Partial<Student>) => {
    await CloudDB.updateStudentInFirebase(id, updated);
  };

  const handleDeleteStudent = async (id: string) => {
    await CloudDB.deleteStudentFromFirebase(id);
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

  // Filter display results for live search tab
  const displayResults = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.regNo.toLowerCase().includes(q) ||
      (s.phone1 && s.phone1.includes(q)) ||
      (s.phone2 && s.phone2.includes(q)) ||
      (s.counsellor && s.counsellor.toLowerCase().includes(q)) ||
      (s.branch && s.branch.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  // Welcome / Role Selection Screen
  if (!role) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl text-white shadow-2xl mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">EduBase Pro</h1>
            <p className="text-slate-500 mt-2 text-lg">Firebase Cloud Synchronized Student Directory</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button onClick={() => setRole('user')} className="group bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 text-left hover:border-indigo-500 hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Search Students</h3>
              <p className="text-slate-500">Live Firebase cloud database access for all devices.</p>
            </button>
            <button onClick={() => setShowPasswordPrompt(true)} className="group bg-slate-900 p-10 rounded-[2.5rem] text-left hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Administrator</h3>
              <p className="text-slate-400">Import Excel or Google Sheets directly into Firebase Cloud.</p>
            </button>
          </div>
        </div>

        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowPasswordPrompt(false)} />
            <form onSubmit={handleAdminLogin} className="relative bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-slate-800 mb-2 text-center">Admin Authentication</h3>
              <input 
                type="password" 
                value={passwordInput} 
                onChange={(e) => setPasswordInput(e.target.value)} 
                placeholder="Admin Passkey (default: admin123)"
                className={`w-full p-4 rounded-xl border-2 mb-4 focus:outline-none text-center text-lg tracking-widest ${passwordError ? 'border-red-500 animate-shake' : 'border-slate-100'}`} 
                autoFocus 
              />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all">Access Dashboard</button>
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
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">EduBase Pro</h1>
              <span className="text-[9px] font-black uppercase text-indigo-600 tracking-widest hidden sm:block">Firebase Cloud Database</span>
            </div>
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
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Firebase Status</p>
                       <p className="text-sm font-bold text-slate-800">{cloudStatus === 'online' ? 'Live Cloud Synced' : 'Offline'}</p>
                    </div>
                    {role === 'admin' && (
                      <button onClick={() => {setShowCloudSettingsModal(true); setIsMenuOpen(false);}} className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                        <span>Sync Google Sheet</span>
                      </button>
                    )}
                    <button onClick={() => setRole(null)} className="w-full flex items-center space-x-3 px-4 py-3 text-left text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                      <span>Logout</span>
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
             <p className="animate-pulse tracking-widest text-xs uppercase font-black">Connecting to Firebase Cloud...</p>
          </div>
        ) : view === 'admin' && role === 'admin' ? (
          <AdminDashboard 
            students={students} 
            isLoading={loading}
            sheetUrl={sheetUrlInput}
            lastUpdated={lastUpdated}
            onExcelUpload={handleExcelUpload}
            onGoogleSheetSync={handleGoogleSheetSync}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
          />
        ) : (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-slate-900 mb-8 uppercase tracking-tight">Student Search</h2>
              <div className="relative group">
                <input
                  type="text"
                  placeholder="Search by Name, SID, Mobile, Counsellor, or Branch..."
                  className="w-full pl-14 pr-14 py-5 bg-white border-2 border-slate-100 rounded-3xl shadow-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-lg transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <svg className="w-6 h-6 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                
                {isSearching && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              
              {aiInsights && searchQuery && (
                <div className="mt-8 p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] text-left animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Firebase Cloud AI Insights</span>
                  </div>
                  <p className="text-indigo-900 text-sm font-bold leading-relaxed">{aiInsights}</p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-center space-x-3">
                <div className="flex items-center bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">
                  <div className={`w-2 h-2 rounded-full mr-2 ${cloudStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    {cloudStatus === 'online' ? `Firebase Cloud Active • ${students.length} Records` : 'Firebase Connection Issue'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(100vh-360px)] custom-scrollbar pr-2 pb-10">
              {displayResults.length > 0 ? (
                displayResults.map((student) => (
                  <StudentCard key={student.id} student={student} />
                ))
              ) : (
                <div className="col-span-full text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 text-slate-300 font-black uppercase text-sm tracking-widest">
                  {searchQuery ? 'No matching records in Firebase Cloud' : 'No student records in Firebase. Upload Excel or sync Google Sheet in Admin.'}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Google Sheet Sync Modal */}
      {showCloudSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCloudSettingsModal(false)} />
          <form onSubmit={handleSaveSheetUrl} className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95 duration-200">
             <button type="button" onClick={() => setShowCloudSettingsModal(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
             <h3 className="text-2xl font-black text-slate-900 mb-2">Sync Google Sheet to Firebase</h3>
             <p className="text-slate-500 mb-8 text-sm leading-relaxed">
               Enter a Google Sheet link. The student records will be fetched and stored directly into Firebase Cloud Firestore so all users see updated records instantly.
             </p>
             <div className="space-y-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Shared Google Sheet Link</label>
                 <input 
                   type="text" 
                   value={sheetUrlInput} 
                   onChange={(e) => setSheetUrlInput(e.target.value)} 
                   placeholder="https://docs.google.com/spreadsheets/d/..."
                   className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold shadow-inner"
                 />
               </div>
               <button type="submit" disabled={syncing} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center space-x-3 active:scale-95">
                 {syncing && <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>}
                 <span>{syncing ? 'Syncing to Firebase...' : 'Update Firebase Cloud Database'}</span>
               </button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
