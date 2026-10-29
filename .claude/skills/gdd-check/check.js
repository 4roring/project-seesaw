// gdd 정합성 검사 — 기계로 잴 수 있는 항목(A·C·D·E·F·G)만 돈다.
// 규칙 문장끼리의 모순(B)은 SKILL.md의 절차대로 모델이 읽어서 판단한다.
//
//   node .claude/skills/gdd-check/check.js            // 전체
//   node .claude/skills/gdd-check/check.js 02 10      // 특정 장만 (A·C·D·E)
//   node .claude/skills/gdd-check/check.js --all      // ⚠️ 딱지 붙은 절의 건도 하나하나 보이기
//
// 출력은 마크다운 보고서. 파일은 아무것도 고치지 않는다.
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '../../..');
const GDD = path.join(ROOT, 'gdd');
const NOTES = path.join(ROOT, 'ideanote');
const DEMO = path.join(ROOT, 'web-demo');
const rel = (p) => path.relative(ROOT, p);

const args = process.argv.slice(2);
const SHOW_ALL = args.includes('--all');
const only = args.filter((a) => /^\d{1,2}$/.test(a)).map((a) => a.padStart(2, '0'));

// ── 읽기 ──────────────────────────────────────────────────────────────

const gddFiles = fs.readdirSync(GDD).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
const inScope = (f) => !only.length || only.includes(f.slice(0, 2));
const docs = gddFiles.map((f) => ({ file: path.join(GDD, f), name: f, lines: fs.readFileSync(path.join(GDD, f), 'utf8').split('\n') }));
const readme = { file: path.join(ROOT, 'README.md'), name: 'README.md', lines: fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').split('\n') };

let DATA = null;
try {
  const ctx = vm.createContext({ console, structuredClone, Math, JSON, Date });
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(path.join(DEMO, 'data.js'), 'utf8'), ctx, { filename: 'data.js' });
  DATA = vm.runInContext('TS_DATA', ctx);
} catch (e) {
  DATA = null;
}

