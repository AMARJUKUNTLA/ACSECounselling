
import React from 'react';
import { Student } from '../types';

interface StudentCardProps {
  student: Student;
}

const StudentCard: React.FC<StudentCardProps> = ({ student }) => {
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
           <span className="text-white text-[10px] font-black uppercase tracking-wider">{student.branch || 'General'}</span>
        </div>
      </div>
      
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 block">Contact Information</label>
            <div className="space-y-3">
              {/* Student Phone (SPHNO) */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                <div className="flex items-center text-slate-700">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mr-3 text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Student</p>
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

              {/* Parent Phone (FPHNO) */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-emerald-200 transition-all">
                <div className="flex items-center text-slate-700">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mr-3 text-emerald-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Parent</p>
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
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Mentor Assigned</label>
            <p className="text-slate-800 font-bold text-sm bg-slate-50 p-2.5 rounded-xl border border-slate-100">{student.counsellor || 'Not Assigned'}</p>
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
          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Program / Branch</label>
            <p className="text-indigo-900 font-black uppercase text-sm">{student.branch || 'Not Assigned'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCard;
