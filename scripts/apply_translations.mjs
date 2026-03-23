import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NEW_KEYS_TO_ADD } from '../check_missing.mjs';

const msgDir = path.join(process.cwd(), 'src', 'messages');
const dataEn = JSON.parse(fs.readFileSync(path.join(msgDir, 'en.json'), 'utf-8'));
const dataTr = JSON.parse(fs.readFileSync(path.join(msgDir, 'tr.json'), 'utf-8'));

for (const section in NEW_KEYS_TO_ADD) {
  if (!dataEn[section]) dataEn[section] = {};
  if (!dataTr[section]) dataTr[section] = {};
  
  for (const key in NEW_KEYS_TO_ADD[section]) {
    dataEn[section][key] = NEW_KEYS_TO_ADD[section][key].en;
    dataTr[section][key] = NEW_KEYS_TO_ADD[section][key].tr;
  }
}

fs.writeFileSync(path.join(msgDir, 'en.json'), JSON.stringify(dataEn, null, 2) + '\n');
fs.writeFileSync(path.join(msgDir, 'tr.json'), JSON.stringify(dataTr, null, 2) + '\n');

console.log('Successfully updated en.json and tr.json!');
