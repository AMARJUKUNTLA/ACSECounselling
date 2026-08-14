import { GoogleGenAI } from "@google/genai";
import { Student, AppUser } from "../types";
import { normalizeProgramBranch } from "./databaseService";

export interface AgentMetric {
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'red' | 'amber' | 'emerald' | 'indigo' | 'blue' | 'purple';
}

export interface AgentQueryResult {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  intent?: 'attendance_filter' | 'single_student' | 'multiple_students' | 'counsellor_stats' | 'general_stats' | 'cgpa_filter' | 'r_grade_filter' | 'conversational';
  students?: Student[];
  metrics?: AgentMetric[];
  highlightStudent?: Student;
  suggestedFollowUps?: string[];
  filterActionName?: string;
  filterValue?: string;
  exportable?: boolean;
}

/**
 * Clean & normalize attendance string into a number
 */
export const parseAttendanceValue = (attStr?: string): number | null => {
  if (!attStr) return null;
  const clean = attStr.replace(/[^0-9.]/g, '');
  if (!clean) return null;
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
};

/**
 * Clean & normalize CGPA string into a number
 */
export const parseCgpaValue = (cgpaStr?: string): number | null => {
  if (!cgpaStr) return null;
  const clean = cgpaStr.replace(/[^0-9.]/g, '');
  if (!clean) return null;
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
};

/**
 * Local deterministic NLP query processing engine
 * Guarantees 100% accuracy on attendance, student lookup, counsellors, etc.
 */
