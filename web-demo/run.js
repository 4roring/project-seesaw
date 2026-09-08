// 런 진행 — 열 번의 비무와, 그 사이의 걸음
// gdd/09-run-structure.md · gdd/13-crossroads.md
const TS_Run = (() => {
  const D = TS_DATA;

  const state = {
    // SELECT | WEAPON | BATTLE | REWARD | CROSSROAD | NODE | RUN_WON | RUN_LOST
    phase: 'SELECT',
    color: null,
    weapons: [],       // 손에 쥔 신병이기 (키 배열). 손은 둘뿐 (gdd/14)
    weaponOffer: null, // 런 중에 제안된 무기
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
    pendingManual: false, // 기연 '비급' — 아직 익히지 못한 구결
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
    state.pendingManual = false;
    state.journal = [];
  }

  // 시작 덱(count 포함 정의)을 카드 1장 = 항목 1개로 펼친다
  function expandStarter(color) {
    const out = [];
    D.STARTER_DECKS[color].forEach((def) => {
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
    startBattle();
  }

  // ── 신병이기 (gdd/14) ───────────────────────────────────────
  function handsUsed() {
    return state.weapons.reduce((n, k) => n + ((D.WEAPONS[k] || {}).hands || 0), 0);
  }
  function handsFree() { return D.WEAPON_SLOTS - handsUsed(); }
  function canEquip(key) {
    const w = D.WEAPONS[key];
    return !!w && !state.weapons.includes(key) && w.hands <= handsFree();
  }
  // 시작 시 한 자루. 양손 무기를 고르면 손이 다 차고, 한손을 고르면
  // 한 칸이 남아 런 중에 하나를 더 쥘 수 있다 (14-2).
  function chooseWeapon(key) {
    if (state.phase !== 'WEAPON') return;
    if (key && !canEquip(key)) return;
    if (key) state.weapons.push(key);
    startBattle();
  }
  // 런 중 획득 — 손이 비었으면 그냥 쥐고, 다 찼으면 하나를 놓는다 (14-5)
  function takeWeapon(key, dropKey) {
    if (!D.WEAPONS[key] || state.weapons.includes(key)) return false;
    if (dropKey) state.weapons = state.weapons.filter((k) => k !== dropKey);
    if (!canEquip(key)) return false;
    state.weapons.push(key);
    return true;
  }

  function currentEnemy() { return D.ENEMIES[state.stage - 1]; }

  function startBattle() {
    state.battleKind = 'STAGE';
    state.eliteEnemy = null;
    state.game = TS_Engine.createGame({
      enemy: currentEnemy(),
      deck: state.deck,
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      handCap: (D.COLORS[state.color] || {}).handCap,
      weapons: state.weapons,
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
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      handCap: (D.COLORS[state.color] || {}).handCap,
      weapons: state.weapons,
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

    if (state.battleKind === 'ELITE') {
      note(`비무대회에서 ${g.enemyName}을(를) 꺾다`);
      // 꺾은 상대의 병기를 취한다 — 덱 성장 곡선을 건드리지 않는 자리다
      state.weaponOffer = D.WEAPONS_ENABLED ? rollWeaponOffer() : null;
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
    state.rewardOptions = rollRewards();
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
    consumeRewardPick();
  }

  function skipReward() { state.rewardPicksLeft = 0; consumeRewardPick(); }

  function consumeRewardPick() {
    state.rewardPicksLeft -= 1;
    if (state.rewardPicksLeft > 0) {
      state.rewardOptions = rollRewards();
      return;
    }
    // 엘리트를 이겨서 온 보상이면 걸음은 이미 소비했다 — 곧장 다음 비무로
    if (state.battleKind === 'ELITE') {
      // 꺾은 상대의 병기가 있으면 먼저 묻는다
      if (state.weaponOffer) {
        const offer = state.weaponOffer;
        state.weaponOffer = null;
        state.node = { key: 'FORTUNE', fortune: 'relic_blade' };
        state.nodeView = weaponOfferView(offer, '비무대회 — 꺾은 자의 병기');
        state.phase = 'NODE';
        return;
      }
      advanceStage(); return;
    }
    openCrossroad();
  }

  // 아직 안 쥔 무기 중 하나. 손이 다 찼으면 "무엇을 놓을지"는 UI가 묻는다.
  function rollWeaponOffer() {
    const pool = Object.keys(D.WEAPONS).filter((k) => !state.weapons.includes(k));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── 갈림길 ──────────────────────────────────────────────────
  function availableFortunes() {
    return D.FORTUNES.filter((f) => !f.available || f.available(state));
  }

  function rollCrossroad() {
    const rest = ['TAVERN', 'SECT_VISIT', 'ELITE'];
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

  // 무기 제안. 손이 비어 있으면 쥐거나 지나가고, 다 찼으면 무엇을 놓을지
  // 고른다 — 버리는 것이 있어야 무기 교체에 무게가 생긴다 (gdd/14 14-5).
  function weaponOfferView(key, title) {
    const w = D.WEAPONS[key];
    const options = [];
    if (w.hands <= handsFree()) {
      options.push({ id: `wtake:${key}`, name: `${w.icon} ${w.name}을(를) 쥔다`,
        tag: `${w.hands}손`, desc: `${w.rule}\n${w.flavor}` });
    } else {
      state.weapons.forEach((k) => {
        const cur = D.WEAPONS[k];
        // 놓아서 자리가 나는 것만 제시한다
        if (w.hands <= handsFree() + cur.hands) {
          options.push({ id: `wswap:${key}:${k}`, name: `${cur.name}을(를) 놓고 ${w.name}을(를) 쥔다`,
            tag: '교체', desc: `놓는 것: ${cur.rule}\n쥐는 것: ${w.rule}` });
        }
      });
      // 한손 둘을 쥔 채 양손 무기를 만나면 한 자루만 놓아서는 자리가 안 난다.
      // 이 경우가 막히면 "한손 둘 → 양손 하나"로 갈아탈 길이 아예 없어진다.
      if (!options.length && state.weapons.length > 1) {
        options.push({ id: `wswap:${key}:${state.weapons.join('+')}`,
          name: `쥔 것을 모두 놓고 ${w.name}을(를) 쥔다`, tag: '교체',
          desc: `놓는 것: ${state.weapons.map((k) => D.WEAPONS[k].name).join(' · ')}\n쥐는 것: ${w.rule}` });
      }
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
    if (key === 'relic_blade') {
      const offer = rollWeaponOffer();
      if (!offer) return `${f.name} — 이미 모든 병기를 갖추었습니다.`;
      state.weaponOffer = offer;
      state.nodeView = weaponOfferView(offer, '기연 — 신병이기');
      return null; // 손이 찼으면 무엇을 놓을지 골라야 한다
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
        state.pendingManual = false;
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

    if (key === 'FORTUNE') {
      if (id === 'refuse') { finishNode('기연을 지나쳤습니다.'); return; }
      if (id === 'accept') {
        const line = applyFortune(state.node.fortune);
        if (line === null) return; // 은거 고수 — 하위 선택이 이어진다
        finishNode(line);
        return;
      }
      if (id.startsWith('wtake:')) {
        const k = id.slice(6);
        takeWeapon(k);
        finishNode(`신병이기 — ${D.WEAPONS[k].name}을(를) 손에 넣었습니다.`);
        return;
      }
      if (id.startsWith('wswap:')) {
        const [, k, drop] = id.split(':');
        const dropKeys = drop.split('+');
        const dropped = dropKeys.map((d) => D.WEAPONS[d].name).join(' · ');
        state.weapons = state.weapons.filter((x) => !dropKeys.includes(x));
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
    advanceStage();
  }

  // 걸음이 끝나면 기본 회복만 붙이고 다음 비무로. 예전에는 여기서 잃은
  // 체력의 절반이 그냥 돌아왔는데, 그러면 수련장에 갈 이유가 없다 (13-3).
  function advanceStage() {
    state.lastHeal = heal(D.STAGE_HEAL_RATIO);
    state.stage += 1;
    state.node = null;
    state.nodeView = null;
    startBattle();
  }

  return {
    get, newRun, chooseDeck, startBattle, syncBattleResult,
    chooseWeapon, takeWeapon, canEquip, handsFree, handsUsed, rollWeaponOffer, weaponOfferView,
    takeCard, skipReward, upgradableIndexes, currentEnemy,
    chooseNode, chooseNodeOption,
    // 시뮬레이터가 쓰는 것들
    poolForTier, tierForClearedStage, upgradeAt, availableFortunes,
  };
})();
