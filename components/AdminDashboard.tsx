
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Student } from '../types';
import StudentCard from './StudentCard';
import * as CloudDB from '../services/databaseService';

interface AdminDashboardProps {
  students: Student[];
  onDataLoaded: (data: Student[]) => void;
  onClearDatabase: () => void;
  isLoading: boolean;
  onSyncCloud: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  students, 
  onDataLoaded, 
  onClearDatabase, 
  isLoading,
  onSyncCloud
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'settings'>('analytics');
  const [selectedCounsellor, setSelectedCounsellor] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCloudConfiguring, setIsCloudConfiguring] = useState(false);

  // Cloud Config Form State
  const [cloudForm, setCloudForm] = useState<CloudDB.FirebaseConfig>({
    apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem('edubase_firebase_config');
    if (saved) setCloudForm(JSON.parse(saved));
  }, []);

  const stats = useMemo(() => {
    const branches = new Set(students.map(s => s.branch)).size;
    const years = new Set(students.map(s => s.year)).size;
    const uniqueSections = new Set(students.map(s => `${s.year}-${s.branch}-${s.section}`)).size;
    return { branches, years, sections: uniqueSections, counsellors: new Set(students.map(s => s.counsellor)).size };
  }, [students]);

  const displayedStudents = useMemo(() => {
    if (selectedCounsellor) return students.filter(s => (s.counsellor || 'Unassigned') === selectedCounsellor);
    if (selectedSection) return students.filter(s => `${s.year} - ${s.branch} (Sec: ${s.section})` === selectedSection);
    return students;
  }, [students, selectedCounsellor, selectedSection]);

  const handleSaveCloudConfig = (e: React.FormEvent) => {
    e.preventDefault();
    CloudDB.saveCloudConfig(cloudForm);
    alert("Cloud Configuration Saved! App will now attempt to sync.");
    onSyncCloud();
    window.location.reload();
  };

  const handlePushToCloud = async () => {
    if (students.length === 0) return alert("No data to push.");
    setIsCloudConfiguring(true);
    try {
      await CloudDB.saveStudentsToCloud(students);
      alert("Success! Local data has been pushed to the cloud.");
    } catch (e) {
      alert("Failed to push. Is your Cloud Config correct?");
    } finally {
      setIsCloudConfiguring(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Tab Switcher */}
      <div className="flex bg-slate-200/50 p-1 rounded-2xl w-fit">
        <button onClick={() => setActiveTab('analytics')} className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Insights & Analytics</button>
        <button onClick={() => setActiveTab('settings')} className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>Cloud Settings</button>
      </div>

      {activeTab === 'analytics' ? (
        <div className="space-y-8">
           {/* Info Banner */}
           <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
              <h2 className="text-2xl font-black mb-2 relative z-10">Administrative Hub</h2>
              <p className="text-indigo-100 text-sm max-w-lg relative z-10">Manage student records globally. Changes here are synced in real-time to all connected mobile devices.</p>
           </div>

           {/* Stats Grid */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Database', value: students.length, color: 'text-slate-900' },
                { label: 'Departments', value: stats.branches, color: 'text-blue-600' },
                { label: 'Counsellors', value: stats.counsellors, color: 'text-indigo-600' },
                { label: 'Total Sections', value: stats.sections, color: 'text-orange-500' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className={`text-3xl font-black ${stat.color} mt-1`}>{stat.value}</p>
                </div>
              ))}
           </div>

           <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-black text-slate-800">Master Student Directory</h3>
                <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">{displayedStudents.length} Records</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 custom-scrollbar">
                {displayedStudents.map(s => (
                  <div key={s.id} onClick={() => { setSelectedStudent(s); setIsModalOpen(true); }} className="p-4 rounded-2xl border border-slate-100 hover:border-indigo-500 transition-all cursor-pointer bg-white shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-slate-800 text-sm truncate uppercase">{s.name}</h5>
                        <p className="text-[10px] font-black text-slate-400 mt-0.5">{s.regNo}</p>
                      </div>
                      <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase">{s.branch}</span>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      ) : (
        <div className="max-w-3xl space-y-8 animate-in slide-in-from-left-4 duration-500">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Cloud Database Setup</h3>
            <p className="text-slate-500 text-sm mb-8">To stop using local storage and enable mobile access, connect your app to a **Firebase Firestore** project.</p>

            <form onSubmit={handleSaveCloudConfig} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(cloudForm).map((key) => (
                  <div key={key}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">{key.replace(/([A-Z])/g, ' $1')}</label>
                    <input 
                      type="text" 
                      value={(cloudForm as any)[key]} 
                      onChange={(e) => setCloudForm({...cloudForm, [key]: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-sm"
                      placeholder={`Enter ${key}`}
                      required
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 pt-6">
                <button type="submit" className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Save & Connect Cloud</button>
                <button 
                  type="button" 
                  onClick={handlePushToCloud} 
                  disabled={isCloudConfiguring || !CloudDB.isCloudConfigured()}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-black transition-all disabled:opacity-30"
                >
                  {isCloudConfiguring ? 'Pusing Data...' : 'Push Local Data to Cloud'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem]">
            <h4 className="text-emerald-900 font-black text-lg mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              How to get these values?
            </h4>
            <ol className="text-emerald-800 text-sm space-y-3 list-decimal list-inside font-medium">
              <li>Go to <a href="https://console.firebase.google.com" target="_blank" className="underline font-bold">Firebase Console</a></li>
              <li>Create a new project named "EduBase"</li>
              <li>Add a "Web App" to your project</li>
              <li>Copy the "firebaseConfig" values and paste them above</li>
              <li>In the left sidebar, go to **Firestore Database** and click "Create Database"</li>
              <li>Set rules to **Test Mode** (or public for this demo) so your phone can read the data.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-200">
             <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Student Information</h4>
             <StudentCard student={selectedStudent} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