// 각 줄에 붙는 문맥: 코드 블록 안인가, ⚠️ 딱지 붙은 절 안인가.
// 딱지 = 제목 바로 아래(빈 줄 건너) 첫 내용이 "> ⚠️"로 시작하는 인용.
function annotate(doc) {
  const out = [];
  let fence = null, flagged = null, flaggedLevel = 0, justHeading = false;
  doc.lines.forEach((text, i) => {
    const h = /^(#{1,6}) /.exec(text);
    if (!fence && h) {
      if (flagged && h[1].length <= flaggedLevel) flagged = null;
      justHeading = h[1].length;
    } else if (!fence && justHeading && text.trim()) {
      if (/^>\s*⚠️/.test(text)) { flagged = text.replace(/^>\s*/, '').slice(0, 70); flaggedLevel = justHeading; }
      justHeading = false;
    }
    const f = /^```(\w*)/.exec(text);
    if (f) fence = fence === null ? f[1] || 'text' : null;
    // 일부러 남긴 곳: 같은 줄이나 바로 윗줄에 <!-- gdd-check: 무시 -->
    const ignore = text.includes('gdd-check: 무시') || (i > 0 && doc.lines[i - 1].trim() === '<!-- gdd-check: 무시 -->');
    out.push({ n: i + 1, text, fence: f ? null : fence, flagged, ignore });
  });
  return out.filter((l) => !l.ignore);
}

// ── 결과 모음 ─────────────────────────────────────────────────────────

const findings = { A: [], C: [], D: [], E: [], F: [], G: [] };
const notAssessed = [];
const flaggedCount = {}; // 딱지 문구 → { where, count }
function add(key, sev, where, msg, flagged) {
  if (flagged && !SHOW_ALL) {
    const k = `${where.split(':')[0]} — ${flagged}`;
    flaggedCount[k] = (flaggedCount[k] || 0) + 1;
    return;
  }
  findings[key].push({ sev, where, msg });
}

// ── A. 옛 용어 잔존 ───────────────────────────────────────────────────
// 12-2 표의 "옛 표기" 열마다 잡는 정규식. 표에 행이 늘었는데 여기 없으면 ⚪로 알린다.
const OLD_TERM_RULES = {
  '메모리 게이지': /메모리|게이지/g,
  '턴이 넘어가는 사건': null, // 문장 단위 표현이라 기계로 못 잡는다 → B에서 모델이 본다
  '카드 코스트': /코스트/g,
  '`P6 … 0 … E6`': /(?<![A-Za-z0-9_])[PE][0-6](?![0-9A-Za-z_])|(?<![A-Za-z])[PE] ?(?:방향|쪽|구역)/g,
  '턴': /(?<![가-힣])턴(?!트)/g,
  '드로우 액션': /드로우 액션/g,
  'BREAK': /\bBREAK\b/g,
  '기절': /기절/g,
  '취약': /취약/g,
  '약화': /약화/g,
  '지속 효과 — 자기 강화': /테이머/g,
  '지속 효과 — 장 전체': /옵션\s*[:：형]/g,
  '카드 티어': /티어/g,
};

function termTable() {
  const d = docs.find((x) => x.name.startsWith('12-'));
  if (!d) return null;
  const start = d.lines.findIndex((l) => /^## 12-2\./.test(l));
  if (start < 0) return null;
  const rows = [];
  for (let i = start + 1; i < d.lines.length && !/^## /.test(d.lines[i]); i++) {
    const m = /^\| (.+?) \| (.+?) \|/.exec(d.lines[i]);
    if (m && !/^-+$/.test(m[1].trim()) && m[1].trim() !== '옛 표기') rows.push({ old: m[1].trim(), canon: m[2].replace(/\*\*/g, '').trim() });
  }
  return rows;
}

// 코드 식별자는 예외: 백틱 안이 영문·숫자·기호뿐이면 지운다. 한글 설명은 남는다.
const stripIdentifiers = (s) => s.replace(/`[^`]*`/g, (m) => (/[가-힣]/.test(m) || /\b[PE][0-6]\b/.test(m) ? m : ' '.repeat(m.length)));
// 링크 대상(파일 경로)도 검사 대상이 아니다 — 파일명 01-core-system-gauge 같은 것.
const stripLinkTargets = (s) => s.replace(/\]\([^)]*\)/g, (m) => ' '.repeat(m.length));

function checkTerms() {
  const rows = termTable();
  if (!rows) { notAssessed.push('A — gdd/12의 12-2 용어 표를 찾지 못함. 옛 용어 검사를 하지 않았다'); return; }
  const rules = [];
  for (const r of rows) {
    if (!(r.old in OLD_TERM_RULES)) notAssessed.push(`A — 12-2의 "${r.old} → ${r.canon}" 행에 검사 규칙이 없다. check.js의 OLD_TERM_RULES에 추가할 것`);
    else if (OLD_TERM_RULES[r.old]) rules.push({ ...r, re: OLD_TERM_RULES[r.old] });
  }
  const scan = (where, text, flagged) => {
    const t = stripLinkTargets(stripIdentifiers(text));
    for (const r of rules) {
      const hits = [...t.matchAll(r.re)].map((m) => m[0]);
      if (hits.length) add('A', '🟡', where, `${[...new Set(hits)].join(', ')} → **${r.canon}** · ${text.trim().slice(0, 80)}`, flagged);
    }
  };
  for (const d of [...docs, readme]) {
    if (d.name.startsWith('12-') || (d !== readme && !inScope(d.name))) continue;
    for (const l of annotate(d)) {
      // 코드 블록 안은 한글이 있는 부분(주석 · 설명)만 본다
      const text = l.fence && l.fence !== 'text' ? (l.text.match(/\/\/.*|\/\*.*|[^\n]*[가-힣][^\n]*/) || [''])[0] : l.text;
      scan(`${rel(d.file)}:${l.n}`, text, l.flagged);
    }
  }
  // web-demo 표시 문자열 — 주석을 빼고 문자열 리터럴 · HTML 본문만. 장을 골라 돌릴 때는 건너뛴다
  if (only.length) return;
  for (const f of fs.readdirSync(DEMO).filter((x) => /\.(js|html)$/.test(x) && x !== 'sim-node.js')) {
    const src = fs.readFileSync(path.join(DEMO, f), 'utf8').split('\n');
    let inBlockComment = false;
    src.forEach((line, i) => {
      let s = line;
      if (inBlockComment) { const e = s.indexOf('*/'); if (e < 0) return; s = s.slice(e + 2); inBlockComment = false; }
      s = s.replace(/\/\*.*?\*\//g, '');
      const b = s.indexOf('/*'); if (b >= 0) { s = s.slice(0, b); inBlockComment = true; }
      s = s.replace(/<!--.*?-->/g, '');
      const shown = f.endsWith('.html')
        ? [s.replace(/<script[\s\S]*?<\/script>|<[^>]+>/g, ' '), ...[...s.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)].map((m) => m[1] || m[2] || m[3] || '')].join(' ')
        : [...s.replace(/(^|[^:'"`])\/\/.*$/, '$1').matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g)].map((m) => m[1] || m[2] || m[3] || '').join(' ');
      if (/[가-힣]/.test(shown)) scan(`web-demo/${f}:${i + 1}`, shown);
    });
  }
}

// ── C. 정본 위임 위반 — data.js 상수 이름과 숫자가 한 줄에 같이 있으면 값 대조 ──
function checkConstants() {
  if (!DATA) { notAssessed.push('C · D — web-demo/data.js를 읽지 못함'); return; }
  const scalars = Object.entries(DATA).filter(([k, v]) => /^[A-Z_]+$/.test(k) && typeof v === 'number');
  let compared = 0;
  for (const d of [...docs, readme]) {
    if (d !== readme && !inScope(d.name)) continue;
    for (const l of annotate(d)) {
      for (const [k, v] of scalars) {
        if (!new RegExp('`' + k + '`').test(l.text)) continue;
        const nums = l.text.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ' ').replace(/\d{4}-\d\d-\d\d/g, ' ')
          .match(/-?\d+(?:\.\d+)?%?/g);
        if (!nums) continue;
        compared++;
        const vals = nums.map((n) => (n.endsWith('%') ? parseFloat(n) / 100 : parseFloat(n)));
        if (!vals.some((x) => Math.abs(x - v) < 1e-9)) add('C', '🔴', `${rel(d.file)}:${l.n}`, `\`${k}\` = **${v}** (data.js) 인데 이 줄의 숫자는 ${nums.join(', ')} · ${l.text.trim().slice(0, 70)}`, l.flagged);
      }
    }
  }
  if (!compared) notAssessed.push('C — 상수 이름과 숫자가 한 줄에 같이 나온 곳이 없어 비교한 값이 0개');
}

// ── D. 카드 · 적 목록 대조 ────────────────────────────────────────────
const norm = (s) => s.replace(/\s+/g, '');
function allNames(o, out = new Set()) {
  if (Array.isArray(o)) o.forEach((x) => allNames(x, out));
  else if (o && typeof o === 'object') { if (typeof o.name === 'string') out.add(norm(o.name)); Object.values(o).forEach((x) => allNames(x, out)); }
  return out;
}
const CLOSER = { 패도: 'DOMINANT', 노회: 'CRAFTY' };

function checkRoster() {
  if (!DATA) return;
  const names = allNames(DATA);
  // 1) gdd 본문이 초식 이름으로 부르는 것: \[이름\] 또는 `한글이름`
  const termsDoc = new Set((termTable() || []).flatMap((r) => [norm(r.canon.replace(/\(.*?\)/g, '')), norm(r.old)]));
  for (const d of [...docs, readme]) {
    if (d.name.startsWith('12-') || (d !== readme && !inScope(d.name))) continue; // 12는 옛 이름을 일부러 인용한다
    for (const l of annotate(d)) {
      if (l.fence) continue;
      // 백틱은 짝 단위로 끊어야 "`a` 중 `b`"의 " 중 "을 이름으로 잡지 않는다
      const ticked = l.text.split('`').filter((_, i) => i % 2 === 1);
      const refs = [...[...l.text.matchAll(/\\\[([가-힣 ]{2,8})\\\]/g)].map((m) => m[1]), ...ticked.filter((s) => /^[가-힣 ]{3,8}$/.test(s))].map((s) => s.trim());
      for (const r of refs) {
        if (names.has(norm(r)) || termsDoc.has(norm(r)) || /니다$/.test(r)) continue; // `합니다` 같은 낱말 인용
        add('D', '🟡', `${rel(d.file)}:${l.n}`, `\`${r}\` — data.js에 이 이름이 없다 (이름이 바뀌었거나 초식이 아님)`, l.flagged);
      }
    }
  }
  // 2) gdd/10 적 표 ↔ ENEMIES
  const d10 = docs.find((x) => x.name.startsWith('10-'));
  if (!d10 || !inScope(d10.name)) return;
  const head = d10.lines.findIndex((l) => /^\|.*\| 적 \|.*빈틈.*\|/.test(l));
  if (head < 0) { notAssessed.push('D — gdd/10에서 "적 | … | 빈틈" 표를 찾지 못함. 적 수치 대조를 하지 않았다'); return; }
  const cols = d10.lines[head].split('|').map((c) => c.trim());
  const ci = (name) => cols.indexOf(name);
  const seen = new Set();
  for (let i = head + 2; i < d10.lines.length && d10.lines[i].startsWith('|'); i++) {
    const cells = d10.lines[i].split('|').map((c) => c.replace(/\*\*/g, '').trim());
    const where = `gdd/10-enemy-roster.md:${i + 1}`;
    const e = DATA.ENEMIES.find((x) => norm(x.name) === norm(cells[ci('적')]));
    if (!e) { add('D', '🔴', where, `표의 적 "${cells[ci('적')]}"이 data.js ENEMIES에 없다`); continue; }
    seen.add(e);
    const stage = DATA.ENEMIES.indexOf(e) + 1;
    if (ci('#') >= 0 && +cells[ci('#')] !== stage) add('D', '🔴', where, `${e.name}: 표는 스테이지 ${cells[ci('#')]}, data.js는 ${stage}번째`);
    if (ci('빈틈') >= 0 && +cells[ci('빈틈')] !== e.breakThreshold) add('D', '🔴', where, `${e.name}: 빈틈 표 **${cells[ci('빈틈')]}** ↔ data.js **${e.breakThreshold}**`);
    if (ci('클로저') >= 0 && CLOSER[cells[ci('클로저')]] !== e.closerStyle) add('D', '🔴', where, `${e.name}: 클로저 표 **${cells[ci('클로저')]}** ↔ data.js **${e.closerStyle}**`);
    if (ci('경지') >= 0 && e.realm && norm(cells[ci('경지')]) !== norm(String(e.realm))) add('D', '🔴', where, `${e.name}: 경지 표 **${cells[ci('경지')]}** ↔ data.js **${e.realm}**`);
  }
  for (const e of DATA.ENEMIES) if (!seen.has(e)) add('D', '🔴', 'gdd/10-enemy-roster.md', `data.js의 적 "${e.name}"이 표에 없다`);
  // 3) 표 안에 적힌 "빈틈 N~M" 범위 ↔ 실제 최소·최대
  const bt = DATA.ENEMIES.map((e) => e.breakThreshold), lo = Math.min(...bt), hi = Math.max(...bt);
  for (const d of [...docs, readme]) {
    for (const l of annotate(d)) {
      if (!l.text.startsWith('|')) continue;
      const m = /빈틈\**\s*\(?(\d+)\s*~\s*(\d+)\)?/.exec(l.text);
      if (m && (+m[1] !== lo || +m[2] !== hi)) add('D', '🔴', `${rel(d.file)}:${l.n}`, `빈틈 범위 **${m[1]}~${m[2]}** ↔ data.js 실제 **${lo}~${hi}**`, l.flagged);
    }
  }
}

// ── E. 상호 참조 — 파일 링크와 "8-4-4" 같은 절 번호 ───────────────────
function headingsOf(doc) {
  return new Set(doc.lines.map((l) => /^#{1,6} (\d+(?:-\d+)+)\./.exec(l)).filter(Boolean).map((m) => m[1]));
}
function checkRefs() {
  const byCh = {};
  for (const d of docs) byCh[+d.name.slice(0, 2)] = { doc: d, heads: headingsOf(d) };
  const sectionRe = /(?<![\d\w./-])(\d{1,2}(?:-\d+)+)(?![\d\w-])/g;
  const targets = [...docs.map((d) => ({ d, isGdd: true })), { d: readme, isGdd: false }];
  for (const { d, isGdd } of targets) {
    if (isGdd && !inScope(d.name)) continue;
    const myCh = isGdd ? +d.name.slice(0, 2) : null;
    for (const l of annotate(d)) {
      if (l.fence && l.fence !== 'text') continue;
      // 파일 링크
      for (const m of l.text.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
        if (/^https?:/.test(m[1])) continue;
        const p = path.resolve(path.dirname(d.file), m[1]);
        if (!fs.existsSync(p)) add('E', '🟡', `${rel(d.file)}:${l.n}`, `깨진 링크 → ${m[1]}`, l.flagged);
      }
      // 절 번호: 같은 줄에 링크된 장이 있으면 그 장, 없으면 번호의 앞자리 장
      const text = l.text.replace(/\]\([^)]*\)/g, ']').replace(/\d{4}-\d\d-\d\d/g, '');
      for (const m of text.matchAll(sectionRe)) {
        const ch = +m[1].split('-')[0];
        if (!byCh[ch]) continue;
        if (myCh === ch && l.text.startsWith('#')) continue; // 자기 제목
        if (!byCh[ch].heads.has(m[1])) add('E', '🟡', `${rel(d.file)}:${l.n}`, `절 **${m[1]}** 이 ${byCh[ch].doc.name}에 없다`, l.flagged);
      }
    }
  }
  // web-demo 주석의 "gdd/NN N-N"
  for (const f of fs.readdirSync(DEMO).filter((x) => x.endsWith('.js'))) {
    fs.readFileSync(path.join(DEMO, f), 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/gdd\/?\s?(\d{2})[^\d\n]{0,3}?((?:\d{1,2})(?:-\d+)+)/g)) {
        const ch = +m[1];
        if (!byCh[ch]) add('E', '🟡', `web-demo/${f}:${i + 1}`, `gdd/${m[1]} 장이 없다`);
        else if (!byCh[ch].heads.has(m[2])) add('E', '🟡', `web-demo/${f}:${i + 1}`, `절 **${m[2]}** 이 ${byCh[ch].doc.name}에 없다`);
      }
    });
  }
}

// ── F. 목차 — gdd/00의 표와 실제 파일 ─────────────────────────────────
function checkIndex() {
  const d0 = docs.find((x) => x.name.startsWith('00-'));
  if (!d0) { notAssessed.push('F — gdd/00-README.md가 없다'); return; }
  const listed = [];
  d0.lines.forEach((l, i) => { const m = /^\| \[([^\]]+\.md)\]\(([^)]+)\)/.exec(l); if (m) listed.push({ file: m[2], n: i + 1 }); });
  const actual = gddFiles.filter((f) => !f.startsWith('00-'));
  for (const f of actual) if (!listed.some((x) => x.file === f)) add('F', '🟡', 'gdd/00-README.md', `${f}가 목차 표에 없다`);
  for (const x of listed) if (!actual.includes(x.file)) add('F', '🟡', `gdd/00-README.md:${x.n}`, `목차의 ${x.file}가 실제로 없다`);
  const order = listed.map((x) => x.file).filter((f) => actual.includes(f));
  if (order.join() !== [...order].sort().join()) add('F', '🟡', 'gdd/00-README.md', '목차 순서가 장 번호 순이 아니다');
}