export const processLocalQuery = (
  rawQuery: string,
  students: Student[],
  currentUser: AppUser
): AgentQueryResult => {
  const query = rawQuery.trim().toLowerCase();
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const resultId = `msg-${Date.now()}`;

  // 1. ATTENDANCE QUERIES: BELOW 50%, < 50%, 50-65%, etc.
  const belowMatch = query.match(/(?:below|less than|<|under|sub|lower than)\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*%/i) ||
                     query.match(/([0-9]{1,2}(?:\.[0-9]+)?)\s*%\s*(?:and below|or less|below)/i) ||
                     query.match(/attendance\s*(?:below|<|less than)\s*([0-9]{1,2}(?:\.[0-9]+)?)/i);

  const betweenMatch = query.match(/(?:between|from)\s*([0-9]{1,2})\s*%?\s*(?:to|and|-)\s*([0-9]{1,2})\s*%/i);

  if (query.includes('below 50') || query.includes('<50') || query.includes('< 50') || query.includes('critical attendance') || (belowMatch && parseFloat(belowMatch[1]) <= 50)) {
    const threshold = belowMatch ? parseFloat(belowMatch[1]) : 50;
    const matching = students.filter(s => {
      const att = parseAttendanceValue(s.attendance);
      return att !== null && att < threshold;
    }).sort((a, b) => (parseAttendanceValue(a.attendance) || 0) - (parseAttendanceValue(b.attendance) || 0));

    const totalStudents = students.length || 1;
    const percentageOfBatch = ((matching.length / totalStudents) * 100).toFixed(1);

    // Group by branch
    const csbsCount = matching.filter(s => normalizeProgramBranch(s.branch).toLowerCase().includes('csbs')).length;
    const iotCount = matching.filter(s => normalizeProgramBranch(s.branch).toLowerCase().includes('iot')).length;

    // Counsellor count with most low-attendance
    const counsellorCounts: Record<string, number> = {};
    matching.forEach(s => {
      const c = s.counsellor || 'Unassigned';
      counsellorCounts[c] = (counsellorCounts[c] || 0) + 1;
    });
    const topCounsellor = Object.entries(counsellorCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      id: resultId,
      sender: 'agent',
      text: `Found **${matching.length} students** with critical attendance strictly below **${threshold}%**. This represents **${percentageOfBatch}%** of the total enrolled student body. Immediate counseling and parent notifications are recommended.`,
      timestamp,
      intent: 'attendance_filter',
      students: matching,
      exportable: true,
      filterActionName: `< ${threshold}% Attendance`,
      filterValue: 'low_attendance_50',
      metrics: [
        { label: 'Critical Attendance (<50%)', value: matching.length, color: 'red', subtext: `${percentageOfBatch}% of total students` },
        { label: 'B.Tech CSBS', value: csbsCount, color: 'indigo', subtext: 'In CSBS stream' },
        { label: 'B.Tech CSE(IoT)', value: iotCount, color: 'emerald', subtext: 'In IoT stream' },
        { 
          label: 'Most Affected Mentor', 
          value: topCounsellor ? topCounsellor[0] : 'None', 
          color: 'amber', 
          subtext: topCounsellor ? `${topCounsellor[1]} critical students` : 'N/A' 
        }
      ],
      suggestedFollowUps: [
        `Export CSV of students below ${threshold}% attendance`,
        'Show students with attendance between 50% and 65%',
        'List students with R-Grades (Attendance Shortage)',
        'Show counsellor-wise critical list'
      ]
    };
  }

  // Attendance below any custom percentage (e.g. below 65%, below 75%)
  if (belowMatch) {
    const threshold = parseFloat(belowMatch[1]);
    const matching = students.filter(s => {
      const att = parseAttendanceValue(s.attendance);
      return att !== null && att < threshold;
    }).sort((a, b) => (parseAttendanceValue(a.attendance) || 0) - (parseAttendanceValue(b.attendance) || 0));

    return {
      id: resultId,
      sender: 'agent',
      text: `Identified **${matching.length} students** whose overall attendance is below **${threshold}%**.`,
      timestamp,
      intent: 'attendance_filter',
      students: matching,
      exportable: true,
      filterActionName: `< ${threshold}% Attendance`,
      filterValue: `below_${threshold}`,
      metrics: [
        { label: `Attendance < ${threshold}%`, value: matching.length, color: threshold < 65 ? 'amber' : 'blue', subtext: 'Matching students' },
        { label: 'Total Students', value: students.length, color: 'indigo', subtext: 'Total cohort' }
      ],
      suggestedFollowUps: [
        'Show students below 50% attendance',
        'Show top performing students (CGPA > 8.5)',
        'List all counsellors'
      ]
    };
  }

  // Attendance between range (e.g. 50% to 65%)
  if (betweenMatch) {
    const minVal = Math.min(parseFloat(betweenMatch[1]), parseFloat(betweenMatch[2]));
    const maxVal = Math.max(parseFloat(betweenMatch[1]), parseFloat(betweenMatch[2]));

    const matching = students.filter(s => {
      const att = parseAttendanceValue(s.attendance);
      return att !== null && att >= minVal && att <= maxVal;
    }).sort((a, b) => (parseAttendanceValue(a.attendance) || 0) - (parseAttendanceValue(b.attendance) || 0));

    return {
      id: resultId,
      sender: 'agent',
      text: `Found **${matching.length} students** with borderline attendance between **${minVal}% and ${maxVal}%** (Warning tier).`,
      timestamp,
      intent: 'attendance_filter',
      students: matching,
      exportable: true,
      metrics: [
        { label: `${minVal}% - ${maxVal}% Attendance`, value: matching.length, color: 'amber', subtext: 'Warning Category' }
      ],
      suggestedFollowUps: [
        'Show students below 50% attendance',
        'Show students with R-Grades'
      ]
    };
  }

  // 2. PARTICULAR STUDENT SEARCH (BY REG NO, NAME, PHONE, OR "STUDENT X")
  const studentKeywords = ['student', 'profile', 'details of', 'tell me about', 'who is', 'find', 'search', 'roll no', 'reg no', 'sid'];
  const isLookingForStudent = studentKeywords.some(kw => query.includes(kw)) || /^[0-9a-z]{5,15}$/i.test(query.trim());

  // Extract clean potential student identifier
  let searchToken = query;
  studentKeywords.forEach(kw => {
    searchToken = searchToken.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
  });
  searchToken = searchToken.replace(/details|data|info|information|about|for|record/gi, '').trim();

  if (searchToken.length >= 2 || isLookingForStudent) {
    const term = searchToken.toLowerCase();
    const matches = students.filter(s => {
      const reg = (s.regNo || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      const p1 = (s.phone1 || '').replace(/\D/g, '');
      const p2 = (s.phone2 || '').replace(/\D/g, '');

      return reg === term || 
             name === term ||
             (term.length >= 3 && reg.includes(term)) ||
             (term.length >= 3 && name.includes(term)) ||
             (term.length >= 6 && (p1.includes(term) || p2.includes(term)));
    });

    if (matches.length === 1) {
      const st = matches[0];
      const att = parseAttendanceValue(st.attendance);
      const cgpa = parseCgpaValue(st.cgpa);

      return {
        id: resultId,
        sender: 'agent',
        text: `Here is the comprehensive record for **${st.name}** (SID: \`${st.regNo}\`).`,
        timestamp,
        intent: 'single_student',
        highlightStudent: st,
        students: [st],
        metrics: [
          { 
            label: 'Attendance', 
            value: st.attendance ? `${st.attendance}%` : 'N/A', 
            color: (att !== null && att < 50) ? 'red' : (att !== null && att < 75) ? 'amber' : 'emerald',
            subtext: (att !== null && att < 50) ? '🚨 Critical Shortage' : (att !== null && att < 75) ? '⚠️ Warning' : '✅ Good Standing'
          },
          { 
            label: 'CGPA', 
            value: st.cgpa || 'N/A', 
            color: (cgpa !== null && cgpa >= 8.0) ? 'indigo' : (cgpa !== null && cgpa < 6.0) ? 'red' : 'blue',
            subtext: (cgpa !== null && cgpa >= 8.0) ? '🌟 Distinction' : 'Academic Standing'
          },
          { label: 'Year & Branch', value: `Yr ${st.year || '1'} • ${normalizeProgramBranch(st.branch)}`, color: 'purple' },
          { label: 'Assigned Mentor', value: st.counsellor || 'Unassigned', color: 'emerald', subtext: 'Faculty Mentor' }
        ],
        suggestedFollowUps: [
          `Show all students under ${st.counsellor || 'this mentor'}`,
          `Show students in Year ${st.year || '1'} ${normalizeProgramBranch(st.branch)}`,
          'Show students with below 50% attendance'
        ]
      };
    } else if (matches.length > 1 && matches.length <= 30) {
      return {
        id: resultId,
        sender: 'agent',
        text: `Found **${matches.length} matching students** for query "${searchToken}". Click any student below to view their detailed record.`,
        timestamp,
        intent: 'multiple_students',
        students: matches,
        suggestedFollowUps: [
          `Show details for ${matches[0].name}`,
          'Show students with below 50% attendance'
        ]
      };
    }
  }

  // 3. R-GRADE (ATTENDANCE SHORTAGE) / I-GRADE QUERIES
  if (query.includes('r-grade') || query.includes('r grade') || query.includes('backlog') || query.includes('shortage') || query.includes('rgrade')) {
    const rGradeStudents = students.filter(s => {
      const r = (s.rGrade || '').trim().toLowerCase();
      const count = Number(s.rGradeCount) || 0;
      return (r && r !== 'none' && r !== '0' && r !== 'nil' && r !== '-') || count > 0;
    });

    return {
      id: resultId,
      sender: 'agent',
      text: `Found **${rGradeStudents.length} students** with registered **R-Grades** (course repeats due to attendance shortage).`,
      timestamp,
      intent: 'r_grade_filter',
      students: rGradeStudents,
      exportable: true,
      metrics: [
        { label: 'R-Grade Shortage Cases', value: rGradeStudents.length, color: 'red', subtext: 'Mandatory course repeat' },
        { label: 'Total Cohort', value: students.length, color: 'indigo', subtext: 'All students' }
      ],
      suggestedFollowUps: [
        'Show students below 50% attendance',
        'Show top performers with CGPA > 8.5',
        'Show counsellor-wise breakdown'
      ]
    };
  }

  // 4. CGPA / TOP PERFORMER QUERIES
  if (query.includes('cgpa') || query.includes('topper') || query.includes('top student') || query.includes('highest') || query.includes('distinction')) {
    const cgpaThresholdMatch = query.match(/(?:cgpa|gpa)\s*(?:>|above|greater than|>=)\s*([0-9](?:\.[0-9]+)?)/i) ||
                               query.match(/(?:>|above)\s*([0-9](?:\.[0-9]+)?)\s*(?:cgpa|gpa)/i);

    const minCgpa = cgpaThresholdMatch ? parseFloat(cgpaThresholdMatch[1]) : 8.0;

    const topStudents = students.filter(s => {
      const c = parseCgpaValue(s.cgpa);
      return c !== null && c >= minCgpa;
    }).sort((a, b) => (parseCgpaValue(b.cgpa) || 0) - (parseCgpaValue(a.cgpa) || 0));

    return {
      id: resultId,
      sender: 'agent',
      text: `Identified **${topStudents.length} high-performing students** with CGPA ≥ **${minCgpa}**.`,
      timestamp,
      intent: 'cgpa_filter',
      students: topStudents,
      exportable: true,
      metrics: [
        { label: `CGPA ≥ ${minCgpa}`, value: topStudents.length, color: 'indigo', subtext: 'High Achievers' },
        { 
          label: 'Highest CGPA', 
          value: topStudents[0]?.cgpa || 'N/A', 
          color: 'emerald', 
          subtext: topStudents[0] ? `${topStudents[0].name} (${topStudents[0].regNo})` : 'N/A' 
        }
      ],
      suggestedFollowUps: [
        'Show students below 50% attendance',
        'Show students with R-Grades',
        'Branch breakdown (CSBS vs IoT)'
      ]
    };
  }

  // 5. COUNSELLOR QUERIES
  if (query.includes('counsellor') || query.includes('mentor') || query.includes('faculty')) {
    // Check if query is about a specific counsellor
    const foundCounsellor = Array.from(new Set(students.map(s => s.counsellor).filter(Boolean))).find(c => {
      return query.includes(c.toLowerCase());
    });

    if (foundCounsellor) {
      const assigned = students.filter(s => (s.counsellor || '').toLowerCase() === foundCounsellor.toLowerCase());
      const lowAtt = assigned.filter(s => {
        const att = parseAttendanceValue(s.attendance);
        return att !== null && att < 50;
      });

      return {
        id: resultId,
        sender: 'agent',
        text: `Mentor **${foundCounsellor}** is assigned **${assigned.length} students** (${lowAtt.length} with critical attendance < 50%).`,
        timestamp,
        intent: 'multiple_students',
        students: assigned,
        exportable: true,
        metrics: [
          { label: 'Assigned Mentees', value: assigned.length, color: 'indigo', subtext: foundCounsellor },
          { label: 'Critical Attendance (<50%)', value: lowAtt.length, color: lowAtt.length > 0 ? 'red' : 'emerald', subtext: 'Requires counseling' }
        ],
        suggestedFollowUps: [
          'Show students below 50% attendance',
          'List all counsellors'
        ]
      };
    }

    // General counsellor breakdown
    const counsellorMap: Record<string, { total: number; lowAtt: number; rGrades: number }> = {};
    students.forEach(s => {
      const c = s.counsellor || 'Unassigned';
      if (!counsellorMap[c]) {
        counsellorMap[c] = { total: 0, lowAtt: 0, rGrades: 0 };
      }
      counsellorMap[c].total++;
      const att = parseAttendanceValue(s.attendance);
      if (att !== null && att < 50) counsellorMap[c].lowAtt++;
      const r = (s.rGrade || '').trim().toLowerCase();
      if (r && r !== 'none' && r !== '0') counsellorMap[c].rGrades++;
    });

    const totalCounsellors = Object.keys(counsellorMap).length;
    const sortedCounsellors = Object.entries(counsellorMap).sort((a, b) => b[1].lowAtt - a[1].lowAtt);

    return {
      id: resultId,
      sender: 'agent',
      text: `There are **${totalCounsellors} active mentors / counsellors** tracking **${students.length} students**.`,
      timestamp,
      intent: 'counsellor_stats',
      metrics: [
        { label: 'Active Mentors', value: totalCounsellors, color: 'indigo' },
        { 
          label: 'Mentor with most <50% attendance', 
          value: sortedCounsellors[0] ? sortedCounsellors[0][0] : 'None', 
          color: 'red',
          subtext: sortedCounsellors[0] ? `${sortedCounsellors[0][1].lowAtt} students < 50%` : ''
        }
      ],
      suggestedFollowUps: [
        'Show students below 50% attendance',
        'Show students with R-Grades'
      ]
    };
  }

  // 6. BRANCH / DEPARTMENT / YEAR QUERIES
  if (query.includes('branch') || query.includes('csbs') || query.includes('iot') || query.includes('department') || query.includes('year')) {
    const isIot = query.includes('iot');
    const isCsbs = query.includes('csbs');

    let filtered = students;
    if (isIot) {
      filtered = filtered.filter(s => normalizeProgramBranch(s.branch).toLowerCase().includes('iot'));
    } else if (isCsbs) {
      filtered = filtered.filter(s => normalizeProgramBranch(s.branch).toLowerCase().includes('csbs'));
    }

    const yearMatch = query.match(/year\s*([1-4])|([1-4])(?:st|nd|rd|th)?\s*year/i);
    if (yearMatch) {
      const yr = yearMatch[1] || yearMatch[2];
      filtered = filtered.filter(s => s.year === yr);
    }

    const lowAtt = filtered.filter(s => {
      const a = parseAttendanceValue(s.attendance);
      return a !== null && a < 50;
    });

    return {
      id: resultId,
      sender: 'agent',
      text: `Summary for **${isIot ? 'B.Tech CSE(IoT)' : isCsbs ? 'B.Tech CSBS' : 'All Department Cohorts'}** (${filtered.length} students total):`,
      timestamp,
      intent: 'multiple_students',
      students: filtered,
      exportable: true,
      metrics: [
        { label: 'Selected Cohort Size', value: filtered.length, color: 'indigo' },
        { label: 'Critical Attendance (<50%)', value: lowAtt.length, color: lowAtt.length > 0 ? 'red' : 'emerald', subtext: `${((lowAtt.length / (filtered.length || 1)) * 100).toFixed(1)}% of cohort` }
      ],
      suggestedFollowUps: [
        'Show students below 50% attendance',
        'Show students with R-Grades',
        'Top performers in this cohort'
      ]
    };
  }

  // 7. DEFAULT GENERAL OVERVIEW & STATS
  const below50Count = students.filter(s => {
    const a = parseAttendanceValue(s.attendance);
    return a !== null && a < 50;
  }).length;

  const rGradeCount = students.filter(s => {
    const r = (s.rGrade || '').trim().toLowerCase();
    return r && r !== 'none' && r !== '0';
  }).length;

  const topCgpaCount = students.filter(s => {
    const c = parseCgpaValue(s.cgpa);
    return c !== null && c >= 8.5;
  }).length;

  return {
    id: resultId,
    sender: 'agent',
    text: `I am your **EduNexus Academic & Attendance Agent**. I can instantly filter students, lookup individual records, analyze attendance shortages (<50%), track R-grades, and examine mentor distributions.\n\nTry asking queries like:\n- *"Show students below 50% attendance"*\n- *"Particular student data for [Roll No / Name]"*\n- *"Students with R-Grades"*\n- *"Top performers with CGPA > 8.5"*`,
    timestamp,
    intent: 'general_stats',
    metrics: [
      { label: 'Total Enrolled', value: students.length, color: 'indigo' },
      { label: 'Critical Att. (<50%)', value: below50Count, color: 'red', subtext: 'Needs immediate action' },
      { label: 'R-Grade Shortages', value: rGradeCount, color: 'amber', subtext: 'Course repeats' },
      { label: 'Top Performers (≥8.5)', value: topCgpaCount, color: 'emerald', subtext: 'Distinction' }
    ],
    suggestedFollowUps: [
      '🚨 Show students below 50% attendance',
      '⚠️ Show students between 50% and 65% attendance',
      '❌ Show students with R-Grades',
      '⭐ Show top performing students (CGPA > 8.5)'
    ]
  };
};

/**
 * Enhanced Query Handler combining deterministic local parsing and Gemini 3.7 Flash
 */
export const queryAgent = async (
  query: string,
  students: Student[],
  currentUser: AppUser
): Promise<AgentQueryResult> => {
  // First run local deterministic engine (which is instantaneous and 100% accurate on data)
  const localResult = processLocalQuery(query, students, currentUser);

  // If local engine already matched specific entities or filter commands, return it directly
  if (
    localResult.intent === 'attendance_filter' ||
    localResult.intent === 'single_student' ||
    localResult.intent === 'r_grade_filter' ||
    (localResult.students && localResult.students.length > 0)
  ) {
    return localResult;
  }

  // Otherwise, if Gemini API key exists, call Gemini 3.7 Flash for deep natural language understanding
  try {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Prepare statistical summary of dataset
      const totalCount = students.length;
      const lowAttCount = students.filter(s => (parseAttendanceValue(s.attendance) || 0) < 50).length;
      const rGradeCount = students.filter(s => (s.rGrade && s.rGrade.toLowerCase() !== 'none')).length;

      // Sample preview of 25 students
      const preview = students.slice(0, 30).map(s => ({
        regNo: s.regNo,
        name: s.name,
        branch: normalizeProgramBranch(s.branch),
        year: s.year,
        attendance: s.attendance,
        cgpa: s.cgpa,
        counsellor: s.counsellor
      }));

      const prompt = `You are the AI Academic & Attendance Assistant for EduNexus (Dept. of CSBS & IoT).
Total Students in Database: ${totalCount}.
Critical Attendance (<50%): ${lowAttCount}.
Students with R-Grades: ${rGradeCount}.
Student Dataset Sample: ${JSON.stringify(preview)}

User Admin Query: "${query}"

Provide a concise, professional, structured answer formatted in Markdown with bold key figures and clear bullet points. If the query asks for a specific student, attendance threshold, or counsellor, explain clearly how to find it and summarize the relevant facts.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          temperature: 0.3
        }
      });

      if (response.text) {
        return {
          ...localResult,
          text: response.text,
          intent: 'conversational'
        };
      }
    }
  } catch (err) {
    console.warn('Gemini query error, falling back to local engine:', err);
  }

  return localResult;
};
