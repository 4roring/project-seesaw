// 게임 규칙 엔진 — gdd/01~05 문서의 확정 규칙을 구현
// 문서에 수치가 명시되지 않은 부분(플레이어 HP, 약화/취약 배율, 패스 버튼 등)은
// web-demo/README.md에 "구현 가정"으로 정리해 두었습니다.

const TS_Engine = (() => {
  const D = TS_DATA;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildDeck() {
    const deck = [];
    let uid = 0;
    D.CARD_DEFS.forEach((def) => {
      for (let i = 0; i < def.count; i++) {
        deck.push({ ...def, uid: `${def.key}-${uid++}` });
      }
    });
    return shuffle(deck);
  }

  function createGame() {
    const game = {
      turn: 1,
      gauge: D.STARTING_GAUGE,
      status: 'PLAYING', // PLAYING | WON | LOST

      playerHp: D.STARTING_PLAYER_HP,
      playerMaxHp: D.STARTING_PLAYER_HP,
      playerBlock: 0,

      bossHp: D.STARTING_BOSS_HP,
      bossMaxHp: D.STARTING_BOSS_HP,
      bossBlock: 0,
      bossScalingPower: 0,
      isBossStunned: false,

      // 보스 기술 쿨다운 — gdd/08-boss-skill-loop.md
      bossCooldowns: Object.fromEntries(D.BOSS_SKILLS.map((s) => [s.key, 0])),

      // "1 턴" 지속형 상태 — 정확히 다음 플레이어 턴 동안만 유효
      playerWeakenActive: false, // 내 카드 피해 -25%
      bossVulnerableActive: false, // 보스가 받는 피해 +50%
      // "다음 피격 1회" 소모형 상태
      playerVulnerableActive: false, // 보스 공격 피해 +50%, 다음 피격 1회에 소모

      pendingCostReduction: 0,
      pendingDamageMultiplier: 1,

      // 테이머/옵션형 지속 효과 — gdd/06-persistent-effects.md
      activeEffects: [],

      // 턴 이코노미 — gdd/07-turn-economy-revision.md
      cardsPlayedThisTurn: 0,
      comboCounter: 0,
      comboBonusDrawsThisTurn: 0,

      drawPile: buildDeck(),
      hand: [],
      discardPile: [],

      log: [],
    };
    drawCards(game, D.HAND_SIZE);
    pushLog(game, `전투 시작 — 게이지 P${-D.STARTING_GAUGE} 위치에서 시작합니다.`);
    return game;
  }

  function pushLog(game, message) {
    game.log.push(message);
  }

  function drawCards(game, n) {
    for (let i = 0; i < n; i++) {
      if (game.drawPile.length === 0) {
        if (game.discardPile.length === 0) return; // 더 뽑을 카드 없음
        game.drawPile = shuffle(game.discardPile);
        game.discardPile = [];
        pushLog(game, '버린 더미를 섞어 뽑을 더미를 채웠습니다.');
      }
      game.hand.push(game.drawPile.pop());
    }
  }

  function startPlayerTurn(game) {
    // 직전 턴에 실제로 사용한 카드 수 - 그 턴에 콤보로 추가 드로우한 카드 수만큼
    // 보충 드로우 (핸드는 유지, 버리지 않음) — 콤보 드로우는 "당겨쓰기"이지
    // 손패 총량을 늘리는 효과가 아니므로 리필량에서 빼야 한다.
    // gdd/07-turn-economy-revision.md 6-2
    const refillCount = Math.max(0, game.cardsPlayedThisTurn - game.comboBonusDrawsThisTurn);
    game.playerBlock = 0;
    // pendingCostReduction/pendingDamageMultiplier는 여기서 리셋하지 않는다 —
    // "다음 카드 한 장" 보너스는 턴이 바뀌어도 유지되고 실제로 카드에
    // 소비될 때까지 남아있는다 (gdd/06-persistent-effects.md 5-5-1)
    game.cardsPlayedThisTurn = 0;
    game.comboCounter = 0;
    game.comboBonusDrawsThisTurn = 0;
    tickActiveEffects(game);
    drawCards(game, refillCount);
    pushLog(game, `--- 턴 ${game.turn} 시작 (게이지 위치: ${gaugeLabel(game.gauge)}) ---`);
  }

  // 지속 효과 id로 찾아 있으면 수치 합산 + 지속시간 갱신, 없으면 새로 추가
  // (gdd/06-persistent-effects.md 5-2)
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
    return game.activeEffects
      .filter((e) => e.kind === kind)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  // 턴 시작 트리거형 효과 발동 → 모든 지속 효과 잔여 턴 감소 → 만료 제거
  function tickActiveEffects(game) {
    game.activeEffects.forEach((e) => {
      if (e.kind === 'BLOCK_ON_TURN_START' && e.turnsRemaining > 0) {
        game.playerBlock += e.amount;
        pushLog(game, `[${e.name}] 발동 — 방어도 +${e.amount}.`);
      }
    });
    game.activeEffects.forEach((e) => { e.turnsRemaining -= 1; });
    game.activeEffects
      .filter((e) => e.turnsRemaining <= 0)
      .forEach((e) => pushLog(game, `[${e.name}] 효과가 만료되었습니다.`));
    game.activeEffects = game.activeEffects.filter((e) => e.turnsRemaining > 0);
  }

  function gaugeLabel(g) {
    if (g === 0) return '중립(0)';
    return g < 0 ? `P${-g}` : `E${g}`;
  }

  function checkWinLose(game) {
    if (game.status !== 'PLAYING') return true; // 이미 승패가 갈린 뒤 중복 판정 방지
    if (game.bossHp <= 0) {
      game.bossHp = 0;
      game.status = 'WON';
      pushLog(game, '보스 체력이 0이 되었습니다. 승리!');
      return true;
    }
    if (game.playerHp <= 0) {
      game.playerHp = 0;
      game.status = 'LOST';
      pushLog(game, '플레이어 체력이 0이 되었습니다. 패배...');
      return true;
    }
    return false;
  }

  function applyDamageToBoss(game, rawDamage) {
    let dmg = rawDamage;
    // BREAK 취약(+50%)과 균열탄류 아우라(+N%)는 한 번에 가산 후 곱연산
    // (gdd/06-persistent-effects.md 5-3)
    const bonusPct = (game.bossVulnerableActive ? 50 : 0) + sumEffectAmount(game, 'BOSS_VULNERABLE_AURA');
    if (bonusPct > 0) dmg = Math.round(dmg * (1 + bonusPct / 100));
    const absorbed = Math.min(game.bossBlock, dmg);
    game.bossBlock -= absorbed;
    game.bossHp -= dmg - absorbed;
  }

  function applyDamageToPlayer(game, rawDamage) {
    let dmg = rawDamage;
    if (game.playerVulnerableActive) {
      dmg = Math.round(dmg * 1.5);
      game.playerVulnerableActive = false; // 다음 피격 1회 소모
    }
    const absorbed = Math.min(game.playerBlock, dmg);
    game.playerBlock -= absorbed;
    game.playerHp -= dmg - absorbed;
    return dmg;
  }

  // 기술의 실제 비용 — 같은 기술을 연속으로 쓴 횟수만큼 올라간다(최소 1).
  // (gdd/08-boss-skill-loop.md 8-4-2)
  function effectiveSkillCost(skill, streak) {
    const streakBonus = streak.lastKey === skill.key ? streak.count : 0;
    return Math.max(1, skill.cost + streakBonus);
  }

  // 두 갈래로 고른다 (gdd/08-boss-skill-loop.md 8-4):
  //  1) 오프너 — 쿨다운 0이면서 비용이 현재 게이지 이하인(예산 안에 드는)
  //     기술 중 우선순위 최고. 이 분기는 gauge - cost >= 0 이라 페이즈를
  //     끝내지 못한다.
  //  2) 클로저 — 예산 안에 드는 게 하나도 없을 때. 이때는 가장 "비싼"
  //     기술을 골라 게이지를 크게 밀어낸다. 페이즈를 끝내는 것은 항상 이
  //     분기이므로, 여기서 무엇을 고르냐가 플레이어에게 돌아가는 메모리
  //     양을 결정한다 — 작게 넘길수록 큰 기술이 남아 있어 크게 돌려준다.
  function pickBossSkill(cooldowns, streak, gauge) {
    const ready = D.BOSS_SKILLS.filter((s) => (cooldowns[s.key] || 0) <= 0);
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

    // 연속 사용 카운트 갱신 (gdd/08-boss-skill-loop.md 8-4-2)
    if (streak.lastKey === chosen.skill.key) {
      streak.count += 1;
    } else {
      streak.lastKey = chosen.skill.key;
      streak.count = 1;
    }

    return chosen;
  }

  // 보스 페이즈가 끝난 뒤의 최종 게이지 — 최소 반환 보장(P3)과 범위 하한을
  // 함께 적용한다. (gdd/08-boss-skill-loop.md 8-4-3)
  function clampReturnedGauge(finalGauge) {
    return Math.max(Math.min(finalGauge, -D.MIN_MEMORY_RETURN), D.GAUGE_MIN);
  }

  // 매 보스 페이즈 시작 시 1회, 남은 쿨다운을 전부 1씩 감소 (0 미만 방지)
  function tickBossCooldowns(game) {
    Object.keys(game.bossCooldowns).forEach((k) => {
      if (game.bossCooldowns[k] > 0) game.bossCooldowns[k] -= 1;
    });
  }

  // 기술 하나의 효과를 실제로 적용 (상태 변경 + 로그). cost는 연속 사용
  // 가산이 반영된 실제 비용 — 로그에 "얼마를 넘겼는지" 보여주기 위함.
  function applyBossSkillEffect(game, skill, cost) {
    if (skill.kind === 'BUFF') {
      game.bossScalingPower += skill.powerGain;
      game.bossBlock += skill.blockGain;
      pushLog(game, `[${skill.name}](비용 ${cost}) 사용 — 공격력 +${skill.powerGain}, 방어도 +${skill.blockGain}.`);
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
    pushLog(game, `[${skill.name}](비용 ${cost}) 사용 — ${dmg} 피해.${extra}`);
  }

  // 보스 기술 루프: 게이지가 0 이상인 동안 기술을 반복 사용, 음수가 되면 종료.
  // 플레이어 턴이 "0 초과"에서 끝나는 것과 대칭 (gdd/08-boss-skill-loop.md 7-1)
  function runBossPhaseLoop(game, startGauge) {
    let gauge = startGauge;
    let guard = 0;
    const streak = { lastKey: null, count: 0 }; // 페이즈 로컬 — 페이즈가 끝나면 자연히 사라짐
    while (gauge >= 0 && guard < 50) {
      guard++;
      const { skill, cost } = pickBossSkill(game.bossCooldowns, streak, gauge);
      gauge -= cost;
      applyBossSkillEffect(game, skill, cost);
      if (skill.cooldown > 0) game.bossCooldowns[skill.key] = skill.cooldown;
      if (checkWinLose(game)) break;
    }
    return gauge;
  }

  // 부작용 없는 미리보기용 시뮬레이션 — 실제 상태(쿨다운/공격력)를 복사해서 굴린다.
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
      const { skill, cost } = pickBossSkill(cooldowns, streak, gauge);
      gauge -= cost;
      if (skill.kind === 'BUFF') {
        scaling += skill.powerGain;
        steps.push(`${skill.name}(비용${cost}, 버프)`);
      } else {
        steps.push(`${skill.name}(비용${cost}, ${skill.damage + scaling}dmg)`);
      }
      if (skill.cooldown > 0) cooldowns[skill.key] = skill.cooldown;
    }
    // 실제 페이즈 종료와 동일한 보정을 적용해야 미리보기와 결과가 일치한다
    return { steps, finalGauge: clampReturnedGauge(gauge) };
  }

  // 순수 함수: 현재 게이지 위치(n)에서 턴이 끝난다면 어떤 일이 벌어질지 미리보기
  // (실제 상태를 바꾸지 않음 — UI의 실시간 인텐트 표시용, gdd 04 문서 4단계)
  function previewIntent(game) {
    if (game.gauge <= 0) {
      return { text: '안전 — 아직 플레이어 턴이 종료되지 않습니다.', tone: 'safe' };
    }
    const n = Math.min(game.gauge, D.GAUGE_MAX);
    if (game.isBossStunned) {
      return { text: `E${n} 도달 시 보스는 기절 상태라 행동하지 못합니다. (게이지 ${gaugeLabel(-n)}로 이동)`, tone: 'stunned' };
    }
    if (n >= D.BREAK_THRESHOLD) {
      const auraPct = sumEffectAmount(game, 'BOSS_VULNERABLE_AURA');
      const totalPct = 50 + auraPct;
      return { text: `BREAK! 패턴 무효화 + 보스 기절 + 다음 턴 보스 취약(+${totalPct}% 피해${auraPct > 0 ? ` = 기본 50% + 아우라 ${auraPct}%` : ''})`, tone: 'break' };
    }
    const sim = simulateBossPhase(game, n);
    const tone = n <= 2 ? 'charge' : n <= 4 ? 'engage' : 'danger';
    return { text: `보스 반격 예상: ${sim.steps.join(' → ')} → ${gaugeLabel(sim.finalGauge)}에서 내 턴 시작`, tone };
  }

  function resolveBossPhase(game, n) {
    // 이전 보스 페이즈가 걸어둔 "다음 플레이어 턴 한정" 상태 만료
    game.playerWeakenActive = false;
    game.bossVulnerableActive = false;

    if (game.isBossStunned) {
      pushLog(game, `보스가 기절 상태라 이번 페이즈에는 기술을 하나도 쓰지 못했습니다.`);
      game.isBossStunned = false;
      // 기절 페이즈에도 최소 반환 보장을 적용한다 — 없으면 BREAK 직후
      // 기절 턴에 오히려 가장 얕은 P1이 돌아오는 최악의 경우가 생긴다.
      game.gauge = clampReturnedGauge(-n);
      return;
    }

    if (n >= D.BREAK_THRESHOLD) {
      pushLog(game, `[BREAK!] E${n} 도달 — 보스 패턴 무효화, 1턴 기절, 다음 내 턴 보스 취약(+50%) 부여.`);
      game.isBossStunned = true;
      game.bossVulnerableActive = true;
      game.gauge = D.STARTING_GAUGE; // BREAK는 항상 P3로 복귀 (gdd 04 문서)
      return;
    }

    // 보스 기술 루프 — 게이지가 음수가 될 때까지 기술을 반복 사용 (gdd/08-boss-skill-loop.md)
    tickBossCooldowns(game);
    const finalGauge = runBossPhaseLoop(game, n);
    if (game.status !== 'PLAYING') return; // 루프 도중 플레이어가 쓰러진 경우
    game.gauge = clampReturnedGauge(finalGauge);
    if (game.gauge !== finalGauge) {
      pushLog(game, `최소 반환 보장 — 게이지가 ${gaugeLabel(finalGauge)}에서 ${gaugeLabel(game.gauge)}(으)로 보정됩니다.`);
    }
    pushLog(game, `보스 페이즈 종료 — 게이지 ${gaugeLabel(game.gauge)}에서 플레이어 턴이 시작됩니다.`);
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

    const effectiveCost = Math.max(0, card.cost - game.pendingCostReduction);
    game.pendingCostReduction = 0;

    let effectiveDamage = card.damage;
    if (effectiveDamage > 0) {
      effectiveDamage *= game.pendingDamageMultiplier;
      game.pendingDamageMultiplier = 1;
      effectiveDamage += sumEffectAmount(game, 'DAMAGE_BOOST');
      if (game.playerWeakenActive) effectiveDamage = Math.round(effectiveDamage * 0.75);
    }

    game.hand.splice(idx, 1);
    game.discardPile.push(card);

    if (effectiveDamage > 0) {
      applyDamageToBoss(game, effectiveDamage);
      pushLog(game, `[${card.name}] 사용 — 보스에게 ${effectiveDamage} 피해.`);
    } else {
      pushLog(game, `[${card.name}] 사용.`);
    }
    if (card.block > 0) {
      game.playerBlock += card.block;
      pushLog(game, `방어도 +${card.block}.`);
    }
    if (card.effect === 'REDUCE_NEXT_COST') {
      game.pendingCostReduction = 1;
      pushLog(game, '다음 카드의 비용이 1 감소합니다.');
    } else if (card.effect === 'DOUBLE_NEXT_ATTACK') {
      game.pendingDamageMultiplier = 2;
      pushLog(game, '다음 공격 카드의 피해량이 2배가 됩니다.');
    } else if (card.effect === 'PERSISTENT_DAMAGE_BOOST') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'DAMAGE_BOOST' });
      pushLog(game, `[${p.name}] 설치 — ${p.turns}턴간 공격 카드 피해 +${p.amount}.`);
    } else if (card.effect === 'PERSISTENT_BLOCK_ON_TURN_START') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'BLOCK_ON_TURN_START' });
      pushLog(game, `[${p.name}] 설치 — 다음 턴부터 ${p.turns}턴간 턴 시작 시 방어도 +${p.amount}.`);
    } else if (card.effect === 'PERSISTENT_BOSS_VULNERABLE') {
      const p = card.persistentPayload;
      addOrRefreshEffect(game, { ...p, kind: 'BOSS_VULNERABLE_AURA' });
      pushLog(game, `[${p.name}] 설치 — ${p.turns}턴간 보스가 받는 피해 +${p.amount}%.`);
    }

    // 콤보 드로우 — gdd/07-turn-economy-revision.md 6-3
    game.cardsPlayedThisTurn += 1;
    game.comboCounter += 1;
    if (game.comboCounter >= D.COMBO_THRESHOLD) {
      game.comboCounter -= D.COMBO_THRESHOLD;
      if (game.bossHp > 0) {
        drawCards(game, 1);
        game.comboBonusDrawsThisTurn += 1;
        pushLog(game, '콤보 발동! 카드 1장을 추가로 뽑습니다.');
      }
    }

    if (checkWinLose(game)) return;

    const rawGauge = game.gauge + effectiveCost;
    if (rawGauge > 0) {
      const n = Math.min(rawGauge, D.GAUGE_MAX);
      game.gauge = n;
      pushLog(game, `게이지가 ${gaugeLabel(n)}(으)로 넘어가 턴이 종료됩니다.`);
      endPlayerTurnAndResolveBoss(game, n);
    } else {
      game.gauge = rawGauge;
    }
  }

  // 게이지를 넘기지 않고 스스로 턴을 마치는 "패스"
  // 메모리 리스크: 패스하면 게이지가 보스 쪽으로 3칸 상납된다.
  // 그 직후 보상으로 카드 1장을 드로우한다 — 손패가 적을 때 완전히
  // 무력해지지 않도록 하는 보정. (gdd/07-turn-economy-revision.md 6-1)
  function passTurn(game) {
    if (game.status !== 'PLAYING') return;
    const before = game.gauge;
    const pushedGauge = game.gauge + D.PASS_MEMORY_PENALTY;
    pushLog(game, `플레이어가 패스 — 보스에게 메모리 ${D.PASS_MEMORY_PENALTY}을 상납합니다. (게이지 ${gaugeLabel(before)} → ${gaugeLabel(Math.min(pushedGauge, D.GAUGE_MAX))})`);
    drawCards(game, D.PASS_BONUS_DRAW);
    pushLog(game, `패스 보상으로 카드 ${D.PASS_BONUS_DRAW}장을 뽑습니다.`);

    if (pushedGauge > 0) {
      const n = Math.min(pushedGauge, D.GAUGE_MAX);
      game.gauge = n;
      pushLog(game, `게이지가 ${gaugeLabel(n)}(으)로 넘어가 보스 패턴이 발동합니다.`);
      endPlayerTurnAndResolveBoss(game, n);
    } else {
      game.gauge = pushedGauge;
      game.turn += 1;
      startPlayerTurn(game);
    }
  }

  return {
    createGame,
    playCard,
    passTurn,
    previewIntent,
    gaugeLabel,
  };
})();