// ── G. 졸업 표기 짝 — gdd의 "ideanote/NNN에서 졸업" ↔ 노트 상태 ────────
function noteStatus(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = /^> 상태:\s*(\S+)\s*([^|\n]*)/m.exec(t);
  return { status: m ? m[1] + ' ' + m[2].trim() : null, text: t };
}
function checkGraduation() {
  const pairs = [];
  for (const d of docs) {
    d.lines.slice(0, 12).forEach((l) => {
      const m = /ideanote\/(\d{3})[^)]*\)\S*에서 졸업/.exec(l);
      if (m) pairs.push({ d, num: m[1] });
    });
  }
  for (const { d, num } of pairs) {
    const nf = fs.readdirSync(NOTES).find((f) => f.startsWith(num + '-'));
    if (!nf) { add('G', '🟡', rel(d.file), `졸업 원본 ideanote/${num}이 없다`); continue; }
    const { status, text } = noteStatus(path.join(NOTES, nf));
    if (!status) add('G', '⚪', `ideanote/${nf}`, '"> 상태:" 줄을 찾지 못함');
    else if (!/^(✅|🔶)/.test(status)) add('G', '🟡', `ideanote/${nf}`, `${d.name}가 여기서 졸업했다는데 노트 상태는 "${status}"`);
    if (!text.includes(`gdd/${d.name}`)) add('G', '🟡', `ideanote/${nf}`, `졸업한 ${d.name}로 가는 링크가 노트에 없다`);
  }
  // 반대 방향: ✅ 노트인데 아무 gdd도 가리키지 않음
  for (const nf of fs.readdirSync(NOTES).filter((f) => /^\d{3}-.*\.md$/.test(f))) {
    const { status, text } = noteStatus(path.join(NOTES, nf));
    if (status && status.startsWith('✅') && !/gdd\/\d\d-/.test(text)) add('G', '🟡', `ideanote/${nf}`, '✅ 채택인데 졸업한 gdd 장으로 가는 링크가 없다');
  }
}

