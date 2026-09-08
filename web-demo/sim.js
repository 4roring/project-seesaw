// 밸런스 시뮬레이션 하네스 (개발용) — 게임에서는 로드하지 않는다.
// 사용법: 브라우저 콘솔에서
//   fetch('sim.js').then(r=>r.text()).then(eval);
//   ['RED','BLUE','BLACK','YELLOW'].map(c => TS_Sim.run(c, 40));
//   TS_Sim.run(c, 40, { planned: true })   // 계획형 정책
//   TS_Sim.run(c, 40, { casual: true })    // 초심자 정책
//   TS_Sim.run(c, 40, { search: true })    // 탐색 정책 (수순을 다 따져 본다)
//
// 정책 3단계 — 이 폭이 곧 "실력에 따른 난이도 밴드"다.
//   casual  : 큰 피해만 보고 낸다. 기세를 아껴 쓰지 않고, 파훼를 노리지
//             않으며, 방어/회복/드로우의 값을 모른다. 보상도 아무거나 고른다.
//   greedy  : 효율(가치/틈)로 고르고 기세를 정확히 맞춰 쓴다. 파훼가 닿으면
//             노린다. 이미 상당한 수준의 플레이라 "하한"이 아니다.
//   planned : greedy + 타이밍 판단(패 파기는 손패가 쌓인 뒤, 연계는 나중에).
//   search  : 한 합에서 낼 수 있는 수순을 실제로 다 돌려 보고 결과가 가장
//             좋은 것을 고른다. 위 셋은 "카드 하나를 어떻게 고르나"의 정책이라
//             각자의 맹점이 통계에 그대로 박히는데, 탐색은 그 맹점이 없다.
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
    v += (c.block || 0) * 1.0 + (c.heal || 0) * 1.0 + (c.draw || 0) * 4 + (c.counter || 0) * 2.2 /* 적 페이즈당 2~4회 발동 */;
    if (c.lifesteal) v += (c.damage || 0) * c.lifesteal / 100;
    if (c.evade) v += c.evade * 7; // 일격 하나를 통째로 넘기는 값어치
    // B라인 필드 (gdd/03 3-2). 여기 빠져 있으면 점수가 0이 되고, 문파 방문
    // 교환에서 AI가 그 문파의 핵심 초식을 "값 없는 카드"로 놓아 버린다.
    // 실제로 백의 몰아치기 카드가 통째로 버려져 파훼율이 31% → 21%로
    // 떨어졌고, 3스테이지(철벽 무승, 빈틈 9) 사망이 0 → 16으로 튀었다.
    if (c.deepStrike) v += c.deepStrike * Math.max(0, -g.gauge);
    if (c.rageScale) v += c.rageScale * Math.floor((g.playerMaxHp - g.playerHp) / 10);
    if (c.surge) v += c.surge * 3;      // 기세를 안 쓰고 파훼선에 다가간다
    if (c.sealSkill) v += c.sealSkill * 5; // 적의 가장 비싼 초식을 지운다
    if (c.drainPower) v += c.drainPower * 4;
    if (c.effect) v += 4;
    if (c.rewind) v += c.rewind * 3;
    if (c.bossWeaken) v += 3;
    // 빈틈 감소는 이번 전투 내내 남는다 — 한 번 쓰고 마는 피해와 같은
    // 자로 재면 안 된다. 5로 두었더니 탐색 AI가 백의 '파계진언'을 교환에서
    // 매번 내다 버렸고(40런 중 최다 교환), 파훼율이 31% → 24%로 떨어지며
    // 3스테이지(철벽 무승, 빈틈 9) 사망이 1 → 17로 튀었다. 파훼 한 번은
    // 적 페이즈 하나를 통째로 지우므로 그만큼 값을 매긴다.
    if (c.breakThresholdDown) v += c.breakThresholdDown * 8;
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
        const breaks = g.momentumSpentThisTurn + cost(g, c) >= E.effectiveBreakThreshold(g);
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

  // ── 탐색 정책 ───────────────────────────────────────────────
  // 합 하나를 통째로 시뮬레이션해 본다. 합은 기세가 0을 넘어야 끝나므로
  // 모든 수순은 반드시 합 종료로 끝나고, 그 시점(적 반격까지 끝난 뒤)의
  // 상태를 평가한다 — 사람이 "이렇게 내면 다음 합이 어떻게 되지?"를
  // 따지는 것과 같은 층위다.
  function cloneGame(g) {
    const log = g.log, fx = g.fx;
    g.log = []; g.fx = [];              // 로그는 복사할 이유가 없다
    const c = structuredClone(g);
    g.log = log; g.fx = fx;
    return c;
  }

  // 합이 끝난 뒤의 상태가 얼마나 좋은가.
  // 플레이어 체력(80)이 적 체력(90~210)보다 귀하므로 가중치를 더 준다.
  function evalTurn(sim, base) {
    if (sim.status === 'LOST') return -1e6;
    const bossDmg = base.bossHp - sim.bossHp;
    const hpLost = base.playerHp - sim.playerHp;
    if (sim.status === 'WON') return 1e6 - hpLost * 10;
    return bossDmg * 1.0
      - hpLost * 2.2
      + (-sim.gauge) * 2.5        // 다음 합에 쓸 수 있는 기세
      + sim.playerBlock * 0.2
      + sim.hand.length * 0.5;
  }

  // 같은 key의 카드는 같은 수라 한 번만 가지를 친다
  function distinctPlays(g) {
    const seen = new Set(); const out = [];
    g.hand.forEach((c) => {
      if (!usable(g, c) || seen.has(c.key)) return;
      seen.add(c.key); out.push(c);
    });
    return out;
  }

  function searchTurn(g, nodeCap) {
    const base = { bossHp: g.bossHp, playerHp: g.playerHp };
    const startTurn = g.turn;
    let nodes = 0, bestScore = -Infinity, bestPath = null;

    function rec(sim, path) {
      if (sim.status !== 'PLAYING' || sim.turn !== startTurn) {
        const sc = evalTurn(sim, base);
        if (sc > bestScore) { bestScore = sc; bestPath = path; }
        return;
      }
      if (nodes >= nodeCap || path.length >= 8) {
        const sc = evalTurn(sim, base);
        if (sc > bestScore) { bestScore = sc; bestPath = path; }
        return;
      }
      // 좋아 보이는 수부터 봐서, 노드 상한에 걸려도 쓸 만한 수순이 남게 한다
      const cands = distinctPlays(sim).sort((a, b) => score(sim, b) - score(sim, a));
      cands.forEach((c) => {
        if (nodes >= nodeCap) return;
        nodes++;
        const s2 = cloneGame(sim);
        E.playCard(s2, s2.hand.find((x) => x.key === c.key).uid);
        rec(s2, path.concat([{ key: c.key }]));
      });
      if (nodes < nodeCap) {
        nodes++;
        const s3 = cloneGame(sim);
        E.drawAction(s3);
        rec(s3, path.concat([{ draw: true }]));
      }
    }

    rec(cloneGame(g), []);
    return bestPath || [{ draw: true }];
  }

  function searchAutoTurn(g, stat, nodeCap) {
    const t = g.turn;
    stat.turns++;
    const path = searchTurn(g, nodeCap);
    for (const step of path) {
      if (g.status !== 'PLAYING' || g.turn !== t) break;
      if (step.draw) { stat.draws++; E.drawAction(g); }
      else {
        const card = g.hand.find((x) => x.key === step.key);
        if (!card) break;              // 드로우로 손패가 바뀐 경우
        stat.plays++; E.playCard(g, card.uid);
      }
    }
    // 수순대로 갔는데도 합이 안 끝났으면 숨 고르기로 마무리
    let guard = 0;
    while (g.status === 'PLAYING' && g.turn === t && guard++ < 12) {
      stat.draws++; E.drawAction(g);
    }
  }

  // ── 걸음의 정책 (gdd/13-crossroads.md) ──────────────────────
  // 전투만 자동화하고 걸음을 아무렇게나 고르면, 걸음이 밸런스에 얼마나
  // 기여하는지가 통계에서 통째로 사라진다. 전투 정책과 같은 3단계로 나눈다.
  //   casual : 눈에 띄는 대로 고른다. 체력도 안 본다.
  //   그 외   : 체력을 보고 쉴지 얻을지 정하고, 위험한 걸음은 여유가 있을
  //            때만 고른다.
  function crossroadScore(st, key) {
    const hp = st.playerHp / st.playerMaxHp;
    if (key === 'TRAINING') return hp < 0.65 ? 60 + (1 - hp) * 90 : 45;
    if (key === 'TAVERN') return hp < 0.65 ? 30 + (1 - hp) * 50 : 12;
    if (key === 'SECT_VISIT') return 50;
    // 비무대회는 유일하게 죽을 수 있는 걸음이다 — 여유가 있을 때만
    if (key === 'ELITE') return hp > 0.85 ? 58 : 4;
    if (key === 'FORTUNE') return 38;
    return 0;
  }

  function pickCrossroad(st, casual) {
    const opts = st.crossroad.slice();
    if (casual) return opts[Math.floor(Math.random() * opts.length)];
    return opts.sort((a, b) => crossroadScore(st, b) - crossroadScore(st, a))[0];
  }

  function pickNodeOption(st, casual) {
    const view = st.nodeView;
    const live = (view.options || []).filter((o) => !o.disabled);
    if (!live.length) return null;
    if (casual) return live[Math.floor(Math.random() * live.length)].id;

    const g = st.game;
    const hp = st.playerHp / st.playerMaxHp;

    if (st.node.key === 'TRAINING') {
      const rest = live.find((o) => o.id === 'rest');
      if (rest && hp < 0.65) return rest.id;
      const learn = live.find((o) => o.id === 'learn');
      if (learn) return learn.id;
      // 강화는 "지금 덱에서 가장 값나가는 카드"를 더 키운다
      const ups = live.filter((o) => o.upgrade);
      if (ups.length) {
        ups.sort((a, b) => score(g, st.deck[b.cardIndex]) - score(g, st.deck[a.cardIndex]));
        return ups[0].id;
      }
      return (rest || live[0]).id;
    }

    if (st.node.key === 'SECT_VISIT') {
      const drop = live.filter((o) => o.id.startsWith('drop:'));
      if (drop.length) {
        // 놓을 것은 지금 덱에서 가장 값 없는 초식
        drop.sort((a, b) => score(g, a.card) - score(g, b.card));
        return drop[0].id;
      }
      const cards = live.filter((o) => o.card);
      if (!cards.length) return live[0].id;
      cards.sort((a, b) => score(g, b.card) - score(g, a.card));
      // 얻을 것이 놓을 것보다 못하면 물러선다. 교환이 강제이던 시절엔
      // 이 판단을 못 해서, 시작 덱이 아직 멀쩡한 1~2스테이지에 핵심
      // 초식을 헐값에 내주고 3스테이지(빈틈 9)에서 무너졌다.
      const worst = Math.min(...st.deck.map((c) => score(g, c)));
      if (score(g, cards[0].card) <= worst && live.some((o) => o.id === 'leave')) return 'leave';
      return cards[0].id;
    }

    if (st.node.key === 'FORTUNE') {
      const forget = live.filter((o) => o.id.startsWith('forget:'));
      if (forget.length) {
        // 덜어낼 것은 가장 값 없는 초식
        forget.sort((a, b) => score(g, a.card) - score(g, b.card));
        return forget[0].id;
      }
      // 최대 체력을 깎는 마공은 여유가 있을 때만
      if (st.node.fortune === 'demonic' && hp < 0.6) return 'refuse';
      return 'accept';
    }
    return live[0].id;
  }

  function run(color, runs, opts) {
    const planned = !!(opts && opts.planned);
    const casual = !!(opts && opts.casual);
    const search = !!(opts && opts.search);
    const nodeCap = (opts && opts.nodeCap) || 200;  // 400으로 올려도 결과가 같다
    const stat = { plays: 0, draws: 0, turns: 0, dist: {}, breaks: 0, nodes: {}, elites: 0 };
    let clears = 0, sum = 0;
    for (let i = 0; i < runs; i++) {
      R.newRun(); R.chooseDeck(color);
      let guard = 0, lastNodeId = null, nodeRepeat = 0;
      while (guard++ < 4000) {
        const st = R.get();
        if (st.phase === 'RUN_WON' || st.phase === 'RUN_LOST') break;
        if (st.phase === 'BATTLE') {
          if (st.game.status !== 'PLAYING') { R.syncBattleResult(); continue; }
          const logAt = st.game.log.length;
          if (search) searchAutoTurn(st.game, stat, nodeCap);
          else autoTurn(st.game, stat, planned, casual);
          if (st.game.log.slice(logAt).some((l) => l.includes('[파훼!]'))) stat.breaks++;
          R.syncBattleResult();
        } else if (st.phase === 'REWARD') {
          const o = st.rewardOptions.slice();
          // 초심자는 보상도 아무거나 고른다
          if (casual) { if (o.length) R.takeCard(o[Math.floor(Math.random() * o.length)]); else R.skipReward(); }
          else { o.sort((a, b) => score(st.game, b) - score(st.game, a));
                 if (o.length) R.takeCard(o[0]); else R.skipReward(); }
        } else if (st.phase === 'CROSSROAD') {
          const key = pickCrossroad(st, casual);
          stat.nodes[key] = (stat.nodes[key] || 0) + 1;
          if (key === 'ELITE') stat.elites++;
          R.chooseNode(key);
        } else if (st.phase === 'NODE') {
          const id = pickNodeOption(st, casual);
          if (id == null) break;
          // 걸음이 제자리를 돌면 바깥 guard가 조용히 런을 끊고, 그 런은
          // "그 스테이지에서 죽었다"로 집계된다 — 통계가 통째로 거짓이
          // 되면서 아무 경고도 안 뜬다. 실제로 한 번 당했다.
          if (id === lastNodeId && ++nodeRepeat > 8) {
            throw new Error(`걸음이 진행되지 않습니다: ${st.node && st.node.key} / ${id}`);
          }
          if (id !== lastNodeId) { lastNodeId = id; nodeRepeat = 0; }
          R.chooseNodeOption(id);
        } else break;
      }
      const st = R.get();
      if (st.phase === 'RUN_WON') { clears++; sum += 10; }
      else { sum += st.stage; stat.dist[st.stage] = (stat.dist[st.stage] || 0) + 1; }
    }
    return {
      color,
      policy: search ? '탐색' : casual ? '초심자' : planned ? '계획' : '탐욕',
      clear: (clears / runs * 100).toFixed(0) + '%',
      avg: (sum / runs).toFixed(1),
      cardsPerTurn: (stat.plays / stat.turns).toFixed(2),
      drawActPerTurn: (stat.draws / stat.turns).toFixed(2),
      breakRate: (stat.breaks / stat.turns * 100).toFixed(0) + '%',
      nodes: stat.nodes,
      deathAt: stat.dist,
    };
  }

  // ── 데이터 점검 ─────────────────────────────────────────────
  // 조용히 틀리는 것들만 본다. 강화가 카드를 약하게 만드는 실수는 화면에
  // 아무 경고도 남기지 않는다 — 금강저의 피해를 11 → 14로 올렸을 때
  // 강화표(13)를 같이 안 고쳐서 실제로 한 번 생겼다.
  function lint() {
    const problems = [];
    const D2 = TS_DATA;
    const all = [];
    Object.entries(D2.STARTER_DECKS).forEach(([col, cards]) =>
      cards.forEach((c) => all.push({ col, c, where: '시작 덱' })));
    Object.entries(D2.REWARD_POOLS).forEach(([col, tiers]) =>
      Object.entries(tiers).forEach(([t, cards]) =>
        cards.forEach((c) => all.push({ col, c, where: `보상 티어${t}` }))));

    // 1) 강화가 어떤 수치도 낮추면 안 된다
    const LOWER_IS_BETTER = new Set(['cost', 'hpCost']);
    all.forEach(({ col, c, where }) => {
      const patch = D2.UPGRADES[c.key];
      if (!patch) return;
      Object.entries(patch).forEach(([k, v]) => {
        const base = c[k];
        if (typeof base !== 'number' || typeof v !== 'number') return;
        const worse = LOWER_IS_BETTER.has(k) ? v > base : v < base;
        if (worse) problems.push(`${col} ${where} · ${c.name}(${c.key}): 강화하면 ${k} ${base} → ${v}로 나빠짐`);
      });
    });

    // 2) 되감기 불변 규칙 — cost - rewind >= 1 (소멸 카드는 예외)
    all.forEach(({ col, c, where }) => {
      if (c.rewind && !c.exhaust && c.cost - c.rewind < 1) {
        problems.push(`${col} ${where} · ${c.name}: cost(${c.cost}) - rewind(${c.rewind}) < 1 — 무한 루프`);
      }
    });

    // 3) score()가 0점으로 보는 필드가 있는가 — 빠진 필드는 "버려도 되는
    //    카드"라는 뜻이 되어 교환·보상 통계를 통째로 뒤튼다
    const KNOWN = new Set(['key','name','cost','count','desc','upgraded','unique','exhaust',
      'effect','persistentPayload','damage','block','heal','draw','rewind','counter','evade',
      'lifesteal','chain','chainBlock','discardAll','blockToDamage','hpCost','bossWeaken',
      'breakThresholdDown','deepStrike','rageScale','surge','sealSkill','drainPower']);
    const unseen = new Set();
    all.forEach(({ c }) => Object.keys(c).forEach((k) => { if (!KNOWN.has(k)) unseen.add(k); }));
    unseen.forEach((k) => problems.push(`점수 함수가 모르는 필드: ${k} — sim.js score()에 넣으세요`));

    return problems.length ? problems : ['이상 없음'];
  }

  return { run, score, lint };
})();
