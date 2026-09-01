import React, { useState, useEffect, useRef } from 'react';
import { Student, AppUser } from '../types';
import { queryAgent, AgentQueryResult, parseAttendanceValue, parseCgpaValue } from '../services/aiQueryEngine';
import { normalizeProgramBranch } from '../services/databaseService';

interface AdminAiChatbotProps {
  students: Student[];
  currentUser: AppUser;
  onSelectStudent: (student: Student) => void;
  onApplyDirectoryFilter?: (filterVal: string) => void;
  isFloatingDrawer?: boolean;
  onCloseDrawer?: () => void;
}

const QUICK_PROMPTS = [
  { label: '🚨 Below 50% Attendance Students', query: 'Show students with below 50% attendance' },
  { label: '⚠️ 50% - 65% Low Attendance', query: 'Show students with attendance between 50% and 65%' },
  { label: '🔍 Particular Student Lookup', query: 'Find student ' },
  { label: '⭐ Top Performers (CGPA ≥ 8.5)', query: 'Show top students with CGPA > 8.5' },
  { label: '❌ R-Grades (Att. Shortage)', query: 'Show students with R-Grades' },
  { label: '👨‍🏫 Counsellor-wise Breakdown', query: 'Show counsellor-wise student distribution' },
  { label: '🏢 CSBS vs IoT Cohort Stats', query: 'Show attendance breakdown for CSBS and IoT' },
];