// ── 실행 · 보고 ───────────────────────────────────────────────────────

checkTerms(); checkConstants(); checkRoster(); checkRefs();
if (!only.length) { checkIndex(); checkGraduation(); }

const TITLES = {
  A: 'A. 옛 용어 잔존 (gdd/12 12-2 기준)',
  C: 'C. 정본 위임 위반 (data.js 상수 ↔ gdd 본문)',
  D: 'D. 카드 · 적 목록 (data.js ↔ gdd)',
  E: 'E. 상호 참조 (링크 · 절 번호)',
  F: 'F. 목차 (gdd/00)',
  G: 'G. 졸업 표기 짝 (gdd ↔ ideanote)',
};
const out = [`# gdd 기계 검사 ${only.length ? `(장 ${only.join(', ')})` : ''}`.trim(), ''];
const count = (s) => Object.values(findings).flat().filter((f) => f.sev === s).length;
out.push(`🔴 ${count('🔴')} · 🟡 ${count('🟡')} · ⚪ ${count('⚪') + notAssessed.length}` + (Object.keys(flaggedCount).length ? ` · ⚠️ 딱지 절 안에서 숨김 ${Object.values(flaggedCount).reduce((a, b) => a + b, 0)}` : ''), '');
for (const k of Object.keys(TITLES)) {
  if (only.length && (k === 'F' || k === 'G')) continue;
  out.push(`## ${TITLES[k]} — ${findings[k].length}건`);
  if (k === 'A' && !SHOW_ALL && !only.length) {
    // 건수가 많아 파일별로 묶는다. 줄 단위는 장 번호를 주거나 --all로.
    const byFile = {};
    for (const f of findings.A) {
      const [file, n] = f.where.split(':');
      const term = /→ \*\*([^*]+)\*\*/.exec(f.msg)[1];
      ((byFile[file] ||= {})[term] ||= []).push(n);
    }
    for (const [file, terms] of Object.entries(byFile)) {
      const total = Object.values(terms).reduce((a, b) => a + b.length, 0);
      const parts = Object.entries(terms).sort((a, b) => b[1].length - a[1].length)
        .map(([t, ns]) => `→${t} ×${ns.length} (줄 ${[...new Set(ns)].slice(0, 6).join(', ')}${ns.length > 6 ? ' …' : ''})`);
      out.push(`- 🟡 \`${file}\` ${total}건 — ${parts.join(' · ')}`);
    }
    if (findings.A.length) out.push('', '_줄마다 보려면 장 번호를 주거나(`check.js 06`) `--all`._');
    out.push('');
    continue;
  }
  for (const f of findings[k]) out.push(`- ${f.sev} \`${f.where}\` ${f.msg}`);
  out.push('');
}
if (Object.keys(flaggedCount).length) {
  out.push('## ⚠️ 딱지 붙은 절 (스스로 낡았다고 밝힌 곳 — 건수만, `--all`로 펼침)');
  for (const [k, n] of Object.entries(flaggedCount)) out.push(`- ${k} … ${n}건`);
  out.push('');
}
if (notAssessed.length) {
  out.push('## ⚪ 평가 불가');
  for (const n of notAssessed) out.push(`- ${n}`);
  out.push('');
}
console.log(out.join('\n'));
