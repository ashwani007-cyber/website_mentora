import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\kushw\\.gemini\\chrome-auto-profile";

if (!fs.existsSync(USER_DATA)) {
  fs.mkdirSync(USER_DATA, { recursive: true });
}

console.log("Spawning Chrome with debugging port...");
const chrome = spawn(CHROME_EXE, [
  '--remote-debugging-port=9222',
  '--remote-allow-origins=*',
  `--user-data-dir=${USER_DATA}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--start-maximized',
  'http://localhost:5173/'
], {
  detached: false,
  stdio: 'inherit'
});

chrome.on('error', (err) => console.error('Chrome spawn error:', err));
chrome.on('exit', (code, sig) => console.log('Chrome exited with:', code, sig));

// Wait 4 seconds for Chrome to be ready
setTimeout(async () => {
  try {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    const data = await res.json();
    console.log("SUCCESS! Chrome is connected:", data.Browser);
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}, 4000);