const AdminAiChatbot: React.FC<AdminAiChatbotProps> = ({
  students,
  currentUser,
  onSelectStudent,
  onApplyDirectoryFilter,
  isFloatingDrawer = false,
  onCloseDrawer
}) => {
  const [messages, setMessages] = useState<AgentQueryResult[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [searchTableQuery, setSearchTableQuery] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize initial greeting message
  useEffect(() => {
    if (messages.length === 0 && students.length > 0) {
      const initialGreeting = queryAgent('overview stats', students, currentUser);
      initialGreeting.then(res => {
        setMessages([res]);
      });
    }
  }, [students]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    // Add user message
    const userMsg: AgentQueryResult = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await queryAgent(textToSend, students, currentUser);
      setMessages(prev => [...prev, response]);
    } catch (err) {
      console.error('Agent query error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: "I encountered a momentary issue processing that query. Please try rephrasing or click one of the suggested query buttons.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = (msg: AgentQueryResult) => {
    if (!msg.students || msg.students.length === 0) return;

    const headers = ['Reg No', 'Student Name', 'Branch', 'Year', 'Section', 'Attendance %', 'CGPA', 'Counsellor', 'Student Phone', 'Parent Phone', 'R-Grade'];
    const rows = msg.students.map(s => [
      `"${s.regNo || ''}"`,
      `"${s.name || ''}"`,
      `"${normalizeProgramBranch(s.branch || '')}"`,
      `"${s.year || ''}"`,
      `"${s.section || ''}"`,
      `"${s.attendance || ''}"`,
      `"${s.cgpa || ''}"`,
      `"${s.counsellor || ''}"`,
      `"${s.phone1 || ''}"`,
      `"${s.phone2 || ''}"`,
      `"${s.rGrade || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `edunexus_query_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Speech to text toggle
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your query.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputQuery(transcript);
          handleSend(transcript);
        }
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    const initialGreeting = queryAgent('overview stats', students, currentUser);
    initialGreeting.then(res => setMessages([res]));
  };

  return (
    <div className={`flex flex-col bg-white ${isFloatingDrawer ? 'h-[600px] w-[95vw] md:w-[680px] rounded-[2.5rem] shadow-2xl border border-slate-200' : 'h-[750px] rounded-[2.5rem] border border-slate-100 shadow-sm'} overflow-hidden relative animate-in fade-in duration-300`}>
      
      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex items-center justify-between border-b border-indigo-900/40 text-white shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-black text-sm text-white tracking-tight">Counselling Geenie 🧞✨</h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                Admin Mode
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Instant attendance filters, single student lookup & academic analytics ({students.length} students indexed)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            title="Reset conversation"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all text-xs font-bold flex items-center space-x-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Reset</span>
          </button>
          
          {isFloatingDrawer && onCloseDrawer && (
            <button
              onClick={onCloseDrawer}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="bg-slate-50/80 px-6 py-2.5 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto custom-scrollbar shrink-0">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0 flex items-center space-x-1 mr-1">
          <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>Suggested:</span>
        </span>
        {QUICK_PROMPTS.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (qp.query === 'Find student ') {
                setInputQuery('Find student ');
                inputRef.current?.focus();
              } else {
                handleSend(qp.query);
              }
            }}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-xs font-bold transition-all shadow-2xs whitespace-nowrap active:scale-95 shrink-0"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6 bg-slate-50/40">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              <div className={`max-w-[90%] md:max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                {/* Message Header */}
                <div className={`flex items-center space-x-2 mb-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <span className="w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-black text-white shadow-2xs">
                      AI
                    </span>
                  )}
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {isUser ? 'You (Admin)' : 'Counselling Geenie'}
                  </span>
                  <span className="text-[10px] text-slate-300 font-bold">{msg.timestamp}</span>
                </div>

                {/* Message Body Container */}
                <div
                  className={`p-5 rounded-[2rem] shadow-sm ${
                    isUser
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-100 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  {/* Text Content */}
                  <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </div>

                  {/* Metrics Cards if available */}
                  {msg.metrics && msg.metrics.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                      {msg.metrics.map((m, mIdx) => {
                        const colorMap = {
                          red: 'bg-red-50 text-red-700 border-red-100',
                          amber: 'bg-amber-50 text-amber-700 border-amber-100',
                          emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                          indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
                          blue: 'bg-blue-50 text-blue-700 border-blue-100',
                          purple: 'bg-purple-50 text-purple-700 border-purple-100'
                        };
                        const selectedColor = colorMap[m.color || 'indigo'];

                        return (
                          <div
                            key={mIdx}
                            className={`p-3 rounded-2xl border ${selectedColor} text-center shadow-2xs flex flex-col justify-between`}
                          >
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
                              {m.label}
                            </p>
                            <p className="text-lg font-black my-0.5 truncate">{m.value}</p>
                            {m.subtext && (
                              <p className="text-[9px] font-bold text-slate-400 truncate">{m.subtext}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Single Student Detailed Spotlight Card */}
                  {msg.highlightStudent && (
                    <div className="mt-5 p-5 bg-gradient-to-br from-indigo-50/60 via-slate-50 to-white rounded-2xl border border-indigo-100 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100/60">
                        <div>
                          <span className="text-[9px] font-black uppercase text-indigo-600 tracking-widest bg-indigo-100/60 px-2 py-0.5 rounded-md">
                            Student Profile Record
                          </span>
                          <h4 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                            {msg.highlightStudent.name}
                          </h4>
                          <p className="text-xs font-bold text-slate-500">
                            SID / Reg No: <span className="font-mono text-indigo-600 font-extrabold">{msg.highlightStudent.regNo}</span> • {normalizeProgramBranch(msg.highlightStudent.branch)} (Year {msg.highlightStudent.year || '2'} • Sec {msg.highlightStudent.section || 'A'})
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onSelectStudent(msg.highlightStudent!)}
                            className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center space-x-1.5 shrink-0"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Open Full Record</span>
                          </button>
                        </div>
                      </div>

                      {/* Stats Overview */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Overall Att.</span>
                          <p className={`text-base font-black mt-0.5 ${(parseAttendanceValue(msg.highlightStudent.attendance) || 0) < 50 ? 'text-red-600' : 'text-slate-800'}`}>
                            {msg.highlightStudent.attendance ? `${msg.highlightStudent.attendance}%` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase">CGPA</span>
                          <p className="text-base font-black text-slate-800 mt-0.5">{msg.highlightStudent.cgpa || 'N/A'}</p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase">R-Grade</span>
                          <p className={`text-base font-black mt-0.5 ${msg.highlightStudent.rGrade && msg.highlightStudent.rGrade.toLowerCase() !== 'none' ? 'text-red-600' : 'text-slate-800'}`}>
                            {msg.highlightStudent.rGrade || 'None'}
                          </p>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Mentor</span>
                          <p className="text-xs font-black text-slate-800 mt-1 truncate">{msg.highlightStudent.counsellor || 'Unassigned'}</p>
                        </div>
                      </div>

                      {/* Subject Attendance Breakdown if present */}
                      {msg.highlightStudent.subjectAttendance && Object.keys(msg.highlightStudent.subjectAttendance).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200/60">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                            Subject Attendance Breakdown:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(msg.highlightStudent.subjectAttendance).map(([subj, val]) => {
                              const numVal = parseAttendanceValue(val);
                              const isLow = numVal !== null && numVal < 50;

                              return (
                                <div key={subj} className={`p-2 rounded-lg border text-xs font-bold flex justify-between items-center ${isLow ? 'bg-red-50 border-red-100 text-red-800' : 'bg-white border-slate-200 text-slate-700'}`}>
                                  <span className="truncate max-w-[110px]" title={subj}>{subj}</span>
                                  <span className={`font-black ${isLow ? 'text-red-600' : 'text-indigo-600'}`}>{val || 'N/A'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Direct Contacts */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {msg.highlightStudent.phone1 && (
                          <a
                            href={`tel:${msg.highlightStudent.phone1}`}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-all shadow-2xs"
                          >
                            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>Call Student: {msg.highlightStudent.phone1}</span>
                          </a>
                        )}
                        {msg.highlightStudent.phone2 && (
                          <a
                            href={`tel:${msg.highlightStudent.phone2}`}
                            className="px-3 py-1.5 bg-white border border-emerald-200 hover:border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-all shadow-2xs"
                          >
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span>Call Parent: {msg.highlightStudent.phone2}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Multi-Student Table List (e.g. Below 50% attendance list) */}
                  {msg.students && msg.students.length > 0 && !msg.highlightStudent && (
                    <div className="mt-5 space-y-3">
                      {/* Search & Export Toolbar inside message */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-black text-slate-700">
                            {msg.students.length} Student Records Found
                          </span>
                          {msg.filterActionName && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md uppercase">
                              {msg.filterActionName}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* In-table instant search */}
                          <input
                            type="text"
                            placeholder="Filter this list..."
                            value={searchTableQuery[msg.id] || ''}
                            onChange={(e) => setSearchTableQuery({ ...searchTableQuery, [msg.id]: e.target.value })}
                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 w-36 sm:w-48"
                          />

                          {msg.exportable && (
                            <button
                              onClick={() => handleExportCsv(msg)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all shadow-2xs flex items-center space-x-1 active:scale-95 shrink-0"
                              title="Export these students as CSV"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>Export CSV</span>
                            </button>
                          )}

                          {onApplyDirectoryFilter && msg.filterValue && (
                            <button
                              onClick={() => onApplyDirectoryFilter(msg.filterValue!)}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-2xs flex items-center space-x-1 active:scale-95 shrink-0"
                              title="Filter main directory with this criteria"
                            >
                              <span>View in Directory</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Scrollable Students Table */}
                      <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-200/90 custom-scrollbar shadow-2xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-100 text-slate-500 uppercase text-[9px] font-black tracking-wider z-10 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Student</th>
                              <th className="py-2.5 px-3">SID / Reg No</th>
                              <th className="py-2.5 px-3">Branch & Yr</th>
                              <th className="py-2.5 px-3">Att. %</th>
                              <th className="py-2.5 px-3">CGPA</th>
                              <th className="py-2.5 px-3">Mentor</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {msg.students
                              .filter(st => {
                                const q = (searchTableQuery[msg.id] || '').toLowerCase();
                                if (!q) return true;
                                return (
                                  (st.name || '').toLowerCase().includes(q) ||
                                  (st.regNo || '').toLowerCase().includes(q) ||
                                  (st.counsellor || '').toLowerCase().includes(q) ||
                                  (st.branch || '').toLowerCase().includes(q)
                                );
                              })
                              .slice(0, 100) // Show up to 100 in table view
                              .map((st) => {
                                const attNum = parseAttendanceValue(st.attendance);
                                const isCritical = attNum !== null && attNum < 50;
                                const isWarning = attNum !== null && attNum >= 50 && attNum < 65;

                                return (
                                  <tr key={st.id || st.regNo} className="hover:bg-indigo-50/40 transition-colors">
                                    <td className="py-2.5 px-3 font-bold text-slate-800">
                                      <div className="flex items-center space-x-2">
                                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] flex items-center justify-center">
                                          {(st.name || '?')[0]}
                                        </span>
                                        <span className="truncate max-w-[130px] font-black">{st.name || 'Unknown'}</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                                      {st.regNo}
                                    </td>
                                    <td className="py-2.5 px-3 font-medium text-slate-600">
                                      <span className="truncate max-w-[110px] block">
                                        {normalizeProgramBranch(st.branch)} • Y{st.year || '2'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-black">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center space-x-1 ${
                                          isCritical
                                            ? 'bg-red-100 text-red-700'
                                            : isWarning
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                        }`}
                                      >
                                        {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping mr-0.5"></span>}
                                        <span>{st.attendance ? `${st.attendance}%` : 'N/A'}</span>
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-slate-700">
                                      {st.cgpa || 'N/A'}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500 font-medium truncate max-w-[100px]">
                                      {st.counsellor || 'Unassigned'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        onClick={() => onSelectStudent(st)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white rounded-lg text-[10px] font-black transition-all shadow-2xs active:scale-90"
                                      >
                                        Profile
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Follow-up Suggestions */}
                  {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center space-x-1">
                        <span>Suggested Queries:</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedFollowUps.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleSend(sug)}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-300 text-[11px] font-bold text-slate-600 hover:text-indigo-700 transition-all text-left"
                          >
                            ↳ {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-200">
            <div className="p-4 rounded-[2rem] rounded-tl-xs bg-white border border-slate-100 shadow-sm flex items-center space-x-3 text-slate-600">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-500">
                Agent is analyzing student records & calculating metrics...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleSpeechRecognition}
            className={`p-3 rounded-2xl border transition-all ${
              isListening
                ? 'bg-red-500 border-red-600 text-white animate-pulse shadow-md'
                : 'bg-slate-50 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500'
            }`}
            title={isListening ? "Listening... (click to stop)" : "Speak query (Microphone)"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask anything (e.g. 'below 50% attendance students', 'particular student data for 22A91A0501')..."
            className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            disabled={isLoading}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs rounded-2xl shadow-md transition-all active:scale-95 flex items-center space-x-1.5 shrink-0"
          >
            <span>Ask</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
        <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-slate-400 font-medium">
          <span>Supported: "below 50% attendance", "tell me about student [name/regNo]", "counsellor stats", "R-grades"</span>
          <span className="font-bold text-indigo-600">Counselling Geenie 🧞</span>
        </div>
      </div>
    </div>
  );
};

export default AdminAiChatbot;
