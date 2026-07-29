/* Shared launcher for the verification scripts.

   Playwright is deliberately not a dependency of the game — the game has none.
   Install it only when you want to run these:

     npm install --no-save playwright

   The browser is whatever is already on the machine; CHROME=/path/to/chrome
   overrides it, and with nothing set Playwright falls back to its own download. */
import { chromium } from 'playwright';
import fs from 'fs';

const CANDIDATES = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

export function launch(){
  const exe = CANDIDATES.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  return chromium.launch(exe ? { executablePath: exe } : {});
}

export const GAME = new URL('../dist/index.html', import.meta.url).href;
