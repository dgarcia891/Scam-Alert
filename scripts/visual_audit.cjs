const { exec } = require('child_process');
const fs = require('fs');
const readline = require('readline');

console.log('👁️ Visual Audit (Loud Failure Protocol)\n');
const contextPath = 'docs/architecture/CONTEXT.md';
let content = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, 'utf8') : '';
const urlMatch = content.match(/\*\*URL:\*\*\s*(.+)/);

function launch(targetUrl) {
  console.log(`🌐 Opening: ${targetUrl}`);
  const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${cmd} "${targetUrl}"`, (err) => {
    if (err) console.error('❌ Failed to open browser:', err.message);
    else console.log('✅ Browser launched.');
  });
}

if (urlMatch && urlMatch[1].trim() !== 'PENDING') {
  launch(urlMatch[1].trim());
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('⚠️ URL missing in CONTEXT.md. 🔗 Enter Lovable Preview URL: ', (answer) => {
    if (answer) {
      if (!content.includes('**URL:**')) {
        content += `\n- **URL:** ${answer}\n`;
      } else {
        content = content.replace(/\*\*URL:\*\*\s*.+/, `**URL:** ${answer}`);
      }
      fs.writeFileSync(contextPath, content);
      console.log('✅ URL saved to CONTEXT.md');
      launch(answer);
    } else {
      console.log('❌ No URL provided. Visual audit aborted.');
    }
    rl.close();
  });
}
