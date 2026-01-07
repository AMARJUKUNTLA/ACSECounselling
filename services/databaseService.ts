
import { Student } from '../types';

const SHEET_URL_KEY = 'edubase_google_sheet_url';
const PWD_KEY = 'student_explorer_pwd';

/**
 * Using a fresh unique Bin ID. 
 * npoint.io bins are created on the fly with POST if they don't exist, 
 * but for global consistency, we use a fixed one.
 * If this bin is deleted or restricted, users can still save locally.
 */
const GLOBAL_BIN_ID = '9974251469e38f1262d1'; 
const GLOBAL_KV_URL = `https://api.npoint.io/${GLOBAL_BIN_ID}`; 

export const saveSheetUrl = async (url: string) => {
  // 1. Save locally immediately
  localStorage.setItem(SHEET_URL_KEY, url);
  
  // 2. Push to Cloud Bin using POST/PUT
  // We try PUT first to update the specific bin
  try {
    const payload = { 
      active_sheet_url: url,
      updated_at: new Date().toISOString()
    };

    const response = await fetch(GLOBAL_KV_URL, {
      method: 'POST', // npoint often prefers POST for creating/overwriting bins
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
       // Fallback to PUT if POST is restricted on existing bin
       await fetch(GLOBAL_KV_URL, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
       });
    }
    console.log("Global cloud sync complete.");
  } catch (e) {
    console.error("Cloud master sync failed. Stored locally.", e);
    throw e;
  }
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || '';
};

export const fetchGlobalSheetUrl = async (): Promise<string | null> => {
  try {
    // Force refresh with cache busting
    const response = await fetch(`${GLOBAL_KV_URL}?nocache=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.active_sheet_url || null;
  } catch (e) {
    console.warn("Global config fetch failed, reverting to local link.");
    return null;
  }
};

export const updateAdminPassword = (newPwd: string) => {
  localStorage.setItem(PWD_KEY, newPwd);
};

export const fetchFromGoogleSheets = async (url: string): Promise<Student[]> => {
  try {
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) throw new Error("Invalid URL");
    
    const spreadsheetId = matches[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&t=${Date.now()}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error("Sheet access denied. Make sure it is Public (Anyone with link).");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map((line, index) => {
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
        counsellor: getVal(['cname', 'counante', 'counsellor', 'mentor']),
        year: getVal(['year', 'academic year', 'yr']),
        section: getVal(['section', 'sec']),
        branch: getVal(['branch', 'dept', 'department', 'br']),
        id: `gs-${index}-${Date.now()}`
      };
    });
  } catch (e) {
    console.error("GS fetch error:", e);
    throw e;
  }
};
