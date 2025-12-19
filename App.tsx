
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student } from './types';
import StudentCard from './components/StudentCard';
import AdminDashboard from './components/AdminDashboard';
import FileUpload from './components/FileUpload';
import { getGeminiInsights } from './services/geminiService';

const DB_KEY = 'student_explorer_db';
const PWD_KEY = 'student_explorer_pwd';
const DEFAULT_PWD = 'admin123';

type Role = 'user' | 'admin' | null;

const App: React.FC = () => {
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(DB_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem(PWD_KEY) || DEFAULT_PWD;
  });

  const [role, setRole] = useState<Role>(() => {
    return (sessionStorage.getItem('app_role') as Role) || null;
  });
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [view, setView] = useState<'search' | 'admin'>('search');

  // Menu and Modal states
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isChangePwdModalOpen, setIsChangePwdModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Password change form state
  const [pwdForm, setPwdForm] = useState({ current: '', new: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    if (role) sessionStorage.setItem('app_role', role);
    else sessionStorage.removeItem('app_role');
  }, [role]);

  useEffect(() => {
    localStorage.setItem(DB_KEY, JSON.stringify(students));
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

  const handleDataLoaded = (data: Student[]) => {
    setLoading(true);
    setStudents(data);
    setTimeout(() => {
      setLoading(false);
      setIsUploadModalOpen(false);
      setView('admin');
    }, 800);
  };

  const clearDatabase = () => {
    if (confirm("Are you sure you want to delete all student records? This cannot be undone.")) {
      setStudents([]);
      localStorage.removeItem(DB_KEY);
      setIsProfileMenuOpen(false);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === adminPassword) {
      setRole('admin');
      setShowPasswordPrompt(false);
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
    }
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (pwdForm.current !== adminPassword) {
      setPwdMsg({ text: 'Current password incorrect', type: 'error' });
      return;
    }
    if (pwdForm.new.length < 4) {
      setPwdMsg({ text: 'New password too short (min 4)', type: 'error' });
      return;
    }
    if (pwdForm.new !== pwdForm.confirm) {
      setPwdMsg({ text: 'Passwords do not match', type: 'error' });
      return;
    }
    setAdminPassword(pwdForm.new);
    localStorage.setItem(PWD_KEY, pwdForm.new);
    setPwdMsg({ text: 'Password updated successfully!', type: 'success' });
    setPwdForm({ current: '', new: '', confirm: '' });
    setTimeout(() => {
      setIsChangePwdModalOpen(false);
      setPwdMsg(null);
    }, 1500);
  };

  const generateInsights = async () => {
    if (students.length === 0 || !searchQuery.trim()) return;
    setInsightsLoading(true);
    try {
      const result = await getGeminiInsights(students, searchQuery);
      setInsights(result);
    } catch (error) {
      setInsights("Unable to fetch insights.");
    } finally {
      setInsightsLoading(false);
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
            <p className="text-slate-500 mt-2 text-lg">Select access portal</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            <button onClick={() => setRole('user')} className="group bg-white p-10 rounded-[2.5rem] border-2 border-slate-100 text-left hover:border-indigo-500 hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Student & Staff</h3>
              <p className="text-slate-500">Search records and view assignments.</p>
            </button>
            <button onClick={() => setShowPasswordPrompt(true)} className="group bg-slate-900 p-10 rounded-[2.5rem] text-left hover:shadow-2xl transition-all">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Management</h3>
              <p className="text-slate-400">Secure administrative dashboard.</p>
            </button>
          </div>
        </div>
        {showPasswordPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowPasswordPrompt(false)} />
            <form onSubmit={handleAdminAuth} className="relative bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
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
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1">Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <nav className="flex items-center space-x-1 mr-2">
              <button onClick={() => setView('search')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'search' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Search</button>
              {role === 'admin' && (
                <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'admin' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Dashboard</button>
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
                      <>
                        <button onClick={() => { setIsUploadModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                          <svg className="w-4 h-4 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                          Import Student Data
                        </button>
                        <button onClick={() => { setIsChangePwdModalOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                          <svg className="w-4 h-4 mr-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                          Change Password
                        </button>
                        <button onClick={clearDatabase} className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">
                          <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          Clear Database
                        </button>
                        <div className="my-1 border-t border-slate-100"></div>
                      </>
                    )}
                    <button onClick={() => setRole(null)} className="w-full flex items-center px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                      Logout / Switch Role
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
             <p className="mt-4 text-xs text-slate-400 font-medium text-center italic">Supported headers: SID, SNAME, YEAR, SECTION, BRANCH, SPHNO, FPHNO, CNAME (Counsellor)</p>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isChangePwdModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsChangePwdModalOpen(false)} />
          <form onSubmit={handlePasswordUpdate} className="relative bg-white w-full max-w-md p-8 rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900 mb-6">Change Access Password</h3>
            <div className="space-y-4">
              <input type="password" placeholder="Current Password" value={pwdForm.current} onChange={e => setPwdForm({...pwdForm, current: e.target.value})} className="w-full p-4 bg-slate-50 border-transparent border-2 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold" />
              <input type="password" placeholder="New Password" value={pwdForm.new} onChange={e => setPwdForm({...pwdForm, new: e.target.value})} className="w-full p-4 bg-slate-50 border-transparent border-2 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold" />
              <input type="password" placeholder="Confirm New Password" value={pwdForm.confirm} onChange={e => setPwdForm({...pwdForm, confirm: e.target.value})} className="w-full p-4 bg-slate-50 border-transparent border-2 rounded-xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold" />
            </div>
            {pwdMsg && <p className={`mt-4 text-sm font-bold ${pwdMsg.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>{pwdMsg.text}</p>}
            <div className="flex gap-3 mt-8">
              <button type="button" onClick={() => setIsChangePwdModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100">Update Password</button>
            </div>
          </form>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 pt-10">
        {view === 'admin' && role === 'admin' ? (
          <AdminDashboard students={students} onDataLoaded={handleDataLoaded} onClearDatabase={clearDatabase} isLoading={loading} />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Search Container */}
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Search Records</h2>
              <div className="mt-8 relative group">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-indigo-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <input
                  type="text"
                  placeholder="Enter Name, SID, Branch, or Counsellor..."
                  className="w-full pl-16 pr-6 py-6 bg-white border-2 border-slate-100 rounded-3xl shadow-xl shadow-slate-200/50 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-xl text-slate-800 placeholder-slate-400 font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-6">
                {students.length === 0 ? (
                   <div className="bg-white p-16 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 rounded-3xl text-amber-500 mb-6">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h4 className="text-2xl font-bold text-slate-800">Database is empty</h4>
                    <p className="text-slate-500 max-w-sm mx-auto mt-3">Please notify an administrator to upload the student records file.</p>
                  </div>
                ) : !searchQuery.trim() ? (
                  <div className="bg-white/40 backdrop-blur-sm p-16 rounded-[2.5rem] border border-dashed border-slate-200 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 rounded-3xl text-indigo-500 mb-6 rotate-3">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h4 className="text-2xl font-bold text-slate-800">Ready to search</h4>
                    <p className="text-slate-500 max-w-sm mx-auto mt-3">The database currently has {students.length} students indexed.</p>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-2 px-2">
                      <h3 className="font-black text-slate-400 uppercase tracking-[0.2em] text-[11px]">
                        Results ({filteredStudents.length})
                      </h3>
                    </div>
                    <div className="space-y-6">
                      {filteredStudents.map((student) => (
                        <StudentCard key={student.id} student={student} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="bg-white p-16 rounded-[2.5rem] border border-slate-100 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-2xl text-red-300 mb-6">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </div>
                    <h4 className="text-xl font-bold text-slate-800">No records found</h4>
                    <p className="text-slate-500 mt-2">No data matches "{searchQuery}".</p>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div className="bg-indigo-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-indigo-200/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="flex items-center space-x-3 mb-6 relative z-10">
                    <div className="bg-indigo-500/30 p-2.5 rounded-xl">
                      <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <h3 className="font-bold text-xl">Intelligence</h3>
                  </div>
                  <p className="text-indigo-200 text-sm mb-8 leading-relaxed relative z-10">Use AI to analyze trends or summarize details for the current search results.</p>
                  
                  <button
                    onClick={generateInsights}
                    disabled={insightsLoading || !searchQuery.trim() || filteredStudents.length === 0}
                    className="w-full bg-white text-indigo-900 font-black py-4 rounded-2xl hover:bg-indigo-50 transition-all shadow-lg active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed relative z-10"
                  >
                    {insightsLoading ? 'Analyzing...' : 'Generate Insights'}
                  </button>

                  {insights && (
                    <div className="mt-8 p-5 bg-white/5 rounded-2xl text-sm border border-white/10 relative z-10 animate-in fade-in zoom-in-95 duration-300">
                      <p className="leading-relaxed text-indigo-50 font-medium">{insights}</p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                  <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest mb-6">Directory Info</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-slate-400">Total Records</span>
                      <span className="font-black text-slate-900">{students.length}</span>
                    </div>
                  </div>
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
