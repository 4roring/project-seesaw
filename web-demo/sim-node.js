// 시뮬레이터를 브라우저 없이 돌린다 (개발용 — 게임에서는 로드하지 않는다).
//   node web-demo/sim-node.js "TS_Sim.run('BLADE', 300, { faction: 'heterodox' })"
//   node web-demo/sim-node.js -f 실험.js          // 파일의 마지막 식을 출력
//   SEED=12345 node web-demo/sim-node.js "..."     // Math.random 고정 — 회귀 비교용
//
// 파일럿 1.5에서 4문파 수치가 "한 글자까지 같다"를 확인한 방법이 SEED다. 같은
// 시드로 넣기 전 · 넣은 뒤의 출력 해시를 비교한다. 브라우저 콘솔보다 수십 배
// 빨라 300런 × 여러 칸을 한 번에 잰다.
const vm = require('vm'), fs = require('fs'), path = require('path');
const dir = __dirname;
const M = Object.create(Math);
if (process.env.SEED) {
  let a = +process.env.SEED >>> 0;
  M.random = () => {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ctx = vm.createContext({ console, structuredClone, Math: M, JSON, Date });
ctx.window = ctx;
['data.js', 'engine.js', 'run.js', 'sim.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
const code = process.argv[2] === '-f' ? fs.readFileSync(process.argv[3], 'utf8') : process.argv[2];
console.log(JSON.stringify(vm.runInContext(code, ctx), null, 1));
