// 밸런스 시뮬레이션 하네스 (개발용) — 게임에서는 로드하지 않는다.
// 사용법: 브라우저 콘솔에서
//   fetch('sim.js').then(r=>r.text()).then(eval);
//   ['RED','BLUE','BLACK','YELLOW'].map(c => TS_Sim.run(c, 40));
// 간단한 탐욕 AI로 런을 자동 플레이해 클리어율·평균 도달 스테이지·
// 턴당 카드 사용 수·사망 스테이지 분포를 집계한다.
window.TS_Sim = (() => {
  const E = TS_Engine, R = TS_Run;
  const cost = (g, c) => Math.max(0, c.cost - g.pendingCostReduction);

  // 카드 1장의 즉시 가치를 코스트로 나눈 효율 점수
  function score(g, c) {
    let v = c.damage || 0;
    if (c.chain) v += c.chain * g.cardsPlayedThisTurn;
    if (c.chainBlock) v += c.chainBlock * g.cardsPlayedThisTurn * 0.6;
    if (c.blockToDamage) v += g.playerBlock * c.blockToDamage;
    if (c.discardAll) v += c.discardAll * (g.hand.length - 1);
    // 방어도/회복을 피해의 0.6배로 보던 초기 가중치는 방어형 컬러를 구조적으로
    // 과소평가했다. 실측상 백(피해 절반, 도달 9.8)이 증명하듯 경감은 피해와
    // 거의 동등한 가치라, 1.0으로 맞춰야 컬러 비교가 공정해진다.
    v += (c.block || 0) * 1.0 + (c.heal || 0) * 1.0 + (c.draw || 0) * 4 + (c.counter || 0) * 0.8;
    if (c.lifesteal) v += (c.damage || 0) * c.lifesteal / 100;
    if (c.evade) v += c.evade * 7; // 일격 하나를 통째로 넘기는 값어치
    if (c.effect) v += 4;
    if (c.rewind) v += c.rewind * 3;
    if (c.bossWeaken) v += 3;
    if (c.breakThresholdDown) v += 5;
    v -= (c.hpCost || 0) * 0.8;
    return v / Math.max(0.5, cost(g, c));
  }

  const usable = (g, c) => !(c.hpCost && c.hpCost >= g.playerHp);

  function autoTurn(g, stat) {
    const t = g.turn;
    let guard = 0;
    stat.turns++;
    while (g.status === 'PLAYING' && g.turn === t && guard++ < 40) {
      // 1) 턴을 끝내지 않고 낼 수 있는 카드 중 효율 최고
      const playable = g.hand.filter((c) => usable(g, c) && g.gauge + cost(g, c) - (c.rewind || 0) <= 0);
      if (playable.length) {
        playable.sort((a, b) => score(g, b) - score(g, a));
        stat.plays++;
        E.playCard(g, playable[0].uid);
        continue;
      }
      // 2) 합을 끝내야 한다. 무엇으로 끝내느냐가 다음 합을 정한다.
      //    - 파훼(적max 도달)에 닿는 초식이 있으면 그게 거의 항상 최선이다:
      //      적의 페이즈가 통째로 지워지고 다음 합에 사혈 노출까지 붙는다.
      //    - 아니면 가장 크게 때리는 초식. 그것도 시원찮으면 기세를 카드로 환전.
      let best = null, bv = -1, bestBreaks = false;
      g.hand.filter((c) => usable(g, c)).forEach((c) => {
        const land = g.gauge + Math.max(0, cost(g, c) - g.pendingCostReduction * 0) - (c.rewind || 0);
        const breaks = land >= g.breakThreshold;
        let v = (c.damage || 0)
          + (c.chain ? c.chain * g.cardsPlayedThisTurn : 0)
          + (c.discardAll ? c.discardAll * (g.hand.length - 1) : 0)
          + (c.blockToDamage ? g.playerBlock * c.blockToDamage : 0);
        if (breaks) v += 40; // 페이즈 한 번을 통째로 지우는 값어치
        if (v > bv) { bv = v; best = c; bestBreaks = breaks; }
      });
      if (best && (bestBreaks || bv >= 8)) { stat.plays++; E.playCard(g, best.uid); }
      else { stat.draws++; E.drawAction(g); }
    }
  }

  function run(color, runs) {
    const stat = { plays: 0, draws: 0, turns: 0, dist: {} };
    let clears = 0, sum = 0;
    for (let i = 0; i < runs; i++) {
      R.newRun(); R.chooseDeck(color);
      let guard = 0;
      while (guard++ < 4000) {
        const st = R.get();
        if (st.phase === 'RUN_WON' || st.phase === 'RUN_LOST') break;
        if (st.phase === 'BATTLE') {
          if (st.game.status !== 'PLAYING') { R.syncBattleResult(); continue; }
          autoTurn(st.game, stat);
          R.syncBattleResult();
        } else if (st.phase === 'REWARD') {
          const o = st.rewardOptions.slice().sort((a, b) => score(st.game, b) - score(st.game, a));
          if (o.length) R.takeCard(o[0]); else R.skipReward();
        } else break;
      }
      const st = R.get();
      if (st.phase === 'RUN_WON') { clears++; sum += 10; }
      else { sum += st.stage; stat.dist[st.stage] = (stat.dist[st.stage] || 0) + 1; }
    }
    return {
      color,
      clear: (clears / runs * 100).toFixed(0) + '%',
      avg: (sum / runs).toFixed(1),
      cardsPerTurn: (stat.plays / stat.turns).toFixed(2),
      drawActPerTurn: (stat.draws / stat.turns).toFixed(2),
      deathAt: stat.dist,
    };
  }

  return { run, score };
})();
