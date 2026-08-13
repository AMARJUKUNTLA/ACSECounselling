import React, { useState, useEffect } from 'react';
import { Student, AppUser } from './types';
import LoginForm from './components/LoginForm';
import AdminDashboard from './components/AdminDashboard';
import FacultyDashboard from './components/FacultyDashboard';
import * as CloudDB from './services/databaseService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('edubase_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetUrl, setSheetUrl] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Auto-seed default accounts in Firestore on first render
  useEffect(() => {
    CloudDB.seedDefaultUsersIfEmpty();
  }, []);

  // Save current user session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('edubase_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('edubase_auth_user');
    }
  }, [currentUser]);

  const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1aHZzg0SxTAQvVfME5bMv2DKOaE3HgNUDvRVL8LKUp6o/edit?usp=sharing';

  // Subscribe to Firestore Real-Time Students and Config
  useEffect(() => {
    setLoading(true);

    const unsubscribeStudents = CloudDB.subscribeToStudents(
      (data) => {
        setStudents(data);
        setLoading(false);

        // If dataset is missing CGPA academic data or empty, automatically sync from user's Google Sheet URL
        if (data.length === 0 || !data.some(s => s.cgpa)) {
          console.log("Syncing default Google Sheet data into Firebase Cloud...");
          CloudDB.fetchFromGoogleSheets(DEFAULT_SHEET_URL).catch(err => {
            console.warn("Auto Google Sheet sync notice:", err);
          });
        }
      },
      (err) => {
        console.error("Firebase connection error:", err);
        setLoading(false);
      }
    );

    const unsubscribeConfig = CloudDB.subscribeToConfig((config) => {
      if (config.sheetUrl) setSheetUrl(config.sheetUrl);
      if (config.lastUpdated) setLastUpdated(config.lastUpdated);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeConfig();
    };
  }, []);

  const handleLogout = async () => {
    await CloudDB.logoutUserFromFirebase();
    setCurrentUser(null);
    setIsMenuOpen(false);
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

  // 1. Mandatory Authorization Lock Screen
  if (!currentUser) {
    return <LoginForm onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // 2. Main Authenticated Application Dashboard
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Portal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight leading-tight">EduNexus</h1>
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                  {currentUser.role === 'admin' ? 'Admin Portal' : 'Faculty Counseling Portal'}
                </span>
              </div>
            </div>
          </div>

          {/* User Account Controls */}
          <div className="flex items-center space-x-4">
            
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-black text-slate-800">{currentUser.name}</span>
              <span className="text-[10px] font-bold text-slate-400">{currentUser.email}</span>
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 p-1.5 pr-3 rounded-full transition-all border border-slate-200"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white ${currentUser.role === 'admin' ? 'bg-slate-900' : 'bg-emerald-600'}`}>
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-xs font-bold text-slate-700 capitalize">{currentUser.role}</span>
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Account Dropdown */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b border-slate-50 mb-1">
                    <p className="text-xs font-black text-slate-800">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{currentUser.email}</p>
                    <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${currentUser.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                      {currentUser.role} Access
                    </span>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-3.5 py-3 text-left text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                    <span>Sign Out / Switch Account</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* Main View Router based on Role */}
      <main className="max-w-7xl mx-auto px-4 pt-6 flex-1 w-full flex flex-col">
        {currentUser.role === 'admin' ? (
          <AdminDashboard 
            students={students}
            currentUser={currentUser}
            isLoading={loading}
            sheetUrl={sheetUrl}
            lastUpdated={lastUpdated}
            onExcelUpload={handleExcelUpload}
            onGoogleSheetSync={handleGoogleSheetSync}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
          />
        ) : (
          <FacultyDashboard 
            students={students}
            currentUser={currentUser}
            isLoading={loading}
          />
        )}
      </main>

    </div>
  );
};

export default App;
