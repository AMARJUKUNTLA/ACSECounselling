
import { Student } from '../types';

const SHEET_URL_KEY = 'edubase_google_sheet_url';
const PWD_KEY = 'student_explorer_pwd';
// Public KV store bucket for global settings (reasonably unique to avoid collisions)
const GLOBAL_KV_URL = 'https://api.npoint.io/ed7d01804f326589312b'; 

export const saveSheetUrl = async (url: string) => {
  // Save locally first
  localStorage.setItem(SHEET_URL_KEY, url);
  
  // Save globally to the cloud bin
  try {
    await fetch('https://api.npoint.io/ed7d01804f326589312b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_sheet_url: url })
    });
  } catch (e) {
    console.warn("Global sync failed, saved locally only.", e);
  }
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || '';
};

export const fetchGlobalSheetUrl = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://api.npoint.io/ed7d01804f326589312b');
    if (!response.ok) return null;
    const data = await response.json();
    return data.active_sheet_url || null;
  } catch (e) {
    console.error("Failed to fetch global config", e);
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
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Could not fetch sheet data");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map((line, index) => {
      // Basic CSV splitting
      const values = line.split(',').map(v => v.trim().replace(/["']/g, ''));
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const getVal = (keys: string[]) => {
        for (const key of keys) {
          if (row[key] !== undefined) return row[key];
        }
        return '';
      };

      return {
        regNo: getVal(['sid', 'reg no', 'registration', 'regno', 'rno']),
        name: getVal(['sname', 'name', 'student name', 'stuname']),
        phone1: getVal(['sphno', 'phone1', 'student phone', 'phone 1', 'student mobile']),
        phone2: getVal(['fphno', 'phone2', 'father phone', 'parent phone', 'phone 2', 'father mobile']),
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor']),
        year: getVal(['year', 'academic year', 'yr']),
        section: getVal(['section', 'sec']),
        branch: getVal(['branch', 'dept', 'department', 'br']),
        id: `gs-${index}-${Date.now()}`
      };
    });
  } catch (e) {
    console.error("Google Sheets Fetch Failed", e);
    throw e;
  }
};
