const { exec } = require('child_process');
const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
console.log("👁️ Launching Chrome...");
exec(`${cmd} chrome://extensions`);
