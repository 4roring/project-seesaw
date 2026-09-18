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
  // 연계 수 — 엔진의 chainLinks와 같다. 4문파 런에서는 cardsPlayedThisTurn 그대로.
  const links = (g) => Math.max(0, g.cardsPlayedThisTurn - (g.chainOffset || 0)) + (g.chainBank || 0);

  // 카드 1장의 즉시 가치를 코스트로 나눈 효율 점수
  function score(g, c) {
    let v = c.damage || 0;
    if (c.chain) v += c.chain * links(g);
    if (c.chainBlock) v += c.chainBlock * links(g) * 0.6;
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
    // 파일럿 (ideanote/017-3). 쌓는다: 다음 합의 연계 1수는 연계 초식 한 장이
    // 한 번 더 받는 가산쯤이다. 태운다: 지금 합의 연계를 곧바로 늘린다.
    if (c.chainKeep) v += c.chainKeep * 2.5;
    if (c.chainPrime) v += c.chainPrime * 3;
    // 파일럿 1.5 — 마무리는 지금 이은 수로 터지고 연계를 비운다. 비우는 값은
    // 이 초식 뒤에 올 연계 초식의 몫이라 점수에서 따로 빼지 않는다(탐욕은 한 수 앞만 본다).
    if (c.finisher) v += c.finisher * links(g);
    // 사파 — 봉인은 다음 초식 피해를 막는 경감이다(막은 만큼 방어도와 같은 값, 12에서 자른다).
    if (c.chainSeal) v += Math.min(c.sealAll ? 30 : 12, c.chainSeal * links(g)) * (c.sealAll ? 1.5 : 1);
    if (c.chainDraw) v += Math.min(c.chainDrawCap || 99, Math.floor(links(g) / c.chainDraw)) * 4;
    if (c.bossExpose) v += 5;
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
    if ((c.chain || c.chainBlock) && links(g) < 2) return true;
    // 마무리 · 봉인은 연계를 비운다 — 세 수 이상 모인 뒤에
    if ((c.finisher || c.chainSeal) && links(g) < 3) return true;
    if (c.evade && g.evadeCharges > 0) return true;
    return false;
  }

  // 초심자 점수 — 피해만 본다. 방어도·회복·드로우·유틸의 값을 모르고,
  // 틈 대비 효율도 따지지 않는다.
  function casualScore(g, c) {
    let v = c.damage || 0;
    if (c.chain) v += c.chain * links(g);
    if (c.finisher) v += c.finisher * links(g);
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
          + (c.chain ? c.chain * links(g) : 0)
          + (c.finisher ? c.finisher * links(g) : 0)
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
    // 고묘 — 유물 자리. 위험이 없으므로 여유가 있을 때 우선한다
    if (key === 'TOMB') return hp > 0.6 ? 54 : 20;
    // 기연은 대가가 붙지만 여유가 있으면 걸어 볼 만하다. 38로 두었더니
    // 늘 곁에 있는 수련장(45+)에 밀려 탐욕 정책이 런당 0.00회 골랐고,
    // 그 바람에 기연 4종이 통계에서 통째로 빠져 있었다.
    if (key === 'FORTUNE') return hp > 0.75 ? 52 : 18;
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
      // 병기·유물 제안 — 자리가 비면 받고, 차 있으면 바꾸지 않는다.
      // (서로의 우열은 아직 데이터가 없어 AI가 판단할 근거가 없다)
      const take = live.find((o) => o.id.startsWith('wtake:') || o.id.startsWith('rtake:'));
      if (take) return take.id;
      if (live.some((o) => o.id.startsWith('wswap:'))) return 'wleave';
      if (live.some((o) => o.id.startsWith('rswap:'))) return 'rleave';
      const forget = live.filter((o) => o.id.startsWith('forget:'));
      if (forget.length) {
        // 덜어낼 것은 가장 값 없는 초식
        forget.sort((a, b) => score(g, a.card) - score(g, b.card));
        return forget[0].id;
      }
      // 최대 체력을 깎는 마공은 여유가 있을 때만
      if (st.node.fortune === 'demonic' && hp < 0.6) return 'refuse';
      // 화면에 없는 선택지를 고르면 chooseNodeOption이 조용히 아무것도
      // 안 해서 런이 제자리를 돈다 — 반드시 실제 선택지 중에서 고른다.
      const accept = live.find((o) => o.id === 'accept');
      return accept ? accept.id : live[0].id;
    }
    return live[0].id;
  }

  // 전투 밖(출신 '강호 경험'의 첫 전리품)에서는 점수를 볼 전투가 없다
  const IDLE = { cardsPlayedThisTurn: 0, chainBank: 0, chainOffset: 0, playerBlock: 0, hand: [], gauge: -3,
    playerHp: 80, playerMaxHp: 80, pendingCostReduction: 0 };

  // 파일럿 보상 정책 (ideanote/017 "검증하려면") — 한 세력만 집는다 / 세력 초식이면
  // 무엇이든 집는다(잡캐) / 가장 좋은 것. 계열 카드는 어느 정책에서나 받는다.
  const PURE = ['orthodox', 'heterodox', 'demonic'];
  function rewardChoice(st, options, casual, faction) {
    const g = st.game || IDLE;
    let cands = options.slice();
    const ults = cands.filter((c) => c.ultimate);
    if (ults.length) {
      // 순수 정책은 제 세력 오의가 있으면 그것, 없으면 가장 좋아 보이는 것
      const own = PURE.includes(faction) && ults.find((c) => c.faction === faction);
      if (own) return own;
      if (casual) return ults[Math.floor(Math.random() * ults.length)];
      return ults.sort((a, b) => score(g, b) - score(g, a))[0];
    }
    if (PURE.includes(faction)) {
      cands = cands.filter((c) => !c.faction || c.faction === faction);
    } else if (faction === 'mixed') {
      const fac = cands.filter((c) => c.faction);
      if (fac.length) cands = fac;
    }
    if (!cands.length) return null;
    if (casual) return cands[Math.floor(Math.random() * cands.length)];
    return cands.sort((a, b) => score(g, b) - score(g, a))[0];
  }

  function run(color, runs, opts) {
    const planned = !!(opts && opts.planned);
    // 무기를 고정해 한 자루씩 재기 위한 손잡이. 생략하거나 'random'이면
    // 무작위 — 맨손으로 나서는 길은 없다 (gdd/14 14-2). 색 × 무기 조합을
    // 하나씩 가르려면 필요하다.
    const weapon = opts && opts.weapon;
    // 유물도 한 개씩 고정해 잰다 — 무기와 같은 이유다 (gdd/14-6).
    const relic = opts && opts.relic;
    const casual = !!(opts && opts.casual);
    const search = !!(opts && opts.search);
    const nodeCap = (opts && opts.nodeCap) || 200;  // 400으로 올려도 결과가 같다
    // 파일럿 손잡이 (ideanote/017) — 시작 부스터와 세력 정책
    const booster = opts && opts.booster;
    const faction = (opts && opts.faction) || 'best';
    // 오의를 끈 채 재기 — "오의가 도달을 얼마나 올리나" (파일럿 1.5 기준 4)
    const savedUltStage = TS_DATA.ULTIMATE_STAGE;
    if (opts && opts.noUlt) TS_DATA.ULTIMATE_STAGE = 99;
    const stat = { plays: 0, draws: 0, turns: 0, dist: {}, breaks: 0, nodes: {}, elites: 0 };
    // 검증 지표 — 전투가 끝날 때 한 번씩 모은다
    const lin = { battles: 0, turns: 0, carried: 0, carryTurns: 0, shareSum: 0, shareN: 0,
      minHpSum: 0, finale: 0, saber: 0, ultTaken: {}, ultOfferFav: 0, ultOfferSlots: 0,
      ultGuaranteeOk: 0, ultGuaranteeN: 0,
      finisherPlays: 0, finisherLinks: 0, sealPlays: 0, sealPrevented: 0, chainDrawn: 0,
      damageTaken: 0, hpBurned: 0, maxHpDelta: 0, drainKills: 0, maxHitSum: 0, maxHitTop: 0, wins: 0, maxHits: [],
      boosterPicked: {}, offersNoFaction: 0,
      deck: { orthodox: 0, heterodox: 0, demonic: 0 }, deckLineage: 0, deckSize: 0 };
    const seenGames = new WeakSet();
    const recordBattle = (g) => {
      if (!g || !g.stats || g.status === 'PLAYING' || seenGames.has(g)) return;
      seenGames.add(g);
      const s2 = g.stats;
      lin.battles++; lin.turns += g.turn;
      lin.carried += s2.carriedLinks; lin.carryTurns += s2.carryTurns;
      const top = Math.max(s2.maxTurnDamage, s2.turnDamage);
      if (s2.totalDamage > 0) { lin.shareSum += top / s2.totalDamage; lin.shareN++; }
      lin.minHpSum += Math.max(0, s2.minHp) / g.playerMaxHp;
      lin.finale += s2.finaleFires;
      lin.saber += g.log.filter((l) => l.includes('도(刀) — 첫 초식')).length;
      lin.finisherPlays += s2.finisherPlays || 0; lin.finisherLinks += s2.finisherLinks || 0;
      lin.sealPlays += s2.sealPlays || 0; lin.sealPrevented += s2.sealPrevented || 0;
      lin.chainDrawn += s2.chainDrawn || 0; lin.damageTaken += s2.damageTaken || 0;
      lin.hpBurned += s2.hpBurned || 0;
      lin.maxHitSum += s2.maxHit || 0; lin.maxHits.push(s2.maxHit || 0); lin.maxHitTop = Math.max(lin.maxHitTop, s2.maxHit || 0);
      if (g.status === 'WON') lin.wins++;
    };
    let clears = 0, sum = 0;
    for (let i = 0; i < runs; i++) {
      R.newRun(); R.chooseDeck(color);
      if (relic) {
        const st0 = R.get();
        st0.relics = relic === 'random'
          ? [Object.keys(TS_DATA.RELICS)[Math.floor(Math.random() * Object.keys(TS_DATA.RELICS).length)]]
          : [relic];
        st0.lastStandLeft = st0.relics.reduce((n, k) => n + (TS_DATA.RELICS[k].lastStand || 0), 0);
      }
      if (R.get().phase === 'WEAPON') {
        const keys = R.weaponKeysFor(color);
        const pick = weapon && weapon !== 'random'
          ? weapon : keys[Math.floor(Math.random() * keys.length)];
        R.chooseWeapon(pick);
        // 잘못된 키면 WEAPON에 멈춘 채 아래 루프가 break로 끝나고, 그 런은
        // "1스테이지에서 죽었다"로 조용히 집계된다 — 여기서 끊는다.
        if (R.get().phase === 'WEAPON') throw new Error(`쥘 수 없는 병기: ${pick}`);
      }
      // 시작 부스터 — 고정하면 그 하나만 보여 준다. 아니면 보인 셋 중 무작위
      // (부스터끼리의 우열은 검증 6이 재는 것이라 정책이 미리 알면 안 된다).
      if (R.get().phase === 'ORIGIN') {
        const st0 = R.get();
        if (!st0.boosterOffer.some((k) => TS_DATA.BOOSTERS.find((b) => b.key === k).kind === '세력')) lin.offersNoFaction++;
        if (booster && booster !== 'random') st0.boosterOffer = [booster];
        const pick = st0.boosterOffer[Math.floor(Math.random() * st0.boosterOffer.length)];
        R.chooseBooster(pick);
        if (R.get().phase === 'ORIGIN') throw new Error(`고를 수 없는 부스터: ${pick}`);
        lin.boosterPicked[pick] = (lin.boosterPicked[pick] || 0) + 1;
      }
      let guard = 0, lastNodeId = null, nodeRepeat = 0;
      while (guard++ < 4000) {
        const st = R.get();
        if (st.phase === 'RUN_WON' || st.phase === 'RUN_LOST') break;
        if (st.phase === 'BATTLE') {
          if (st.game.status !== 'PLAYING') { recordBattle(st.game); R.syncBattleResult(); continue; }
          const logAt = st.game.log.length;
          if (search) searchAutoTurn(st.game, stat, nodeCap);
          else autoTurn(st.game, stat, planned, casual);
          if (st.game.log.slice(logAt).some((l) => l.includes('[파훼!]'))) stat.breaks++;
          recordBattle(st.game);
          R.syncBattleResult();
        } else if (st.phase === 'REWARD') {
          const o = st.rewardOptions.slice();
          // 각인석(gdd/15)이 있으면 "안 받는다"가 실제 선택지가 된다 —
          // 제시된 카드가 지금 덱의 중간값보다 못하면 연마를 택한다.
          // 이 판단을 안 넣으면 유물이 한 번도 발동하지 않아 통계에서
          // 통째로 사라진다.
          const sealed = R.hasRelic && R.hasRelic('refuseUpgrade');
          if (sealed && o.length && !casual) {
            const best = Math.max(...o.map((c) => score(st.game, c)));
            const deckScores = st.deck.map((c) => score(st.game, c)).sort((a, b) => a - b);
            const median = deckScores[Math.floor(deckScores.length / 2)] || 0;
            if (best < median) { R.skipReward(); continue; }
          }
          if (R.isLineage(color)) {
            // 오의 자리 — 제시된 셋의 세력 구성과 비전 · 맹세 · 혈서의 보장 (검증 4)
            if (o.some((c) => c.ultimate)) {
              const b = R.boosterDef(st.booster) || {};
              if (b.favor) { lin.ultOfferFav += o.filter((c) => c.faction === b.favor).length; lin.ultOfferSlots += o.length; }
              if (b.ultGuarantee) { lin.ultGuaranteeN++; if (o.some((c) => c.faction === b.ultGuarantee)) lin.ultGuaranteeOk++; }
            }
            const pick = rewardChoice(st, o, casual, faction);
            if (pick && pick.ultimate) lin.ultTaken[pick.faction] = (lin.ultTaken[pick.faction] || 0) + 1;
            if (pick) R.takeCard(pick); else R.skipReward();
            continue;
          }
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
      if (st.game) recordBattle(st.game);
      if (R.isLineage(color)) {
        PURE.forEach((f) => { lin.deck[f] += st.deck.filter((c) => c.faction === f && !c.ultimate).length; });
        lin.deckLineage += st.deck.filter((c) => c.lineage).length;
        lin.deckSize += st.deck.length;
        lin.maxHpDelta += st.drainMaxHpGained - st.burnMaxHpLost;
        lin.drainKills += st.drainKills;
      }
      if (st.phase === 'RUN_WON') { clears++; sum += 10; }
      else { sum += st.stage; stat.dist[st.stage] = (stat.dist[st.stage] || 0) + 1; }
    }
    TS_DATA.ULTIMATE_STAGE = savedUltStage;
    return {
      color,
      policy: search ? '탐색' : casual ? '초심자' : planned ? '계획' : '탐욕',
      weapon: weapon || '무작위',
      relic: relic || '없음',
      clear: (clears / runs * 100).toFixed(0) + '%',
      avg: (sum / runs).toFixed(1),
      cardsPerTurn: (stat.plays / stat.turns).toFixed(2),
      drawActPerTurn: (stat.draws / stat.turns).toFixed(2),
      breakRate: (stat.breaks / stat.turns * 100).toFixed(0) + '%',
      nodes: stat.nodes,
      deathAt: stat.dist,
      lineage: R.isLineage(color) ? (() => {
        const T = Math.max(1, lin.turns);
        return {
          booster: booster || '무작위',
          faction,
          남긴연계_합당: +(lin.carried / Math.max(1, lin.carryTurns)).toFixed(2),
          최대합_비중: Math.round(lin.shareSum / Math.max(1, lin.shareN) * 100),
          최저HP_비율: Math.round(lin.minHpSum / Math.max(1, lin.battles) * 100),
          검_합당: +(lin.finale / T).toFixed(2),
          도_합당: +(lin.saber / T).toFixed(2),
          마무리_합당: +(lin.finisherPlays / T).toFixed(2),
          마무리전_연계: +(lin.finisherLinks / Math.max(1, lin.finisherPlays)).toFixed(2),
          봉인_합당: +(lin.sealPlays / T).toFixed(2),
          봉인_막은피해_합당: +(lin.sealPrevented / T).toFixed(2),
          연계드로우_합당: +(lin.chainDrawn / T).toFixed(2),
          받은피해_합당: +(lin.damageTaken / T).toFixed(2),
          태운HP_런당: +(lin.hpBurned / runs).toFixed(1),
          최대체력_변화_런당: +(lin.maxHpDelta / runs).toFixed(2),
          흡성막타_런당: +(lin.drainKills / runs).toFixed(2),
          흡성막타_승리당: +(lin.drainKills / Math.max(1, lin.wins)).toFixed(2),
          가장큰한방_전투평균: +(lin.maxHitSum / Math.max(1, lin.battles)).toFixed(1),
          가장큰한방_최대: lin.maxHitTop,
          ...(() => { const h = lin.maxHits.slice().sort((x, y) => x - y); const q = (p) => h[Math.min(h.length - 1, Math.floor(h.length * p))] || 0;
            return { 한방_p50: q(0.5), 한방_p90: q(0.9), 한방_p99: q(0.99), 한방_100이상: +(h.filter((x) => x >= 100).length / Math.max(1, h.length)).toFixed(3) }; })(),
          덱_정파: +(lin.deck.orthodox / runs).toFixed(1),
          덱_사파: +(lin.deck.heterodox / runs).toFixed(1),
          덱_마교: +(lin.deck.demonic / runs).toFixed(1),
          덱_계열: +(lin.deckLineage / runs).toFixed(1),
          덱_장수: +(lin.deckSize / runs).toFixed(1),
          오의_받음: lin.ultTaken,
          오의_가중세력비율: lin.ultOfferSlots ? +(lin.ultOfferFav / lin.ultOfferSlots).toFixed(2) : null,
          오의_보장: lin.ultGuaranteeN ? `${lin.ultGuaranteeOk}/${lin.ultGuaranteeN}` : null,
          부스터_세력없는셋: +(lin.offersNoFaction / runs).toFixed(2),
          부스터_고름: lin.boosterPicked,
        };
      })() : undefined,
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
    // 파일럿 — 무기 계열 (ideanote/017)
    Object.entries(D2.LINEAGE_STARTER || {}).forEach(([col, cards]) =>
      cards.forEach((c) => all.push({ col, c, where: '계열 시작 덱' })));
    Object.entries(D2.LINEAGE_POOL || {}).forEach(([col, cards]) =>
      cards.forEach((c) => all.push({ col, c, where: '계열 20장' })));
    Object.entries(D2.FACTION_POOL || {}).forEach(([col, facs]) =>
      Object.entries(facs).forEach(([f, cards]) =>
        cards.forEach((c) => all.push({ col, c, where: `세력 ${f}` }))));
    Object.entries(D2.ULTIMATES || {}).forEach(([col, list]) =>
      list.forEach((c) => all.push({ col, c, where: '오의' })));
    // 오의는 세력당 2장 (파일럿 1.5 C-2)
    Object.entries(D2.ULTIMATES || {}).forEach(([col, list]) => (D2.FACTION_ORDER || []).forEach((f) => {
      const n = list.filter((c) => c.faction === f).length;
      if (n !== 2) problems.push(`${col} ${f} 오의가 ${n}장 — 초안 C-2는 세력당 2장`);
    }));
    // 부스터가 가리키는 세력이 있는가
    (D2.BOOSTERS || []).forEach((b) => ['favor', 'factionPick', 'ultGuarantee', 'convert'].forEach((k) => {
      if (b[k] && !(D2.FACTIONS || {})[b[k]]) problems.push(`부스터 ${b.name}: 모르는 세력 ${b[k]}`);
    }));

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

    // 1-2) 궁극기가 완전해질 때 어떤 수치도 낮아지면 안 된다
    all.forEach(({ col, c, where }) => {
      if (!c.full) return;
      Object.entries(c.full).forEach(([k, v]) => {
        const base = c[k];
        if (typeof base !== 'number' || typeof v !== 'number') return;
        const worse = LOWER_IS_BETTER.has(k) ? v > base : v < base;
        if (worse) problems.push(`${col} ${where} · ${c.name}: 완전해지면 ${k} ${base} → ${v}로 나빠짐`);
      });
    });

    // 1-3) 희귀도 구성 — 계열 9/8/3, 세력 4/3/2 (ideanote/017-4)
    const mix = (cards) => [1, 2, 3].map((r) => cards.filter((c) => c.rarity === r).length).join('/');
    Object.entries(D2.LINEAGE_POOL || {}).forEach(([col, cards]) => {
      if (mix(cards) !== '9/8/3') problems.push(`${col} 계열 20장의 희귀도 구성이 ${mix(cards)} — 017-4는 9/8/3`);
    });
    Object.entries(D2.FACTION_POOL || {}).forEach(([col, facs]) => Object.entries(facs).forEach(([f, cards]) => {
      if (mix(cards) !== '4/3/2') problems.push(`${col} 세력 ${f}의 희귀도 구성이 ${mix(cards)} — 017-4는 4/3/2`);
    }));

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
      'breakThresholdDown','deepStrike','rageScale','surge','sealSkill','drainPower',
      // 파일럿 (ideanote/017) — 이름표 필드와 동사 필드
      'rarity','lineage','faction','ultimate','fullAt','full','isFull','chainKeep','chainPrime',
      // 파일럿 1.5
      'basic','finisher','chainSeal','sealAll','chainDraw','chainDrawCap','bossExpose']);
    const unseen = new Set();
    all.forEach(({ c }) => Object.keys(c).forEach((k) => { if (!KNOWN.has(k)) unseen.add(k); }));
    unseen.forEach((k) => problems.push(`점수 함수가 모르는 필드: ${k} — sim.js score()에 넣으세요`));

    return problems.length ? problems : ['이상 없음'];
  }

  return { run, score, lint };
})();
