// 전투 엔진 — gdd/01~08, 12 문서의 규칙을 구현
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

      // 파훼 임계점은 전역 상수가 아니라 적의 스탯이다 (gdd/02 2-2).
      // base는 임계점 축소 카드의 하한을 상대값으로 계산하기 위해 남긴다.
      baseBreakThreshold: enemy.breakThreshold,
      breakThreshold: enemy.breakThreshold,
      // 빈틈 감소는 이번 합에만 남는다. 전투 내내 남기면 파훼가 계단
      // 함수라서(넘거나 못 넘거나) 임계점을 영구히 내리는 카드는 값이
      // 없거나 게임을 끝내거나 둘 중 하나가 된다 — 중간이 없다.
      // 실측: 백은 이 필드가 있으면 96%, 없으면 2%였다 (gdd/02 2-4).
      thresholdDownThisTurn: 0,
      closerStyle: enemy.closerStyle || 'DOMINANT', // 패도 | 노회 (gdd/08 8-4-1)
      enemyRealm: enemy.realm || '',
      // 손패 뚜껑은 문파마다 다르다 (gdd/07 7-2)
      handRefillCap: config.handCap != null ? config.handCap : D.HAND_REFILL_CAP,

      // 신병이기 (gdd/14) — 규칙을 비트는 둘째 축. 손은 둘뿐이다.
      weapons: (config.weapons || []).map((w) => (typeof w === 'string' ? D.WEAPONS[w] : w)).filter(Boolean),
      // 유물 (gdd/15) — 대부분 런 층에서 작동하지만, 쓰러지는 순간과
      // 파훼처럼 전투 안에서만 관측되는 것은 엔진이 알아야 한다.
      relics: (config.relics || []).map((r) => (typeof r === 'string' ? D.RELICS[r] : r)).filter(Boolean),
      lastStandLeft: 0,  // 호심경 — 아래에서 채운다
      breakCount: 0,     // 오도비 — 런이 전투 후에 읽어 간다
      returnBonusNextTurn: 0, // 곤(棍) — 방어도를 남기면 다음 합이 깊어진다
      // 최소 반환 보장은 런 중에 깎일 수 있다 — 기연 '영약'의 대가
      // (ideanote/012 12-6). 합의 88%가 이 값에서 시작하므로 1칸이 무겁다.
      minMomentumReturn: config.minReturn != null ? config.minReturn : D.MIN_MOMENTUM_RETURN,

      // 정확히 1턴만 유효한 상태
      playerWeakenActive: false,
      bossVulnerableActive: false,
      // 다음 피격 1회에 소모되는 상태
      playerVulnerableActive: false,
      bossWeakenActive: false, // 적의 다음 공격 피해 -25% (자 '부식장')
      // 반탄은 적 페이즈 하나를 통째로 버틴다 — 피격 1회로 소모되던 시절엔
      // 한 장 써서 5~10을 한 번 돌려주는 게 전부라 사실상 함정 카드였다
      // (반탄을 통째로 지워도 백의 클리어율이 98% → 93%로만 움직였다).
      // 적 페이즈는 2~4대를 때리므로, 유지되면 "때릴수록 아프다"가 성립한다.
      counterDamage: 0,
      evadeCharges: 0,         // 남은 흘리기 횟수 — 피격 1회를 통째로 무효화 (흑)

      // "다음 카드 한 장" 보너스 — 소비될 때까지 턴을 넘겨도 유지 (gdd 06 문서)
      pendingCostReduction: 0,
      pendingDamageMultiplier: 1,

      activeEffects: [],

      // 턴 이코노미 (gdd 07 문서)
      cardsPlayedThisTurn: 0,
      comboCounter: 0,
      comboBonusDrawsThisTurn: 0,
      cardDrawsThisTurn: 0,      // 초식 효과로 뽑은 장수 — 보충량에서 뺀다
      cardsDiscardedThisTurn: 0, // 패 파기 카드로 버린 장수 — 보충 드로우에 포함
      // 이번 합에 "초식으로" 지불한 틈의 합 = 몰아치기. 이 값이 빈틈에 닿으면
      // 파훼 (gdd/02 2-1).
      //   - 되감기는 빼지 않는다: 더 많이 몰아칠 수 있게 해주는 수단이므로
      //     흑(무당)의 "합을 늘린다"가 파훼로 이어진다.
      //   - 숨 고르기는 포함하지 않는다: 물러서며 숨을 고르는 행동으로
      //     상대 초식을 깨뜨릴 수는 없다. 포함하면 카드를 한 장도 내지 않고
      //     숨 고르기만 반복해 파훼가 나는 구멍이 생긴다 (실측 확인).
      momentumSpentThisTurn: 0,

      drawPile: buildDeck(config.deck),
      hand: [],
      discardPile: [],

      log: [],
      fx: [], // UI 연출 큐 (엔진은 쌓기만, UI가 소비)
    };
    game.lastStandLeft = config.lastStandLeft != null
      ? config.lastStandLeft
      : game.relics.reduce((n, r) => n + (r.lastStand || 0), 0);
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
    // 손에서 빠져나간 수 − 이번 합에 이미 당겨 쓴 수.
    // 연환 드로우와 드로우 초식은 둘 다 "이번 합에 쓸 카드를 미리 당겨오는"
    // 효과이지 손패 총량을 늘리는 효과가 아니다. 드로우 초식만 안 빼고 있어서
    // 초식 한 장당 손패가 영구히 +1씩 불어나고 있었다 (gdd/07 7-2).
    const drawnAhead = game.comboBonusDrawsThisTurn
      + (D.SUBTRACT_CARD_DRAWS ? game.cardDrawsThisTurn : 0);
    let refillCount = Math.max(0,
      game.cardsPlayedThisTurn + game.cardsDiscardedThisTurn - drawnAhead);
    // 보충 장수 상한 — null이면 무제한.
    if (D.REFILL_CAP != null) refillCount = Math.min(refillCount, D.REFILL_CAP);
    // 손패 크기 뚜껑 — 보충으로 이 크기를 넘기지 않는다. 드로우 초식으로
    // 뽑은 장수는 보충량에서 빠지지 않아 손패가 합마다 불어나는데, 그걸
    // 여기서 막는다 (gdd/07 7-2). 이미 넘겨 들고 있으면 보충은 0.
    if (game.handRefillCap != null) {
      refillCount = Math.min(refillCount, Math.max(0, game.handRefillCap - game.hand.length));
    }
    game.playerBlock = 0;
    game.counterDamage = 0; // 반탄은 적 페이즈 하나만 버틴다
    // pendingCostReduction / pendingDamageMultiplier는 리셋하지 않는다 — 실제로
    // 카드에 소비될 때까지 턴을 넘겨도 유지 (gdd/06 6-6)
    game.cardsPlayedThisTurn = 0;
    game.comboCounter = 0;
    game.comboBonusDrawsThisTurn = 0;
    game.cardDrawsThisTurn = 0;
    game.cardsDiscardedThisTurn = 0;
    game.momentumSpentThisTurn = 0;
    game.thresholdDownThisTurn = 0;
    tickActiveEffects(game);
    drawCards(game, refillCount);
    pushLog(game, `--- ${game.turn}합 시작 (기세 ${gaugeLabel(game.gauge)}) ---`);
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

  // 무기 효과는 합산한다 — 한손 둘을 쥐면 두 효과를 동시에 받는다 (gdd/14 14-2).
  function weaponSum(game, field) {
    return game.weapons.reduce((sum, w) => sum + (w[field] || 0), 0);
  }
  function hasWeapon(game, field) { return game.weapons.some((w) => w[field]); }

  // 이번 합에 실제로 넘어야 하는 빈틈. 하한을 두는 이유는 gdd/02 2-3.
  function effectiveBreakThreshold(game) {
    const floor = Math.max(5, game.baseBreakThreshold - 4);
    return Math.max(floor, game.breakThreshold - game.thresholdDownThisTurn);
  }

  function gaugeLabel(g) {
    if (g === 0) return '중립(0)';
    return g < 0 ? `아${-g}` : `적${g}`;
  }

  function checkWinLose(game) {
    if (game.status !== 'PLAYING') return true;
    if (game.bossHp <= 0) {
      game.bossHp = 0; game.status = 'WON';
      pushLog(game, `${game.enemyName}을(를) 쓰러뜨렸습니다. 승리!`);
      return true;
    }
    if (game.playerHp <= 0) {
      // 호심경 (gdd/15) — 강호행에 한 번, 쓰러지는 대신 체력 1로 버틴다
      if (game.lastStandLeft > 0) {
        game.lastStandLeft -= 1;
        game.playerHp = 1;
        pushLog(game, '[호심경] 깨어지며 목숨을 건집니다 — 체력 1로 버팁니다.');
        pushFx(game, 'heal', { amount: 1 });
        return false;
      }
      game.playerHp = 0; game.status = 'LOST';
      pushLog(game, '플레이어 체력이 0이 되었습니다. 패배...');
      return true;
    }
    return false;
  }

  function applyDamageToBoss(game, rawDamage) {
    let dmg = rawDamage;
    // 파훼 사혈 노출(+50%)과 아우라(+N%)는 가산 후 한 번에 곱연산 (gdd/06 6-3)
    const bonusPct = (game.bossVulnerableActive ? 50 : 0) + sumEffectAmount(game, 'BOSS_VULNERABLE_AURA');
    if (bonusPct > 0) dmg = Math.round(dmg * (1 + bonusPct / 100));
    const absorbed = Math.min(game.bossBlock, dmg);
    game.bossBlock -= absorbed;
    game.bossHp -= dmg - absorbed;
    return dmg;
  }

  // pierce=true면 방어도를 절반만 인정한다 — 페이즈를 끝내는 "마무리 일격"이
  // 그냥 막히면 "작게 넘기면 큰 게 온다"는 시소 규칙에 이빨이 없어진다.
  // 흘리기(흑)는 그보다 먼저 판정되므로 관통과 무관하게 통째로 넘긴다 —
  // 방어도와 흘리기의 성격이 갈리는 지점이다 (gdd/08 8-4-2).
  function applyDamageToPlayer(game, rawDamage, pierce) {
    // 흘리기 (흑/무당) — 사량발천근. 방어도처럼 깎는 게 아니라 그 일격을
    // 통째로 넘긴다. 큰 일격일수록 이득이라 방어도(백)와 성격이 다르다.
    if (game.evadeCharges > 0) {
      game.evadeCharges -= 1;
      pushLog(game, `흘리기 — 일격을 넘겼습니다. (남은 횟수 ${game.evadeCharges})`);
      pushFx(game, 'evade', {});
      return 0;
    }
    let dmg = rawDamage;
    if (game.bossWeakenActive) {
      dmg = Math.round(dmg * 0.75); // 자 '부식장'
      game.bossWeakenActive = false;
    }
    if (game.playerVulnerableActive) {
      dmg = Math.round(dmg * 1.5);
      game.playerVulnerableActive = false; // 다음 피격 1회 소모
    }
    const usableBlock = pierce
      ? Math.floor(game.playerBlock * D.CLOSER_BLOCK_RATIO)
      : game.playerBlock;
    const absorbed = Math.min(usableBlock, dmg);
    game.playerBlock -= absorbed;
    game.playerHp -= dmg - absorbed;

    // 반격 (백 '반탄강기') — 이번 적 페이즈의 매 피격마다 돌려준다.
    // 소모되지 않고, 다음 내 합이 시작될 때 사라진다.
    if (game.counterDamage > 0) {
      const counter = game.counterDamage;
      applyDamageToBoss(game, counter);
      pushLog(game, `반탄! ${counter} 피해를 돌려줍니다.`);
      pushFx(game, 'playerAttack', { amount: counter, label: '반탄' });
    }
    return dmg;
  }

  // ── 보스 기술 선택 (gdd/08 8-4) ────────────────────────────────
  // 같은 기술을 연속으로 쓸수록 비용이 오른다 (8-4-3)
  function effectiveSkillCost(skill, streak) {
    const streakBonus = streak.lastKey === skill.key ? streak.count : 0;
    return Math.max(1, skill.cost + streakBonus);
  }

  // 오프너: 예산(현재 기세) 안에 드는 초식 중 우선순위 최고. 이 분기는
  //   gauge - cost >= 0 이라 페이즈를 끝내지 못한다.
  // 클로저: 예산 안에 드는 게 없을 때. 페이즈를 끝내는 것은 항상 이 분기라,
  //   여기서 무엇을 고르냐가 플레이어에게 돌아오는 기세를 결정한다.
  //   성격에 따라 갈린다 (gdd/08 8-4-1):
  //     패도(DOMINANT) — 가장 비싼 것. 크게 때리고 크게 돌려준다
  //     노회(CRAFTY)  — 예산을 넘기는 것 중 가장 싼 것. 덜 때리고 덜 돌려준다
  //   노회는 최소 반환 보장(8-4-4)이 있어야만 성립한다. 없으면 착지가 아1로
  //   고정돼 덱 빌드업 자체가 무너졌던 초기 구현이 그대로 재현된다.
  function pickBossSkill(game, cooldowns, streak, gauge) {
    const ready = game.enemySkills.filter((s) => (cooldowns[s.key] || 0) <= 0);
    const priced = ready.map((s) => ({ skill: s, cost: effectiveSkillCost(s, streak) }));
    const affordable = priced.filter((p) => p.cost <= gauge);

    let chosen;
    if (affordable.length > 0) {
      affordable.sort((a, b) => b.skill.priority - a.skill.priority);
      chosen = affordable[0];
    } else if (game.closerStyle === 'CRAFTY') {
      priced.sort((a, b) => a.cost - b.cost || b.skill.priority - a.skill.priority);
      chosen = priced[0];
    } else {
      priced.sort((a, b) => b.cost - a.cost || b.skill.priority - a.skill.priority);
      chosen = priced[0];
    }

    if (streak.lastKey === chosen.skill.key) streak.count += 1;
    else { streak.lastKey = chosen.skill.key; streak.count = 1; }

    return { ...chosen, isCloser: affordable.length === 0 };
  }

  // 최소 반환 보장(아3) + 범위 하한 (gdd/08 8-4-4)
  function clampReturnedGauge(game, finalGauge) {
    // 곤(棍)은 방어도를 남긴 합의 다음 합을 한 칸 더 깊게 만든다 (gdd/14).
    const floor = game.minMomentumReturn + game.returnBonusNextTurn;
    return Math.max(Math.min(finalGauge, -floor), D.GAUGE_MIN);
  }

  function tickBossCooldowns(game) {
    Object.keys(game.bossCooldowns).forEach((k) => {
      if (game.bossCooldowns[k] > 0) game.bossCooldowns[k] -= 1;
    });
  }

  function applyBossSkillEffect(game, skill, cost, isCloser) {
    if (skill.kind === 'BUFF') {
      game.bossScalingPower += skill.powerGain;
      game.bossBlock += skill.blockGain;
      pushLog(game, `[${skill.name}](틈 ${cost}) — 공격력 +${skill.powerGain}, 방어도 +${skill.blockGain}.`);
      pushFx(game, 'enemyBuff', { name: skill.name, cost });
      return;
    }
    const dmg = applyDamageToPlayer(game, skill.damage + game.bossScalingPower, isCloser);
    let extra = '';
    if (skill.kind === 'ATTACK_WEAKEN') {
      game.playerWeakenActive = true;
      extra = ' 내상 부여(다음 내 합의 초식 피해 -25%).';
    } else if (skill.kind === 'ATTACK_VULNERABLE') {
      game.playerVulnerableActive = true;
      extra = ' 사혈 노출(다음 피격 +50%).';
    }
    pushLog(game, `[${skill.name}](틈 ${cost}${isCloser ? ' · 관통' : ''}) — ${dmg} 피해.${extra}`);
    pushFx(game, 'enemyAttack', { name: skill.name, amount: dmg, cost });
  }

  // 게이지가 0 이상인 동안 기술을 반복 사용, 음수가 되면 종료 (gdd/08 8-1)
  function runBossPhaseLoop(game, startGauge) {
    let gauge = startGauge;
    let guard = 0;
    const streak = { lastKey: null, count: 0 }; // 페이즈 로컬
    while (gauge >= 0 && guard < 50) {
      guard++;
      const { skill, cost, isCloser } = pickBossSkill(game, game.bossCooldowns, streak, gauge);
      gauge -= cost;
      applyBossSkillEffect(game, skill, cost, isCloser);
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
      const { skill, cost, isCloser } = pickBossSkill(game, cooldowns, streak, gauge);
      gauge -= cost;
      const tag = isCloser ? ' · 관통' : '';
      if (skill.kind === 'BUFF') {
        scaling += skill.powerGain;
        steps.push(`${skill.name}(틈${cost}, 운기${tag})`);
      } else {
        steps.push(`${skill.name}(틈${cost}, ${skill.damage + scaling}dmg${tag})`);
      }
      if (skill.cooldown > 0) cooldowns[skill.key] = skill.cooldown;
    }
    // 실제 종료와 동일한 보정을 적용해야 미리보기와 결과가 일치한다
    return { steps, finalGauge: clampReturnedGauge(game, gauge) };
  }

  function previewIntent(game) {
    if (game.gauge <= 0) {
      const need = effectiveBreakThreshold(game) - game.momentumSpentThisTurn;
      if (need <= 0) {
        return { text: '몰아치기 완성 — 이대로 선을 넘기면 파훼!', tone: 'break' };
      }
      return {
        text: `안전 — 아직 선(先)이 넘어가지 않습니다. (파훼까지 틈 ${need} 더)`,
        tone: 'safe',
      };
    }
    const n = Math.min(game.gauge, D.GAUGE_MAX);
    if (game.isBossStunned) {
      return { text: `적${n} 도달 — 적이 무너져 행동하지 못합니다.`, tone: 'stunned' };
    }
    if (game.momentumSpentThisTurn >= effectiveBreakThreshold(game)) {
      const auraPct = sumEffectAmount(game, 'BOSS_VULNERABLE_AURA');
      return { text: `파훼! 적 행동 취소 + 무너짐 + 다음 합 사혈 노출(+${50 + auraPct}% 피해)`, tone: 'break' };
    }
    const sim = simulateBossPhase(game, n);
    const tone = n <= 2 ? 'charge' : n <= 4 ? 'engage' : 'danger';
    return { text: `적 반격 예상: ${sim.steps.join(' → ')} → ${gaugeLabel(sim.finalGauge)}에서 내 합`, tone };
  }

  function resolveBossPhase(game, n) {
    // 이전 페이즈가 걸어둔 "다음 플레이어 턴 한정" 상태 만료
    game.playerWeakenActive = false;
    game.bossVulnerableActive = false;

    if (game.isBossStunned) {
      pushLog(game, '적이 무너져 이번 페이즈에는 초식을 쓰지 못했습니다.');
      game.isBossStunned = false;
      // 기절 페이즈에도 최소 반환 보장을 적용 — 없으면 파훼 직후 합에
      // 오히려 가장 얕은 반환이 나오는 최악의 경우가 생긴다.
      game.gauge = clampReturnedGauge(game, -n);
      return;
    }

    if (game.momentumSpentThisTurn >= effectiveBreakThreshold(game)) {
      pushFx(game, 'break', {});
      game.breakCount += 1;
      if (D.BREAK_GRANTS_VULNERABLE) game.bossVulnerableActive = true;

      if (D.BREAK_BUDGET_RATIO != null) {
        // 페이즈를 지우는 대신 예산을 깎아 진행한다 — 반격이 사라지는 게
        // 아니라 작아진다.
        const reduced = Math.max(0, Math.floor(n * D.BREAK_BUDGET_RATIO));
        pushLog(game, `[파훼!] 몰아치기 ${game.momentumSpentThisTurn} — 적의 예산이 ${n} → ${reduced}으로 무너집니다.`);
        tickBossCooldowns(game);
        const cut = runBossPhaseLoop(game, reduced);
        if (game.status !== 'PLAYING') return;
        game.gauge = clampReturnedGauge(game, cut);
        pushFx(game, 'memory', { to: game.gauge });
        return;
      }

      const parts = ['적 행동 취소'];
      if (D.BREAK_STUNS_NEXT_PHASE) { game.isBossStunned = true; parts.push('1합 무너짐'); }
      if (D.BREAK_GRANTS_VULNERABLE) parts.push('다음 합 사혈 노출');
      pushLog(game, `[파훼!] 이번 합 몰아치기 ${game.momentumSpentThisTurn} — ${parts.join(', ')}.`);
      game.gauge = D.STARTING_GAUGE;
      return;
    }

    tickBossCooldowns(game);
    const finalGauge = runBossPhaseLoop(game, n);
    if (game.status !== 'PLAYING') return;
    game.gauge = clampReturnedGauge(game, finalGauge);
    if (game.gauge !== finalGauge) {
      pushLog(game, `최소 반환 보장 — ${gaugeLabel(finalGauge)} → ${gaugeLabel(game.gauge)}으로 보정.`);
    }
    pushFx(game, 'memory', { to: game.gauge });
    pushLog(game, `적 페이즈 종료 — ${gaugeLabel(game.gauge)}에서 내 합이 시작됩니다.`);
  }

  function endPlayerTurnAndResolveBoss(game, n) {
    // 검(劍) — 선을 적1로 정확히 넘겼을 때만. 시소의 "작게 넘길수록 크게
    // 돌아온다"를 극단까지 민 조건이라, 어느 색도 이 축을 쓰지 않는다.
    const precise = weaponSum(game, 'preciseLanding');
    if (precise && n === 1) {
      pushLog(game, `검(劍) — 적1로 정확히 마감. 추가 피해 ${precise}.`);
      applyDamageToBoss(game, precise);
      pushFx(game, 'playerAttack', { amount: precise, label: '검(劍)' });
      if (checkWinLose(game)) return;
    }
    // 곤(棍) — 방어도를 남긴 채 넘기면 다음 합이 한 칸 깊어진다.
    // 적 페이즈가 방어도를 깎기 전의 값으로 판정한다.
    const guard = weaponSum(game, 'guardReturn');
    game.returnBonusNextTurn = (guard && game.playerBlock > 0) ? guard : 0;
    if (game.returnBonusNextTurn > 0) {
      pushLog(game, `곤(棍) — 방어도 ${game.playerBlock}을 남겨 다음 합이 깊어집니다.`);
    }

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

    // HP를 코스트로 쓰는 카드(자)는 자기 체력으로 죽을 수 없다
    if (card.hpCost && card.hpCost >= game.playerHp) {
      pushLog(game, `[${card.name}] — 체력이 부족해 사용할 수 없습니다.`);
      return;
    }

    const effectiveCost = Math.max(0, card.cost - game.pendingCostReduction);
    game.pendingCostReduction = 0;
    game.momentumSpentThisTurn += effectiveCost;


    game.hand.splice(idx, 1);
    // 소멸(exhaust) 카드는 버린 더미로 가지 않는다 — 메모리를 순증시키는
    // 카드가 다시 섞여 들어오면 한 턴이 무한히 늘어난다.
    if (card.exhaust) pushLog(game, `[${card.name}] 소멸 — 이번 전투에서 사라집니다.`);
    else game.discardPile.push(card);

    // 패 파기 (흑) — 남은 손패를 전부 버리고 버린 장수만큼 피해를 더한다.
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
    // 연계 (적) — 이번 턴에 "이미" 사용한 카드 수만큼 가산. cardsPlayedThisTurn은
    // 이 아래에서 증가하므로 자기 자신은 세지 않는다.
    if (card.chain) {
      const bonus = card.chain * game.cardsPlayedThisTurn;
      effectiveDamage += bonus;
      if (bonus > 0) pushLog(game, `연계 ${game.cardsPlayedThisTurn}장 — 추가 피해 ${bonus}.`);
    }
    // 일격 (적 B라인) — 지금 남은 버퍼가 깊을수록 강하다. 연계가 "나중에
    // 낼수록 강함"이라면 일격은 "먼저 낼수록 강함"이라, 같은 합 안에서
    // 두 라인이 정반대 순서를 요구한다.
    if (card.deepStrike) {
      const depth = Math.max(0, -game.gauge);
      const bonus = card.deepStrike * depth;
      effectiveDamage += bonus;
      if (bonus > 0) pushLog(game, `일격 — 버퍼 아${depth}만큼 추가 피해 ${bonus}.`);
    }
    // 광기 (자 B라인) — 잃은 체력 10당 가산. 흡성(되메우기)과 정반대 방향이라
    // 두 라인이 같은 HP를 놓고 반대로 당긴다.
    if (card.rageScale) {
      const lost = Math.floor((game.playerMaxHp - game.playerHp) / 10);
      const bonus = card.rageScale * lost;
      effectiveDamage += bonus;
      if (bonus > 0) pushLog(game, `광기 — 잃은 체력만큼 추가 피해 ${bonus}.`);
    }
    // ── 신병이기 (gdd/14) ────────────────────────────────────
    // 도(刀) — 첫 초식은 크게, 이후는 무디게. 적(赤)의 연계와 정확히
    // 반대 방향이라 같은 합에서 정반대 순서를 요구한다.
    if (card.damage > 0) {
      const first = weaponSum(game, 'firstStrike');
      const after = weaponSum(game, 'afterFirstPenalty');
      if (first && game.cardsPlayedThisTurn === 0) {
        effectiveDamage += first;
        pushLog(game, `도(刀) — 첫 초식, 추가 피해 ${first}.`);
      } else if (after && game.cardsPlayedThisTurn > 0) {
        effectiveDamage -= after;
      }
      // 창(槍) — 같은 초식을 거듭 찌를수록 매워진다
      // 창(槍) — 무거운 초식일수록 매섭다. 적(赤)의 일격이 "버퍼가 깊을 때"
      // 라면 이쪽은 "무거운 초식을 낼 때"라, 얕은 버퍼에서도 성립한다.
      const heavyMin = game.weapons.reduce((m, w) => (w.heavyCost ? Math.min(m, w.heavyCost) : m), 99);
      const heavyBonus = weaponSum(game, 'heavyBonus');
      if (heavyBonus && card.cost >= heavyMin) {
        effectiveDamage += heavyBonus;
        pushLog(game, `창(槍) — 틈 ${card.cost}의 무거운 초식, 추가 피해 ${heavyBonus}.`);
      }
      // 암기(暗器) — 합이 길어질수록. 흑의 되감기가 "한 합"을 늘린다면
      // 이쪽은 "전투"를 늘린다 — 단위가 달라 겹치지 않는다.
      const att = weaponSum(game, 'attrition');
      if (att) {
        const cap = weaponSum(game, 'attritionCap');
        const bonus = Math.min(cap, att * Math.floor((game.turn - 1) / 2));
        if (bonus > 0) { effectiveDamage += bonus; }
      }
      if (effectiveDamage < 0) effectiveDamage = 0;
    }

    // 방어도 환산 (백) — 카드 자신의 방어도는 아래에서 붙으므로 포함되지 않는다.
    if (card.blockToDamage) {
      const bonus = game.playerBlock * card.blockToDamage;
      effectiveDamage += bonus;
      pushLog(game, `방어도 ${game.playerBlock} 환산 — 추가 피해 ${bonus}.`);
    }
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
      // 흡혈 (자) — 입힌 피해의 N%를 회복
      if (card.lifesteal) {
        const healed = healPlayer(game, Math.round(dealt * card.lifesteal / 100));
        if (healed > 0) pushLog(game, `흡혈 — 체력 +${healed}.`);
      }
    } else {
      pushLog(game, `[${card.name}] 사용.`);
    }
    const blockGain = (card.block || 0)
      + (card.chainBlock ? card.chainBlock * game.cardsPlayedThisTurn : 0);
    if (blockGain > 0) {
      game.playerBlock += blockGain;
      pushLog(game, `방어도 +${blockGain}.`);
    }
    if (card.heal) {
      const healed = healPlayer(game, card.heal);
      pushLog(game, `체력 +${healed}.`);
    }
    if (card.draw) {
      drawCards(game, card.draw);
      game.cardDrawsThisTurn += card.draw;
      pushLog(game, `초식을 더 뽑습니다 — 카드 ${card.draw}장.`);
    }
    if (card.counter) {
      game.counterDamage += card.counter;
      pushLog(game, `반탄 ${game.counterDamage} — 이번 적 페이즈의 매 피격마다 되돌립니다.`);
    }
    if (card.evade) {
      game.evadeCharges += card.evade;
      pushLog(game, `흘리기 ${card.evade}회 준비 (총 ${game.evadeCharges}회).`);
    }
    // 점혈 (흑 B라인) — 적의 준비된 초식 중 가장 비싼 것을 봉인한다.
    // 클로저가 작아지므로 돌아오는 버퍼도 줄어든다 — 안전을 사는 대신
    // 다음 합이 짧아지는 맞교환이다.
    if (card.sealSkill) {
      const ready = game.enemySkills
        .filter((sk) => (game.bossCooldowns[sk.key] || 0) <= 0)
        .sort((a, b) => b.cost - a.cost);
      if (ready.length > 1) {
        const target = ready[0];
        game.bossCooldowns[target.key] = Math.max(game.bossCooldowns[target.key] || 0, card.sealSkill);
        pushLog(game, `점혈 — [${target.name}]을(를) ${card.sealSkill}합간 봉인.`);
      } else {
        pushLog(game, '점혈 — 봉인할 초식이 없습니다.');
      }
    }
    // 공력 흡수 (흑) — 적이 버프로 쌓은 공격력을 깎는다
    if (card.drainPower) {
      const before = game.bossScalingPower;
      game.bossScalingPower = Math.max(0, before - card.drainPower);
      pushLog(game, before > 0
        ? `공력 흡수 — 적 공격력 ${before} → ${game.bossScalingPower}.`
        : '공력 흡수 — 적이 쌓아둔 공격력이 없습니다.');
    }
    // 몰아치기 가산 (백 B라인) — 기세를 쓰지 않고 몰아치기만 쌓는다.
    // 초식이 무거워 몰아치기가 안 쌓이던 백이 파훼를 노릴 수 있게 하는 부품.
    if (card.surge) {
      game.momentumSpentThisTurn += card.surge;
      pushLog(game, `몰아치기 +${card.surge} (총 ${game.momentumSpentThisTurn}).`);
    }
    if (card.bossWeaken) {
      game.bossWeakenActive = true;
      pushLog(game, '다음 적 공격 피해 -25%.');
    }
    if (card.breakThresholdDown) {
      // 하한은 빈틈 - 4, 최소 5 (gdd/02 2-3). 절대값으로 잡으면 빈틈이
      // 작은 적에겐 무효, 큰 적에겐 파격이 되어 같은 카드가 상대에 따라
      // 무의미하거나 압도적이 된다.
      const before = effectiveBreakThreshold(game);
      game.thresholdDownThisTurn += card.breakThresholdDown;
      const after = effectiveBreakThreshold(game);
      pushLog(game, before === after
        ? `이번 합 빈틈은 이미 하한(적${after})입니다.`
        : `이번 합 빈틈 적${before} → 적${after}.`);
    }

    // 태그형 효과
    if (card.effect === 'REDUCE_NEXT_COST') {
      game.pendingCostReduction = 1;
      pushLog(game, '다음 초식의 틈 -1.');
    } else if (card.effect === 'DOUBLE_NEXT_ATTACK') {
      game.pendingDamageMultiplier = 2;
      pushLog(game, '다음 공격 초식 피해 2배.');
    } else if (card.effect === 'PERSISTENT_DAMAGE_BOOST') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'DAMAGE_BOOST' });
      pushLog(game, `[${p.name}] 운용 — ${p.turns}합간 공격 피해 +${p.amount}.`);
    } else if (card.effect === 'PERSISTENT_BLOCK_ON_TURN_START') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'BLOCK_ON_TURN_START' });
      pushLog(game, `[${p.name}] 운용 — 다음 합부터 ${p.turns}합간 방어도 +${p.amount}.`);
    } else if (card.effect === 'PERSISTENT_BOSS_VULNERABLE') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'BOSS_VULNERABLE_AURA' });
      pushLog(game, `[${p.name}] 운용 — ${p.turns}합간 적 받는 피해 +${p.amount}%.`);
    } else if (card.effect === 'PERSISTENT_HEAL_ON_TURN_START') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'HEAL_ON_TURN_START' });
      pushLog(game, `[${p.name}] 운용 — 다음 합부터 ${p.turns}합간 체력 +${p.amount}.`);
    }

    // 콤보 드로우 (gdd/07 7-3)
    game.cardsPlayedThisTurn += 1;
    game.comboCounter += 1;
    if (game.comboCounter >= D.COMBO_THRESHOLD) {
      game.comboCounter -= D.COMBO_THRESHOLD;
      if (game.bossHp > 0) {
        drawCards(game, 1);
        game.comboBonusDrawsThisTurn += 1;
        pushLog(game, '연환! 카드 1장 추가 드로우.');
      }
    }

    if (checkWinLose(game)) return;

    // 비용은 오른쪽(+), 되감기는 왼쪽(-) — 합산 결과로 턴 종료를 판정
    const rawGauge = game.gauge + effectiveCost - (card.rewind || 0);
    if (rawGauge > 0) {
      const n = Math.min(rawGauge, D.GAUGE_MAX);
      game.gauge = n;
      pushFx(game, 'memory', { to: n });
      pushLog(game, `기세가 ${gaugeLabel(n)}(으)로 넘어가 선이 적에게 넘어갑니다.`);
      endPlayerTurnAndResolveBoss(game, n);
    } else {
      game.gauge = Math.max(rawGauge, D.GAUGE_MIN);
      pushFx(game, 'memory', { to: game.gauge });
    }
  }

  // "드로우" 액션 — 기세를 카드로 환전하는 공통 행동 (gdd/07 7-1).
  // 비용 2짜리 카드를 낸 것과 동일하게 처리되므로, 게이지가 0을 넘으면
  // 그대로 턴이 끝난다. 별도의 "패스"는 없다 — 턴을 넘기려면 반드시
  // 기세를 밀어야 하고, 그 대가로 항상 카드를 받는다.
  function drawAction(game) {
    if (game.status !== 'PLAYING') return;
    const before = game.gauge;
    const pushedGauge = game.gauge + D.DRAW_ACTION_COST;
    const handBefore = game.hand.length;
    drawCards(game, D.DRAW_ACTION_CARDS);
    const drawn = game.hand.length - handBefore;
    pushLog(game, drawn > 0
      ? `숨 고르기 — 기세 ${D.DRAW_ACTION_COST} 소모 (${gaugeLabel(before)} → ${gaugeLabel(Math.min(pushedGauge, D.GAUGE_MAX))}), 카드 ${drawn}장.`
      : `숨 고르기 — 뽑을 카드가 없어 기세 ${D.DRAW_ACTION_COST}만 소모했습니다.`);

    if (pushedGauge > 0) {
      const n = Math.min(pushedGauge, D.GAUGE_MAX);
      game.gauge = n;
      pushFx(game, 'memory', { to: n });
      endPlayerTurnAndResolveBoss(game, n);
    } else {
      // 0을 넘지 않았으면 턴은 계속된다 — 카드를 낸 것과 완전히 동일하다.
      // (구 "패스"는 여기서 턴을 넘겼지만, 드로우는 턴 종료 행동이 아니다.)
      game.gauge = pushedGauge;
      pushFx(game, 'memory', { to: game.gauge });
    }
  }

  return { createGame, playCard, drawAction, previewIntent, gaugeLabel, buildDeck,
    effectiveBreakThreshold };
})();
