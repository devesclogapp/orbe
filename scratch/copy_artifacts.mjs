import fs from 'fs';
import path from 'path';

const artifactDir = 'C:/Users/flavi/.gemini/antigravity-ide/brain/389c6be4-4510-42f0-8f9b-f76c2ce74938';
const files = [
  'fix05_screenshot_768_initial.png',
  'fix05_screenshot_768_scrolled.png',
  'fix05_screenshot_900_initial.png',
  'fix05_screenshot_900_drawer_open.png',
  'fix05_screenshot_1080_initial.png'
];

for (const f of files) {
  const src = path.join('y:/2026/ERP ESC LOG/Orbe/scratch', f);
  const dest = path.join(artifactDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copiado: ${f} -> ${dest}`);
  }
}
