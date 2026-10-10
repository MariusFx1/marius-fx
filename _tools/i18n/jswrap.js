// Găsește șirurile cu text pentru oameni într-un fișier JS și (opțional) le învelește în T(...).
// node jswrap.js file.js [--apply] [--skip=line:col,...]
const fs = require('fs'), acorn = require('acorn'), walk = require('acorn-walk');
const file = process.argv[2], APPLY = process.argv.includes('--apply');
const skipArg = (process.argv.find(a => a.startsWith('--skip=')) || '').slice(7);
const SKIP = new Set(skipArg ? skipArg.split(',') : []);
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true, sourceType: 'script' });
const textOf = s => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
const human = s => {
  const t = textOf(s);
  if (!/[A-Za-zĂÂÎȘȚăâîșț]{2,}/.test(t)) return false;
  if (/^[#.\[]?[a-z0-9_-]+$/i.test(s.trim()) && !/[ăâîșț]/i.test(s)) return /^[A-ZĂÎȘȚ][a-zăâîșț]{2,}$/.test(s.trim()) && false;
  if (/^(https?:|mailto:|data:|[a-z]+\/)/.test(s)) return false;
  if (/^[\w.-]+\.(js|json|css|svg|png|csv)$/.test(s)) return false;
  return /[ăâîșțĂÂÎȘȚ]/.test(t) || /[A-Za-z]{2,}[ ,.:;!?…][ ]?[A-Za-z]/.test(t) || /^[A-ZĂÎȘȚ][a-zăâîșț]+[.:!?]?$/.test(t.trim());
};
const BAD_CALLEES = /^(querySelector|querySelectorAll|getElementById|closest|matches|addEventListener|removeEventListener|getAttribute|removeAttribute|hasAttribute|includes|indexOf|startsWith|endsWith|test|replace|split|join|createElement|get|set|del|getItem|setItem|removeItem|warn|log|error|toggle|add|remove|contains|has|getPropertyValue|setProperty|padStart|match|Error|createChart|addSeries|applyOptions|setData|DateTimeFormat|NumberFormat|toLocaleString|T|toFixed)$/;
const found = [];
walk.fullAncestor(ast, (node, state, anc) => {
  const isLit = node.type === 'Literal' && typeof node.value === 'string';
  const isTpl = node.type === 'TemplateLiteral';
  if (!isLit && !isTpl) return;
  const parent = anc[anc.length - 2], gp = anc[anc.length - 3];
  if (parent && parent.type === 'TaggedTemplateExpression') return;
  let text = isLit ? node.value : node.quasis.map(q => q.value.cooked).join('{}');
  if (!human(text)) return;
  let why = '';
  if (parent.type === 'ExpressionStatement' && parent.directive) return;
  if (isTpl && node.expressions.length && /<[a-z]/i.test(text)) why = 'tpl-html';
  if (parent.type === 'BinaryExpression' && /^(===|!==|==|!=|in|<|>)$/.test(parent.operator)) why = 'cmp';
  else if (parent.type === 'Property' && parent.key === node) why = 'key';
  else if (parent.type === 'SwitchCase') why = 'case';
  else if (parent.type === 'MemberExpression' && parent.property === node) why = 'member';
  else if (parent.type === 'CallExpression' && parent.callee !== node) {
    const c = parent.callee, name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : '';
    if (BAD_CALLEES.test(name)) why = 'call:' + name;
    if (name === 'setAttribute' && parent.arguments[0] === node) why = 'attrname';
  } else if (parent.type === 'NewExpression' && /RegExp|Error/.test(parent.callee.name || '')) why = 'new';
  else if (parent.type === 'ArrayExpression' && gp && gp.type === 'CallExpression' && gp.callee.type === 'MemberExpression' && gp.callee.property.name === 'includes') why = 'includes';
  if (parent.type === 'Property' && parent.value === node && /^(type|reason|kind|side|status|id|key|cls|tone|unit|icon|mode|sym|tf|ccy|font)$/.test(parent.key.name || parent.key.value)) why = why || 'dataprop:' + (parent.key.name || parent.key.value);
  const pos = node.loc.start.line + ':' + node.loc.start.column;
  found.push({ node, text, why, pos, exprs: isTpl ? node.expressions.length : 0 });
});
found.sort((a, b) => a.node.start - b.node.start);
for (const f of found) if (!f.why && found.some(o => o !== f && !o.why && o.node.start <= f.node.start && o.node.end >= f.node.end)) f.why = 'nested';
// înlocuiri (de la coadă la cap)
let out = src; const done = [];
const nameOf = (e, used) => {
  let n = e.type === 'Identifier' ? e.name : e.type === 'MemberExpression' && !e.computed ? e.property.name : e.type === 'CallExpression' && e.callee.type === 'Identifier' ? e.callee.name : 'v';
  let k = n, i = 2; while (used.has(k)) k = n + i++; used.add(k); return k;
};
for (const f of [...found].reverse()) {
  if (f.why || SKIP.has(f.pos)) continue;
  const n = f.node;
  // nu dubla T(...)
  let repl;
  if (n.type === 'Literal') repl = 'T(' + src.slice(n.start, n.end) + ')';
  else {
    if (f.exprs > 6) { f.why = 'tpl-too-complex'; continue; }
    const used = new Set(); const parts = [], args = [];
    n.quasis.forEach((q, i) => {
      parts.push(q.value.cooked.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n'));
      if (i < n.expressions.length) { const e = n.expressions[i]; const k = nameOf(e, used); parts.push('{' + k + '}'); args.push(k + ': ' + src.slice(e.start, e.end)); }
    });
    repl = "T('" + parts.join('') + "'" + (args.length ? ', { ' + args.join(', ') + ' }' : '') + ')';
  }
  out = out.slice(0, n.start) + repl + out.slice(n.end);
  done.push(f);
}
for (const f of found) console.log((f.why ? 'SKIP ' + f.why.padEnd(14) : (SKIP.has(f.pos) ? 'SKIP manual        ' : 'WRAP               ')) + f.pos.padEnd(9) + JSON.stringify(f.text).slice(0, 150));
if (APPLY) { fs.writeFileSync(file, out); console.error('applied', done.length); }
