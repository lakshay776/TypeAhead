// backend/scripts/generateSeed.js
// Generates a synthetic seed CSV with 120,000 rows (query,count).
const fs = require('fs');
const path = require('path');

const words = ['iphone','samsung','laptop','java','python','react','nodejs',
  'netflix','amazon','google','youtube','twitter','instagram','facebook',
  'camera','headphones','shoes','shirt','book','tutorial','download',
  'install','review','price','best','cheap','buy','online','free','how to'];

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const rows = ['query,count'];
for (let i = 0; i < 120000; i++) {
  const q = words[Math.floor(Math.random() * words.length)] + ' ' +
            words[Math.floor(Math.random() * words.length)];
  const count = Math.floor(Math.random() * 100000) + 1;
  rows.push(`"${q}",${count}`);
}

fs.writeFileSync(path.join(dataDir, 'seed.csv'), rows.join('\n'));
console.log('Seed written: 120,000 rows ->', path.join(dataDir, 'seed.csv'));
