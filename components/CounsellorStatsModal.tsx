import React, { useState, useMemo } from 'react';
import { Student, AppUser } from '../types';

interface CounsellorStatsModalProps {
  counsellorName: string;
  counsellorUser?: AppUser;
  students: Student[];
  currentUser: AppUser;
  onClose: () => void;
  onSelectStudent: (student: Student) => void;
}

const CounsellorStatsModal: React.FC<CounsellorStatsModalProps> = ({
  counsellorName,
  counsellorUser,
  students,
  currentUser,
  onClose,
  onSelectStudent
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'CLEAN' | 'R_GRADE' | 'I_GRADE' | 'BOTH'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Assigned Counseling Students for this Counsellor
  const assignedStudents = useMemo(() => {
    if (!counsellorName) return [];
    const target = counsellorName.trim().toLowerCase();
    return students.filter(s => {
      if (!s.counsellor) return false;
      const sc = s.counsellor.trim().toLowerCase();
      return sc === target || target.includes(sc) || sc.includes(target);
    });
  }, [students, counsellorName]);

  // Analyze Grade Statuses
  const analyzedData = useMemo(() => {
    let cleanCount = 0; // NO R-Grade AND NO I-Grade
    let rGradeCount = 0; // Having R-Grade
    let iGradeCount = 0; // Having I-Grade
    let bothCount = 0; // Having BOTH R-Grade AND I-Grade

    const items = assignedStudents.map(s => {
      const rStr = (s.rGrade || '').trim().toLowerCase();
      const hasR = rStr !== '' && rStr !== 'none' && rStr !== '0';

      const iStr = (s.iGrade || '').trim().toLowerCase();
      const hasI = iStr !== '' && iStr !== 'none' && iStr !== '0';

      if (!hasR && !hasI) cleanCount++;
      if (hasR) rGradeCount++;
      if (hasI) iGradeCount++;
      if (hasR && hasI) bothCount++;

      const attVal = parseFloat((s.attendance || '0').toString().replace('%', ''));
      const cgpaVal = parseFloat((s.cgpa || '0').toString());

      return {
        student: s,
        hasR,
        hasI,
        isClean: !hasR && !hasI,
        hasBoth: hasR && hasI,
        attVal,
        cgpaVal
      };
    });

    return {
      total: assignedStudents.length,
      cleanCount,
      rGradeCount,
      iGradeCount,
      bothCount,
      items
    };
  }, [assignedStudents]);

  // Filtered List inside Modal
  const filteredItems = useMemo(() => {
    return analyzedData.items.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const s = item.student;
      const matchesSearch = !q || 
        s.name.toLowerCase().includes(q) || 
        s.regNo.toLowerCase().includes(q) ||
        (s.phone1 && s.phone1.includes(q)) ||
        (s.phone2 && s.phone2.includes(q));

      if (!matchesSearch) return false;

      if (filterTab === 'CLEAN') return item.isClean;
      if (filterTab === 'R_GRADE') return item.hasR;
      if (filterTab === 'I_GRADE') return item.hasI;
      if (filterTab === 'BOTH') return item.hasBoth;

      return true; // 'ALL'
    });
  }, [analyzedData, filterTab, searchTerm]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] p-6 md:p-8 max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-6">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2.5 text-slate-400 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-all"
          title="Close dialog"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pr-10 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-xs font-black text-indigo-700 mb-2">
              <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
              <span>FACULTY COUNSELLOR ANALYSIS REPORT</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              {counsellorName}
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Department: <span className="text-slate-800">{counsellorUser?.department || 'Department of CSBS & IoT'}</span> | Assigned Counseling Portfolio Overview
            </p>
          </div>
        </div>

        {/* Breakdown Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          
          {/* Total Counseling Students */}
          <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Assigned</span>
            <span className="text-3xl font-black text-white">{analyzedData.total}</span>
            <span className="text-[10px] font-bold text-slate-300 block">Counseling Students</span>
          </div>

          {/* NO R-Grade & NO I-Grade (Clean Standing) */}
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-3xl shadow-sm space-y-1">
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">No R & No I Grade</span>
            <span className="text-3xl font-black text-emerald-800">{analyzedData.cleanCount}</span>
            <span className="text-[10px] font-bold text-emerald-600 block">✅ Clean Standing</span>
          </div>

          {/* HAVING R-Grade */}
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl shadow-sm space-y-1">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block">Having R-Grade</span>
            <span className="text-3xl font-black text-amber-900">{analyzedData.rGradeCount}</span>
            <span className="text-[10px] font-bold text-amber-700 block">🚫 Att. Shortage Backlog</span>
          </div>

          {/* HAVING I-Grade */}
          <div className="bg-purple-50 border border-purple-200 p-5 rounded-3xl shadow-sm space-y-1">
            <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest block">Having I-Grade</span>
            <span className="text-3xl font-black text-purple-900">{analyzedData.iGradeCount}</span>
            <span className="text-[10px] font-bold text-purple-700 block">📝 Supply Exam Backlog</span>
          </div>

          {/* HAVING BOTH R-Grade & I-Grade */}
          <div className="bg-red-50 border border-red-200 p-5 rounded-3xl shadow-sm space-y-1 col-span-2 md:col-span-1">
            <span className="text-[10px] font-black text-red-700 uppercase tracking-widest block">Both R & I Grade</span>
            <span className="text-3xl font-black text-red-800">{analyzedData.bothCount}</span>
            <span className="text-[10px] font-bold text-red-600 block">🚨 Critical Dual Backlog</span>
          </div>
        </div>

        {/* Filter Tabs & Search Bar inside Modal */}
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: `All Students (${analyzedData.total})`, activeColor: 'bg-slate-900 text-white' },
              { id: 'CLEAN', label: `✅ No R & I Grade (${analyzedData.cleanCount})`, activeColor: 'bg-emerald-600 text-white' },
              { id: 'R_GRADE', label: `🚫 Having R-Grade (${analyzedData.rGradeCount})`, activeColor: 'bg-amber-600 text-white' },
              { id: 'I_GRADE', label: `📝 Having I-Grade (${analyzedData.iGradeCount})`, activeColor: 'bg-purple-600 text-white' },
              { id: 'BOTH', label: `🚨 Both R & I (${analyzedData.bothCount})`, activeColor: 'bg-red-600 text-white' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${filterTab === tab.id ? `${tab.activeColor} shadow-sm scale-105` : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input 
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search in this counsellor's list..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-indigo-500"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>

        {/* Student List Grid */}
        <div className="space-y-3">
          {filteredItems.map(({ student, hasR, hasI, isClean, hasBoth, attVal, cgpaVal }) => (
            <div 
              key={student.id}
              className={`p-5 rounded-2xl border transition-all hover:shadow-md bg-white ${hasBoth ? 'border-red-200 hover:border-red-400 bg-red-50/20' : hasR ? 'border-amber-200 hover:border-amber-400' : hasI ? 'border-purple-200 hover:border-purple-400' : 'border-slate-100'}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Student Identity */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h4 className="text-base font-black text-slate-900">{student.name}</h4>
                    <span className="font-mono text-xs font-extrabold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">{student.regNo}</span>
                    
                    {/* Status Chips */}
                    {isClean && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                        ✅ Clean Standing
                      </span>
                    )}
                    {hasBoth && (
                      <span className="px-2.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                        🚨 Both R & I Grade
                      </span>
                    )}
                    {!hasBoth && hasR && (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider">
                        🚫 Has R-Grade
                      </span>
                    )}
                    {!hasBoth && hasI && (
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-900 rounded-full text-[10px] font-black uppercase tracking-wider">
                        📝 Has I-Grade
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-slate-500">
                    Year: <span className="text-slate-800">{student.year || '3rd'}</span> | Sec: <span className="text-slate-800">{student.section || 'A'}</span> | Dept: <span className="text-indigo-600 font-black">{student.branch || 'CSBS'}</span>
                  </p>
                </div>

                {/* Open Student Card Action Button */}
                <button
                  onClick={() => {
                    onSelectStudent(student);
                    onClose();
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-all shadow-sm active:scale-95 flex items-center space-x-1.5 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                  <span>Open Student Record</span>
                </button>
              </div>

              {/* Stats Bar */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-bold">
                <div className={`p-2.5 rounded-xl border ${attVal < 75 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest block opacity-70">Attendance</span>
                  <span className="text-xs font-black">{student.attendance ? `${student.attendance}%` : 'N/A'}</span>
                  {attVal < 75 && <span className="text-[8px] font-black block text-red-600">🚨 &lt;75% Limit</span>}
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                  <span className="text-[9px] font-black uppercase tracking-widest block opacity-70">CGPA</span>
                  <span className="text-xs font-black text-slate-900">{student.cgpa || 'N/A'}</span>
                </div>

                <div className={`p-2.5 rounded-xl border ${hasR ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest block opacity-70">R-Grade Courses</span>
                  <span className="text-xs font-black truncate block" title={student.rGrade || 'None'}>
                    {hasR ? student.rGrade : 'None'}
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border ${hasI ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                  <span className="text-[9px] font-black uppercase tracking-widest block opacity-70">I-Grade Courses</span>
                  <span className="text-xs font-black truncate block" title={student.iGrade || 'None'}>
                    {hasI ? student.iGrade : 'None'}
                  </span>
                </div>
              </div>

              {/* Phone Contacts */}
              <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center space-x-4">
                <span>Student Mob: <strong className="font-mono text-slate-800">{student.phone1 || 'N/A'}</strong></span>
                <span>Parent Mob: <strong className="font-mono text-slate-800">{student.phone2 || 'N/A'}</strong></span>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="bg-slate-50 p-10 rounded-2xl text-center border border-slate-100">
              <p className="text-sm font-black text-slate-600">No students match this grade filter</p>
              <p className="text-xs font-bold text-slate-400 mt-1">Try selecting another filter tab above.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CounsellorStatsModal;
