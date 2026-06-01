const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'config', 'permissionModules.js');
const clientPath = path.join(__dirname, '..', '..', 'client', 'src', 'config', 'permissionModules.js');

const read = p => fs.readFileSync(p, 'utf8');
const serverText = read(serverPath);
const clientText = read(clientPath);

const extract = (text) => {
  const modules = {};
  // crude regex: find module keys like \n  module_name: { ... permissions: [ { key: 'x' } ] }
  const moduleRegex = /([a-z0-9_]+)\s*:\s*{([\s\S]*?)\n\s*}\s*,?/gmi;
  let m;
  while ((m = moduleRegex.exec(text))) {
    const moduleKey = m[1];
    const body = m[2];
    const permRegex = /key\s*:\s*['"]([a-z0-9_]+)['"]/gmi;
    const keys = [];
    let p;
    while ((p = permRegex.exec(body))) keys.push(p[1]);
    modules[moduleKey] = new Set(keys);
  }
  return modules;
};

const sMods = extract(serverText);
const cMods = extract(clientText);

const missingModules = [];
const missingKeys = {};

for (const [cMod, cKeys] of Object.entries(cMods)) {
  if (!sMods[cMod]) {
    missingModules.push(cMod);
    continue;
  }
  for (const k of cKeys) {
    if (!sMods[cMod].has(k)) {
      if (!missingKeys[cMod]) missingKeys[cMod] = [];
      missingKeys[cMod].push(k);
    }
  }
}

console.log('MISSING MODULES:', JSON.stringify(missingModules, null, 2));
console.log('\nMISSING KEYS PER MODULE:', JSON.stringify(missingKeys, null, 2));
