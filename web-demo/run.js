// 런 진행 — 스테이지 1~10, 덱 성장(10→20장), 스테이지 간 회복
// gdd/09-run-structure.md
const TS_Run = (() => {
  const D = TS_DATA;

  const state = {
    phase: 'SELECT', // SELECT | BATTLE | REWARD | RUN_WON | RUN_LOST
    color: null,
    deck: [],        // 카드 정의 배열 (1개 = 실제 카드 1장)
    stage: 1,
    playerHp: D.STARTING_PLAYER_HP,
    playerMaxHp: D.STARTING_PLAYER_HP,
    game: null,      // 현재 전투 상태
    rewardOptions: [],
    lastHeal: 0,
  };

  function get() { return state; }

  function newRun() {
    state.phase = 'SELECT';
    state.color = null;
    state.deck = [];
    state.stage = 1;
    state.playerHp = D.STARTING_PLAYER_HP;
    state.playerMaxHp = D.STARTING_PLAYER_HP;
    state.game = null;
    state.rewardOptions = [];
    state.lastHeal = 0;
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
    startBattle();
  }

  function currentEnemy() { return D.ENEMIES[state.stage - 1]; }

  function startBattle() {
    state.game = TS_Engine.createGame({
      enemy: currentEnemy(),
      deck: state.deck,
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      handCap: (D.COLORS[state.color] || {}).handCap,
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
    if (g.status === 'WON') {
      state.playerHp = g.playerHp; // 전투 종료 시점 체력을 이어받음
      if (state.stage >= D.ENEMIES.length) {
        state.phase = 'RUN_WON';
      } else {
        state.rewardOptions = rollRewards();
        state.phase = 'REWARD';
      }
    }
  }

  // 방금 클리어한 스테이지 기준 티어 (gdd/09 9-3).
  // 보상은 "다음 스테이지에서 쓸 카드"이므로 한 칸 앞당겨 준다 — 스테이지 4~7을
  // 티어2로, 8~10을 티어3으로 싸우려면 3·7 클리어 시점에 그 티어가 열려야 한다.
  // (앞당기기 전에는 티어3 없이 스테이지 8을 맞아 사망이 몰렸다.)
  function tierForClearedStage(stage) {
    if (stage <= 2) return 1;
    if (stage <= 6) return 2;
    return 3;
  }

  function poolForTier(tier) {
    const pools = D.REWARD_POOLS[state.color] || {};
    // unique 카드는 시작 덱의 1장이 전부 — 보상으로 복사본이 나오면 안 된다
    const starter = expandStarter(state.color).filter((c) => !c.unique).map((c) => ({ ...c }));
    if (tier === 1) return [...(pools[1] || []), ...starter];
    if (tier === 2) return [...(pools[2] || []), ...(pools[1] || []), ...starter];
    return [...(pools[3] || []), ...(pools[2] || [])];
  }

  function rollRewards() {
    const pool = poolForTier(tierForClearedStage(state.stage));
    // key 기준 중복 제거 후 무작위 3장
    const uniq = [];
    const seen = new Set();
    pool.forEach((c) => { if (!seen.has(c.key)) { seen.add(c.key); uniq.push(c); } });
    for (let i = uniq.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
    }
    return uniq.slice(0, D.REWARD_CHOICES).map((c) => { const x = { ...c }; delete x.count; return x; });
  }

  // 강화 가능한 카드(강화표에 있고 아직 강화 안 된 것)의 덱 내 인덱스 목록
  function upgradableIndexes() {
    return state.deck
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.upgraded && D.UPGRADES[c.key])
      .map(({ i }) => i);
  }

  function applyUpgrade(index) {
    const card = state.deck[index];
    const patch = D.UPGRADES[card.key];
    if (!card || card.upgraded || !patch) return false;
    state.deck[index] = { ...card, ...patch, upgraded: true, name: `${card.name}+`, desc: describeUpgrade(card, patch) };
    afterReward();
    return true;
  }

  function describeUpgrade(card, patch) {
    const parts = [];
    if (patch.damage) parts.push(`피해 ${patch.damage}`);
    if (patch.block) parts.push(`방어도 ${patch.block}`);
    if (patch.heal) parts.push(`회복 ${patch.heal}`);
    if (patch.draw) parts.push(`드로우 ${patch.draw}`);
    if (patch.rewind) parts.push(`되감기 ${patch.rewind}`);
    if (patch.counter) parts.push(`반격 ${patch.counter}`);
    if (patch.breakThresholdDown) parts.push(`파훼 임계점 -${patch.breakThresholdDown}`);
    if (patch.chain) parts.push(`연계 피해 ${patch.chain}`);
    if (patch.chainBlock) parts.push(`연계 방어도 ${patch.chainBlock}`);
    if (patch.lifesteal) parts.push(`흡혈 ${patch.lifesteal}%`);
    return parts.length ? `${parts.join(', ')} (강화)` : `${card.desc} (강화)`;
  }

  function takeCard(option) {
    state.deck.push({ ...option });
    afterReward();
  }

  function skipReward() { afterReward(); }

  // 보상 선택 후: 회복 → 다음 스테이지 전투 시작
  function afterReward() {
    const missing = state.playerMaxHp - state.playerHp;
    state.lastHeal = Math.floor(missing * D.STAGE_HEAL_RATIO);
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + state.lastHeal);
    state.stage += 1;
    startBattle();
  }

  return {
    get, newRun, chooseDeck, startBattle, syncBattleResult,
    takeCard, skipReward, applyUpgrade, upgradableIndexes, currentEnemy,
  };
})();
