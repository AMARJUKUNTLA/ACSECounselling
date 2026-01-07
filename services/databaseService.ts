
import { Student } from '../types';

const SHEET_URL_KEY = 'edubase_google_sheet_url';
const PWD_KEY = 'student_explorer_pwd';

/**
 * Using a more robust public JSON storage approach.
 * npoint.io bins sometimes require a manual first POST to exist.
 * This ID is a new, specifically formatted target.
 */
const GLOBAL_BIN_ID = '7295828475c4078805f2'; 
const GLOBAL_KV_URL = `https://api.npoint.io/${GLOBAL_BIN_ID}`; 

export const saveSheetUrl = async (url: string) => {
  // 1. Immediate local save for same-tab responsiveness
  localStorage.setItem(SHEET_URL_KEY, url);
  
  // 2. Local broadcast for other tabs
  const bc = new BroadcastChannel('edubase_sync');
  bc.postMessage({ type: 'URL_UPDATED', url });
  bc.close();

  const payload = { 
    active_sheet_url: url,
    last_updated: new Date().toISOString()
  };

  try {
    // We attempt POST first as it's more likely to "create/overwrite" if PUT fails on fresh bins
    const response = await fetch(GLOBAL_KV_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      // Fallback to PUT if POST is rejected (common on some JSON bins)
      const putResponse = await fetch(GLOBAL_KV_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!putResponse.ok) throw new Error("Cloud rejected both update methods.");
    }
    console.log("Global cloud master link updated successfully.");
  } catch (e) {
    console.warn("Cloud master sync failed. Storing locally. Reason:", e);
    // We don't throw here to allow the app to function locally if the cloud is down
  }
};

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || '';
};

export const fetchGlobalSheetUrl = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${GLOBAL_KV_URL}?nocache=${Date.now()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.active_sheet_url || null;
  } catch (e) {
    console.error("Unreachable cloud bin.");
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
    if (!response.ok) throw new Error("Google Sheets access denied. Check 'Anyone with link' settings.");
    const text = await response.text();
    
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    return lines.slice(1).filter(line => line.trim()).map((line, index) => {
      // Robust CSV parsing for quoted commas
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
    console.error("Data source fetch error:", e);
    throw e;
  }
};
