// Toate cheile UI cerute de JS: T('literal') + datele traduse dinamic (quiz, capitole, valori salvate).
const fs = require('fs'), acorn = require('acorn'), walk = require('acorn-walk');
const SITE = '/workspace/forex-ms/';
const FILES = ['script.js', 'rr.js', 'jurnal.js', 'quiz.js', 'calendar.js', 'glosar.js', 'lectie.js', 'sim-engine.js', 'sim-extra.js', 'sim-stats.js', 'sim.js'];
const keys = new Map();
const add = (k, f) => { if (!keys.has(k)) keys.set(k, f); };
for (const f of FILES) {
  const src = fs.readFileSync(SITE + f, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest' });
  walk.full(ast, n => {
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'T' && n.arguments[0]) {
      const a = n.arguments[0];
      if (a.type === 'Literal' && typeof a.value === 'string') add(a.value, f);
      else if (a.type === 'TemplateLiteral' && !a.expressions.length) add(a.quasis[0].value.cooked, f);
    }
  });
  if (f === 'quiz.js') {   // QUESTIONS + CH
    walk.full(ast, n => {
      if (n.type === 'VariableDeclarator' && ['QUESTIONS', 'CH'].includes(n.id.name)) walk.full(n.init, x => { if (x.type === 'Literal' && typeof x.value === 'string') add(x.value, f); });
    });
  }
}
['Londra', 'Da', 'Nu', 'piață', 'lunar', 'anual', 'trimestrial', 'anual, medie pe 3 luni'].forEach(k => add(k, 'dynamic'));
const out = [...keys.keys()];
fs.writeFileSync('/workspace/forex-ms-tools/i18n/src/ui-keys.json', JSON.stringify(out, null, 1));
const lang = process.argv[2];
if (lang) {
  const p = `/workspace/forex-ms-tools/i18n/${lang}/ui.json`;
  const d = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  const miss = out.filter(k => !(k in d)), extra = Object.keys(d).filter(k => !keys.has(k));
  console.log(lang, 'ui keys', out.length, 'missing', miss.length, 'unused', extra.length);
  if (process.argv[3] === '--list') console.log(JSON.stringify(miss, null, 1));
  if (process.argv[3] === '--unused') console.log(JSON.stringify(extra, null, 1));
} else console.log('ui keys', out.length);
