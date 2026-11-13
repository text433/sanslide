// Saliek vienu index.html. `node build.js` → dist/index.html (three.js no cdnjs); `node build.js --local` → dist/test.html (lokāls three.js testiem)
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let html = r('index.template.html');
for (const [tag, file] of [['__SIM__', 'sim.js'], ['__GFX__', 'gfx.js'], ['__MAIN__', 'main.js']]) {
  const code = r(file);
  if (code.includes('</script')) throw new Error('script close tag in ' + file);
  html = html.replace('/*' + tag + '*/', () => '\n' + code);
}
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
const local = html.replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', '../node_modules/three/build/three.min.js')
  .replace(/<link href="https:\/\/fonts[^>]+>/, '');
fs.writeFileSync(path.join(__dirname, 'dist', 'test.html'), local);
console.log('built', (html.length / 1024).toFixed(1) + ' KB');
