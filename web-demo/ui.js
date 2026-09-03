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
      'arena', 'gauge-cells', 'gauge-marker', 'memory-fx', 'intent-preview', 'boss-skill-legend',
      'play-zone', 'combo-dots', 'hand-row', 'pile-counts', 'pass-btn', 'log-panel',
      'reward-title', 'reward-sub', 'reward-grid', 'upgrade-grid', 'skip-reward-btn',
      'result-title', 'result-sub', 'result-restart-btn',
    ].forEach((id) => { els[id] = $(id); });
  }

  // ── 화면 전환 ───────────────────────────────────────────────
  function showScreen(name) {
    ['select', 'battle', 'reward', 'result'].forEach((s) => {
      els[`screen-${s}`].classList.toggle('hidden', s !== name);
    });
  }

  function render() {
    const run = TS_Run.get();
    if (run.phase === 'SELECT') { showScreen('select'); renderDeckSelect(); return; }
    if (run.phase === 'BATTLE') { showScreen('battle'); renderBattle(run); return; }
    if (run.phase === 'REWARD') { showScreen('reward'); renderReward(run); return; }
    showScreen('result'); renderResult(run);
  }

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
        <div class="deck-name">${info.name}</div>
        <div class="deck-desc">${info.desc}</div>
        <div class="deck-list">${list}</div>`;
      div.addEventListener('click', () => {
        TS_Run.chooseDeck(key);
        fxCursor = TS_Run.get().game.fx.length; // 시작 로그의 fx는 재생하지 않음
        render();
      });
      els['deck-grid'].appendChild(div);
    });
  }

  // ── 전투 ────────────────────────────────────────────────────
  function buildGaugeTrack() {
    els['gauge-cells'].innerHTML = '';
    for (let v = D.GAUGE_MIN; v <= D.GAUGE_MAX; v++) {
      const cell = document.createElement('div');
      cell.className = 'gauge-cell ' + zoneClassFor(v);
      cell.textContent = v === 0 ? '0' : v < 0 ? `P${-v}` : `E${v}`;
      els['gauge-cells'].appendChild(cell);
    }
  }

  function zoneClassFor(v) {
    if (v < 0) return 'p';
    if (v === 0) return 'neutral';
    if (v <= 2) return 'e-safe';
    if (v <= 4) return 'e-engage';
    if (v <= 5) return 'e-danger';
    return 'e-break';
  }

  function gaugePercent(gauge) {
    const idx = gauge - D.GAUGE_MIN;
    const total = D.GAUGE_MAX - D.GAUGE_MIN + 1;
    return ((idx + 0.5) / total) * 100;
  }

  function renderBattle(run) {
    const g = run.game;
    const color = D.COLORS[run.color];

    els['stage-badge'].textContent = `STAGE ${run.stage}`;
    els['stage-name'].textContent = g.enemyName;
    els['turn-count'].textContent = g.turn;

    els['player-avatar'].textContent = color.icon;
    els['player-name'].textContent = `${color.name} 덱`;
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
    addBadge(els['boss-badges'], 'vulnerable', '취약(BREAK)', g.bossVulnerableActive);
    addBadge(els['boss-badges'], 'weaken', '약화(다음 공격 -25%)', g.bossWeakenActive);
    g.activeEffects.filter((e) => e.kind === 'BOSS_VULNERABLE_AURA')
      .forEach((e) => addBadge(els['boss-badges'], 'vulnerable', `${e.name} +${e.amount}% (${e.turnsRemaining}턴)`, true));

    els['player-badges'].innerHTML = '';
    addBadge(els['player-badges'], 'block', `방어도 ${g.playerBlock}`, g.playerBlock > 0);
    addBadge(els['player-badges'], 'weaken', '약화(-25%)', g.playerWeakenActive);
    addBadge(els['player-badges'], 'vulnerable', '취약(다음 피격 +50%)', g.playerVulnerableActive);
    addBadge(els['player-badges'], 'power', `반격 ${g.counterDamage}`, g.counterDamage > 0);
    addBadge(els['player-badges'], 'power', `다음 카드 비용 -${g.pendingCostReduction}`, g.pendingCostReduction > 0);
    addBadge(els['player-badges'], 'power', `다음 공격 ${g.pendingDamageMultiplier}배`, g.pendingDamageMultiplier > 1);
    addBadge(els['player-badges'], 'stun', `BREAK 기준 E${g.breakThreshold}`, g.breakThreshold !== D.BREAK_THRESHOLD);
    g.activeEffects.filter((e) => e.kind === 'DAMAGE_BOOST')
      .forEach((e) => addBadge(els['player-badges'], 'power', `${e.name} 피해+${e.amount} (${e.turnsRemaining}턴)`, true));
    g.activeEffects.filter((e) => e.kind === 'BLOCK_ON_TURN_START')
      .forEach((e) => addBadge(els['player-badges'], 'block', `${e.name} 방어+${e.amount} (${e.turnsRemaining}턴)`, true));
    g.activeEffects.filter((e) => e.kind === 'HEAL_ON_TURN_START')
      .forEach((e) => addBadge(els['player-badges'], 'block', `${e.name} 회복+${e.amount} (${e.turnsRemaining}턴)`, true));

    els['gauge-marker'].style.left = gaugePercent(g.gauge) + '%';

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

    playPendingFx(g);
  }

  function addBadge(container, cls, text, active) {
    if (!active) return;
    const span = document.createElement('span');
    span.className = `badge active ${cls}`;
    span.textContent = text;
    container.appendChild(span);
  }

  function renderSkillLegend(g) {
    els['boss-skill-legend'].innerHTML = '';
    g.enemySkills.forEach((s) => {
      const cd = g.bossCooldowns[s.key] || 0;
      const row = document.createElement('div');
      row.className = 'boss-skill-row' + (cd > 0 ? ' locked' : '');
      const cdText = cd > 0 ? ` · 재사용까지 ${cd}턴` : (s.cooldown > 0 ? ` · 쿨다운 ${s.cooldown}턴` : '');
      row.textContent = `${s.name} — 비용 ${s.cost}${cdText}`;
      els['boss-skill-legend'].appendChild(row);
    });
  }

  function renderCombo(g) {
    els['combo-dots'].innerHTML = '';
    for (let i = 0; i < D.COMBO_THRESHOLD; i++) {
      const dot = document.createElement('div');
      dot.className = 'combo-dot' + (i < g.comboCounter ? ' filled' : '');
      els['combo-dots'].appendChild(dot);
    }
  }

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
        <div class="card-desc">${hpTag}${card.desc}</div>`;
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.uid);
        div.classList.add('dragging');
      });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      div.addEventListener('click', () => doPlayCard(card.uid));
      els['hand-row'].appendChild(div);
    });
  }

  function doPlayCard(uid) {
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

  // 메모리가 게이지 위로 떨어지는 연출
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
    div.textContent = 'BREAK!';
    els['arena'].appendChild(div);
    setTimeout(() => div.remove(), 800);
  }

  // ── 보상 ────────────────────────────────────────────────────
  function renderReward(run) {
    els['reward-title'].textContent = `스테이지 ${run.stage} 클리어!`;
    els['reward-sub'].textContent =
      `현재 덱 ${run.deck.length}장 · 다음 상대: ${D.ENEMIES[run.stage].name} (다음 전투 전 잃은 체력의 50% 회복)`;

    els['reward-grid'].innerHTML = '';
    run.rewardOptions.forEach((opt) => {
      const div = document.createElement('div');
      div.className = 'reward-card';
      const hpTag = opt.hpCost ? `HP -${opt.hpCost} · ` : '';
      div.innerHTML = `
        <div class="rc-name">${opt.name}</div>
        <div class="rc-cost">비용 ${opt.cost}</div>
        <div class="rc-desc">${hpTag}${opt.desc}</div>`;
      div.addEventListener('click', () => { TS_Run.takeCard(opt); resetBattleFx(); render(); });
      els['reward-grid'].appendChild(div);
    });

    els['upgrade-grid'].innerHTML = '';
    const idxs = TS_Run.upgradableIndexes();
    if (idxs.length === 0) {
      const note = document.createElement('div');
      note.className = 'empty-note';
      note.textContent = '강화할 수 있는 카드가 없습니다.';
      els['upgrade-grid'].appendChild(note);
    } else {
      // 같은 카드가 여러 장이면 하나만 대표로 보여준다
      const shown = new Set();
      idxs.forEach((i) => {
        const card = run.deck[i];
        if (shown.has(card.key)) return;
        shown.add(card.key);
        const chip = document.createElement('div');
        chip.className = 'upgrade-chip';
        chip.textContent = `${card.name} → +`;
        chip.addEventListener('click', () => { TS_Run.applyUpgrade(i); resetBattleFx(); render(); });
        els['upgrade-grid'].appendChild(chip);
      });
    }
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
  function wireStaticEvents() {
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

    els['pass-btn'].addEventListener('click', () => {
      const run = TS_Run.get();
      if (run.phase !== 'BATTLE') return;
      TS_Engine.passTurn(run.game);
      afterAction();
    });

    els['skip-reward-btn'].addEventListener('click', () => { TS_Run.skipReward(); resetBattleFx(); render(); });

    const restart = () => { TS_Run.newRun(); fxCursor = 0; render(); };
    els['restart-btn'].addEventListener('click', restart);
    els['result-restart-btn'].addEventListener('click', restart);
  }

  function init() {
    cacheEls();
    buildGaugeTrack();
    wireStaticEvents();
    TS_Run.newRun();
    render();
  }

  return { init, render };
})();
