import fs from 'fs';

const text = fs.readFileSync('c:/work/clinic-management/temp-contract-utf8.txt', 'utf8');
const escaped = JSON.stringify(text);
const out = `export const THERAPY_CONTRACT_BODY = ${escaped};\n`;
fs.writeFileSync('c:/work/clinic-management/client/src/shared/lib/therapyContractBody.js', out, 'utf8');
console.log('Written therapyContractBody.js');
