
import { Student } from '../types';

const SHEET_URL_KEY = 'edubase_google_sheet_url';
const PWD_KEY = 'student_explorer_pwd';

// Fixed Global Bin ID for your specific application instance
const GLOBAL_BIN_ID = 'ed7d01804f326589312b'; 
const GLOBAL_KV_URL = `https://api.npoint.io/${GLOBAL_BIN_ID}`; 

export const saveSheetUrl = async (url: string) => {
  // 1. Update local storage for immediate responsiveness
  localStorage.setItem(SHEET_URL_KEY, url);
  
  // 2. Push to Cloud Bin (Overwrites the master configuration)
  try {
    const response = await fetch(GLOBAL_KV_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        active_sheet_url: url,
        timestamp: Date.now() 
      })
    });
    
    if (!response.ok) {
      // If PUT fails (bin might not exist), try POST as a fallback
      await fetch(`https://api.npoint.io/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_sheet_url: url })
      });
    }
    console.log("Master cloud configuration updated.");
  } catch (e) {
    console.error("Cloud update failed, data saved to local device only.", e);
    throw e;
  }
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || '';
};

export const fetchGlobalSheetUrl = async (): Promise<string | null> => {
  try {
    // Cache busting is critical for reflecting changes across devices
    const response = await fetch(`${GLOBAL_KV_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.active_sheet_url || null;
  } catch (e) {
    console.warn("Global cloud fetch unreachable, using local fallback.");
    return null;
  }
};

export const updateAdminPassword = (newPwd: string) => {
  localStorage.setItem(PWD_KEY, newPwd);
};

export const fetchFromGoogleSheets = async (url: string): Promise<Student[]> => {
  try {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) throw new Error("Invalid Google Sheets URL");
    
    const spreadsheetId = matches[1];
    // Add timestamp to Google URL to bypass their edge caching
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&t=${Date.now()}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Google Sheets access denied. Check 'Share' settings.");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map((line, index) => {
      // CSV split with regex to handle quoted values containing commas
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const getVal = (keys: string[]) => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== '') return row[key];
        }
        return '';
      };

      return {
        regNo: getVal(['sid', 'reg no', 'registration', 'regno', 'rno']),
        name: getVal(['sname', 'name', 'student name', 'stuname']),
        phone1: getVal(['sphno', 'phone1', 'student phone', 'phone 1', 'student mobile']),
        phone2: getVal(['fphno', 'phone2', 'father phone', 'parent phone', 'phone 2', 'father mobile']),
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor', 'counante']),
        year: getVal(['year', 'academic year', 'yr']),
        section: getVal(['section', 'sec']),
        branch: getVal(['branch', 'dept', 'department', 'br']),
        id: `gs-${index}-${Date.now()}`
      };
    });
  } catch (e) {
    console.error("Data fetch failed:", e);
    throw e;
  }
};
