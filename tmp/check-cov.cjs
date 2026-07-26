const cov = require('../coverage/coverage-final.json');
Object.keys(cov).forEach(k => {
  const short = k.replace(/.*simplesheets./, '').replace(/\\/g, '/');
  if (!short.includes('.test.') && !short.includes('node_modules')) {
    const s = cov[k].s;
    const f = cov[k].f;
    const stmts = Object.values(s).filter(v=>v>0).length + '/' + Object.values(s).length;
    const funcs = Object.values(f).filter(v=>v>0).length + '/' + Object.values(f).length;
    if (short.includes('Search') || short.includes('clipboardParse')) {
      console.log(short, '|', stmts, 'stmts |', funcs, 'funcs');
    }
  }
});
