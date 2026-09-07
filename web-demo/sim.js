// 밸런스 시뮬레이션 하네스 (개발용) — 게임에서는 로드하지 않는다.
// 사용법: 브라우저 콘솔에서
//   fetch('sim.js').then(r=>r.text()).then(eval);
//   ['RED','BLUE','BLACK','YELLOW'].map(c => TS_Sim.run(c, 40));
//   TS_Sim.run(c, 40, { planned: true })   // 계획형 정책
//   TS_Sim.run(c, 40, { casual: true })    // 초심자 정책
//
// 정책 3단계 — 이 폭이 곧 "실력에 따른 난이도 밴드"다.
//   casual  : 큰 피해만 보고 낸다. 기세를 아껴 쓰지 않고, 파훼를 노리지
//             않으며, 방어/회복/드로우의 값을 모른다. 보상도 아무거나 고른다.
//   greedy  : 효율(가치/틈)로 고르고 기세를 정확히 맞춰 쓴다. 파훼가 닿으면
//             노린다. 이미 상당한 수준의 플레이라 "하한"이 아니다.
//   planned : greedy + 타이밍 판단(패 파기는 손패가 쌓인 뒤, 연계는 나중에).
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

  // ⚠️ 이 정책의 알려진 편향: 기세를 딱 맞춰 아껴 쓰느라 몰아치기가 안 쌓여
  // 파훼를 거의 못 낸다 (백 기준 파훼율 10%, 아무거나 지르는 초심자 정책은
  // 31%). "효율적으로 쓰기"와 "파훼 노리기"가 반대 방향이라 생기는 일이고,
  // 그래서 백은 초심자 정책이 탐욕 정책보다 잘한다(80% vs 25%).
  // 파훼를 합 단위로 계획하는 정책을 만들어 보정해야 정확한 수치가 나온다.

  // 계획형 정책이 추가로 지키는 규칙. "생각을 많이 하면 얼마나 좋아지는가"를
  // 재기 위한 것이라, 사람이 실제로 할 법한 판단만 넣는다.
  //   1) 패 파기는 손패가 충분히 쌓였을 때만 (블루의 핵심 타이밍)
  //   2) 연계 초식은 앞에 몇 장 깔린 뒤에 (레드의 핵심 순서)
  //   3) 흘리기는 이미 남아 있으면 겹쳐 쓰지 않는다
  function planHolds(g, c) {
    if (c.discardAll && g.hand.length - 1 < 4) return true;
    if ((c.chain || c.chainBlock) && g.cardsPlayedThisTurn < 2) return true;
    if (c.evade && g.evadeCharges > 0) return true;
    return false;
  }

  // 초심자 점수 — 피해만 본다. 방어도·회복·드로우·유틸의 값을 모르고,
  // 틈 대비 효율도 따지지 않는다.
  function casualScore(g, c) {
    let v = c.damage || 0;
    if (c.chain) v += c.chain * g.cardsPlayedThisTurn;
    if (c.discardAll) v += c.discardAll * (g.hand.length - 1);
    return v;
  }

  function autoTurn(g, stat, planned, casual) {
    const t = g.turn;
    let guard = 0;
    stat.turns++;
    while (g.status === 'PLAYING' && g.turn === t && guard++ < 40) {
      // 1) 턴을 끝내지 않고 낼 수 있는 카드 중 효율 최고
      let playable = g.hand.filter((c) => usable(g, c) && g.gauge + cost(g, c) - (c.rewind || 0) <= 0);
      if (casual) {
        // 초심자는 기세를 아껴 쓰지 않는다 — 가장 세 보이는 걸 그냥 낸다.
        if (playable.length) {
          playable.sort((a, b) => casualScore(g, b) - casualScore(g, a));
          stat.plays++;
          E.playCard(g, playable[0].uid);
          continue;
        }
        // 낼 수 있는 게 없으면 손패에서 제일 센 걸 지르고 합을 넘긴다.
        // 파훼는 계산하지 않는다.
        const hand = g.hand.filter((c) => usable(g, c));
        if (hand.length) {
          hand.sort((a, b) => casualScore(g, b) - casualScore(g, a));
          stat.plays++;
          E.playCard(g, hand[0].uid);
        } else { stat.draws++; E.drawAction(g); }
        continue;
      }
      if (planned) {
        const kept = playable.filter((c) => !planHolds(g, c));
        // 전부 보류되면 이번 합엔 낼 게 없다는 뜻이라 보류를 푼다
        if (kept.length) playable = kept;
      }
      if (playable.length) {
        playable.sort((a, b) => score(g, b) - score(g, a));
        stat.plays++;
        E.playCard(g, playable[0].uid);
        continue;
      }
      // 2) 합을 끝내야 한다. 무엇으로 끝내느냐가 다음 합을 정한다.
      //    - 파훼(몰아치기가 빈틈 도달)에 닿는 초식이 있으면 그게 거의 항상 최선이다:
      //      적의 페이즈가 통째로 지워지고 다음 합에 사혈 노출까지 붙는다.
      //    - 아니면 가장 크게 때리는 초식. 그것도 시원찮으면 기세를 카드로 환전.
      let best = null, bv = -1, bestBreaks = false;
      g.hand.filter((c) => usable(g, c)).forEach((c) => {
        // 파훼는 착지 위치가 아니라 이번 합의 몰아치기 총량으로 난다
        const breaks = g.momentumSpentThisTurn + cost(g, c) >= g.breakThreshold;
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

  function run(color, runs, opts) {
    const planned = !!(opts && opts.planned);
    const casual = !!(opts && opts.casual);
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
          autoTurn(st.game, stat, planned, casual);
          R.syncBattleResult();
        } else if (st.phase === 'REWARD') {
          const o = st.rewardOptions.slice();
          // 초심자는 보상도 아무거나 고른다
          if (casual) { if (o.length) R.takeCard(o[Math.floor(Math.random() * o.length)]); else R.skipReward(); }
          else { o.sort((a, b) => score(st.game, b) - score(st.game, a));
                 if (o.length) R.takeCard(o[0]); else R.skipReward(); }
        } else break;
      }
      const st = R.get();
      if (st.phase === 'RUN_WON') { clears++; sum += 10; }
      else { sum += st.stage; stat.dist[st.stage] = (stat.dist[st.stage] || 0) + 1; }
    }
    return {
      color,
      policy: casual ? '초심자' : planned ? '계획' : '탐욕',
      clear: (clears / runs * 100).toFixed(0) + '%',
      avg: (sum / runs).toFixed(1),
      cardsPerTurn: (stat.plays / stat.turns).toFixed(2),
      drawActPerTurn: (stat.draws / stat.turns).toFixed(2),
      deathAt: stat.dist,
    };
  }

  return { run, score };
})();
