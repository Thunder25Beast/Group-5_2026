const fs = require('fs');
const file = 'E:/AnkGuru/artifacts/ankguru/app/standalone-asr.js';
let data = fs.readFileSync(file, 'utf8');
data = data.replace('? `Error: `', '? `Error: {errorMsg}`');
fs.writeFileSync(file, data);
