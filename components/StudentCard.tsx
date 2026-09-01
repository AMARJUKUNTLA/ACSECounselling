import React from 'react';
import { Student, AppUser } from '../types';
import StudentCounselingRemarks from './StudentCounselingRemarks';
import { getDepartmentForBranch, normalizeProgramBranch } from '../services/databaseService';

interface StudentCardProps {
  student: Student;
  currentUser?: AppUser;
  onOpenCounsellorAnalysis?: (counsellorName: string) => void;
}

const StudentCard: React.FC<StudentCardProps> = ({ student, currentUser, onOpenCounsellorAnalysis }) => {
  const handleCall = (phoneNumber: string) => {
    window.location.href = `tel:${phoneNumber.replace(/\s+/g, '')}`;
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300">
      <div className="bg-indigo-600 px-8 py-6 flex justify-between items-center">
        <div>
          <h3 className="text-white font-black text-xl leading-tight uppercase tracking-tight">{student.name || 'Unknown Name'}</h3>
          <p className="text-indigo-100 text-sm font-bold mt-1">SID: {student.regNo || 'N/A'}</p>
        </div>
        <div className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20">
           <span className="text-white text-[10px] font-black uppercase tracking-wider">{normalizeProgramBranch(student.branch || 'B.Tech CSBS')}</span>
        </div>
      </div>
      
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Contact Details</label>
              <div className="space-y-3">
                {/* Student Phone */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                  <div className="flex items-center text-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-3 text-indigo-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Student Phone</p>
                      <a href={`tel:${student.phone1}`} className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors truncate">{student.phone1 || 'Not Provided'}</a>
                    </div>
                  </div>
                  {student.phone1 && (
                    <button 
                      onClick={() => handleCall(student.phone1)}
                      className="w-8 h-8 bg-white text-indigo-600 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 005.505 5.505l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                    </button>
                  )}
                </div>

                {/* Parent Phone */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-emerald-200 transition-all">
                  <div className="flex items-center text-slate-700">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mr-3 text-emerald-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Parent Phone</p>
                      <a href={`tel:${student.phone2}`} className="text-sm font-black text-slate-800 hover:text-emerald-600 transition-colors truncate">{student.phone2 || 'Not Provided'}</a>
                    </div>
                  </div>
                  {student.phone2 && (
                    <button 
                      onClick={() => handleCall(student.phone2)}
                      className="w-8 h-8 bg-white text-emerald-600 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 005.505 5.505l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Assigned Mentor / Counsellor</label>
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-slate-800 font-bold text-sm">{student.counsellor || 'Not Assigned'}</p>
                {student.counsellor && onOpenCounsellorAnalysis && (
                  <button 
                    onClick={() => onOpenCounsellorAnalysis(student.counsellor)}
                    className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg transition-all flex items-center space-x-1"
                    title={`View counseling breakdown for ${student.counsellor}`}
                  >
                    <span>📊 Breakdown</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Year</label>
                <p className="text-slate-900 font-black text-2xl leading-none">{student.year || '-'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Section</label>
                <p className="text-slate-900 font-black text-2xl leading-none">{student.section || '-'}</p>
              </div>
            </div>
            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-between">
              <div>
                <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Offered Program</label>
                <p className="text-indigo-900 font-black uppercase text-base">{normalizeProgramBranch(student.branch || 'B.Tech CSBS')}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-indigo-100/60">
                <span className="text-[10px] font-bold text-indigo-600/80">
                  {getDepartmentForBranch(student.branch || 'CSBS')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Academic Performance & Backlogs Overview (CGPA, Attendance, R-Grade, I-Grade) */}
        <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-base font-black text-slate-900 flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full inline-block"></span>
              <span>Academic Performance & Backlog Summary</span>
            </h4>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                Last Attendance Updated: <span className="text-slate-700 font-extrabold">{student.attendanceUpdatedAt ? new Date(student.attendanceUpdatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Google Sheet Synced'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CGPA Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Cumulative CGPA</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-black text-slate-900">{student.cgpa || 'N/A'}</span>
                <span className="text-xs font-bold text-slate-400">/ 10.0</span>
              </div>
              <p className="text-[10px] font-bold text-blue-700 mt-2">
                {parseFloat(student.cgpa || '0') >= 7.5 ? '⭐ First Class with Distinction' : parseFloat(student.cgpa || '0') >= 6.0 ? '✅ First Class Standing' : '⚠️ Needs Academic Support'}
              </p>
            </div>

            {/* Attendance % Card */}
            <div className={`p-5 rounded-2xl border ${parseInt(student.attendance || '100') < 75 ? 'bg-red-50/70 border-red-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${parseInt(student.attendance || '100') < 75 ? 'text-red-600' : 'text-emerald-700'}`}>Overall Attendance</span>
              <div className="flex items-baseline space-x-1">
                <span className={`text-3xl font-black ${parseInt(student.attendance || '100') < 75 ? 'text-red-700' : 'text-emerald-900'}`}>{student.attendance ? `${student.attendance}%` : 'N/A'}</span>
              </div>
              <p className={`text-[10px] font-bold mt-2 ${parseInt(student.attendance || '100') < 75 ? 'text-red-700' : 'text-emerald-700'}`}>
                {parseInt(student.attendance || '100') < 75 ? '🚨 Shortage (< 75% limit)' : '✅ Satisfactory Attendance'}
              </p>
            </div>

            {/* R-Grade Card (Attendance Shortage Backlog) */}
            <div className={`p-5 rounded-2xl border ${student.rGrade && student.rGrade.toLowerCase() !== 'none' && student.rGrade !== '0' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">R-Grade Courses</span>
                {student.rGradeCount ? (
                  <span className="px-2 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-black">{student.rGradeCount} Courses</span>
                ) : null}
              </div>
              <p className="text-sm font-black text-slate-800 truncate" title={student.rGrade || 'None'}>
                {student.rGrade && student.rGrade.toLowerCase() !== 'none' ? student.rGrade : 'None (No Attendance Backlog)'}
              </p>
              <p className="text-[9px] font-bold text-amber-800/80 mt-2 leading-tight">
                ⚠️ <span className="font-extrabold">R-Grade:</span> Due to attendance shortage. Must re-register for course.
              </p>
            </div>

            {/* I-Grade Card (Internal Marks Shortage / Supply Exam) */}
            <div className={`p-5 rounded-2xl border ${student.iGrade && student.iGrade.toLowerCase() !== 'none' && student.iGrade !== '0' ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">I-Grade Courses</span>
                {student.iGradeCredits ? (
                  <span className="px-2 py-0.5 bg-purple-600 text-white rounded-full text-[10px] font-black">{student.iGradeCredits} Credits</span>
                ) : null}
              </div>
              <p className="text-sm font-black text-slate-800 truncate" title={student.iGrade || 'None'}>
                {student.iGrade && student.iGrade.toLowerCase() !== 'none' ? student.iGrade : 'None (No Internal Backlog)'}
              </p>
              <p className="text-[9px] font-bold text-purple-800/80 mt-2 leading-tight">
                📝 <span className="font-extrabold">I-Grade:</span> Incomplete internal marks. Must appear for supply exams.
              </p>
            </div>
          </div>

          {/* Subject-Wise Attendance Breakdown */}
          {student.subjectAttendance && Object.keys(student.subjectAttendance).length > 0 && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Subject-Wise Attendance Breakdown</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(student.subjectAttendance).map(([subj, val]) => {
                  const numVal = parseFloat(val.replace('%', ''));
                  const isLow = !isNaN(numVal) && numVal < 75;
                  return (
                    <div 
                      key={subj} 
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-2 ${isLow ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                      <span className="font-mono text-slate-900">{subj}:</span>
                      <span className={`font-black ${isLow ? 'text-red-700' : 'text-emerald-600'}`}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Permanent Student Remarks (Preserved across all attendance updates) */}
          {student.remarks && (
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                  Firebase Preserved Student Remarks
                </span>
                <span className="text-[9px] font-bold text-amber-600 bg-amber-100/80 px-2 py-0.5 rounded-full">Protected</span>
              </div>
              <p className="text-xs font-bold text-slate-800 leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-100/60">{student.remarks}</p>
            </div>
          )}
        </div>

        {/* Counseling & Behavioral Remarks Log */}
        {currentUser && (
          <StudentCounselingRemarks student={student} currentUser={currentUser} />
        )}
      </div>
    </div>
  );
};

export default StudentCard;
