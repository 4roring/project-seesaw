// 런 진행 — 열 번의 비무와, 그 사이의 걸음
// gdd/09-run-structure.md · gdd/13-crossroads.md
const TS_Run = (() => {
  const D = TS_DATA;

  const state = {
    // SELECT | WEAPON | BATTLE | REWARD | CROSSROAD | NODE | RUN_WON | RUN_LOST
    phase: 'SELECT',
    color: null,
    weapons: [],       // 손에 쥔 신병이기 (키 배열). 한 자루만 (gdd/14 14-2)
    weaponOffer: null, // 런 중에 제안된 무기
    relics: [],        // 지닌 유물 (gdd/15). 강호행의 규칙을 비튼다
    relicOffer: null,
    lastStandLeft: 0,  // 호심경 — 전투 사이에도 이어진다
    skipNextCrossroad: false, // 축지부 — 두 걸음을 딛은 대가
    secondStepPending: false,
    deck: [],        // 카드 정의 배열 (1개 = 실제 카드 1장)
    stage: 1,
    playerHp: D.STARTING_PLAYER_HP,
    playerMaxHp: D.STARTING_PLAYER_HP,
    // 최소 반환 기세는 런 중에 깎일 수 있다 (기연 '영약')
    minReturn: D.MIN_MOMENTUM_RETURN,

    game: null,           // 현재 전투 상태
    battleKind: 'STAGE',  // STAGE | ELITE — 이겼을 때 어디로 돌아가는지가 다르다
    eliteEnemy: null,

    rewardOptions: [],
    rewardPicksLeft: 1,
    lastHeal: 0,

    crossroad: [],     // 이번 갈림길의 걸음 후보 (노드 키)
    node: null,        // 진행 중인 걸음 { key, fortune? }
    nodeView: null,    // 하위 선택지 { title, sub, options: [...] }
    nodeResult: null,  // 걸음이 끝나고 보여줄 한 줄

    intel: [],         // 주루에서 미리 본 스테이지 번호
    fortuneUsed: 0,
    pendingManual: 0,  // 기연 '비급' — 아직 익히지 못한 구결 권수 (부스터 '비급 두 권'이면 2)
    // 파일럿 1.5 — 무기 계열 (ideanote/017 · drafts/017-pilot-1.5)
    booster: null,         // 고른 시작 부스터 키
    boosterOffer: [],      // 보여 준 부스터 셋
    preRun: false,         // 지금 보상 화면이 "나서기 전" 전리품인가
    preRunKeep: false,     // 같은 셋에서 여러 장을 거두는가 ('강호 경험' — 3장 중 2장)
    ultimateTaken: false,  // 오의는 런에 하나
    // 마교의 대가 (초안 C-3) — 검증 지표로도 쓴다
    burnMaxHpLost: 0, drainMaxHpGained: 0, drainKills: 0,
    burnCarry: 0,          // 10에 못 미쳐 아직 정산하지 않은 태운 HP
    journal: [],       // 걸음의 기록 (ideanote/009 연대기의 재료)
  };

  function get() { return state; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newRun() {
    state.phase = 'SELECT';
    state.color = null;
    state.weapons = [];
    state.weaponOffer = null;
    state.relics = [];
    state.relicOffer = null;
    state.lastStandLeft = 0;
    state.skipNextCrossroad = false;
    state.secondStepPending = false;
    state.deck = [];
    state.stage = 1;
    state.playerHp = D.STARTING_PLAYER_HP;
    state.playerMaxHp = D.STARTING_PLAYER_HP;
    state.minReturn = D.MIN_MOMENTUM_RETURN;
    state.game = null;
    state.battleKind = 'STAGE';
    state.eliteEnemy = null;
    state.rewardOptions = [];
    state.rewardPicksLeft = 1;
    state.lastHeal = 0;
    state.crossroad = [];
    state.node = null;
    state.nodeView = null;
    state.nodeResult = null;
    state.intel = [];
    state.fortuneUsed = 0;
    state.pendingManual = 0;
    state.booster = null;
    state.boosterOffer = [];
    state.preRun = false;
    state.preRunKeep = false;
    state.ultimateTaken = false;
    state.burnMaxHpLost = 0; state.drainMaxHpGained = 0; state.drainKills = 0; state.burnCarry = 0;
    state.journal = [];
  }

  // 시작 덱(count 포함 정의)을 카드 1장 = 항목 1개로 펼친다
  function expandStarter(color) {
    const out = [];
    (D.STARTER_DECKS[color] || (D.LINEAGE_STARTER || {})[color] || []).forEach((def) => {
      const n = def.count || 1;
      for (let i = 0; i < n; i++) {
        const card = { ...def };
        delete card.count;
        out.push(card);
      }
    });
    return out;
  }

  function chooseDeck(color) {
    state.color = color;
    state.deck = expandStarter(color);
    state.stage = 1;
    if (D.WEAPONS_ENABLED) { state.phase = 'WEAPON'; return; }
    // 계열은 곧 무기라 병기를 끈 데모에서도 부스터는 고른다
    if (isLineage(color)) { openBoosters(); return; }
    startBattle();
  }

  // ── 파일럿 — 무기 계열 (ideanote/017) ──────────────────────
  // 4문파 데모와 나란히 돈다. 이 아래는 계열 런에서만 쓰인다.
  function isLineage(key) { return !!(D.LINEAGES_ENABLED && D.LINEAGES && D.LINEAGES[key]); }

  // 화면이 "누구로 나섰나"를 그릴 때 쓰는 이름표. 문파와 계열이 같은 모양이다.
  function profile(key) { return (D.COLORS || {})[key] || (D.LINEAGES || {})[key] || {}; }

  // 이 런이 쥘 수 있는 병기. 계열이면 그 계열의 둘뿐이고(계열이 곧 무기),
  // 4문파면 계열 전용 병기를 뺀 전부다.
  function weaponKeysFor(key) {
    if (isLineage(key)) return D.LINEAGES[key].weapons.filter((k) => D.WEAPONS[k]);
    return Object.keys(D.WEAPONS).filter((k) => !D.WEAPONS[k].lineageOnly);
  }

  // ── 시작 부스터 (초안 C-1) ─────────────────────────────────
  // 계열 · 병기를 고른 뒤 풀에서 무작위 셋을 보여 주고 하나를 고른다.
  function boosterDef(key) { return (D.BOOSTERS || []).find((b) => b.key === key); }
  function openBoosters() {
    state.boosterOffer = shuffle((D.BOOSTERS || []).map((b) => b.key)).slice(0, D.BOOSTER_CHOICES);
    state.phase = 'ORIGIN';
  }

  // 전향 — 기본 초식 8장만 그 세력 일반 초식으로 (계열 고유 2장은 남긴다)
  function convertBasics(faction) {
    const commons = factionPool(faction).filter((c) => c.rarity === 1);
    state.deck = state.deck.map((c) => (c.basic ? { ...commons[Math.floor(Math.random() * commons.length)] } : c));
  }

  function chooseBooster(key) {
    if (state.phase !== 'ORIGIN' || !state.boosterOffer.includes(key)) return;
    const b = boosterDef(key);
    if (!b) return;
    state.booster = key;
    note(`시작 부스터 — ${b.name}`);
    if (b.minReturn) state.minReturn += b.minReturn;
    if (b.manuals) state.pendingManual = (state.pendingManual || 0) + b.manuals;
    if (b.convert) convertBasics(b.convert);
    if (b.upgrades) {
      shuffle(upgradableIndexes()).slice(0, b.upgrades).forEach((i) => upgradeAt(i));
    }
    // 나서기 전의 전리품 — 세력 초식 3장 중 1장, 또는 무작위 3장 중 2장
    if (b.factionPick || b.veteranPicks) {
      state.preRun = true;
      state.preRunKeep = !!b.veteranPicks;
      state.rewardPicksLeft = b.veteranPicks || 1;
      state.rewardOptions = rollLineageRewards('STAGE', D.REWARD_CHOICES, b.factionPick || null);
      state.phase = 'REWARD';
      return;
    }
    startBattle();
  }

  function favorFaction() { const b = boosterDef(state.booster); return b ? b.favor || null : null; }

  // 덱에 든 그 세력 초식 수 (오의 자신은 세지 않는다)
  function factionCount(faction) {
    return state.deck.filter((c) => c.faction === faction && !c.ultimate).length;
  }

  // 전투 시작 효과 — 부스터가 비무마다 새로 까는 것 (진법 · 쾌수)
  function battleExtras() {
    const b = boosterDef(state.booster) || {};
    const opening = [];
    if (b.opening === 'guard') {
      opening.push({ block: 5, effect: { id: 'booster-guard', name: '호신진', kind: 'BLOCK_ON_TURN_START', amount: 5, turns: 1 } });
    } else if (b.opening === 'break') {
      opening.push({ effect: { id: 'booster-break', name: '파공진', kind: 'BOSS_VULNERABLE_AURA', amount: 15, turns: 2 } });
    }
    return { openingEffects: opening, extraHand: b.extraHand || 0 };
  }

  function factionPool(faction) { return (((D.FACTION_POOL || {})[state.color] || {})[faction]) || []; }
  function lineagePool() {
    return [...((D.LINEAGE_POOL || {})[state.color] || []),
      ...(D.FACTION_ORDER || []).flatMap((f) => factionPool(f))];
  }

  // 희귀도로 조절한다 — 첫 전리품부터 전부 후보다 (017-4).
  // 한 칸마다 희귀도를 먼저 굴리고, 그 희귀도 안에서 부스터 가중으로 고른다.
  // only를 주면 그 세력 풀에서만 (세력 부스터의 "3장 중 1장").
  function rollLineageRewards(kind, n, only) {
    const odds = D.RARITY_ODDS[kind] || D.RARITY_ODDS.STAGE;
    const total = odds.reduce((a, b) => a + b, 0);
    const pool = only ? factionPool(only) : lineagePool();
    const fav = favorFaction();
    const weight = (c) => (fav && c.faction === fav ? D.BOOSTER_FACTION_WEIGHT : 1);
    const out = [];
    for (let i = 0; i < n; i++) {
      let r = Math.random() * total, rarity = odds.length;
      for (let j = 0; j < odds.length; j++) { if (r < odds[j]) { rarity = j + 1; break; } r -= odds[j]; }
      const fresh = (c) => !out.some((o) => o.key === c.key);
      let cands = pool.filter((c) => c.rarity === rarity && fresh(c));
      if (!cands.length) cands = pool.filter(fresh);
      if (!cands.length) break;
      out.push({ ...weightedPick(cands, weight) });
    }
    return out;
  }

  function weightedPick(cands, weight) {
    let x = Math.random() * cands.reduce((sum, c) => sum + weight(c), 0);
    return cands.find((c) => (x -= weight(c)) < 0) || cands[cands.length - 1];
  }

  // 오의 — 무작위 3장 중 1장, 덱에 없는 세력 것도 (초안 C-2).
  // 세력 부스터: 속가제자 · 연줄 · 잔당은 그 세력 ×2, 비전 · 맹세 · 혈서는 반드시 한 장.
  function ultimateOptions() {
    let pool = ((D.ULTIMATES || {})[state.color] || []).slice();
    const b = boosterDef(state.booster) || {};
    const out = [];
    if (b.ultGuarantee) {
      const own = pool.filter((c) => c.faction === b.ultGuarantee);
      if (own.length) out.push(own[Math.floor(Math.random() * own.length)]);
    }
    const weight = (c) => (b.favor && c.faction === b.favor ? D.BOOSTER_FACTION_WEIGHT : 1);
    while (out.length < D.ULTIMATE_CHOICES) {
      pool = pool.filter((c) => !out.includes(c));
      if (!pool.length) break;
      out.push(weightedPick(pool, weight));
    }
    return shuffle(out).map((c) => ({ ...c }));
  }

  // ── 유물 (gdd/15) ───────────────────────────────────────────
  function hasRelic(field) {
    return state.relics.some((k) => (D.RELICS[k] || {})[field]);
  }
  function relicSum(field) {
    return state.relics.reduce((n, k) => n + ((D.RELICS[k] || {})[field] || 0), 0);
  }
  function relicSlotsFree() { return D.RELIC_SLOTS - state.relics.length; }
  function takeRelic(key, dropKey) {
    if (!D.RELICS[key] || state.relics.includes(key)) return false;
    if (dropKey) state.relics = state.relics.filter((k) => k !== dropKey);
    if (relicSlotsFree() <= 0) return false;
    state.relics.push(key);
    // 호심경을 새로 얻으면 그 자리에서 바로 유효해진다
    state.lastStandLeft = Math.max(state.lastStandLeft, relicSum('lastStand'));
    return true;
  }
  function rollRelicOffer() {
    const pool = Object.keys(D.RELICS).filter((k) => !state.relics.includes(k));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── 신병이기 (gdd/14) ───────────────────────────────────────
  // 병기는 한 자루만 쥔다. 새 병기를 쥐려면 쥔 것을 놓는다 (14-2).
  function canEquip(key) {
    return weaponKeysFor(state.color).includes(key) && !state.weapons.includes(key);
  }
  // 시작 시 한 자루. 맨손으로 나서는 길은 없다 (14-5).
  function chooseWeapon(key) {
    if (state.phase !== 'WEAPON') return;
    if (!canEquip(key)) return;
    state.weapons = [key];
    // 계열 런은 병기를 쥔 뒤 시작 부스터를 고른다 (초안 C-1)
    if (isLineage(state.color) && !state.booster) { openBoosters(); return; }
    startBattle();
  }
  // 런 중 획득 — 쥔 것이 있으면 놓고 쥔다 (14-5)
  function takeWeapon(key) {
    if (!canEquip(key)) return false;
    state.weapons = [key];
    return true;
  }

  function currentEnemy() { return D.ENEMIES[state.stage - 1]; }

  function startBattle() {
    state.battleKind = 'STAGE';
    state.eliteEnemy = null;
    state.game = TS_Engine.createGame({
      enemy: currentEnemy(),
      deck: state.deck,
      ...battleExtras(),
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      handCap: (D.COLORS[state.color] || {}).handCap,
      weapons: state.weapons,
      relics: state.relics,
      lastStandLeft: state.lastStandLeft,
      minReturn: state.minReturn,
    });
    state.phase = 'BATTLE';
  }

  // 비무대회 — 앞으로 만날 상대를 미리 겨룬다 (gdd/13 13-6).
  // 로스터를 당겨 쓰므로 난이도가 스테이지 곡선을 저절로 따라간다.
  function startEliteBattle() {
    const idx = Math.min(state.stage - 1 + D.ELITE_LOOKAHEAD, D.ENEMIES.length - 1);
    const base = D.ENEMIES[idx];
    const enemy = { ...base, hp: Math.max(1, Math.round(base.hp * D.ELITE_HP_RATIO)) };
    state.eliteEnemy = enemy;
    state.battleKind = 'ELITE';
    state.game = TS_Engine.createGame({
      enemy,
      deck: state.deck,
      ...battleExtras(),
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      handCap: (D.COLORS[state.color] || {}).handCap,
      weapons: state.weapons,
      relics: state.relics,
      lastStandLeft: state.lastStandLeft,
      minReturn: state.minReturn,
    });
    state.phase = 'BATTLE';
  }

  // 전투가 끝났는지 확인하고 다음 단계로 넘긴다. UI가 매 입력 후 호출.
  function syncBattleResult() {
    const g = state.game;
    if (!g || state.phase !== 'BATTLE') return;
    if (g.status === 'LOST') {
      state.playerHp = 0;
      state.phase = 'RUN_LOST';
      return;
    }
    if (g.status !== 'WON') return;

    state.playerHp = g.playerHp; // 전투 종료 시점 체력을 이어받음
    // 마교의 대가 (초안 C-3) — 태운 HP 10당 최대 체력 -1, 흡성 막타면 +2.
    // 정산은 비무가 끝날 때지만 10에 못 미친 나머지는 다음 비무로 넘긴다 — 비무마다
    // 버리면 순수 마교도 한 비무에 평균 5.7만 태워서 대가가 거의 안 붙었다.
    if (isLineage(state.color)) {
      const burned = state.burnCarry + ((g.stats && g.stats.hpBurned) || 0);
      const lost = Math.floor(burned / D.BURN_PER_MAXHP);
      state.burnCarry = burned - lost * D.BURN_PER_MAXHP;
      if (lost > 0) {
        state.playerMaxHp = Math.max(1, state.playerMaxHp - lost);
        state.playerHp = Math.min(state.playerHp, state.playerMaxHp);
        state.burnMaxHpLost += lost;
        note(`태운 HP가 쌓여 최대 체력 -${lost}`);
      }
      if (g.drainKill) {
        state.playerMaxHp += D.DRAIN_KILL_MAXHP;
        state.playerHp += D.DRAIN_KILL_MAXHP;
        state.drainMaxHpGained += D.DRAIN_KILL_MAXHP;
        state.drainKills += 1;
        note(`흡성으로 막타 — 최대 체력 +${D.DRAIN_KILL_MAXHP}`);
      }
    }
    state.lastStandLeft = g.lastStandLeft; // 호심경은 강호행에 한 번뿐이다
    // 오도비 — 전투에서 낸 파훼를 강호행의 성장으로 옮긴다
    const grow = relicSum('breakGrowth') * g.breakCount;
    if (grow > 0) {
      state.playerMaxHp += grow;
      state.playerHp += grow;
      note(`오도비 — 파훼 ${g.breakCount}회로 최대 체력 +${grow}`);
    }

    if (state.battleKind === 'ELITE') {
      note(`비무대회에서 ${g.enemyName}을(를) 꺾다`);
      // 꺾은 상대가 지녔던 것을 취한다 — 병기이거나 유물이다.
      // 덱 성장 곡선을 건드리지 않는 자리라 여기 둔다 (gdd/13-7).
      state.weaponOffer = D.WEAPONS_ENABLED ? rollWeaponOffer() : null;
      state.relicOffer = D.RELICS_ENABLED ? rollRelicOffer() : null;
      state.rewardPicksLeft = D.ELITE_REWARD_CARDS;
      state.rewardOptions = rollRewards();
      state.phase = 'REWARD';
      return;
    }

    note(`${g.enemyName}을(를) 꺾다`);
    if (state.stage >= D.ENEMIES.length) {
      state.phase = 'RUN_WON';
      return;
    }
    state.rewardPicksLeft = 1;
    // 오의 — 계열 런의 5스테이지 전리품을 대신한다 (초안 C-2)
    if (isLineage(state.color) && state.stage === D.ULTIMATE_STAGE && !state.ultimateTaken) {
      state.rewardOptions = ultimateOptions();
    } else {
      state.rewardOptions = rollRewards();
    }
    state.phase = 'REWARD';
  }

  function note(text) { state.journal.push({ stage: state.stage, text }); }

  // 방금 클리어한 스테이지 기준 티어 (gdd/09 9-3).
  // 보상은 "다음 스테이지에서 쓸 카드"이므로 한 칸 앞당겨 준다 — 스테이지 4~7을
  // 티어2로, 8~10을 티어3으로 싸우려면 3·7 클리어 시점에 그 티어가 열려야 한다.
  // (앞당기기 전에는 티어3 없이 스테이지 8을 맞아 사망이 몰렸다.)
  function tierForClearedStage(stage) {
    if (stage <= 2) return 1;
    if (stage <= 6) return 2;
    return 3;
  }

  function poolForTier(tier, color) {
    const pools = D.REWARD_POOLS[color || state.color] || {};
    // unique 카드는 시작 덱의 1장이 전부 — 보상으로 복사본이 나오면 안 된다
    const starter = expandStarter(color || state.color).filter((c) => !c.unique).map((c) => ({ ...c }));
    if (tier === 1) return [...(pools[1] || []), ...starter];
    if (tier === 2) return [...(pools[2] || []), ...(pools[1] || []), ...starter];
    return [...(pools[3] || []), ...(pools[2] || [])];
  }

  // key 기준 중복 제거 후 무작위 n장
  function pickCards(pool, n) {
    const uniq = [];
    const seen = new Set();
    pool.forEach((c) => { if (!seen.has(c.key)) { seen.add(c.key); uniq.push(c); } });
    return shuffle(uniq).slice(0, n).map((c) => { const x = { ...c }; delete x.count; return x; });
  }

  function rollRewards() {
    if (isLineage(state.color)) {
      return rollLineageRewards(state.battleKind === 'ELITE' ? 'ELITE' : 'STAGE', D.REWARD_CHOICES);
    }
    return pickCards(poolForTier(tierForClearedStage(state.stage)), D.REWARD_CHOICES);
  }

  // 강화 가능한 카드(강화표에 있고 아직 강화 안 된 것)의 덱 내 인덱스 목록
  function upgradableIndexes() {
    return state.deck
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.upgraded && D.UPGRADES[c.key])
      .map(({ i }) => i);
  }

  function upgradeAt(index) {
    const card = state.deck[index];
    const patch = D.UPGRADES[card && card.key];
    if (!card || card.upgraded || !patch) return false;
    // 설명은 ui.js의 TS_Text가 필드에서 생성하므로 여기서 만들지 않는다 —
    // 손으로 만들던 시절엔 강화하면 원래 효과가 텍스트에서 사라졌다.
    state.deck[index] = { ...card, ...patch, upgraded: true, name: `${card.name}+` };
    return true;
  }

  // ── 비무 보상 ───────────────────────────────────────────────
  function takeCard(option) {
    state.deck.push({ ...option });
    if (option.ultimate) state.ultimateTaken = true;
    // '강호 경험' — 같은 셋에서 한 장 더
    if (state.preRunKeep) state.rewardOptions = state.rewardOptions.filter((o) => o.key !== option.key);
    consumeRewardPick();
  }

  function skipReward() {
    // 각인석 (gdd/15) — 거두지 않는 쪽을 실제 선택지로 만든다.
    // 덱을 얇게 유지하면서도 성장할 길이 열린다.
    if (hasRelic('refuseUpgrade')) {
      const ups = upgradableIndexes();
      if (ups.length) {
        const i = ups[Math.floor(Math.random() * ups.length)];
        const before = state.deck[i].name;
        upgradeAt(i);
        note(`각인석 — 전리품 대신 ${before}을(를) 연마`);
      }
    }
    state.rewardPicksLeft = 0;
    consumeRewardPick();
  }

  function consumeRewardPick() {
    state.rewardPicksLeft -= 1;
    if (state.rewardPicksLeft > 0) {
      if (!state.preRunKeep) state.rewardOptions = rollRewards();
      if (state.rewardOptions.length) return;
    }
    // 나서기 전의 전리품이면 이제 첫 비무로 나선다
    if (state.preRun) { state.preRun = false; state.preRunKeep = false; startBattle(); return; }
    // 엘리트를 이겨서 온 보상이면 걸음은 이미 소비했다 — 곧장 다음 비무로
    if (state.battleKind === 'ELITE') {
      // 꺾은 상대가 지녔던 것 — 병기와 유물을 함께 놓고 하나를 고른다.
      // 둘을 차례로 물으면 "둘 다 받는" 것이 되어 대회 보상이 너무 커진다.
      if (state.weaponOffer || state.relicOffer) {
        state.nodeView = spoilsView(state.weaponOffer, state.relicOffer);
        state.weaponOffer = null; state.relicOffer = null;
        state.node = { key: 'TOMB' }; // 선택지 처리기를 공유한다
        state.phase = 'NODE';
        return;
      }
      advanceStage(); return;
    }
    openCrossroad();
  }

  // 아직 안 쥔 무기 중 하나. 쥔 것을 놓을지는 제안 화면이 묻는다.
  function rollWeaponOffer() {
    const pool = weaponKeysFor(state.color).filter((k) => !state.weapons.includes(k));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── 갈림길 ──────────────────────────────────────────────────
  function availableFortunes() {
    return D.FORTUNES.filter((f) => !f.available || f.available(state));
  }

  function rollCrossroad() {
    // 계열 런에는 문파 방문이 없다 — 017-5는 그 걸음을 "세력의 문"으로
    // 바꾸는데, 그건 만남 걸음과 함께(순서 4) 한다. 파일럿에서는 뺀다.
    const rest = isLineage(state.color) ? ['TAVERN', 'ELITE'] : ['TAVERN', 'SECT_VISIT', 'ELITE'];
    // 고묘 — 유물이 나오는 자리. 이게 없으면 런의 77%가 유물을 한 번도
    // 못 본다(실측). 시스템을 만들어 놓고 안 보이게 두면 없는 것과 같다.
    if (D.RELICS_ENABLED && rollRelicOffer()) rest.push('TOMB');
    if (state.fortuneUsed < D.FORTUNE_MAX_PER_RUN && availableFortunes().length) rest.push('FORTUNE');
    if (D.CROSSROAD_ALWAYS_TRAINING) {
      // 수련장은 늘 열어 둔다. 회복과 연마가 둘 다 여기 있어서, 이 걸음에
      // 닿지 못하는 갈림길이 이어지면 런이 선택이 아니라 사고로 끝난다.
      return shuffle(['TRAINING', ...shuffle(rest).slice(0, D.CROSSROAD_CHOICES - 1)]);
    }
    const picked = shuffle(['TRAINING', ...rest]).slice(0, D.CROSSROAD_CHOICES);
    if (!picked.some((k) => k === 'TRAINING' || k === 'TAVERN')) {
      picked[picked.length - 1] = Math.random() < 0.5 ? 'TRAINING' : 'TAVERN';
    }
    return picked;
  }

  function openCrossroad() {
    if (!D.CROSSROAD_ENABLED) { advanceStage(); return; }
    // 축지부 (gdd/15) — 지난번에 두 걸음을 딛었으면 이번은 건너뛴다
    if (state.skipNextCrossroad) {
      state.skipNextCrossroad = false;
      state.nodeResult = '축지부 — 땅을 접어 건너뜁니다.';
      advanceStage();
      return;
    }
    state.crossroad = rollCrossroad();
    state.node = null;
    state.nodeView = null;
    state.phase = 'CROSSROAD';
  }

  function chooseNode(key) {
    if (state.phase !== 'CROSSROAD' || !state.crossroad.includes(key)) return;
    state.node = { key };
    if (key === 'ELITE') { note('비무대회에 나서다'); startEliteBattle(); return; }
    if (key === 'TAVERN') { resolveTavern(); return; }
    if (key === 'TOMB') {
      const offer = rollRelicOffer();
      if (!offer) { finishNode('고묘 — 남은 것이 없습니다.'); return; }
      state.nodeView = relicOfferView(offer, '고묘(古墓)');
      state.phase = 'NODE';
      return;
    }
    if (key === 'TRAINING') { state.nodeView = trainingView(); }
    else if (key === 'SECT_VISIT') { state.nodeView = sectVisitView(); }
    else if (key === 'FORTUNE') { state.nodeView = fortuneView(); }
    state.phase = 'NODE';
  }

  // ── 수련장 ──────────────────────────────────────────────────
  function trainingView() {
    const options = [{
      id: 'rest',
      name: '운기조식(運氣調息)',
      tag: '회복',
      desc: `잃은 체력의 ${Math.round(D.TRAIN_HEAL_RATIO * 100)}%를 되찾습니다 (+${healAmount(D.TRAIN_HEAL_RATIO)}).`,
      disabled: state.playerHp >= state.playerMaxHp,
    }];
    if (state.pendingManual) {
      options.push({
        id: 'learn',
        name: '구결 해독(口訣 解讀)',
        tag: '기연',
        desc: '주웠던 비급의 구결을 마침내 몸에 익힙니다 — 무색 초식 1장.',
      });
    }
    const shown = new Set();
    upgradableIndexes().forEach((i) => {
      const card = state.deck[i];
      if (shown.has(card.key)) return; // 같은 카드가 여러 장이면 하나만 대표로
      shown.add(card.key);
      options.push({ id: `up:${i}`, name: card.name, tag: '연마', cardIndex: i, upgrade: true });
    });
    return {
      title: '수련장(修練場)',
      sub: '숨을 돌릴 것인가, 초식을 벼릴 것인가.',
      options,
    };
  }

  // ── 문파 방문 ───────────────────────────────────────────────
  // 얻는 게 아니라 바꾼다. 걸음이 전부 순이득이면 갈림길은 선택이 아니라
  // 보너스가 되고, 실제로 그렇게 만들었더니 숙련 플레이 클리어율이
  // 74% → 88%로 부풀었다. 덱 장수는 비무 전리품만으로 자란다(10→20).
  // 대신 이 걸음은 "원하는 라인으로 덱을 몰아가는" 수단이 된다.
  function sectVisitView() {
    const tier = tierForClearedStage(state.stage);
    const own = pickCards(poolForTier(tier), D.SECT_VISIT_OWN_CHOICES);
    const others = Object.keys(D.COLORS).filter((c) => c !== state.color);
    const guest = others[Math.floor(Math.random() * others.length)];
    // 타 문파 무공은 한 티어 아래에서만 — 색 정체성을 해치지 않을 만큼만
    const foreign = pickCards(poolForTier(Math.max(1, tier - 1), guest), D.SECT_VISIT_FOREIGN_CHOICES);
    return {
      title: '문파 방문',
      sub: `본산의 비급을 열람하거나, ${(D.COLORS[guest] || {}).sect}의 무공 한 자락을 얻습니다.`,
      groups: [
        { label: `비급 열람 — ${(D.COLORS[state.color] || {}).sect}`, ids: own.map((c, i) => `own:${i}`) },
        { label: `객경 초빙 — ${(D.COLORS[guest] || {}).sect}`, ids: foreign.map((c, i) => `for:${i}`) },
      ],
      options: [
        ...own.map((c, i) => ({ id: `own:${i}`, card: c, name: c.name, tag: '비급' })),
        ...foreign.map((c, i) => ({ id: `for:${i}`, card: c, name: c.name, tag: (D.COLORS[guest] || {}).name })),
        // 물러설 길이 없으면 이 걸음은 함정이 된다 — 가져갈 만한 게 없는
        // 날에도 손에 익은 초식을 억지로 놓아야 하니까. 걸음은 이미 썼으니
        // 공짜는 아니다.
        { id: 'leave', name: '배우지 않고 돌아간다', tag: '물러섬',
          desc: '오늘은 마음에 드는 초식이 없습니다. 걸음만 쓰고 지나갑니다.' },
      ],
    };
  }

  // ── 기연 ────────────────────────────────────────────────────
  function fortuneView() {
    const pool = availableFortunes();
    const f = pool[Math.floor(Math.random() * pool.length)];
    state.node.fortune = f.key;
    return {
      title: `기연 — ${f.name}`,
      sub: f.story,
      fortune: f,
      options: [
        { id: 'accept', name: '받아들인다', tag: '수락', desc: `얻는 것: ${f.gain}\n대가: ${f.cost}` },
        { id: 'refuse', name: '지나친다', tag: '거절', desc: '아무 일도 일어나지 않습니다.' },
      ],
    };
  }

  function fortuneDef(key) { return D.FORTUNES.find((f) => f.key === key); }

  // 비무대회의 전리 — 병기와 유물을 한 화면에 놓고 하나만 고르게 한다.
  function spoilsView(weaponKey, relicKey) {
    const options = [];
    if (weaponKey) {
      const w = D.WEAPONS[weaponKey];
      const held = state.weapons[0];
      options.push({
        id: held ? `wswap:${weaponKey}:${held}` : `wtake:${weaponKey}`,
        name: `${w.icon} ${w.name}`, tag: held ? '교체' : '병기',
        desc: `${w.rule}\n${held ? '쥐던 것을 놓습니다: ' + D.WEAPONS[held].name : w.flavor}`,
      });
    }
    if (relicKey) {
      const rl = D.RELICS[relicKey];
      const canTake = relicSlotsFree() > 0;
      options.push({
        id: canTake ? `rtake:${relicKey}` : `rswap:${relicKey}:${state.relics[0]}`,
        name: `${rl.icon} ${rl.name}`, tag: canTake ? '유물' : '교체',
        desc: `${rl.rule}\n${canTake ? rl.flavor : '버립니다: ' + D.RELICS[state.relics[0]].name}`,
      });
    }
    options.push({ id: 'rleave', name: '아무것도 취하지 않는다', tag: '거절',
      desc: '꺾은 것으로 족합니다.' });
    return { title: '비무대회 — 꺾은 자의 유품', sub: '하나만 취할 수 있습니다.', options };
  }

  // 유물 제안. 자리가 비면 지니고, 다 찼으면 무엇을 버릴지 고른다.
  function relicOfferView(key, title) {
    const rl = D.RELICS[key];
    const options = [];
    if (relicSlotsFree() > 0) {
      options.push({ id: `rtake:${key}`, name: `${rl.icon} ${rl.name}을(를) 지닌다`,
        tag: '획득', desc: `${rl.rule}\n${rl.flavor}` });
    } else {
      state.relics.forEach((k) => {
        const cur = D.RELICS[k];
        options.push({ id: `rswap:${key}:${k}`, name: `${cur.name}을(를) 버리고 ${rl.name}을(를) 지닌다`,
          tag: '교체', desc: `버리는 것: ${cur.rule}\n지니는 것: ${rl.rule}` });
      });
    }
    options.push({ id: 'rleave', name: '그냥 지나간다', tag: '거절',
      desc: relicSlotsFree() > 0 ? '손대지 않는 편이 나을 수도 있습니다.'
        : '지니던 것을 버릴 이유가 없습니다.' });
    return { title, sub: `${rl.icon} ${rl.name} — ${rl.rule}`, options };
  }

  // 무기 제안. 한 자루만 쥐므로 늘 "놓고 쥐거나, 지나가거나"다 —
  // 버리는 것이 있어야 무기 교체에 무게가 생긴다 (gdd/14 14-5).
  function weaponOfferView(key, title) {
    const w = D.WEAPONS[key];
    const held = state.weapons[0];
    const options = [];
    if (!held) {
      options.push({ id: `wtake:${key}`, name: `${w.icon} ${w.name}을(를) 쥔다`,
        tag: '병기', desc: `${w.rule}\n${w.flavor}` });
    } else {
      const cur = D.WEAPONS[held];
      options.push({ id: `wswap:${key}:${held}`, name: `${cur.name}을(를) 놓고 ${w.name}을(를) 쥔다`,
        tag: '교체', desc: `놓는 것: ${cur.rule}\n쥐는 것: ${w.rule}` });
    }
    options.push({ id: 'wleave', name: '그냥 지나간다', tag: '거절',
      desc: '손에 익은 것을 놓을 이유가 없습니다.' });
    return { title, sub: `${w.icon} ${w.name} — ${w.rule}`, options };
  }

  function applyFortune(key) {
    const f = fortuneDef(key);
    if (!f) return '';
    state.fortuneUsed += 1;
    f.apply(state);
    if (key === 'demonic') {
      const card = pickCards(D.FORTUNE_CARDS.demonic, 1)[0];
      state.deck.push({ ...card });
      return `${f.name} — ${card.name}을(를) 익혔습니다. 최대 체력이 10 줄었습니다.`;
    }
    if (key === 'elixir') {
      return `${f.name} — 최대 체력 +15. 다만 이제 합은 아${state.minReturn}에서 시작합니다.`;
    }
    if (key === 'manual') {
      return `${f.name} — 구결을 얻었습니다. 수련장에서 익혀야 합니다.`;
    }
    if (key === 'relic_find') {
      const offer = rollRelicOffer();
      if (!offer) return `${f.name} — 이미 모든 유물을 지녔습니다.`;
      state.nodeView = relicOfferView(offer, '기연 — 기물');
      return null;
    }
    if (key === 'relic_blade') {
      const offer = rollWeaponOffer();
      if (!offer) return `${f.name} — 이미 모든 병기를 갖추었습니다.`;
      state.weaponOffer = offer;
      state.nodeView = weaponOfferView(offer, '기연 — 신병이기');
      return null; // 쥔 병기를 놓고 쥘지, 지나칠지 골라야 한다
    }
    if (key === 'hermit') {
      // 잊을 초식을 고르게 한다 — 무작위로 지우면 대가가 아니라 사고다
      state.nodeView = {
        title: '은거 고수',
        sub: '무엇을 덜어낼 것인지 고르십시오. 덜어낸 자리에 한 수가 들어옵니다.',
        options: state.deck.map((c, i) => ({ id: `forget:${i}`, card: c, name: c.name, tag: '잊는다' })),
      };
      return null; // 아직 걸음이 끝나지 않았다
    }
    return f.name;
  }

  // ── 걸음 안의 선택 ──────────────────────────────────────────
  function chooseNodeOption(id) {
    if (state.phase !== 'NODE' || !state.nodeView) return;
    const opt = (state.nodeView.options || []).find((o) => o.id === id);
    if (!opt || opt.disabled) return;
    const key = state.node.key;

    if (key === 'TRAINING') {
      if (id === 'rest') {
        const healed = heal(D.TRAIN_HEAL_RATIO);
        finishNode(`수련장 — 운기조식으로 체력 ${healed}을(를) 되찾았습니다.`);
        return;
      }
      if (id === 'learn') {
        const card = pickCards(D.FORTUNE_CARDS.manual, 1)[0];
        state.deck.push({ ...card });
        state.pendingManual = Math.max(0, (state.pendingManual || 0) - 1);
        finishNode(`수련장 — 구결을 풀어 ${card.name}을(를) 익혔습니다.`);
        return;
      }
      if (opt.upgrade) {
        const before = state.deck[opt.cardIndex].name;
        upgradeAt(opt.cardIndex);
        finishNode(`수련장 — ${before}을(를) 연마했습니다.`);
        return;
      }
    }

    if (key === 'SECT_VISIT') {
      // 놓기 단계를 먼저 본다 — 놓을 후보에도 card가 실려 있어서, 얻기
      // 분기를 앞에 두면 같은 화면을 영원히 다시 그린다 (실측: 런이
      // 무한 루프에 빠져 통계가 통째로 거짓이 됐다).
      if (id.startsWith('drop:')) {
        const i = Number(id.slice(5));
        const dropped = state.deck[i];
        state.deck.splice(i, 1);
        state.deck.push({ ...state.node.gained });
        finishNode(`문파 방문 — ${dropped.name}을(를) 놓고 ${state.node.gained.name}을(를) 배웠습니다.`);
        return;
      }
      if (id === 'leave') { finishNode('문파 방문 — 마음에 드는 초식이 없어 그냥 돌아섰습니다.'); return; }
      if (opt.card) {
        state.node.gained = { ...opt.card };
        state.nodeView = {
          title: '문파 방문 — 무엇을 놓을 것인가',
          sub: `${opt.card.name}을(를) 배우는 대신, 손에 익은 초식 하나를 놓습니다.`,
          options: state.deck.map((c, i) => ({ id: `drop:${i}`, card: c, name: c.name, tag: '놓는다' })),
        };
        return;
      }
    }

    if (key === 'FORTUNE' || key === 'TOMB') {
      if (id === 'refuse') { finishNode('기연을 지나쳤습니다.'); return; }
      if (id === 'accept') {
        const line = applyFortune(state.node.fortune);
        if (line === null) return; // 은거 고수 — 하위 선택이 이어진다
        finishNode(line);
        return;
      }
      if (id.startsWith('rtake:')) {
        const k = id.slice(6);
        takeRelic(k);
        finishNode(`기물 — ${D.RELICS[k].name}을(를) 손에 넣었습니다.`);
        return;
      }
      if (id.startsWith('rswap:')) {
        const [, k, drop] = id.split(':');
        const dropped = D.RELICS[drop].name;
        takeRelic(k, drop);
        finishNode(`기물 — ${dropped}을(를) 버리고 ${D.RELICS[k].name}을(를) 지녔습니다.`);
        return;
      }
      if (id === 'rleave') { finishNode('기물을 그대로 두고 지나쳤습니다.'); return; }
      if (id.startsWith('wtake:')) {
        const k = id.slice(6);
        takeWeapon(k);
        finishNode(`신병이기 — ${D.WEAPONS[k].name}을(를) 손에 넣었습니다.`);
        return;
      }
      if (id.startsWith('wswap:')) {
        const [, k, drop] = id.split(':');
        const dropped = D.WEAPONS[drop].name;
        takeWeapon(k);
        finishNode(`신병이기 — ${dropped}을(를) 놓고 ${D.WEAPONS[k].name}을(를) 쥐었습니다.`);
        return;
      }
      if (id === 'wleave') { finishNode('신병이기를 그대로 두고 지나쳤습니다.'); return; }
      if (id.startsWith('forget:')) {
        const i = Number(id.slice(7));
        const dropped = state.deck[i];
        state.deck.splice(i, 1);
        // 덜어낸 자리에 한 수 — 강화할 게 없으면 회복으로 갚는다
        const ups = upgradableIndexes();
        let gained = '';
        if (ups.length) {
          const pick = ups[Math.floor(Math.random() * ups.length)];
          const name = state.deck[pick].name;
          upgradeAt(pick);
          gained = `${name}을(를) 연마했습니다`;
        } else {
          const healed = heal(D.TRAIN_HEAL_RATIO);
          gained = `체력 ${healed}을(를) 되찾았습니다`;
        }
        finishNode(`은거 고수 — ${dropped.name}을(를) 잊고, ${gained}.`);
        return;
      }
    }
  }

  function resolveTavern() {
    const healed = heal(D.TAVERN_HEAL_RATIO);
    const seen = [];
    for (let i = 0; i < D.TAVERN_INTEL_DEPTH; i++) {
      const st = state.stage + 1 + i; // 다음 비무부터
      if (st <= D.ENEMIES.length && !state.intel.includes(st)) { state.intel.push(st); seen.push(st); }
    }
    const names = seen.map((st) => D.ENEMIES[st - 1].name).join(' · ');
    state.nodeView = null;
    finishNode(`주루 — ${names || '더 들을 소문이 없습니다'}의 소문을 들었습니다. 체력 ${healed} 회복.`);
  }

  function healAmount(ratio) {
    return Math.floor((state.playerMaxHp - state.playerHp) * ratio);
  }

  function heal(ratio) {
    const amount = healAmount(ratio);
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + amount);
    return amount;
  }

  function finishNode(line) {
    state.nodeResult = line;
    if (line) note(line);
    // 축지부 (gdd/15) — 한 갈림길에서 두 걸음을 딛는다. 걸음 총량은
    // 그대로지만(다음 갈림길을 건너뛰므로) 여섯 후보 중 둘을 고르게 되고,
    // 두 걸음을 이어 붙일 수 있다(수련장에서 연마한 초식을 곧장 문파
    // 방문에서 굳히는 식).
    if (hasRelic('doubleStep') && !state.secondStepPending) {
      state.secondStepPending = true;
      state.crossroad = rollCrossroad();
      state.node = null;
      state.nodeView = null;
      state.phase = 'CROSSROAD';
      return;
    }
    if (state.secondStepPending) {
      state.secondStepPending = false;
      state.skipNextCrossroad = true;
    }
    advanceStage();
  }

  // 걸음이 끝나면 기본 회복만 붙이고 다음 비무로. 예전에는 여기서 잃은
  // 체력의 절반이 그냥 돌아왔는데, 그러면 수련장에 갈 이유가 없다 (13-3).
  function advanceStage() {
    state.lastHeal = heal(D.STAGE_HEAL_RATIO);
    state.stage += 1;
    // 이문록 (gdd/15) — 주루가 팔던 정보를 상시화한다
    if (hasRelic('alwaysIntel')) {
      for (let i = 0; i < D.TAVERN_INTEL_DEPTH; i++) {
        const st = state.stage + i;
        if (st <= D.ENEMIES.length && !state.intel.includes(st)) state.intel.push(st);
      }
    }
    state.node = null;
    state.nodeView = null;
    startBattle();
  }

  return {
    get, newRun, chooseDeck, startBattle, syncBattleResult,
    chooseBooster, boosterDef, isLineage, profile, weaponKeysFor, factionCount,
    takeRelic, rollRelicOffer, relicSlotsFree, hasRelic,
    chooseWeapon, takeWeapon, canEquip, rollWeaponOffer, weaponOfferView,
    takeCard, skipReward, upgradableIndexes, currentEnemy,
    chooseNode, chooseNodeOption,
    // 시뮬레이터가 쓰는 것들
    poolForTier, tierForClearedStage, upgradeAt, availableFortunes,
  };
})();
