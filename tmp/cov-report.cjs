const cov = require('../coverage/coverage-final.json');
const files = [];
Object.entries(cov).forEach(([k, data]) => {
  if (k.includes('.test.') || k.includes('node_modules')) return;
  const s = data.s;
  const f = data.f;
  const stmts = Object.values(s).filter(v=>v>0).length;
  const totalStmts = Object.values(s).length;
  const funcs = Object.values(f).filter(v=>v>0).length;
  const totalFuncs = Object.values(f).length;
  files.push({
    path: k.replace(/.*simplesheets./, '').replace(/\\/g, '/'),
    stmts: (stmts/totalStmts*100).toFixed(1),
    funcs: totalFuncs > 0 ? (funcs/totalFuncs*100).toFixed(1) : '100.0'
  });
});
files.filter(f => parseFloat(f.stmts) < 95 || parseFloat(f.funcs) < 95)
  .sort((a,b) => parseFloat(a.stmts) - parseFloat(b.stmts))
  .forEach(f => console.log(f.stmts + '% stmts | ' + f.funcs + '% funcs | ' + f.path));
