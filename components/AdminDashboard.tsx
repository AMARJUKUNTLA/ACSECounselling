
import React, { useMemo, useState, useEffect } from 'react';
import { Student } from '../types';
import StudentCard from './StudentCard';

interface AdminDashboardProps {
  students: Student[];
  onDataLoaded: (data: Student[]) => void;
  onClearDatabase: () => void;
  isLoading: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  students, 
  onDataLoaded, 
  onClearDatabase, 
  isLoading 
}) => {
  const [selectedCounsellor, setSelectedCounsellor] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search states for breakdowns
  const [counsellorSearch, setCounsellorSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const stats = useMemo(() => {
    const branches = new Set(students.map(s => s.branch)).size;
    const years = new Set(students.map(s => s.year)).size;
    const counsellors = new Set(students.map(s => s.counsellor).filter(Boolean)).size;
    const uniqueSections = new Set(students.map(s => `${s.year}-${s.branch}-${s.section}`)).size;
    return { branches, years, sections: uniqueSections, counsellors };
  }, [students]);

  // Filtered breakdown data
  const counsellorAnalytics = useMemo(() => {
    const counsellorCounts: Record<string, number> = {};
    students.forEach(s => {
      const c = s.counsellor || 'Unassigned';
      counsellorCounts[c] = (counsellorCounts[c] || 0) + 1;
    });
    return Object.entries(counsellorCounts)
      .filter(([name]) => name.toLowerCase().includes(counsellorSearch.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
  }, [students, counsellorSearch]);

  const sectionAnalytics = useMemo(() => {
    const sectionCounts: Record<string, number> = {};
    students.forEach(s => {
      const key = `${s.year} - ${s.branch} (Sec: ${s.section})`;
      sectionCounts[key] = (sectionCounts[key] || 0) + 1;
    });
    return Object.entries(sectionCounts)
      .filter(([name]) => name.toLowerCase().includes(sectionSearch.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [students, sectionSearch]);

  // Drilldown list for the main panel
  const drilledStudents = useMemo(() => {
    if (selectedCounsellor) {
      return students.filter(s => (s.counsellor || 'Unassigned') === selectedCounsellor);
    }
    if (selectedSection) {
      return students.filter(s => `${s.year} - ${s.branch} (Sec: ${s.section})` === selectedSection);
    }
    return [];
  }, [students, selectedCounsellor, selectedSection]);

  const openStudentDetails = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleCounsellorClick = (name: string) => {
    setSelectedSection(null);
    setSelectedCounsellor(name === selectedCounsellor ? null : name);
  };

  const handleSectionClick = (name: string) => {
    setSelectedCounsellor(null);
    setSelectedSection(name === selectedSection ? null : name);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500 relative">
      {/* Student Details Modal */}
      {isModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-6 right-6 z-10">
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="max-h-[85vh] overflow-y-auto custom-scrollbar p-6 pt-12 sm:p-10">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Student Profile View</h4>
              <StudentCard student={selectedStudent} />
            </div>
          </div>
        </div>
      )}

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Students</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{students.length}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Departments</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{stats.branches}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Counsellors</p>
          <p className="text-3xl font-black text-indigo-600 mt-1">{stats.counsellors}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Sections</p>
          <p className="text-3xl font-black text-orange-500 mt-1">{stats.sections}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Breakdowns */}
        <div className="lg:col-span-4 space-y-8">
          {/* Counsellor Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col max-h-[450px]">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Counsellor Breakdown</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Staff Directory</p>
            
            <div className="relative mb-4">
              <input 
                type="text" 
                placeholder="Search staff..." 
                value={counsellorSearch}
                onChange={(e) => setCounsellorSearch(e.target.value)}
                className="w-full pl-4 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-300 text-sm font-bold text-slate-700"
              />
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {counsellorAnalytics.length > 0 ? counsellorAnalytics.map(([name, count]) => (
                <button 
                  key={name} 
                  onClick={() => handleCounsellorClick(name)} 
                  className={`w-full p-3 rounded-xl border text-left transition-all ${selectedCounsellor === name ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-indigo-300'}`}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-sm truncate pr-2">{name}</h4>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${selectedCounsellor === name ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                  </div>
                </button>
              )) : (
                <p className="text-center text-slate-400 text-xs py-4">No counsellors found</p>
              )}
            </div>
          </div>

          {/* Section-wise Count */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col max-h-[450px]">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Section Roster</h3>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Class Distribution</p>
            
            <div className="relative mb-4">
              <input 
                type="text" 
                placeholder="Filter sections..." 
                value={sectionSearch}
                onChange={(e) => setSectionSearch(e.target.value)}
                className="w-full pl-4 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-300 text-sm font-bold text-slate-700"
              />
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {sectionAnalytics.length > 0 ? sectionAnalytics.map(([name, count]) => (
                <button 
                  key={name} 
                  onClick={() => handleSectionClick(name)} 
                  className={`w-full p-3 rounded-xl border text-left transition-all ${selectedSection === name ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-orange-300'}`}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs truncate pr-2 uppercase">{name}</h4>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${selectedSection === name ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                  </div>
                </button>
              )) : (
                <p className="text-center text-slate-400 text-xs py-4">No sections found</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Roster List (Replaces Structure Explorer Table) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col min-h-[600px] max-h-[950px] overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-white sticky top-0 z-10 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {selectedCounsellor ? 'Counsellor Roster' : selectedSection ? 'Section Roster' : 'Student Roster'}
                </h3>
                { (selectedCounsellor || selectedSection) ? (
                  <p className="text-indigo-600 text-xs font-black uppercase tracking-widest mt-1">
                    Viewing records for: {selectedCounsellor || selectedSection}
                  </p>
                ) : (
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                    Select a category from the left to view members
                  </p>
                )}
              </div>
              { (selectedCounsellor || selectedSection) && (
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
                    {drilledStudents.length} Students
                  </span>
                  <button 
                    onClick={() => { setSelectedCounsellor(null); setSelectedSection(null); }} 
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              { (selectedCounsellor || selectedSection) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {drilledStudents.map(student => (
                    <div 
                      key={student.id} 
                      onClick={() => openStudentDetails(student)} 
                      className="p-5 rounded-2xl border border-slate-100 bg-white hover:border-indigo-300 transition-all cursor-pointer group shadow-sm hover:shadow-md"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors uppercase text-sm">{student.name}</h5>
                          <p className="text-[10px] text-slate-400 font-bold tracking-wider">{student.regNo}</p>
                        </div>
                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">{student.branch}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-black bg-slate-50 text-slate-500 px-2 py-0.5 rounded border">Year {student.year}</span>
                        <span className="text-[9px] font-black bg-slate-50 text-slate-500 px-2 py-0.5 rounded border">Sec {student.section}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-60">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-slate-800">No Roster Selected</h4>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto mt-2">Click on a Counsellor or Section from the left sidebar to view the list of students.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
