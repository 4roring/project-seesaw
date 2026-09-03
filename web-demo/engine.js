// 전투 엔진 — gdd/01~08 문서의 규칙을 구현
// 문서에 수치가 없는 부분은 web-demo/README.md에 "구현 가정"으로 정리.

const TS_Engine = (() => {
  const D = TS_DATA;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 덱 목록(카드 정의 배열)을 인스턴스 배열로 펼친다. count가 있으면 그만큼 복제.
  function buildDeck(cards) {
    const deck = [];
    let uid = 0;
    cards.forEach((def) => {
      const n = def.count || 1;
      for (let i = 0; i < n; i++) deck.push({ ...def, uid: `${def.key}-${uid++}` });
    });
    return shuffle(deck);
  }

  // config: { enemy, deck, playerHp, playerMaxHp }
  function createGame(config) {
    const enemy = config.enemy;
    const game = {
      turn: 1,
      gauge: D.STARTING_GAUGE,
      status: 'PLAYING', // PLAYING | WON | LOST

      playerHp: config.playerHp,
      playerMaxHp: config.playerMaxHp,
      playerBlock: 0,

      enemyName: enemy.name,
      enemyIcon: enemy.icon,
      enemySkills: enemy.skills,
      bossHp: enemy.hp,
      bossMaxHp: enemy.hp,
      bossBlock: 0,
      bossScalingPower: 0,
      isBossStunned: false,
      bossCooldowns: Object.fromEntries(enemy.skills.map((s) => [s.key, 0])),

      breakThreshold: D.BREAK_THRESHOLD, // 블랙의 임계점 축소로 낮아질 수 있음

      // 정확히 1턴만 유효한 상태
      playerWeakenActive: false,
      bossVulnerableActive: false,
      // 다음 피격 1회에 소모되는 상태
      playerVulnerableActive: false,
      bossWeakenActive: false, // 보스의 다음 공격 피해 -25% (옐로우 '부식')
      counterDamage: 0,        // 다음 피격 시 보스에게 돌려줄 반격 피해 (블랙 '재부팅')

      // "다음 카드 한 장" 보너스 — 소비될 때까지 턴을 넘겨도 유지 (gdd 06 문서)
      pendingCostReduction: 0,
      pendingDamageMultiplier: 1,

      activeEffects: [],

      // 턴 이코노미 (gdd 07 문서)
      cardsPlayedThisTurn: 0,
      comboCounter: 0,
      comboBonusDrawsThisTurn: 0,
      cardsDiscardedThisTurn: 0, // 패 파기 카드로 버린 장수 — 보충 드로우에 포함

      drawPile: buildDeck(config.deck),
      hand: [],
      discardPile: [],

      log: [],
      fx: [], // UI 연출 큐 (엔진은 쌓기만, UI가 소비)
    };
    drawCards(game, D.HAND_SIZE);
    pushLog(game, `전투 시작 — ${enemy.name} (HP ${enemy.hp})`);
    return game;
  }

  function pushLog(game, message) { game.log.push(message); }
  // UI 연출용 이벤트. type: 'playerAttack' | 'enemyAttack' | 'memory' | 'break' | 'heal'
  function pushFx(game, type, payload) { game.fx.push({ type, ...payload }); }

  function drawCards(game, n) {
    for (let i = 0; i < n; i++) {
      if (game.drawPile.length === 0) {
        if (game.discardPile.length === 0) return;
        game.drawPile = shuffle(game.discardPile);
        game.discardPile = [];
        pushLog(game, '버린 더미를 섞어 뽑을 더미를 채웠습니다.');
      }
      game.hand.push(game.drawPile.pop());
    }
  }

  function startPlayerTurn(game) {
    // 직전 턴에 "손에서 빠져나간" 카드 수(사용 + 파기) - 콤보로 당겨 쓴 수만큼
    // 보충 (핸드는 유지). 파기를 세지 않으면 패 파기 카드가 손패를 영구히
    // 줄이는 함정이 된다. gdd/07-turn-economy-revision.md 7-2
    const refillCount = Math.max(0,
      game.cardsPlayedThisTurn + game.cardsDiscardedThisTurn - game.comboBonusDrawsThisTurn);
    game.playerBlock = 0;
    // pendingCostReduction / pendingDamageMultiplier는 리셋하지 않는다 — 실제로
    // 카드에 소비될 때까지 턴을 넘겨도 유지 (gdd/06 6-6)
    game.cardsPlayedThisTurn = 0;
    game.comboCounter = 0;
    game.comboBonusDrawsThisTurn = 0;
    game.cardsDiscardedThisTurn = 0;
    tickActiveEffects(game);
    drawCards(game, refillCount);
    pushLog(game, `--- 턴 ${game.turn} 시작 (게이지 ${gaugeLabel(game.gauge)}) ---`);
  }

  function addOrRefreshEffect(game, { id, name, kind, amount, turns }) {
    const existing = game.activeEffects.find((e) => e.id === id);
    if (existing) {
      existing.amount += amount;
      existing.turnsRemaining = turns;
    } else {
      game.activeEffects.push({ id, name, kind, amount, turnsRemaining: turns });
    }
  }

  function sumEffectAmount(game, kind) {
    return game.activeEffects.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
  }

  // 턴 시작 트리거형 효과 발동 → 잔여 턴 감소 → 만료 제거
  function tickActiveEffects(game) {
    game.activeEffects.forEach((e) => {
      if (e.turnsRemaining <= 0) return;
      if (e.kind === 'BLOCK_ON_TURN_START') {
        game.playerBlock += e.amount;
        pushLog(game, `[${e.name}] 발동 — 방어도 +${e.amount}.`);
      } else if (e.kind === 'HEAL_ON_TURN_START') {
        healPlayer(game, e.amount);
        pushLog(game, `[${e.name}] 발동 — 체력 +${e.amount}.`);
      }
    });
    game.activeEffects.forEach((e) => { e.turnsRemaining -= 1; });
    game.activeEffects.filter((e) => e.turnsRemaining <= 0)
      .forEach((e) => pushLog(game, `[${e.name}] 효과가 만료되었습니다.`));
    game.activeEffects = game.activeEffects.filter((e) => e.turnsRemaining > 0);
  }

  function healPlayer(game, amount) {
    const before = game.playerHp;
    game.playerHp = Math.min(game.playerMaxHp, game.playerHp + amount);
    const healed = game.playerHp - before;
    if (healed > 0) pushFx(game, 'heal', { amount: healed });
    return healed;
  }

  function gaugeLabel(g) {
    if (g === 0) return '중립(0)';
    return g < 0 ? `P${-g}` : `E${g}`;
  }

  function checkWinLose(game) {
    if (game.status !== 'PLAYING') return true;
    if (game.bossHp <= 0) {
      game.bossHp = 0; game.status = 'WON';
      pushLog(game, `${game.enemyName}을(를) 쓰러뜨렸습니다. 승리!`);
      return true;
    }
    if (game.playerHp <= 0) {
      game.playerHp = 0; game.status = 'LOST';
      pushLog(game, '플레이어 체력이 0이 되었습니다. 패배...');
      return true;
    }
    return false;
  }

  function applyDamageToBoss(game, rawDamage) {
    let dmg = rawDamage;
    // BREAK 취약(+50%)과 아우라(+N%)는 가산 후 한 번에 곱연산 (gdd/06 6-3)
    const bonusPct = (game.bossVulnerableActive ? 50 : 0) + sumEffectAmount(game, 'BOSS_VULNERABLE_AURA');
    if (bonusPct > 0) dmg = Math.round(dmg * (1 + bonusPct / 100));
    const absorbed = Math.min(game.bossBlock, dmg);
    game.bossBlock -= absorbed;
    game.bossHp -= dmg - absorbed;
    return dmg;
  }

  function applyDamageToPlayer(game, rawDamage) {
    let dmg = rawDamage;
    if (game.bossWeakenActive) {
      dmg = Math.round(dmg * 0.75); // 옐로우 '부식'
      game.bossWeakenActive = false;
    }
    if (game.playerVulnerableActive) {
      dmg = Math.round(dmg * 1.5);
      game.playerVulnerableActive = false; // 다음 피격 1회 소모
    }
    const absorbed = Math.min(game.playerBlock, dmg);
    game.playerBlock -= absorbed;
    game.playerHp -= dmg - absorbed;

    // 반격 (블랙 '재부팅') — 피격 시 1회 소모
    if (game.counterDamage > 0) {
      const counter = game.counterDamage;
      game.counterDamage = 0;
      applyDamageToBoss(game, counter);
      pushLog(game, `반격! ${counter} 피해를 돌려줍니다.`);
      pushFx(game, 'playerAttack', { amount: counter, label: '반격' });
    }
    return dmg;
  }

  // ── 보스 기술 선택 (gdd/08 8-4) ────────────────────────────────
  // 같은 기술을 연속으로 쓸수록 비용이 오른다 (8-4-1)
  function effectiveSkillCost(skill, streak) {
    const streakBonus = streak.lastKey === skill.key ? streak.count : 0;
    return Math.max(1, skill.cost + streakBonus);
  }

  // 오프너: 예산(현재 게이지) 안에 드는 기술 중 우선순위 최고. 이 분기는
  //   gauge - cost >= 0 이라 페이즈를 끝내지 못한다.
  // 클로저: 예산 안에 드는 게 없을 때 — 가장 "비싼" 기술로 크게 밀어낸다.
  //   페이즈를 끝내는 것은 항상 이 분기라, 여기서 무엇을 고르냐가 플레이어에게
  //   돌아가는 메모리 양을 결정한다.
  function pickBossSkill(game, cooldowns, streak, gauge) {
    const ready = game.enemySkills.filter((s) => (cooldowns[s.key] || 0) <= 0);
    const priced = ready.map((s) => ({ skill: s, cost: effectiveSkillCost(s, streak) }));
    const affordable = priced.filter((p) => p.cost <= gauge);

    let chosen;
    if (affordable.length > 0) {
      affordable.sort((a, b) => b.skill.priority - a.skill.priority);
      chosen = affordable[0];
    } else {
      priced.sort((a, b) => b.cost - a.cost || b.skill.priority - a.skill.priority);
      chosen = priced[0];
    }

    if (streak.lastKey === chosen.skill.key) streak.count += 1;
    else { streak.lastKey = chosen.skill.key; streak.count = 1; }

    return chosen;
  }

  // 최소 반환 보장(P3) + 범위 하한 (gdd/08 8-4-2)
  function clampReturnedGauge(finalGauge) {
    return Math.max(Math.min(finalGauge, -D.MIN_MEMORY_RETURN), D.GAUGE_MIN);
  }

  function tickBossCooldowns(game) {
    Object.keys(game.bossCooldowns).forEach((k) => {
      if (game.bossCooldowns[k] > 0) game.bossCooldowns[k] -= 1;
    });
  }

  function applyBossSkillEffect(game, skill, cost) {
    if (skill.kind === 'BUFF') {
      game.bossScalingPower += skill.powerGain;
      game.bossBlock += skill.blockGain;
      pushLog(game, `[${skill.name}](비용 ${cost}) — 공격력 +${skill.powerGain}, 방어도 +${skill.blockGain}.`);
      pushFx(game, 'enemyBuff', { name: skill.name, cost });
      return;
    }
    const dmg = applyDamageToPlayer(game, skill.damage + game.bossScalingPower);
    let extra = '';
    if (skill.kind === 'ATTACK_WEAKEN') {
      game.playerWeakenActive = true;
      extra = ' 약화 부여(다음 내 턴 카드 피해 -25%).';
    } else if (skill.kind === 'ATTACK_VULNERABLE') {
      game.playerVulnerableActive = true;
      extra = ' 취약 부여(다음 피격 +50%).';
    }
    pushLog(game, `[${skill.name}](비용 ${cost}) — ${dmg} 피해.${extra}`);
    pushFx(game, 'enemyAttack', { name: skill.name, amount: dmg, cost });
  }

  // 게이지가 0 이상인 동안 기술을 반복 사용, 음수가 되면 종료 (gdd/08 8-1)
  function runBossPhaseLoop(game, startGauge) {
    let gauge = startGauge;
    let guard = 0;
    const streak = { lastKey: null, count: 0 }; // 페이즈 로컬
    while (gauge >= 0 && guard < 50) {
      guard++;
      const { skill, cost } = pickBossSkill(game, game.bossCooldowns, streak, gauge);
      gauge -= cost;
      applyBossSkillEffect(game, skill, cost);
      if (skill.cooldown > 0) game.bossCooldowns[skill.key] = skill.cooldown;
      if (checkWinLose(game)) break;
    }
    return gauge;
  }

  // 부작용 없는 미리보기 — 실제 상태를 복사해서 굴린다
  function simulateBossPhase(game, n) {
    const cooldowns = { ...game.bossCooldowns };
    Object.keys(cooldowns).forEach((k) => { if (cooldowns[k] > 0) cooldowns[k] -= 1; });
    const streak = { lastKey: null, count: 0 };
    let scaling = game.bossScalingPower;
    let gauge = n;
    const steps = [];
    let guard = 0;
    while (gauge >= 0 && guard < 50) {
      guard++;
      const { skill, cost } = pickBossSkill(game, cooldowns, streak, gauge);
      gauge -= cost;
      if (skill.kind === 'BUFF') {
        scaling += skill.powerGain;
        steps.push(`${skill.name}(비용${cost}, 버프)`);
      } else {
        steps.push(`${skill.name}(비용${cost}, ${skill.damage + scaling}dmg)`);
      }
      if (skill.cooldown > 0) cooldowns[skill.key] = skill.cooldown;
    }
    // 실제 종료와 동일한 보정을 적용해야 미리보기와 결과가 일치한다
    return { steps, finalGauge: clampReturnedGauge(gauge) };
  }

  function previewIntent(game) {
    if (game.gauge <= 0) {
      return { text: '안전 — 아직 턴이 종료되지 않습니다.', tone: 'safe' };
    }
    const n = Math.min(game.gauge, D.GAUGE_MAX);
    if (game.isBossStunned) {
      return { text: `E${n} 도달 — 적이 기절 상태라 행동하지 못합니다.`, tone: 'stunned' };
    }
    if (n >= game.breakThreshold) {
      const auraPct = sumEffectAmount(game, 'BOSS_VULNERABLE_AURA');
      return { text: `BREAK! 적 행동 취소 + 기절 + 다음 턴 취약(+${50 + auraPct}% 피해)`, tone: 'break' };
    }
    const sim = simulateBossPhase(game, n);
    const tone = n <= 2 ? 'charge' : n <= 4 ? 'engage' : 'danger';
    return { text: `적 반격 예상: ${sim.steps.join(' → ')} → ${gaugeLabel(sim.finalGauge)}에서 내 턴`, tone };
  }

  function resolveBossPhase(game, n) {
    // 이전 페이즈가 걸어둔 "다음 플레이어 턴 한정" 상태 만료
    game.playerWeakenActive = false;
    game.bossVulnerableActive = false;

    if (game.isBossStunned) {
      pushLog(game, '적이 기절 상태라 이번 페이즈에는 기술을 쓰지 못했습니다.');
      game.isBossStunned = false;
      // 기절 페이즈에도 최소 반환 보장을 적용 — 없으면 BREAK 직후 턴에
      // 오히려 가장 얕은 반환이 나오는 최악의 경우가 생긴다.
      game.gauge = clampReturnedGauge(-n);
      return;
    }

    if (n >= game.breakThreshold) {
      pushLog(game, `[BREAK!] E${n} 도달 — 적 행동 취소, 1턴 기절, 다음 턴 취약 부여.`);
      pushFx(game, 'break', {});
      game.isBossStunned = true;
      game.bossVulnerableActive = true;
      game.gauge = D.STARTING_GAUGE;
      return;
    }

    tickBossCooldowns(game);
    const finalGauge = runBossPhaseLoop(game, n);
    if (game.status !== 'PLAYING') return;
    game.gauge = clampReturnedGauge(finalGauge);
    if (game.gauge !== finalGauge) {
      pushLog(game, `최소 반환 보장 — ${gaugeLabel(finalGauge)} → ${gaugeLabel(game.gauge)}으로 보정.`);
    }
    pushFx(game, 'memory', { to: game.gauge });
    pushLog(game, `적 페이즈 종료 — ${gaugeLabel(game.gauge)}에서 내 턴이 시작됩니다.`);
  }

  function endPlayerTurnAndResolveBoss(game, n) {
    resolveBossPhase(game, n);
    if (checkWinLose(game)) return;
    game.turn += 1;
    startPlayerTurn(game);
  }

  function playCard(game, uid) {
    if (game.status !== 'PLAYING') return;
    const idx = game.hand.findIndex((c) => c.uid === uid);
    if (idx === -1) return;
    const card = game.hand[idx];

    // HP를 코스트로 쓰는 카드(옐로우)는 자기 체력으로 죽을 수 없다
    if (card.hpCost && card.hpCost >= game.playerHp) {
      pushLog(game, `[${card.name}] — 체력이 부족해 사용할 수 없습니다.`);
      return;
    }

    const effectiveCost = Math.max(0, card.cost - game.pendingCostReduction);
    game.pendingCostReduction = 0;

    game.hand.splice(idx, 1);
    game.discardPile.push(card);

    // 패 파기 (블루) — 남은 손패를 전부 버리고 버린 장수만큼 피해를 더한다.
    // 파기한 장수는 다음 턴 보충 드로우에 포함되므로 손패가 줄지 않는다.
    let discardBonus = 0;
    if (card.discardAll) {
      const discarded = game.hand.length;
      if (discarded > 0) {
        game.discardPile.push(...game.hand);
        game.hand = [];
        game.cardsDiscardedThisTurn += discarded;
        discardBonus = card.discardAll * discarded;
        pushLog(game, `손패 ${discarded}장을 파기 — 추가 피해 ${discardBonus}.`);
      } else {
        pushLog(game, '파기할 손패가 없습니다.');
      }
    }

    let effectiveDamage = card.damage + discardBonus;
    if (effectiveDamage > 0) {
      effectiveDamage *= game.pendingDamageMultiplier;
      game.pendingDamageMultiplier = 1;
      effectiveDamage += sumEffectAmount(game, 'DAMAGE_BOOST');
      if (game.playerWeakenActive) effectiveDamage = Math.round(effectiveDamage * 0.75);
    }

    if (card.hpCost) {
      game.playerHp -= card.hpCost;
      pushLog(game, `[${card.name}] — 체력 ${card.hpCost} 소모.`);
    }
    if (effectiveDamage > 0) {
      const dealt = applyDamageToBoss(game, effectiveDamage);
      pushLog(game, `[${card.name}] 사용 — ${dealt} 피해.`);
      pushFx(game, 'playerAttack', { amount: dealt, label: card.name });
    } else {
      pushLog(game, `[${card.name}] 사용.`);
    }
    if (card.block > 0) {
      game.playerBlock += card.block;
      pushLog(game, `방어도 +${card.block}.`);
    }
    if (card.heal) {
      const healed = healPlayer(game, card.heal);
      pushLog(game, `체력 +${healed}.`);
    }
    if (card.draw) {
      drawCards(game, card.draw);
      pushLog(game, `카드 ${card.draw}장 드로우.`);
    }
    if (card.counter) {
      game.counterDamage += card.counter;
      pushLog(game, `다음 피격 시 반격 ${game.counterDamage} 준비.`);
    }
    if (card.bossWeaken) {
      game.bossWeakenActive = true;
      pushLog(game, '다음 적 공격 피해 -25%.');
    }
    if (card.breakThresholdDown) {
      const before = game.breakThreshold;
      game.breakThreshold = Math.max(4, game.breakThreshold - card.breakThresholdDown);
      pushLog(game, `BREAK 기준값 E${before} → E${game.breakThreshold}.`);
    }

    // 태그형 효과
    if (card.effect === 'REDUCE_NEXT_COST') {
      game.pendingCostReduction = 1;
      pushLog(game, '다음 카드 비용 -1.');
    } else if (card.effect === 'DOUBLE_NEXT_ATTACK') {
      game.pendingDamageMultiplier = 2;
      pushLog(game, '다음 공격 카드 피해 2배.');
    } else if (card.effect === 'PERSISTENT_DAMAGE_BOOST') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'DAMAGE_BOOST' });
      pushLog(game, `[${p.name}] 설치 — ${p.turns}턴간 공격 피해 +${p.amount}.`);
    } else if (card.effect === 'PERSISTENT_BLOCK_ON_TURN_START') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'BLOCK_ON_TURN_START' });
      pushLog(game, `[${p.name}] 설치 — 다음 턴부터 ${p.turns}턴간 방어도 +${p.amount}.`);
    } else if (card.effect === 'PERSISTENT_BOSS_VULNERABLE') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'BOSS_VULNERABLE_AURA' });
      pushLog(game, `[${p.name}] 설치 — ${p.turns}턴간 적 받는 피해 +${p.amount}%.`);
    } else if (card.effect === 'PERSISTENT_HEAL_ON_TURN_START') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'HEAL_ON_TURN_START' });
      pushLog(game, `[${p.name}] 설치 — 다음 턴부터 ${p.turns}턴간 체력 +${p.amount}.`);
    }

    // 콤보 드로우 (gdd/07 7-3)
    game.cardsPlayedThisTurn += 1;
    game.comboCounter += 1;
    if (game.comboCounter >= D.COMBO_THRESHOLD) {
      game.comboCounter -= D.COMBO_THRESHOLD;
      if (game.bossHp > 0) {
        drawCards(game, 1);
        game.comboBonusDrawsThisTurn += 1;
        pushLog(game, '콤보 발동! 카드 1장 추가 드로우.');
      }
    }

    if (checkWinLose(game)) return;

    // 비용은 오른쪽(+), 되감기는 왼쪽(-) — 합산 결과로 턴 종료를 판정
    const rawGauge = game.gauge + effectiveCost - (card.rewind || 0);
    if (rawGauge > 0) {
      const n = Math.min(rawGauge, D.GAUGE_MAX);
      game.gauge = n;
      pushFx(game, 'memory', { to: n });
      pushLog(game, `게이지가 ${gaugeLabel(n)}(으)로 넘어가 턴이 종료됩니다.`);
      endPlayerTurnAndResolveBoss(game, n);
    } else {
      game.gauge = Math.max(rawGauge, D.GAUGE_MIN);
      pushFx(game, 'memory', { to: game.gauge });
    }
  }

  // 게이지를 넘기지 않고 스스로 턴을 마치는 "패스" — 메모리 3을 상납하는
  // 대신 카드 1장을 뽑는다 (gdd/07 7-1)
  function passTurn(game) {
    if (game.status !== 'PLAYING') return;
    const before = game.gauge;
    const pushedGauge = game.gauge + D.PASS_MEMORY_PENALTY;
    pushLog(game, `패스 — 메모리 ${D.PASS_MEMORY_PENALTY} 상납 (${gaugeLabel(before)} → ${gaugeLabel(Math.min(pushedGauge, D.GAUGE_MAX))}).`);
    drawCards(game, D.PASS_BONUS_DRAW);
    pushLog(game, `패스 보상으로 카드 ${D.PASS_BONUS_DRAW}장 드로우.`);

    if (pushedGauge > 0) {
      const n = Math.min(pushedGauge, D.GAUGE_MAX);
      game.gauge = n;
      pushFx(game, 'memory', { to: n });
      endPlayerTurnAndResolveBoss(game, n);
    } else {
      game.gauge = pushedGauge;
      pushFx(game, 'memory', { to: game.gauge });
      game.turn += 1;
      startPlayerTurn(game);
    }
  }

  return { createGame, playCard, passTurn, previewIntent, gaugeLabel, buildDeck };
})();
