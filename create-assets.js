const fs = require('fs');
const path = require('path');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'].forEach(function (f) {
  const p = path.join(assetsDir, f);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, PNG);
    console.log('Created: ' + f);
  } else {
    console.log('Exists: ' + f);
  }
});
