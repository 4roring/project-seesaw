// 화면 라우팅 + 전투 렌더링 + 연출
const TS_UI = (() => {
  const D = TS_DATA;
  const els = {};
  let fxCursor = 0; // 이미 재생한 fx 개수

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    [
      'screen-select', 'screen-battle', 'screen-reward', 'screen-result',
      'deck-grid', 'stage-badge', 'stage-name', 'turn-count', 'restart-btn',
      'player-avatar', 'player-name', 'player-hp-fill', 'player-hp-text', 'player-badges', 'player-fx',
      'enemy-avatar', 'enemy-name', 'boss-hp-fill', 'boss-hp-text', 'boss-badges', 'enemy-fx',
      'arena', 'gauge-cells', 'gauge-marker', 'memory-fx', 'gauge-caption',
      'intent-preview', 'boss-skill-legend',
      'surge-meter',
      'rules-btn', 'rules-overlay', 'rules-body', 'rules-close',
      'play-zone', 'combo-dots', 'hand-row', 'pile-counts', 'draw-btn', 'log-panel',
      'log-fold', 'log-last',
      'reward-title', 'reward-sub', 'reward-heading', 'reward-grid', 'skip-reward-btn',
      'screen-weapon', 'weapon-sub', 'weapon-grid', 'skip-weapon-btn', 'weapon-strip',
      'screen-crossroad', 'crossroad-sub', 'crossroad-grid',
      'screen-node', 'node-title', 'node-sub', 'node-body', 'node-echo',
      'result-title', 'result-sub', 'result-restart-btn',
    ].forEach((id) => { els[id] = $(id); });
  }

  // ── 화면 전환 ───────────────────────────────────────────────
  function showScreen(name) {
    ['select', 'weapon', 'battle', 'reward', 'crossroad', 'node', 'result'].forEach((s) => {
      els[`screen-${s}`].classList.toggle('hidden', s !== name);
    });
  }

  function render() {
    const run = TS_Run.get();
    if (run.phase === 'SELECT') { showScreen('select'); renderDeckSelect(); return; }
    if (run.phase === 'WEAPON') { showScreen('weapon'); renderWeaponSelect(run); return; }
    if (run.phase === 'BATTLE') { showScreen('battle'); renderBattle(run); return; }
    if (run.phase === 'REWARD') { showScreen('reward'); renderReward(run); return; }
    if (run.phase === 'CROSSROAD') { showScreen('crossroad'); renderCrossroad(run); return; }
    if (run.phase === 'NODE') { showScreen('node'); renderNode(run); return; }
    showScreen('result'); renderResult(run);
  }

  // ── 카드 설명 생성 ──────────────────────────────────────────
  // 설명을 데이터에 손으로 쓰면 강화 시 원래 효과를 잃어버리고(피해만 남고
  // 부가 효과가 사라짐) 수치를 조정할 때마다 어긋난다. 카드 필드에서 만든다.
  // 별도 파일로 두지 않는 이유: 스크립트를 하나 늘리면 index.html이 캐시된
  // 브라우저에서 그 파일만 안 불려와 화면이 통째로 죽는다.
  const TS_Text = (() => {
    const D = TS_DATA;

    // 필드 → 사람이 읽는 조각. 순서가 곧 문장 순서다.
    // label은 강화 비교표에서 쓰는 짧은 이름.
    const FIELDS = [
      { key: 'hpCost', label: 'HP 소모', text: (v) => `HP ${v} 소모` },
      { key: 'damage', label: '피해', text: (v) => `피해 ${v}` },
      { key: 'chain', label: '연계 피해', text: (v) => `이번 합에 쓴 초식 1장당 피해 +${v}` },
    { key: 'deepStrike', label: '일격', text: (v) => `남은 버퍼 1칸당 피해 +${v}` },
    { key: 'rageScale', label: '광기', text: (v) => `잃은 체력 10당 피해 +${v}` },
      { key: 'discardAll', label: '파기 피해', text: (v) => `손패를 전부 파기하고 파기 1장당 피해 +${v}` },
      { key: 'blockToDamage', label: '방어도 환산', text: (v) => (v === 1 ? '현재 방어도만큼 피해 추가' : `현재 방어도 ${v}배만큼 피해 추가`) },
      { key: 'lifesteal', label: '흡혈', text: (v) => `입힌 피해의 ${v}% 회복` },
      { key: 'block', label: '방어도', text: (v) => `방어도 ${v}` },
      { key: 'chainBlock', label: '연계 방어도', text: (v) => `이번 합에 쓴 초식 1장당 방어도 +${v}` },
      { key: 'heal', label: '회복', text: (v) => `체력 ${v} 회복` },
      { key: 'draw', label: '드로우', text: (v) => `카드 ${v}장 드로우` },
      { key: 'rewind', label: '되감기', text: (v) => `기세 ${v} 되감기` },
      { key: 'counter', label: '반탄', text: (v) => `적 페이즈 동안 피격마다 반탄 ${v}` },
      { key: 'evade', label: '흘리기', text: (v) => `다음 피격 ${v}회를 흘려보냄` },
    { key: 'sealSkill', label: '점혈', text: (v) => `적의 가장 비싼 초식을 ${v}합간 봉인` },
    { key: 'drainPower', label: '공력 흡수', text: (v) => `적이 쌓은 공격력 ${v} 감소` },
    { key: 'surge', label: '몰아치기', text: (v) => `기세를 쓰지 않고 몰아치기 +${v}` },
      { key: 'breakThresholdDown', label: '빈틈 감소', text: (v) => `이번 합 빈틈 ${v} 감소` },
    ];

    const FLAGS = [
      { key: 'bossWeaken', text: '다음 적 공격 피해 -25%' },
      { key: 'exhaust', text: '사용 후 소멸' },
    ];

    const EFFECTS = {
      REDUCE_NEXT_COST: () => '다음 초식의 틈 -1',
      DOUBLE_NEXT_ATTACK: () => '다음 공격 초식 피해 2배',
      PERSISTENT_DAMAGE_BOOST: (p) => `${p.turns}합간 공격 초식 피해 +${p.amount}`,
      PERSISTENT_BLOCK_ON_TURN_START: (p) => `${p.turns}합간 합 시작 시 방어도 +${p.amount}`,
      PERSISTENT_BOSS_VULNERABLE: (p) => `${p.turns}합간 적이 받는 피해 +${p.amount}%`,
      PERSISTENT_HEAL_ON_TURN_START: (p) => `${p.turns}합간 합 시작 시 체력 +${p.amount}`,
    };

    function describe(card) {
      const parts = [];
      FIELDS.forEach((f) => { if (card[f.key]) parts.push(f.text(card[f.key])); });
      FLAGS.forEach((f) => { if (card[f.key]) parts.push(f.text); });
      const eff = EFFECTS[card.effect];
      if (eff) parts.push(eff(card.persistentPayload || {}));
      return parts.length ? parts.join(', ') : '효과 없음';
    }

    // 강화하면 무엇이 어떻게 바뀌는가. [{label, from, to}]
    function upgradeDiff(card) {
      const patch = D.UPGRADES[card.key];
      if (!patch) return [];
      const rows = [];
      FIELDS.forEach((f) => {
        if (patch[f.key] == null) return;
        rows.push({ label: f.label, from: card[f.key] || 0, to: patch[f.key] });
      });
      return rows;
    }

    function canUpgrade(card) {
      return !card.upgraded && !!D.UPGRADES[card.key];
    }

    return { describe, upgradeDiff, canUpgrade };
  })();

  // ── 덱 선택 ─────────────────────────────────────────────────
  function renderDeckSelect() {
    els['deck-grid'].innerHTML = '';
    Object.entries(D.COLORS).forEach(([key, info]) => {
      const cards = D.STARTER_DECKS[key];
      const list = cards.map((c) => `${c.name}×${c.count || 1}`).join(' · ');
      const div = document.createElement('div');
      div.className = `deck-card ${key}`;
      div.innerHTML = `
        <div class="deck-icon">${info.icon}</div>
        <div class="deck-name">${info.sect} <span class="deck-color">${info.name}</span></div>
        <div class="deck-desc">${info.desc}</div>
        <div class="deck-list">${list}</div>`;
      div.addEventListener('click', () => {
        // 문파를 고른다고 곧장 전투가 시작되지는 않는다 — 신병이기를 먼저
        // 고른다(gdd/14). game이 아직 없을 수 있으므로 반드시 가드가 있는
        // resetBattleFx를 쓴다. 예전엔 game.fx를 바로 읽어서, 무기 선택이
        // 끼어든 뒤로 문파를 누르면 여기서 터지고 화면이 안 넘어갔다.
        TS_Run.chooseDeck(key);
        resetBattleFx(); // 시작 로그의 fx는 재생하지 않음
        render();
      });
      els['deck-grid'].appendChild(div);
    });
  }

  // ── 전투 ────────────────────────────────────────────────────
  // 기세 축은 아6 ~ 적6 고정. 빈틈은 축의 칸이 아니라 "한 합의 총 틈"이라
  // 별도로 표시한다 (gdd/02 2-2).
  // host를 받는 이유: guide.html이 같은 축을 그린다. 안내 페이지가 축을
  // 따로 그리면 칸 색과 눈금이 게임과 어긋나도 아무도 모른다.
  function buildGaugeCells(host) {
    host.innerHTML = '';
    for (let v = D.GAUGE_MIN; v <= D.GAUGE_MAX; v++) {
      const cell = document.createElement('div');
      cell.className = 'gauge-cell ' + zoneClassFor(v);
      cell.textContent = v === 0 ? '0' : v < 0 ? `아${-v}` : `적${v}`;
      host.appendChild(cell);
    }
  }

  function buildGaugeTrack() { buildGaugeCells(els['gauge-cells']); }

  function zoneClassFor(v) {
    if (v < 0) return 'p';
    if (v === 0) return 'neutral';
    if (v <= 2) return 'e-safe';
    if (v <= 4) return 'e-engage';
    return 'e-danger';
  }

  function gaugePercent(gauge) {
    const idx = Math.min(Math.max(gauge, D.GAUGE_MIN), D.GAUGE_MAX) - D.GAUGE_MIN;
    const total = D.GAUGE_MAX - D.GAUGE_MIN + 1;
    return ((idx + 0.5) / total) * 100;
  }

  function renderBattle(run) {
    const g = run.game;
    const color = D.COLORS[run.color];

    els['stage-badge'].textContent = run.battleKind === 'ELITE'
      ? '비무대회' : `STAGE ${run.stage}`;
    els['stage-name'].textContent = g.enemyRealm
      ? `${g.enemyName} · ${g.enemyRealm}` : g.enemyName;
    // 직전 걸음에서 무슨 일이 있었는지 한 줄로 남긴다 — 걸음의 결과를
    // 별도 화면으로 띄우면 클릭만 하나 늘고 읽히지는 않는다.
    els['node-echo'].textContent = run.nodeResult || '';
    els['node-echo'].classList.toggle('hidden', !run.nodeResult);
    els['turn-count'].textContent = g.turn;

    els['player-avatar'].textContent = color.icon;
    els['player-name'].textContent = `${color.sect} · ${color.name}`;
    els['enemy-avatar'].textContent = g.enemyIcon;
    els['enemy-name'].textContent = g.enemyName;

    els['player-hp-fill'].style.width = Math.max(0, (g.playerHp / g.playerMaxHp) * 100) + '%';
    els['player-hp-text'].textContent = `${Math.max(0, g.playerHp)} / ${g.playerMaxHp}`;
    els['boss-hp-fill'].style.width = Math.max(0, (g.bossHp / g.bossMaxHp) * 100) + '%';
    els['boss-hp-text'].textContent = `${Math.max(0, g.bossHp)} / ${g.bossMaxHp}`;

    // 배지
    els['boss-badges'].innerHTML = '';
    addBadge(els['boss-badges'], 'block', `방어도 ${g.bossBlock}`, g.bossBlock > 0);
    addBadge(els['boss-badges'], 'power', `공격력 +${g.bossScalingPower}`, g.bossScalingPower > 0);
    addBadge(els['boss-badges'], 'stun', '기절', g.isBossStunned);
    addBadge(els['boss-badges'], 'vulnerable', '사혈 노출(파훼)', g.bossVulnerableActive);
    addBadge(els['boss-badges'], 'weaken', '부식(다음 공격 -25%)', g.bossWeakenActive);
    g.activeEffects.filter((e) => e.kind === 'BOSS_VULNERABLE_AURA')
      .forEach((e) => addBadge(els['boss-badges'], 'vulnerable', `${e.name} +${e.amount}% (${e.turnsRemaining}합)`, true));

    renderWeaponStrip(run);
    els['player-badges'].innerHTML = '';
    addBadge(els['player-badges'], 'block', `방어도 ${g.playerBlock}`, g.playerBlock > 0);
    addBadge(els['player-badges'], 'weaken', '내상(-25%)', g.playerWeakenActive);
    addBadge(els['player-badges'], 'vulnerable', '사혈 노출(다음 피격 +50%)', g.playerVulnerableActive);
    addBadge(els['player-badges'], 'power', `반탄 ${g.counterDamage}`, g.counterDamage > 0);
    addBadge(els['player-badges'], 'block', `흘리기 ${g.evadeCharges}회`, g.evadeCharges > 0);
    addBadge(els['player-badges'], 'power', `다음 초식의 틈 -${g.pendingCostReduction}`, g.pendingCostReduction > 0);
    addBadge(els['player-badges'], 'power', `다음 공격 ${g.pendingDamageMultiplier}배`, g.pendingDamageMultiplier > 1);
    addBadge(els['player-badges'], 'stun', `파훼 임계점 ${g.breakThreshold}`, g.breakThreshold !== g.baseBreakThreshold);
    g.activeEffects.filter((e) => e.kind === 'DAMAGE_BOOST')
      .forEach((e) => addBadge(els['player-badges'], 'power', `${e.name} 피해+${e.amount} (${e.turnsRemaining}합)`, true));
    g.activeEffects.filter((e) => e.kind === 'BLOCK_ON_TURN_START')
      .forEach((e) => addBadge(els['player-badges'], 'block', `${e.name} 방어+${e.amount} (${e.turnsRemaining}합)`, true));
    g.activeEffects.filter((e) => e.kind === 'HEAL_ON_TURN_START')
      .forEach((e) => addBadge(els['player-badges'], 'block', `${e.name} 회복+${e.amount} (${e.turnsRemaining}합)`, true));

    els['gauge-marker'].style.left = gaugePercent(g.gauge) + '%';
    renderGaugeCaption(g);
    renderSurge(g);

    const intent = TS_Engine.previewIntent(g);
    els['intent-preview'].textContent = intent.text;
    els['intent-preview'].className = 'intent-preview ' + intent.tone;

    renderSkillLegend(g);
    renderCombo(g);
    renderHand(run);

    els['pile-counts'].textContent =
      `뽑을 더미 ${g.drawPile.length} · 버린 더미 ${g.discardPile.length} · 덱 ${run.deck.length}장`;

    els['log-panel'].innerHTML = '';
    g.log.slice(-40).forEach((line) => {
      const div = document.createElement('div');
      div.textContent = line;
      els['log-panel'].appendChild(div);
    });
    els['log-panel'].scrollTop = els['log-panel'].scrollHeight;
    // 접혀 있을 때도 마지막 한 줄은 보여야 한다 — 무슨 일이 일어났는지
    // 모른 채 접힌 상자만 남으면 접은 게 아니라 가린 것이다.
    els['log-last'].textContent = g.log[g.log.length - 1] || '기록';

    playPendingFx(g);
  }

  // 기세 축 아래 한 줄. 규칙("0을 넘기면 선이 넘어간다")과 지금 당장 필요한
  // 숫자("남은 틈")를 같이 말한다. 남은 틈은 지금까지 화면 어디에도 없어서,
  // 처음 하는 사람은 카드를 내 보고 나서야 합이 끝난 걸 알았다.
  function renderGaugeCaption(g) {
    const el = els['gauge-caption'];
    if (!el) return;
    if (g.gauge > 0) {
      el.textContent = `기세 ${TS_Engine.gaugeLabel(g.gauge)} — 선이 적에게 넘어가 있습니다`;
      return;
    }
    const room = -g.gauge;
    el.textContent = room > 0
      ? `기세 ${TS_Engine.gaugeLabel(g.gauge)} — 틈 ${room}까지는 내 합, 0을 넘기면 선이 적에게`
      : '기세 0 — 여기서 한 칸만 더 밀면 선이 적에게 넘어갑니다';
  }

  // 몰아치기 — 이번 합에 지불한 총 틈. 빈틈에 닿으면 파훼 (gdd/02 2-1)
  function renderSurge(g) {
    const el = els['surge-meter'];
    if (!el) return;
    const spent = g.momentumSpentThisTurn;
    const need = TS_Engine.effectiveBreakThreshold(g);
    const pct = Math.min(100, Math.round((spent / need) * 100));
    el.className = 'surge-meter' + (spent >= need ? ' ready' : '');
    // 힌트를 둘로 나눈다. "규칙 설명"은 좁은 화면에서 숨겨도 되지만,
    // "지금 파훼가 걸렸다"는 상태는 숨기면 판단 근거가 사라진다 — 예전에는
    // 둘이 한 칸이어서 모바일에서 통째로 사라졌다.
    el.innerHTML = `<span class="surge-label">몰아치기</span>`
      + `<span class="surge-bar"><span class="surge-fill" style="width:${pct}%"></span></span>`
      + `<span class="surge-num">${spent} / ${need}</span>`
      + (spent >= need
        ? '<span class="surge-ready">이대로 선을 넘기면 파훼!</span>'
        : '<span class="surge-hint">한 합에 몰아친 틈이 빈틈에 닿으면 파훼</span>');
  }

  function addBadge(container, cls, text, active) {
    if (!active) return;
    const span = document.createElement('span');
    span.className = `badge active ${cls}`;
    span.textContent = text;
    container.appendChild(span);
  }

  // 좁은 화면에서만 접어 둔다. details의 open은 CSS로 제어할 수 없어
  // 여기서 정한다. 전투 화면은 매 입력마다 다시 그리므로, 사용자가 편
  // 것을 기억하지 않으면 펼치는 즉시 도로 접힌다.
  const foldState = {};
  function foldOpen(key) {
    return foldState[key] == null ? window.innerWidth > 480 : foldState[key];
  }
  function rememberFold(key, el) {
    el.addEventListener('toggle', () => { foldState[key] = el.open; });
  }

  function renderSkillLegend(g) {
    els['boss-skill-legend'].innerHTML = '';

    // 적의 개성 두 축을 먼저 보여준다 — 플레이어의 전술을 바꾸는 정보라
    // 숨기면 스탯이 있으나 마나가 된다 (gdd/10 10-1)
    const style = g.closerStyle === 'CRAFTY'
      ? { name: '노회', hint: '마무리로 가장 싼 초식 — 얕게 넘겨도 크게 안 돌아온다' }
      : { name: '패도', hint: '마무리로 가장 비싼 초식 — 크게 맞고 크게 돌려받는다' };
    const eff = TS_Engine.effectiveBreakThreshold(g);
    const need = Math.max(0, eff - g.momentumSpentThisTurn);
    const head = document.createElement('div');
    head.className = 'boss-style-row';
    // 한 줄로 묶는다 — .boss-style-row가 세로 flex라, <b> 사이의 맨
    // 텍스트 " · "를 그냥 두면 좁은 화면에서 점만 있는 빈 줄이 생긴다.
    head.innerHTML = `<span class="boss-style-id"><b>빈틈 ${eff}${eff !== g.breakThreshold ? ` (원래 ${g.breakThreshold})` : ''}</b> · <b>${style.name}</b></span>`
      + `<span class="boss-style-hint">${style.hint}</span>`
      // 몰아치기 진행은 아래 몰아치기 바와 같은 숫자라, 좁은 화면에서는
      // 이 줄만 접는다 (CSS에서 .boss-style-surge).
      + `<span class="boss-style-hint boss-style-surge">한 합에 틈 ${eff}을 몰아치면 파훼`
      + (need > 0 ? ` — 지금 ${g.momentumSpentThisTurn}/${eff}` : ' — <b>완성!</b>')
      + `</span>`;
    els['boss-skill-legend'].appendChild(head);

    // 초식 목록은 "가끔 확인하는 참고 정보"라 좁은 화면에서는 접는다.
    // 매 합 보고 결정하는 정보(빈틈·클로저 성격·몰아치기)는 위에 그대로
    // 남긴다 — 그걸 접으면 적의 개성이 있으나 마나가 된다 (gdd/10 10-1).
    const box = document.createElement('details');
    box.className = 'skill-fold';
    box.open = foldOpen('skills');
    rememberFold('skills', box);
    const sum = document.createElement('summary');
    const ready = g.enemySkills.filter((s) => !(g.bossCooldowns[s.key] > 0)).length;
    sum.textContent = `적 초식 ${g.enemySkills.length} (지금 쓸 수 있는 것 ${ready})`;
    box.appendChild(sum);
    g.enemySkills.forEach((s) => {
      const cd = g.bossCooldowns[s.key] || 0;
      const row = document.createElement('div');
      row.className = 'boss-skill-row' + (cd > 0 ? ' locked' : '');
      const cdText = cd > 0 ? ` · 재사용까지 ${cd}합` : (s.cooldown > 0 ? ` · 쿨다운 ${s.cooldown}합` : '');
      row.textContent = `${s.name} — 틈 ${s.cost}${cdText}`;
      box.appendChild(row);
    });
    els['boss-skill-legend'].appendChild(box);
  }

  function renderCombo(g) {
    els['combo-dots'].innerHTML = '';
    for (let i = 0; i < D.COMBO_THRESHOLD; i++) {
      const dot = document.createElement('div');
      dot.className = 'combo-dot' + (i < g.comboCounter ? ' filled' : '');
      els['combo-dots'].appendChild(dot);
    }
  }

  // 좁은 화면 판정. style.css의 미디어 쿼리(480px)와 같은 값을 써야
  // 화면은 압축됐는데 조작은 데스크톱식인 어긋남이 안 생긴다.
  function isNarrow() { return window.innerWidth <= 480; }
  let selectedUid = null;

  function renderHand(run) {
    const g = run.game;
    els['hand-row'].innerHTML = '';
    g.hand.forEach((card) => {
      const div = document.createElement('div');
      div.className = `card ${run.color}` + (card.upgraded ? ' upgraded' : '');
      div.draggable = true;
      div.dataset.uid = card.uid;
      const hpTag = card.hpCost ? `<span style="color:var(--danger)">HP -${card.hpCost}</span> · ` : '';
      div.innerHTML = `
        <div class="card-cost">${card.cost}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${TS_Text.describe(card)}</div>`;
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.uid);
        div.classList.add('dragging');
      });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      if (card.uid === selectedUid) div.classList.add('selected');
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        // 좁은 화면에서는 두 단계로 낸다 — 첫 탭은 고르기(설명이 펼쳐지고
        // 카드가 커진다), 두 번째 탭이 사용이다. 손가락은 마우스보다
        // 부정확해서 한 번 탭에 초식이 나가면 잘못 내는 일이 잦다.
        // 넓은 화면은 예전대로 한 번에 낸다.
        if (!isNarrow()) { doPlayCard(card.uid); return; }
        if (selectedUid === card.uid) { selectedUid = null; doPlayCard(card.uid); return; }
        selectedUid = card.uid;
        render();
      });
      els['hand-row'].appendChild(div);
    });
    // 고른 카드가 잘려 보이면 두 번째 탭을 못 한다
    const sel = els['hand-row'].querySelector('.card.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function doPlayCard(uid) {
    selectedUid = null;
    const run = TS_Run.get();
    if (run.phase !== 'BATTLE') return;
    TS_Engine.playCard(run.game, uid);
    afterAction();
  }

  // 전투 입력 후 공통 처리: 연출 재생 → 결과 판정 → 화면 갱신
  function afterAction() {
    const run = TS_Run.get();
    renderBattle(run); // 연출을 먼저 재생
    if (run.game.status !== 'PLAYING') {
      // 결과 화면으로 넘어가기 전에 마지막 연출을 볼 시간을 준다
      setTimeout(() => { TS_Run.syncBattleResult(); render(); }, 900);
    }
  }

  // ── 연출 재생 ───────────────────────────────────────────────
  function playPendingFx(g) {
    const pending = g.fx.slice(fxCursor);
    fxCursor = g.fx.length;
    pending.forEach((fx, i) => setTimeout(() => playFx(fx), i * 180));
  }

  function playFx(fx) {
    if (fx.type === 'playerAttack') {
      animate(els['player-avatar'], 'attacking');
      animate(els['enemy-avatar'], 'hit');
      floatNum(els['enemy-fx'], `-${fx.amount}`, 'dmg');
      if (fx.label) floatNum(els['player-fx'], fx.label, 'skill');
    } else if (fx.type === 'enemyAttack') {
      animate(els['enemy-avatar'], 'attacking');
      animate(els['player-avatar'], 'hit');
      floatNum(els['player-fx'], `-${fx.amount}`, 'dmg');
      floatNum(els['enemy-fx'], fx.name, 'skill');
    } else if (fx.type === 'enemyBuff') {
      animate(els['enemy-avatar'], 'buffing');
      floatNum(els['enemy-fx'], fx.name, 'skill');
    } else if (fx.type === 'heal') {
      floatNum(els['player-fx'], `+${fx.amount}`, 'heal');
    } else if (fx.type === 'memory') {
      dropMemory(fx.to);
    } else if (fx.type === 'break') {
      breakFlash();
    }
  }

  function animate(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // 리플로우로 애니메이션 재시작
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 700);
  }

  function floatNum(layer, text, cls) {
    const div = document.createElement('div');
    div.className = `float-num ${cls}`;
    div.textContent = text;
    layer.appendChild(div);
    setTimeout(() => div.remove(), 1100);
  }

  // 기세가 게이지 위로 떨어지는 연출
  function dropMemory(toGauge) {
    const pct = gaugePercent(toGauge);
    for (let i = 0; i < 4; i++) {
      const orb = document.createElement('div');
      orb.className = 'memory-orb';
      orb.style.left = `calc(${pct}% + ${(Math.random() - 0.5) * 26}px)`;
      orb.style.animationDelay = `${i * 70}ms`;
      els['memory-fx'].appendChild(orb);
      setTimeout(() => orb.remove(), 1000 + i * 70);
    }
  }

  function breakFlash() {
    const div = document.createElement('div');
    div.className = 'break-flash';
    div.textContent = '파훼!';
    els['arena'].appendChild(div);
    setTimeout(() => div.remove(), 800);
  }

  // ── 신병이기 (gdd/14) ───────────────────────────────────────
  // 무기는 수치가 아니라 규칙을 비튼다. 그래서 카드처럼 "피해 N"을 보여줄
  // 게 없고, 규칙 문장 자체가 곧 카드 설명이다.
  function renderWeaponSelect(run) {
    const color = D.COLORS[run.color] || {};
    els['weapon-sub'].textContent =
      `${color.sect} · ${color.name} — 손은 둘뿐입니다. 한손 둘을 쥐거나, 양손 하나를 쥡니다.`;
    els['weapon-grid'].innerHTML = '';
    Object.values(D.WEAPONS).forEach((w) => {
      const div = document.createElement('div');
      div.className = 'weapon-card';
      div.innerHTML = `
        <div class="wc-icon">${w.icon}</div>
        <div class="wc-name">${w.name}</div>
        <div class="wc-hands">${w.hands === 1 ? '한손 · 손 하나가 남습니다' : '양손 · 손이 다 찹니다'}</div>
        <div class="wc-rule">${w.rule}</div>
        <div class="wc-flavor">${w.flavor}</div>`;
      div.addEventListener('click', () => { TS_Run.chooseWeapon(w.key); render(); });
      els['weapon-grid'].appendChild(div);
    });
  }

  // 쥔 병기와 지닌 유물. 둘 다 규칙을 비트는 물건이라 전투 중에 보여야
  // 하지만, 층이 다르므로(무기=한 합, 유물=강호행) 색을 나눈다.
  function renderWeaponStrip(run) {
    const strip = els['weapon-strip'];
    strip.innerHTML = '';
    (run.weapons || []).forEach((k) => {
      const w = D.WEAPONS[k];
      if (!w) return;
      const span = document.createElement('span');
      span.className = 'weapon-chip';
      span.title = w.rule;
      span.textContent = `${w.icon} ${w.name}`;
      strip.appendChild(span);
    });
    (run.relics || []).forEach((k) => {
      const rl = D.RELICS[k];
      if (!rl) return;
      const span = document.createElement('span');
      span.className = 'relic-chip';
      span.title = rl.rule;
      const used = rl.lastStand && run.lastStandLeft <= 0;
      span.textContent = `${rl.icon} ${rl.name}${used ? ' (깨짐)' : ''}`;
      if (used) span.classList.add('spent');
      strip.appendChild(span);
    });
  }

  // ── 비무 전리품 ─────────────────────────────────────────────
  // 강화는 여기 없다 — 수련장 걸음으로 옮겼다 (gdd/13 13-3). 전리품과
  // 수련은 성격이 다른 보상인데 한 화면에서 다투게 두면, 둘 중 하나는
  // 늘 고르지 않는 쪽이 된다.
  function renderReward(run) {
    const elite = run.battleKind === 'ELITE';
    els['reward-title'].textContent = elite
      ? '비무대회 우승!'
      : `스테이지 ${run.stage} 클리어!`;
    const next = D.ENEMIES[run.stage] ? D.ENEMIES[run.stage].name : '—';
    els['reward-sub'].textContent =
      `현재 덱 ${run.deck.length}장 · 체력 ${run.playerHp}/${run.playerMaxHp} · 다음 상대: ${next}`;
    els['reward-heading'].textContent = run.rewardPicksLeft > 1
      ? `전리품 — 초식 ${run.rewardPicksLeft}장을 거둡니다`
      : '전리품 — 초식 하나를 거둡니다';

    els['reward-grid'].innerHTML = '';
    run.rewardOptions.forEach((opt) => {
      const div = document.createElement('div');
      div.className = 'reward-card';
      div.innerHTML = `
        <div class="rc-name">${opt.name}</div>
        <div class="rc-cost">틈 ${opt.cost}</div>
        <div class="rc-desc">${TS_Text.describe(opt)}</div>`;
      div.addEventListener('click', () => { TS_Run.takeCard(opt); resetBattleFx(); render(); });
      els['reward-grid'].appendChild(div);
    });
  }

  // ── 갈림길 ──────────────────────────────────────────────────
  function renderCrossroad(run) {
    els['crossroad-sub'].textContent =
      `체력 ${run.playerHp}/${run.playerMaxHp} · 덱 ${run.deck.length}장 · `
      + `다음 상대는 ${D.ENEMIES[run.stage].name}. 어느 걸음을 디딜 것인가.`;

    // 주루에서 들은 소문 — 앞 상대의 빈틈과 성격. 이 게임에서 가장 값진
    // 정보라, 걸음을 고르기 전에 보이지 않으면 팔 물건이 못 된다.
    els['crossroad-grid'].innerHTML = '';
    const intel = (run.intel || []).filter((st) => st >= run.stage + 1 && st <= D.ENEMIES.length);
    if (intel.length) {
      const strip = document.createElement('div');
      strip.className = 'intel-strip';
      strip.innerHTML = '<span class="intel-label">들은 소문</span>' + intel.map((st) => {
        const e = D.ENEMIES[st - 1];
        const style = e.closerStyle === 'CRAFTY' ? '노회' : '패도';
        return `<span class="intel-item"><b>${st}단계 ${e.name}</b> — 빈틈 ${e.breakThreshold} · ${style}</span>`;
      }).join('');
      els['crossroad-grid'].appendChild(strip);
    }
    run.crossroad.forEach((key) => {
      const def = D.NODES[key];
      const div = document.createElement('div');
      div.className = `crossroad-card node-${key.toLowerCase()}`;
      div.innerHTML = `
        <div class="cr-icon">${def.icon}</div>
        <div class="cr-name">${def.name}</div>
        <div class="cr-blurb">${def.blurb}</div>
        <div class="cr-detail">${crossroadDetail(run, key)}</div>`;
      div.addEventListener('click', () => { TS_Run.chooseNode(key); resetBattleFx(); render(); });
      els['crossroad-grid'].appendChild(div);
    });
  }

  // 걸음마다 "지금 고르면 실제로 얼마인가"를 붙인다. 이름만 보고 고르면
  // 3지선다가 분위기 선택이 되고, 포기한 것이 무엇인지 남지 않는다.
  function crossroadDetail(run, key) {
    const missing = run.playerMaxHp - run.playerHp;
    if (key === 'TRAINING') {
      return `운기조식 +${Math.floor(missing * D.TRAIN_HEAL_RATIO)} · 또는 초식 연마 1회`;
    }
    if (key === 'TAVERN') {
      const names = [];
      for (let i = 0; i < D.TAVERN_INTEL_DEPTH; i++) {
        const st = run.stage + 1 + i;
        if (st <= D.ENEMIES.length) names.push(`${st}단계`);
      }
      return `${names.join('·') || '—'}의 빈틈을 미리 안다 · 회복 +${Math.floor(missing * D.TAVERN_HEAL_RATIO)}`;
    }
    if (key === 'SECT_VISIT') {
      return `초식 하나를 놓고 하나를 배웁니다 — 자기 문파 ${D.SECT_VISIT_OWN_CHOICES}장, 타 문파 ${D.SECT_VISIT_FOREIGN_CHOICES}장 중에서`;
    }
    if (key === 'ELITE') {
      const idx = Math.min(run.stage - 1 + D.ELITE_LOOKAHEAD, D.ENEMIES.length - 1);
      const e = D.ENEMIES[idx];
      return `상대: ${e.name} (체력 ${Math.round(e.hp * D.ELITE_HP_RATIO)}, 빈틈 ${e.breakThreshold}) · 이기면 초식 ${D.ELITE_REWARD_CARDS}장`;
    }
    if (key === 'FORTUNE') {
      const left = D.FORTUNE_MAX_PER_RUN - run.fortuneUsed;
      return `대가 없는 기연은 없습니다 · 이번 강호행에 ${left}번 남음`;
    }
    if (key === 'TOMB') {
      const free = TS_Run.relicSlotsFree();
      return `유물 하나 · ${free > 0 ? `자리 ${free}칸 남음` : '자리가 차서 하나를 버려야 합니다'}`;
    }
    return '';
  }

  // ── 걸음 안의 선택 ──────────────────────────────────────────
  function renderNode(run) {
    const view = run.nodeView || { title: '', sub: '', options: [] };
    els['node-title'].textContent = view.title;
    els['node-sub'].textContent = view.sub;
    els['node-body'].innerHTML = '';

    const groups = view.groups
      || [{ label: null, ids: (view.options || []).map((o) => o.id) }];

    groups.forEach((g) => {
      if (g.label) {
        const h = document.createElement('h3');
        h.className = 'reward-heading';
        h.textContent = g.label;
        els['node-body'].appendChild(h);
      }
      const grid = document.createElement('div');
      grid.className = 'node-grid';
      g.ids.forEach((id) => {
        const opt = view.options.find((o) => o.id === id);
        if (!opt) return;
        grid.appendChild(nodeOptionEl(run, opt));
      });
      els['node-body'].appendChild(grid);
    });
  }

  function nodeOptionEl(run, opt) {
    const div = document.createElement('div');
    div.className = 'node-option' + (opt.disabled ? ' disabled' : '');

    if (opt.card) {
      div.innerHTML = `
        <div class="no-head"><span class="no-name">${opt.card.name}</span>`
        + `<span class="no-tag">${opt.tag || ''}</span></div>
        <div class="no-cost">틈 ${opt.card.cost}</div>
        <div class="no-desc">${TS_Text.describe(opt.card)}</div>`;
    } else if (opt.upgrade) {
      // 강화는 "무엇이 어떻게 세지는가"를 둘 다 보여준다 — 강화 후 전문과
      // 필드별 차이를 함께 띄우지 않으면 무엇을 고르는지 알 수 없다.
      const card = run.deck[opt.cardIndex];
      const upgraded = { ...card, ...(D.UPGRADES[card.key] || {}) };
      const diff = TS_Text.upgradeDiff(card);
      div.innerHTML = `
        <div class="no-head"><span class="no-name">${card.name} → ${card.name}+</span>`
        + `<span class="no-tag">${opt.tag || ''}</span></div>
        <div class="no-cost">틈 ${card.cost}</div>
        <div class="no-desc">${TS_Text.describe(upgraded)}</div>
        <div class="uc-diff">${diff.map((d) =>
            `<span class="uc-row"><b>${d.label}</b> ${d.from} <i>→</i> ${d.to}</span>`).join('')}</div>`;
    } else {
      div.innerHTML = `
        <div class="no-head"><span class="no-name">${opt.name}</span>`
        + `<span class="no-tag">${opt.tag || ''}</span></div>
        <div class="no-desc">${(opt.desc || '').replace(/\n/g, '<br>')}</div>`;
    }

    if (!opt.disabled) {
      div.addEventListener('click', () => { TS_Run.chooseNodeOption(opt.id); resetBattleFx(); render(); });
    }
    return div;
  }

  function resetBattleFx() { fxCursor = TS_Run.get().game ? TS_Run.get().game.fx.length : 0; }

  // ── 런 종료 ─────────────────────────────────────────────────
  function renderResult(run) {
    const won = run.phase === 'RUN_WON';
    els['result-title'].textContent = won ? '런 클리어!' : '런 실패';
    els['result-sub'].textContent = won
      ? `스테이지 10 (${D.ENEMIES[9].name})까지 모두 돌파했습니다. 최종 덱 ${run.deck.length}장.`
      : `스테이지 ${run.stage} (${D.ENEMIES[run.stage - 1].name})에서 쓰러졌습니다. 덱 ${run.deck.length}장.`;
  }

  // ── 입력 배선 ───────────────────────────────────────────────
  // ── 규칙 창 ─────────────────────────────────────────────────
  // 문장은 data.js의 RULES에서 읽는다 — 여기에 직접 쓰면 안내 페이지와
  // 어긋나고, 상수를 바꿔도 설명이 안 따라온다.
  function buildRules() {
    els['rules-body'].innerHTML = D.RULES.map((sec, i) => {
      const head = D.RULES.length - 1 === i
        ? `<h4 class="rules-sec">${sec.title}</h4>`
        : `<h4 class="rules-sec"><span class="rules-num">${i + 1}</span>${sec.title}</h4>`;
      return head + sec.lines.map((l) => `<p class="rules-line">${l}</p>`).join('');
    }).join('');
  }

  function toggleRules(open) {
    els['rules-overlay'].classList.toggle('hidden', !open);
  }

  function wireStaticEvents() {
    els['rules-btn'].addEventListener('click', (e) => {
      e.stopPropagation(); // 전투 화면의 "고른 카드 놓기"까지 타지 않게
      toggleRules(true);
    });
    els['rules-close'].addEventListener('click', () => toggleRules(false));
    // 바깥을 눌러도 닫힌다 — 창 안(.rules-box)을 누른 건 통과시킨다.
    els['rules-overlay'].addEventListener('click', (e) => {
      if (e.target === els['rules-overlay']) toggleRules(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleRules(false);
    });

    els['play-zone'].addEventListener('dragover', (e) => {
      e.preventDefault(); els['play-zone'].classList.add('drag-over');
    });
    els['play-zone'].addEventListener('dragleave', () => els['play-zone'].classList.remove('drag-over'));
    els['play-zone'].addEventListener('drop', (e) => {
      e.preventDefault();
      els['play-zone'].classList.remove('drag-over');
      const uid = e.dataTransfer.getData('text/plain');
      if (uid) doPlayCard(uid);
    });

    // 숨 고르기 — 틈 2짜리 초식과 동일하게 처리되며, 기세가 0을
    // 넘으면 그대로 선이 넘어간다 (gdd/07 7-1)
    els['draw-btn'].addEventListener('click', () => {
      const run = TS_Run.get();
      if (run.phase !== 'BATTLE') return;
      TS_Engine.drawAction(run.game);
      afterAction();
    });

    els['skip-reward-btn'].addEventListener('click', () => { TS_Run.skipReward(); resetBattleFx(); render(); });
    els['skip-weapon-btn'].addEventListener('click', () => { TS_Run.chooseWeapon(null); render(); });

    // 카드 밖을 누르면 고른 것을 놓는다 — 무르는 길이 없으면 두 단계
    // 탭이 오히려 갇힌 느낌을 준다.
    els['screen-battle'].addEventListener('click', () => {
      if (selectedUid) { selectedUid = null; render(); }
    });

    const restart = () => { TS_Run.newRun(); fxCursor = 0; render(); };
    els['restart-btn'].addEventListener('click', restart);
    els['result-restart-btn'].addEventListener('click', restart);
  }

  function init() {
    cacheEls();
    buildGaugeTrack();
    buildRules();
    els['log-fold'].open = foldOpen('log');
    rememberFold('log', els['log-fold']);
    wireStaticEvents();
    TS_Run.newRun();
    render();
  }

  // describe는 guide.html도 쓴다 — 안내 페이지가 카드 설명을 따로 쓰면
  // 수치를 바꿀 때 게임과 안내가 서로 다른 말을 하게 된다.
  return {
    init, render,
    // 아래 셋은 guide.html이 쓴다 — 안내 페이지가 카드 설명과 기세 축을
    // 따로 만들면 수치를 바꿀 때 게임과 다른 말을 하게 된다.
    describe: TS_Text.describe,
    buildGaugeCells,
    gaugePercent,
  };
})();
