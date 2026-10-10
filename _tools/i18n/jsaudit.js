// Listează fragmentele de text încă netraduse (în afara T(...)) dintr-un fișier JS.
const fs = require('fs'), acorn = require('acorn'), walk = require('acorn-walk');
const file = process.argv[2];
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', locations: true });
const IGN = /^(querySelector|querySelectorAll|getElementById|closest|matches|addEventListener|removeEventListener|getAttribute|removeAttribute|setAttribute|hasAttribute|includes|indexOf|startsWith|endsWith|test|replace|split|join|createElement|get|set|getItem|setItem|removeItem|warn|log|error|toggle|add|remove|contains|has|padStart|match|T|DateTimeFormat|NumberFormat|loadJson|fetch|matchMedia|applyOptions|setProperty)$/;
const allowWords = /^(Buy|Sell|Stop loss|Take profit|SL|TP|BE|EUR|USD|GBP|JPY|EMA|SMA|RSI|MACD|ATR|Bollinger|Fibonacci|OK|R:R|Pips?|Lot|Setup|Instrument|Profit|Total R|Weekend|Marius FX|Tokyo|Sydney|New York|Simulator|H1|H4|D1|P\/L|Manual|Long|Short|Long \/ short|Profit factor|Spread|Ask|Bid|CSV|Excel|Drawdown|Trend)$/;
walk.fullAncestor(ast, (node, st, anc) => {
  const isLit = node.type === 'Literal' && typeof node.value === 'string', isTpl = node.type === 'TemplateLiteral';
  if (!isLit && !isTpl) return;
  for (const a of anc) if (a.type === 'CallExpression' && a !== node) {
    const c = a.callee, nm = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : '';
    if (nm === 'T' && a.arguments[0] === anc[anc.indexOf(a) + 1]) return;
  }
  const p = anc[anc.length - 2];
  if (p.type === 'ExpressionStatement' && p.directive) return;
  if (p.type === 'Property' && p.key === node) return;
  if (p.type === 'MemberExpression' && p.property === node) return;
  if (p.type === 'BinaryExpression' && /^(===|!==|==|!=|in)$/.test(p.operator)) return;
  if (p.type === 'SwitchCase') return;
  if (p.type === 'CallExpression' && p.callee !== node) {
    const c = p.callee, nm = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : '';
    if (IGN.test(nm) && !(nm === 'setAttribute' && p.arguments[1] === node)) return;
  }
  const raw = isLit ? node.value : node.quasis.map(q => q.value.cooked).join(' ⟨⟩ ');
  // text vizibil: în afara tagurilor + valorile atributelor title/aria-label/placeholder
  const attrs = [...raw.matchAll(/(?:title|aria-label|placeholder|alt)="([^"]*)"/g)].map(m => m[1]);
  const vis = raw.replace(/<[^>]*>/g, ' | ').split('|').concat(attrs).map(s => s.replace(/⟨⟩/g, ' ').trim()).filter(s => /[A-Za-zĂÂÎȘȚăâîșț]{3,}/.test(s.replace(/&\w+;/g, '')));
  const looksCode = s => /^[a-z][a-zA-Z0-9]*$/.test(s) || /^[a-z0-9-]+(\s[a-z0-9-]+)*$/.test(s) || /^[#.][\w-]/.test(s) || /^(\d|px|rgba?\(|var\()/.test(s) || /^[A-Z_]+$/.test(s);
  const rest = vis.filter(s => !looksCode(s) && !allowWords.test(s));
  if (rest.length) console.log(node.loc.start.line + ':' + node.loc.start.column + '  ' + rest.map(s => JSON.stringify(s.slice(0, 90))).join('  '));
});
