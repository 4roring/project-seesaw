// 렌더링 + 드래그 앤 드롭 입력 처리
const TS_UI = (() => {
  const D = TS_DATA;
  let game = null;

  const els = {};

  function cacheEls() {
    els.turn = document.getElementById('turn-count');
    els.bossHpFill = document.getElementById('boss-hp-fill');
    els.bossHpText = document.getElementById('boss-hp-text');
    els.bossBadges = document.getElementById('boss-badges');
    els.bossSkillLegend = document.getElementById('boss-skill-legend');
    els.playerHpFill = document.getElementById('player-hp-fill');
    els.playerHpText = document.getElementById('player-hp-text');
    els.playerBadges = document.getElementById('player-badges');
    els.gaugeTrack = document.getElementById('gauge-track');
    els.gaugeCells = document.getElementById('gauge-cells');
    els.gaugeMarker = document.getElementById('gauge-marker');
    els.intentPreview = document.getElementById('intent-preview');
    els.comboDots = document.getElementById('combo-dots');
    els.hand = document.getElementById('hand-row');
    els.playZone = document.getElementById('play-zone');
    els.pileCounts = document.getElementById('pile-counts');
    els.log = document.getElementById('log-panel');
    els.passBtn = document.getElementById('pass-btn');
    els.restartBtn = document.getElementById('restart-btn');
    els.overlay = document.getElementById('overlay');
    els.overlayTitle = document.getElementById('overlay-title');
    els.overlayRestart = document.getElementById('overlay-restart');
  }

  function buildGaugeTrack() {
    els.gaugeCells.innerHTML = '';
    for (let v = D.GAUGE_MIN; v <= D.GAUGE_MAX; v++) {
      const cell = document.createElement('div');
      cell.className = 'gauge-cell ' + zoneClassFor(v);
      cell.textContent = v === 0 ? '0' : v < 0 ? `P${-v}` : `E${v}`;
      els.gaugeCells.appendChild(cell);
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

  function render() {
    els.turn.textContent = game.turn;

    const bossHpPct = Math.max(0, (game.bossHp / game.bossMaxHp) * 100);
    els.bossHpFill.style.width = bossHpPct + '%';
    els.bossHpText.textContent = `${Math.max(0, game.bossHp)} / ${game.bossMaxHp}`;

    const playerHpPct = Math.max(0, (game.playerHp / game.playerMaxHp) * 100);
    els.playerHpFill.style.width = playerHpPct + '%';
    els.playerHpText.textContent = `${Math.max(0, game.playerHp)} / ${game.playerMaxHp}`;

    els.bossBadges.innerHTML = '';
    addBadge(els.bossBadges, 'block', `방어도 ${game.bossBlock}`, game.bossBlock > 0);
    addBadge(els.bossBadges, 'power', `공격력 +${game.bossScalingPower}`, game.bossScalingPower > 0);
    addBadge(els.bossBadges, 'stun', '기절', game.isBossStunned);
    addBadge(els.bossBadges, 'vulnerable', '취약(다음 내 턴, BREAK)', game.bossVulnerableActive);
    game.activeEffects
      .filter((e) => e.kind === 'BOSS_VULNERABLE_AURA')
      .forEach((e) => addBadge(els.bossBadges, 'vulnerable', `${e.name} +${e.amount}% (${e.turnsRemaining}턴)`, true));
    renderBossSkillLegend();

    els.playerBadges.innerHTML = '';
    addBadge(els.playerBadges, 'block', `방어도 ${game.playerBlock}`, game.playerBlock > 0);
    addBadge(els.playerBadges, 'weaken', '약화(피해 -25%)', game.playerWeakenActive);
    addBadge(els.playerBadges, 'vulnerable', '취약(다음 피격 +50%)', game.playerVulnerableActive);
    addBadge(els.playerBadges, 'power', `다음 카드 비용 -${game.pendingCostReduction}`, game.pendingCostReduction > 0);
    addBadge(els.playerBadges, 'power', `다음 공격 카드 피해 ${game.pendingDamageMultiplier}배`, game.pendingDamageMultiplier > 1);
    game.activeEffects
      .filter((e) => e.kind === 'DAMAGE_BOOST')
      .forEach((e) => addBadge(els.playerBadges, 'power', `${e.name} 피해+${e.amount} (${e.turnsRemaining}턴)`, true));
    game.activeEffects
      .filter((e) => e.kind === 'BLOCK_ON_TURN_START')
      .forEach((e) => addBadge(els.playerBadges, 'block', `${e.name} 턴시작 방어+${e.amount} (${e.turnsRemaining}턴)`, true));

    // 게이지 마커 위치: 13칸 중 (gauge - MIN)번째 칸의 중앙
    const idx = game.gauge - D.GAUGE_MIN;
    const totalCells = D.GAUGE_MAX - D.GAUGE_MIN + 1;
    const pct = ((idx + 0.5) / totalCells) * 100;
    els.gaugeMarker.style.left = pct + '%';

    const intent = TS_Engine.previewIntent(game);
    els.intentPreview.textContent = intent.text;
    els.intentPreview.className = 'intent-preview ' + intent.tone;

    renderCombo();
    renderHand();

    els.pileCounts.textContent = `뽑을 더미 ${game.drawPile.length} · 버린 더미 ${game.discardPile.length}`;

    els.log.innerHTML = '';
    game.log.slice(-40).forEach((line) => {
      const div = document.createElement('div');
      div.textContent = line;
      els.log.appendChild(div);
    });
    els.log.scrollTop = els.log.scrollHeight;

    if (game.status !== 'PLAYING') {
      els.overlay.classList.remove('hidden');
      els.overlayTitle.textContent = game.status === 'WON' ? '승리!' : '패배...';
    } else {
      els.overlay.classList.add('hidden');
    }
  }

  function addBadge(container, cls, text, active) {
    if (!active) return;
    const span = document.createElement('span');
    span.className = `badge active ${cls}`;
    span.textContent = text;
    container.appendChild(span);
  }

  // 보스 기술 목록을 항상 표시 — 비용(=넘겨줄 메모리)과 쿨다운 상태
  // (gdd/08-boss-skill-loop.md 8-7 — "보스 공격도 필요 메모리를 볼 수 있게")
  function renderBossSkillLegend() {
    els.bossSkillLegend.innerHTML = '';
    D.BOSS_SKILLS.forEach((s) => {
      const cooldownLeft = game.bossCooldowns[s.key] || 0;
      const row = document.createElement('div');
      row.className = 'boss-skill-row' + (cooldownLeft > 0 ? ' locked' : '');
      const cdText = cooldownLeft > 0 ? ` · 재사용까지 ${cooldownLeft}턴` : (s.cooldown > 0 ? ` · 쿨다운 ${s.cooldown}턴` : '');
      row.textContent = `${s.name} — 비용 ${s.cost}${cdText}`;
      els.bossSkillLegend.appendChild(row);
    });
  }

  function renderCombo() {
    els.comboDots.innerHTML = '';
    for (let i = 0; i < D.COMBO_THRESHOLD; i++) {
      const dot = document.createElement('div');
      dot.className = 'combo-dot' + (i < game.comboCounter ? ' filled' : '');
      els.comboDots.appendChild(dot);
    }
  }

  function renderHand() {
    els.hand.innerHTML = '';
    game.hand.forEach((card) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.draggable = true;
      div.dataset.uid = card.uid;
      div.innerHTML = `
        <div class="card-cost">${card.cost}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.desc}</div>
      `;
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.uid);
        div.classList.add('dragging');
      });
      div.addEventListener('dragend', () => div.classList.remove('dragging'));
      div.addEventListener('click', () => {
        TS_Engine.playCard(game, card.uid);
        render();
      });
      els.hand.appendChild(div);
    });
  }

  function wireStaticEvents() {
    els.playZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.playZone.classList.add('drag-over');
    });
    els.playZone.addEventListener('dragleave', () => {
      els.playZone.classList.remove('drag-over');
    });
    els.playZone.addEventListener('drop', (e) => {
      e.preventDefault();
      els.playZone.classList.remove('drag-over');
      const uid = e.dataTransfer.getData('text/plain');
      if (uid) {
        TS_Engine.playCard(game, uid);
        render();
      }
    });

    els.passBtn.addEventListener('click', () => {
      TS_Engine.passTurn(game);
      render();
    });

    const restart = () => {
      game = TS_Engine.createGame();
      render();
    };
    els.restartBtn.addEventListener('click', restart);
    els.overlayRestart.addEventListener('click', restart);
  }

  function init() {
    cacheEls();
    buildGaugeTrack();
    wireStaticEvents();
    game = TS_Engine.createGame();
    render();
  }

  return { init };
})();
