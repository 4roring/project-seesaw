// 카드/적/기세 데이터 — gdd/05, 09, 10, 11 문서 기준
const TS_DATA = {
  // 기세 축은 아6 ~ 적6 고정이다. 빈틈(breakThreshold)은 게이지 축의 칸이
  // 아니라 "한 합에 몰아쳐야 하는 총 틈"이므로 별개 눈금이다 (gdd/02 2-2).
  GAUGE_MIN: -6,
  GAUGE_MAX: 6,
  STARTING_GAUGE: -3, // 아3
  STARTING_PLAYER_HP: 80,
  HAND_SIZE: 5, // 시작 핸드 크기 (이후로는 사용한 만큼만 보충 — gdd 07 문서)
  REFILL_CAP: null, // 합 시작 보충 드로우의 "장수" 상한. null이면 무제한
  // 합 시작 보충 후 손패가 넘지 못하는 크기(기본값). 드로우 초식으로 뽑은
  // 장수는 보충량에서 빠지지 않아(연환 드로우와 달리) 손패가 합마다 영구히
  // 불어난다. 그 누수를 막는 뚜껑이다 — 이미 넘겨 들고 있으면 보충은 0.
  // 문파별로 COLORS[*].handCap이 이 값을 덮어쓴다.
  HAND_REFILL_CAP: null,
  // 드로우 초식으로 뽑은 장수를 보충량에서 뺄 것인가 (연환 드로우와 동일 취급)
  SUBTRACT_CARD_DRAWS: true,
  DRAW_ACTION_COST: 2, // "숨 고르기"가 내주는 기세 (적 쪽으로 미는 양)
  DRAW_ACTION_CARDS: 1, // "숨 고르기"로 뽑는 카드 수
  COMBO_THRESHOLD: 3, // 이번 합의 카드 사용 수가 이 값에 도달할 때마다 추가 드로우
  // ── 파훼 보상 구성 (gdd/02 2-1) ──────────────────────────────
  // 파훼는 원래 "적 페이즈 취소 + 다음 페이즈까지 기절 + 사혈 노출"로
  // 페이즈를 두 개 지웠다. 최적 플레이가 파훼를 노릴수록 압도적이 되는
  // 원인이라 요소별로 켜고 끌 수 있게 뺐다.
  // 클로저(페이즈를 끝내는 마무리 일격)가 인정하는 방어도 비율.
  // 0이면 방어도를 통째로 무시한다. 0.5면 절반만 막힌다 (gdd/08 8-4-2).
  CLOSER_BLOCK_RATIO: 0,

  BREAK_STUNS_NEXT_PHASE: true,  // 다음 페이즈까지 통째로 지울 것인가
  BREAK_GRANTS_VULNERABLE: true, // 다음 합 사혈 노출(+50%)을 줄 것인가
  BREAK_BUDGET_RATIO: null,      // null이면 페이즈 취소. 0.5면 예산 절반으로 진행

  MIN_MOMENTUM_RETURN: 3, // 적 페이즈가 끝날 때 보장되는 최소 기세(아3)
  REWARD_CHOICES: 3, // 보상으로 제시되는 카드 장수

  // ─────────────────────────────────────────────────────────────
  // 갈림길 (gdd/13-crossroads.md) — 비무와 비무 사이의 한 걸음.
  //
  // 회복이 세 군데로 쪼개졌다. 예전에는 스테이지마다 잃은 체력의 50%가
  // 그냥 돌아왔는데, 그러면 수련장의 운기조식이 살 이유가 없다. 기본
  // 회복을 깎고 그만큼을 걸음에 실어, "쉬러 갈 것인가"가 실제 선택이
  // 되게 한다.
  // ─────────────────────────────────────────────────────────────
  STAGE_HEAL_RATIO: 0.4,   // 어느 걸음을 골라도 붙는 기본 회복
  TRAIN_HEAL_RATIO: 0.5,   // 수련장 · 운기조식
  TAVERN_HEAL_RATIO: 0.2,  // 주루 — 회복은 덤이고 본체는 정보다
  // 갈림길을 꺼서 "걸음이 없던 시절"과 직접 비교하기 위한 개발용 스위치.
  // 걸음이 밸런스에 얼마를 보태는지는 이 A/B로만 정확히 갈린다.
  CROSSROAD_ENABLED: true,
  CROSSROAD_CHOICES: 3,
  // 수련장을 갈림길에 늘 끼울 것인가. 예전에는 스테이지마다 강화를 고를 수
  // 있었는데, 강화를 걸음으로 옮기면서 닿는 빈도가 5분의 1로 줄었다.
  CROSSROAD_ALWAYS_TRAINING: true,
  SECT_VISIT_OWN_CHOICES: 5,     // 비급 열람 — 보상(3장)보다 넓게 본다
  SECT_VISIT_FOREIGN_CHOICES: 3, // 객경 초빙 — 타 문파 무공
  FORTUNE_MAX_PER_RUN: 2,  // 기연이 잦으면 우연이 아니라 일과가 된다
  TAVERN_INTEL_DEPTH: 2,   // 주루에서 미리 보는 앞 스테이지 수

  // 비무대회 — 앞으로 만날 상대를 미리 겨룬다. 적 데이터를 새로 만들지
  // 않는 이유: 이미 균형이 잡힌 로스터를 당겨 쓰면 난이도가 스테이지
  // 곡선을 따라 저절로 올라간다.
  ELITE_LOOKAHEAD: 2,      // 몇 스테이지 앞의 상대를 당겨오는가
  ELITE_HP_RATIO: 0.8,     // 그 상대의 체력 비율
  ELITE_REWARD_CARDS: 2,   // 이기면 초식 두 장

  // ─────────────────────────────────────────────────────────────
  // 카드 효과 필드 (gdd/05-mvp-spec.md 5-1)
  // 카드 설명(desc)은 데이터에 두지 않는다 — 손으로 쓰면 강화 시 원래 효과를
  // 잃어버리고(피해만 남고 부가 효과가 사라짐) 수치를 조정할 때마다 어긋난다.
  // 아래 필드에서 web-demo/text.js가 생성한다.
  //   effect: 태그형 1회성/지속 효과
  //   draw / rewind / heal / hpCost / counter / breakThresholdDown / bossWeaken /
  //   discardAll: 숫자 필드로 표현되는 단순 효과 (여러 개 동시 적용 가능)
  //   chain / chainBlock (적): 이번 합에 이미 사용한 초식 1장당 피해/방어도 가산
  //   blockToDamage (백): 현재 방어도 x N 만큼 피해에 가산
  //   lifesteal (자): 입힌 피해의 N%를 체력으로 회복
  //   evade (흑): 다음 N회의 피격을 통째로 무효화 (방어도와 달리 큰 일격일수록 이득)
  //   unique: 덱에 1장만 존재. 보상 풀에서 제외된다
  //   exhaust: 사용 후 버린 더미로 가지 않고 이번 전투에서 소멸
  //
  // [불변 규칙] 되감기 카드는 반드시 cost - rewind >= 1 이어야 한다.
  //   버린 더미는 다시 섞여 들어오므로, 기세 순증(cost <= rewind) 카드는
  //   장수와 무관하게 한 턴을 무한히 늘리는 영구기관이 된다. 순증 카드를
  //   만들려면 exhaust(소멸)로 1회용임을 보장해야 한다.
  // ─────────────────────────────────────────────────────────────
  COLORS: {
    // 오방색 — gdd/03-color-archetypes.md 3-1. 내부 키는 그대로 두고 표시만 바꾼다.
    // handCap: 손패 뚜껑. 드로우가 정체성인 문파는 더 들 수 있다 — 뚜껑을
    // 일률로 걸면 흑의 패 파기 페이오프(파기 1장당 피해)가 통째로 죽는다.
    RED: { name: '적(赤)', sect: '화산파', handCap: null, icon: '🌸', desc: '초식을 이어 쓸수록 커지는 연환으로 한 합에 터뜨리는 문파' },
    BLUE: { name: '흑(黑)', sect: '무당파', handCap: null, icon: '☯', desc: '기세를 되감아 합을 늘리고, 쌓인 손패를 한 번에 환전하는 문파' },
    BLACK: { name: '백(白)', sect: '금강사', handCap: null, icon: '卍', desc: '금강불괴와 반탄강기로 버티고 파훼 임계점을 끌어내리는 문파' },
    YELLOW: { name: '자(紫)', sect: '마교', handCap: null, icon: '血', desc: '제 피를 태워 초식을 내고 흡성으로 되메우는 금기의 무공' },
  },

  // 시작 덱 (컬러별 10장) — gdd/11-card-tiers.md
  STARTER_DECKS: {
    // 적(赤)은 "여러 장을 모아 한 합에 연계로 터뜨리는" 문파 — chain 카드가 축이다.
    RED: [
      { key: 'strike', name: '매화점점', cost: 1, damage: 5, block: 0, count: 2 },
      { key: 'defend', name: '호신강기', cost: 1, damage: 0, block: 6, count: 2 },
      { key: 'brace', name: '기수응세', cost: 1, damage: 0, block: 5, count: 1, chainBlock: 5 },
      { key: 'breakthrough', name: '파옥일섬', cost: 2, damage: 9, block: 0, count: 2, effect: 'REDUCE_NEXT_COST' },
      { key: 'focus', name: '축기결', cost: 1, damage: 0, block: 0, count: 1, effect: 'DOUBLE_NEXT_ATTACK' },
      { key: 'chainstrike', name: '연환매화', cost: 1, damage: 3, block: 0, count: 1, chain: 5 },
      { key: 'chain_burst', name: '매화만개', cost: 3, damage: 8, block: 0, count: 1, chain: 9 },
    ],
    BLUE: [
      { key: 'jab', name: '점혈수', cost: 1, damage: 5, block: 0, count: 2 },
      // 흑의 생존 수단은 방어도가 아니라 흘리기다 — 사량발천근의 그림 그대로,
      // 깎는 게 아니라 넘긴다. 시작 덱에 없으면 이 색은 경감 수단이 0이 된다.
      { key: 'deflect', name: '유운신법', cost: 1, damage: 0, block: 0, count: 1, evade: 1 },
      { key: 'tuneup', name: '운기조식', cost: 1, damage: 0, block: 0, count: 2, draw: 1 },
      // 기세 순증 카드라 소멸(1회용)이 필수 — 안 그러면 덱이 다시 섞이면서
      // 무한히 재사용된다. 1회용인 대신 되감기 2로 크게 되돌린다.
      { key: 'rewind', name: '반박귀진', cost: 0, damage: 0, block: 0, count: 1, unique: true, exhaust: true, rewind: 2 },
      { key: 'chain', name: '연환장', cost: 2, damage: 12, block: 0, count: 1, draw: 1 },
      { key: 'overload_info', name: '행운유수', cost: 1, damage: 5, block: 0, count: 2, draw: 1 },
      // 패 파기 페이오프 — 흑(黑)은 드로우로 손패를 쌓으므로 그걸 화력으로 환전한다.
      // 파기한 장수는 다음 턴 보충에 포함되어 손패가 영구히 줄지 않는다.
      { key: 'memflush', name: '배수일전', cost: 2, damage: 4, block: 0, count: 1, discardAll: 5 },
    ],
    BLACK: [
      { key: 'guard', name: '금강불괴', cost: 1, damage: 0, block: 8, count: 3 },
      { key: 'anchor', name: '금강저', cost: 2, damage: 14, block: 3, count: 3 },
      { key: 'fortify', name: '반석세', cost: 1, damage: 0, block: 4, count: 2, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '반석세', amount: 2, turns: 2 } },
      { key: 'reboot', name: '반탄강기', cost: 2, damage: 0, block: 6, count: 1, counter: 8 },
      // 임계점 조작은 "틈이 큰 초식 한 장"과 짝을 이뤄야만 값을 한다 (파훼는
      // 한 장으로만 낼 수 있으므로). 그 짝이 없으면 완전한 백지 카드가 되므로
      // 최소한 몸값은 하도록 방어도를 붙였다.
      { key: 'threshold', name: '파계진언', cost: 2, damage: 0, block: 7, count: 1, breakThresholdDown: 1 },
    ],
    YELLOW: [
      { key: 'siphon', name: '흡성소법', cost: 1, damage: 7, block: 0, count: 3, hpCost: 1, lifesteal: 35 },
      { key: 'firstaid', name: '회춘결', cost: 1, damage: 0, block: 0, count: 3, heal: 6 },
      { key: 'corrode', name: '부식장', cost: 2, damage: 7, block: 0, count: 2, bossWeaken: true },
      { key: 'regen', name: '심법: 환혈공', cost: 1, damage: 0, block: 0, count: 1, effect: 'PERSISTENT_HEAL_ON_TURN_START', persistentPayload: { id: 'aura-heal-on-turn', name: '환혈공', amount: 3, turns: 2 } },
      { key: 'resolve', name: '혈기충천', cost: 1, damage: 13, block: 0, count: 1, hpCost: 2 },
    ],
  },

  // 보상 카드 풀 — 티어1은 스테이지 1~3, 티어2는 4~7, 티어3은 8~10 (gdd/09 9-3)
  // 티어1 풀은 시작 덱과 함께 섞여 나온다 (시작 덱 복사본만 나오던 문제 해소).
  REWARD_POOLS: {
    RED: {
      1: [
        { key: 'rapid_slash', name: '낙매분분', cost: 1, damage: 4, block: 0, chain: 3 },
        { key: 'counter_rage', name: '노화반격', cost: 2, damage: 8, block: 6 },
        { key: 'chain_wall', name: '매화방신', cost: 1, damage: 0, block: 2, chainBlock: 4 },
        // B라인(일격) — 연계가 "나중에 낼수록 강함"이면 이쪽은 "먼저 낼수록 강함"
        { key: 'draw_blade', name: '발도세', cost: 1, damage: 2, block: 0, deepStrike: 2 },
        { key: 'thunder_flash', name: '벽력일섬', cost: 2, damage: 4, block: 0, deepStrike: 3 },
        { key: 'flame_edge', name: '화룡수', cost: 2, damage: 11, block: 0 },
        { key: 'ignite', name: '발화결', cost: 1, damage: 4, block: 0, effect: 'REDUCE_NEXT_COST' },
        { key: 'double_load', name: '쌍수결', cost: 2, damage: 6, block: 0, draw: 1 },
      ],
      2: [
        { key: 'tamer_overdrive', name: '심법: 폭혈운기', cost: 3, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '폭혈운기', amount: 3, turns: 3 } },
        { key: 'option_warmup', name: '진법: 열기진', cost: 1, damage: 0, block: 0, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '열기진', amount: 4, turns: 2 } },
        { key: 'option_crackshot', name: '진법: 균열진', cost: 2, damage: 13, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '균열진', amount: 10, turns: 2 } },
        { key: 'flame_combo', name: '화염연격', cost: 3, damage: 20, block: 0 },
        { key: 'chain_storm', name: '연환폭풍', cost: 3, damage: 8, block: 0, chain: 5 },
        { key: 'heat_vent', name: '열기토납', cost: 2, damage: 9, block: 0, chainBlock: 4 },
        { key: 'sky_fall', name: '천붕일격', cost: 3, damage: 6, block: 0, deepStrike: 5 },
        { key: 'primal_stance', name: '혼원일기', cost: 2, damage: 0, block: 4, deepStrike: 4 },
      ],
      3: [
        { key: 'ultimate_core', name: '심법: 화경운기', cost: 4, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '화경운기', amount: 6, turns: 4 } },
        { key: 'final_detonation', name: '겁화만천', cost: 5, damage: 40, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '겁화만천', amount: 20, turns: 3 } },
        { key: 'decisive', name: '일검단천', cost: 6, damage: 48, block: 0 },
        { key: 'overdrive_chain', name: '폭혈연환', cost: 4, damage: 31, block: 0, draw: 1 },
        { key: 'chain_finale', name: '매화종막', cost: 5, damage: 20, block: 0, chain: 10 },
        { key: 'final_chain', name: '매화천강', cost: 4, damage: 12, block: 0, chain: 8 },
        { key: 'blaze_dance', name: '열화난무', cost: 3, damage: 6, block: 0, chain: 7, draw: 1 },
        { key: 'heat_armor', name: '화갑호신', cost: 3, damage: 8, block: 10, chainBlock: 6 },
        { key: 'heaven_rend', name: '개천벽력', cost: 5, damage: 12, block: 0, deepStrike: 8 },
        { key: 'world_split', name: '천지개벽', cost: 4, damage: 8, block: 0, deepStrike: 7 },
      ],
    },
    BLUE: {
      1: [
        { key: 'datashard', name: '편운수', cost: 1, damage: 6, block: 0 },
        { key: 'parallel_scan', name: '양의분심', cost: 1, damage: 0, block: 0, draw: 2 },
        { key: 'backup_circuit', name: '유수방신', cost: 2, damage: 4, block: 6 },
        { key: 'calc_boost', name: '청심결', cost: 2, damage: 8, block: 0, draw: 1 },
        { key: 'delay_loop', name: '완류세', cost: 3, damage: 0, block: 8, rewind: 1 },
        { key: 'cloud_step', name: '제운종', cost: 2, damage: 0, block: 0, evade: 1, draw: 1 },
        // B라인(점혈) — 적의 행동 자체를 자원으로 쓴다
        { key: 'meridian_cut', name: '기맥 차단', cost: 1, damage: 0, block: 0, drainPower: 2 },
        { key: 'point_strike', name: '점혈수법', cost: 2, damage: 5, block: 0, sealSkill: 2 },
      ],
      2: [
        { key: 'datastream', name: '유수연환', cost: 2, damage: 10, block: 0, draw: 2 },
        { key: 'hack', name: '사량발천', cost: 3, damage: 13, block: 0, rewind: 1 },
        { key: 'cache_amp', name: '진법: 양의진', cost: 2, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '양의진', amount: 2, turns: 3 } },
        { key: 'parallel', name: '양의쌍수', cost: 3, damage: 19, block: 0, draw: 1 },
        { key: 'cache_burn', name: '배수결의', cost: 2, damage: 6, block: 0, discardAll: 7 },
        { key: 'logic_bomb', name: '태극붕권', cost: 3, damage: 14, block: 8 },
        { key: 'defrag', name: '조식정기', cost: 3, damage: 0, block: 0, draw: 2, rewind: 1 },
        { key: 'redirect', name: '이화접목', cost: 2, damage: 0, block: 0, evade: 2 },
        { key: 'vital_lock', name: '사혈 제압', cost: 3, damage: 10, block: 0, sealSkill: 3 },
        { key: 'siphon_qi', name: '흡정공', cost: 2, damage: 6, block: 0, drainPower: 3 },
      ],
      3: [
        { key: 'overflow', name: '창해노도', cost: 4, damage: 31, block: 0, draw: 2 },
        { key: 'infinite_loop', name: '무극환류', cost: 4, damage: 0, block: 0, rewind: 2, draw: 2 },
        { key: 'codebreak', name: '태극파천', cost: 5, damage: 40, block: 0 },
        { key: 'system_down', name: '역천환류', cost: 5, damage: 39, block: 0, rewind: 2 },
        { key: 'infinite_calc', name: '만류귀종', cost: 4, damage: 30, block: 0, draw: 3 },
        { key: 'total_flush', name: '배수천붕', cost: 3, damage: 8, block: 0, discardAll: 11 },
        { key: 'deep_calc', name: '현천심법', cost: 5, damage: 34, block: 0, draw: 2, rewind: 1 },
        { key: 'firewall', name: '현무방벽', cost: 2, damage: 0, block: 18, draw: 1 },
        { key: 'taiji_step', name: '태극신법', cost: 3, damage: 0, block: 0, evade: 3, draw: 2 },
        { key: 'seal_meridian', name: '폐맥대법', cost: 4, damage: 14, block: 0, sealSkill: 4, drainPower: 3 },
        { key: 'heaven_net', name: '천라지망', cost: 3, damage: 0, block: 0, sealSkill: 3, evade: 1 },
      ],
    },
    BLACK: {
      1: [
        { key: 'ironwall', name: '철벽공', cost: 1, damage: 0, block: 7 },
        { key: 'shield_bash', name: '강기충', cost: 2, damage: 0, block: 0, blockToDamage: 1 },
        { key: 'counter_stance', name: '반탄세', cost: 1, damage: 0, block: 4, counter: 5 },
        { key: 'check_strike', name: '항마장', cost: 2, damage: 8, block: 4 },
        // B라인(파훼) — 초식이 무거워 몰아치기가 안 쌓이던 문제를 푸는 부품
        { key: 'kihap', name: '기합', cost: 1, damage: 0, block: 0, surge: 2 },
        { key: 'vajra_fist', name: '금강권', cost: 2, damage: 8, block: 0, surge: 1 },
      ],
      2: [
        { key: 'heavyarmor', name: '중갑호신', cost: 2, damage: 0, block: 12 },
        { key: 'counter_protocol', name: '반탄진기', cost: 2, damage: 0, block: 5, counter: 8 },
        { key: 'barrier', name: '진법: 나한진', cost: 3, damage: 0, block: 0, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '나한진', amount: 5, turns: 3 } },
        { key: 'steel_counter', name: '금강반탄', cost: 3, damage: 19, block: 8, counter: 6 },
        { key: 'rampart_strike', name: '벽력금강', cost: 3, damage: 5, block: 6, blockToDamage: 1 },
        { key: 'lion_roar', name: '사자후', cost: 2, damage: 0, block: 6, surge: 3 },
        { key: 'break_palm', name: '파계장', cost: 3, damage: 10, block: 0, breakThresholdDown: 1 },
      ],
      3: [
        { key: 'absolute_guard', name: '부동명왕', cost: 3, damage: 0, block: 20 },
        { key: 'threshold_collapse', name: '멸계진언', cost: 4, damage: 0, block: 16, breakThresholdDown: 2 },
        { key: 'anchor_finish', name: '금강멸적', cost: 5, damage: 39, block: 10 },
        { key: 'fortress', name: '철옹금성', cost: 4, damage: 0, block: 26, counter: 10 },
        { key: 'crush', name: '항마멸쇄', cost: 6, damage: 47, block: 8 },
        { key: 'absolute_reflect', name: '만법귀일', cost: 4, damage: 10, block: 12, blockToDamage: 1 },
        { key: 'demon_ward', name: '항마대진', cost: 4, damage: 0, block: 12, surge: 5 },
        { key: 'devil_slay', name: '멸마일격', cost: 5, damage: 20, block: 0, surge: 4 },
      ],
    },
    YELLOW: {
      1: [
        { key: 'bloodsuck', name: '흡혈수', cost: 1, damage: 6, block: 0, lifesteal: 35 },
        { key: 'life_cycle', name: '순환결', cost: 1, damage: 0, block: 0, heal: 6, draw: 1 },
        { key: 'endure', name: '인고결', cost: 2, damage: 10, block: 0, hpCost: 3 },
        { key: 'purify', name: '청혈결', cost: 1, damage: 0, block: 0, heal: 4, bossWeaken: true },
        // B라인(광기) — 흡성(되메우기)과 정반대로 HP를 낮게 유지할수록 강하다
        { key: 'blood_slash', name: '혈광참', cost: 1, damage: 3, block: 0, rageScale: 3 },
        { key: 'self_rend', name: '자해공', cost: 1, damage: 4, block: 0, hpCost: 6, rageScale: 2 },
      ],
      2: [
        { key: 'devotion', name: '사혈지법', cost: 2, damage: 13, block: 0, hpCost: 4 },
        { key: 'healing_light', name: '회광반조', cost: 2, damage: 0, block: 0, heal: 10 },
        { key: 'decay_spread', name: '진법: 부패진', cost: 2, damage: 13, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '부패진', amount: 15, turns: 2 } },
        { key: 'blood_pact', name: '혈계지약', cost: 3, damage: 20, block: 0, hpCost: 5 },
        { key: 'drain_wave', name: '흡성파', cost: 3, damage: 16, block: 0, lifesteal: 35 },
        { key: 'mad_dance', name: '광혈무', cost: 2, damage: 6, block: 0, rageScale: 5 },
        { key: 'qi_deviation', name: '마기폭주', cost: 2, damage: 4, block: 0, hpCost: 8, rageScale: 6 },
      ],
      3: [
        { key: 'sacrifice', name: '사혈일격', cost: 3, damage: 24, block: 0, hpCost: 8 },
        { key: 'great_regen', name: '대환단공', cost: 3, damage: 0, block: 0, heal: 12, effect: 'PERSISTENT_HEAL_ON_TURN_START', persistentPayload: { id: 'aura-heal-on-turn', name: '대환단공', amount: 3, turns: 3 } },
        { key: 'doom_pact', name: '멸혼혈약', cost: 5, damage: 40, block: 0, hpCost: 5 },
        { key: 'life_convert', name: '환혈전공', cost: 4, damage: 31, block: 0, heal: 5 },
        { key: 'final_awakening', name: '마혼각성', cost: 6, damage: 48, block: 0, hpCost: 10 },
        { key: 'great_drain', name: '흡성신공', cost: 5, damage: 36, block: 0, lifesteal: 35 },
        { key: 'blood_sea', name: '혈해마공', cost: 4, damage: 14, block: 0, rageScale: 9 },
        { key: 'annihilation', name: '멸절심공', cost: 5, damage: 20, block: 0, rageScale: 12 },
      ],
    },
  },

  // 카드 강화("+") — gdd/11-card-tiers.md 11-2. key → 덮어쓸 필드
  UPGRADES: {
    strike: { damage: 8 }, defend: { block: 9 }, breakthrough: { damage: 13 },
    focus: { draw: 1 }, chain_burst: { chain: 13 }, chainstrike: { chain: 8 },
    rapid_slash: { chain: 6 }, brace: { chainBlock: 6 }, flame_edge: { damage: 15 },
    ignite: { damage: 7 }, double_load: { damage: 9 }, counter_rage: { damage: 11 },
    chain_wall: { chainBlock: 8 },
    draw_blade: { deepStrike: 3 }, thunder_flash: { deepStrike: 5 },
    meridian_cut: { drainPower: 3 }, point_strike: { sealSkill: 3 },
    kihap: { surge: 3 }, vajra_fist: { damage: 11 },
    blood_slash: { rageScale: 5 }, self_rend: { rageScale: 4 },
    jab: { damage: 7 }, tuneup: { draw: 2 }, rewind: { rewind: 3 },
    datashard: { damage: 9 }, parallel_scan: { draw: 3 }, backup_circuit: { block: 9 },
    calc_boost: { damage: 11 }, delay_loop: { block: 12 },
    deflect: { evade: 2 }, cloud_step: { evade: 2 }, redirect: { evade: 3 },
    memflush: { discardAll: 7 },
    chain: { damage: 15 }, overload_info: { damage: 7 },
    guard: { block: 12 }, anchor: { damage: 17, block: 5 }, fortify: { block: 7 },
    ironwall: { block: 10 }, shield_bash: { damage: 5 }, counter_stance: { counter: 8 },
    check_strike: { damage: 11 },
    reboot: { counter: 9 }, threshold: { breakThresholdDown: 2 },
    siphon: { damage: 10 }, firstaid: { heal: 9 }, corrode: { damage: 8 },
    drain_wave: { damage: 20 },
    bloodsuck: { damage: 9 }, life_cycle: { heal: 9 }, endure: { damage: 13 },
    purify: { heal: 7 },
    regen: { heal: 5 }, resolve: { damage: 15 },
  },

  // ─────────────────────────────────────────────────────────────
  // 적 로스터 — gdd/10-enemy-roster.md
  // 기술 비용은 1~5 (E5까지만 유효 진입). 모든 적은 비용 1·쿨다운 0의
  // 기본 공격을 가져야 루프 종료가 보장된다 (gdd/08 8-2).
  // 피해 수치는 "마무리 일격" 규칙 도입 후 시뮬레이션으로 재조정된 값.
  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // 적 로스터 — gdd/10-enemy-roster.md
  // 개성을 만드는 두 축 (수치가 아니라 이 둘이 전술을 바꾼다):
  //   breakThreshold(빈틈): 파훼에 필요한 "한 합의 총 틈". 낮을수록 빨리
  //     무너진다. 한 합의 평균 몰아치기가 4~6이라 5~6은 자주, 8은 가끔,
  //     10 이상은 깊은 버퍼를 받은 합에만 가능하다 (gdd/02 2-2)
  //   closerStyle: 'DOMINANT'(패도, 가장 비싼 초식으로 마무리)
  //              | 'CRAFTY'(노회, 예산을 넘기는 것 중 가장 싼 것)  (gdd/08 8-4-1)
  // 초식의 틈은 1~6 (착지 상한이 적6). 모든 적은 틈 1·쿨다운 0의
  // 기본 공격을 가져야 루프 종료가 보장된다 (gdd/10 10-3).
  // ─────────────────────────────────────────────────────────────
  ENEMIES: [
    {
      name: '노상 낭인', icon: '🗡️', realm: '삼류', hp: 90,
      breakThreshold: 6, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '헛손질', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'power_charge', name: '기수식', cost: 2, kind: 'BUFF', powerGain: 1, blockGain: 6, cooldown: 4, priority: 20 },
        { key: 'heavy_strike', name: '내려베기', cost: 3, kind: 'ATTACK_WEAKEN', damage: 10, cooldown: 2, priority: 30 },
        { key: 'aoe_slam', name: '횡소천군', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 13, cooldown: 4, priority: 40 },
      ],
    },
    {
      name: '흑풍 도적', icon: '🪓', realm: '삼류', hp: 102,
      breakThreshold: 5, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '헛손질', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'dash', name: '흑풍보', cost: 2, kind: 'ATTACK', damage: 10, cooldown: 1, priority: 25 },
        { key: 'blast', name: '난도질', cost: 3, kind: 'ATTACK_VULNERABLE', damage: 13, cooldown: 3, priority: 35 },
      ],
    },
    {
      name: '철벽 무승', icon: '🛡️', realm: '이류', hp: 114,
      breakThreshold: 9, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '장타', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'plating', name: '금강신공', cost: 2, kind: 'BUFF', powerGain: 1, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'counter_charge', name: '나한권', cost: 3, kind: 'ATTACK_WEAKEN', damage: 11, cooldown: 2, priority: 30 },
        { key: 'temple_quake', name: '진산장', cost: 6, kind: 'ATTACK_VULNERABLE', damage: 16, cooldown: 4, priority: 40 },
      ],
    },
    {
      name: '쌍도 자객', icon: '🥷', realm: '이류', hp: 124,
      breakThreshold: 7, closerStyle: 'CRAFTY',
      skills: [
        { key: 'normal_attack', name: '스침', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'slash_combo', name: '연환도', cost: 2, kind: 'ATTACK', damage: 8, cooldown: 1, priority: 25 },
        { key: 'shadow_strike', name: '암향표', cost: 3, kind: 'ATTACK_WEAKEN', damage: 13, cooldown: 2, priority: 35 },
        { key: 'night_raid', name: '월야습', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 15, cooldown: 3, priority: 45 },
      ],
    },
    {
      name: '독무 술사', icon: '☠️', realm: '일류', hp: 119,
      breakThreshold: 7, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '독침', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'dark_cycle', name: '독공운기', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 8, cooldown: 4, priority: 20 },
        { key: 'curse', name: '부식독장', cost: 2, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 1, priority: 30 },
        { key: 'wither', name: '만독지기', cost: 3, kind: 'ATTACK_VULNERABLE', damage: 10, cooldown: 2, priority: 35 },
        { key: 'venom_tide', name: '독무창천', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 11, cooldown: 4, priority: 45 },
      ],
    },
    {
      // 빈틈이 작으면 자주 파훼당하므로 싸움이 짧아야 한다. 빈틈이 작은데
      // HP까지 높으면 소모전이 되어 버프가 누적되는 적에게 일방적으로
      // 유리해진다 (gdd/10 10-3).
      name: '폭혈 광인', icon: '🔥', realm: '일류', hp: 109,
      breakThreshold: 6, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '주먹질', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'amplify', name: '폭혈공', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 6, cooldown: 4, priority: 20 },
        { key: 'heavy_strike', name: '분쇄권', cost: 3, kind: 'ATTACK_WEAKEN', damage: 11, cooldown: 2, priority: 30 },
      ],
    },
    {
      name: '쌍생 검객', icon: '⚔️', realm: '절정', hp: 174,
      breakThreshold: 8, closerStyle: 'CRAFTY',
      skills: [
        { key: 'normal_attack', name: '견제검', cost: 1, kind: 'ATTACK', damage: 6, cooldown: 0, priority: 10 },
        { key: 'regroup', name: '쌍생운기', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'sync_hit', name: '합격검', cost: 2, kind: 'ATTACK', damage: 8, cooldown: 1, priority: 25 },
        { key: 'watcher_rage', name: '쌍룡출해', cost: 3, kind: 'ATTACK_WEAKEN', damage: 10, cooldown: 2, priority: 35 },
        { key: 'doom_gaze', name: '천라검막', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 13, cooldown: 4, priority: 45 },
      ],
    },
    {
      name: '심연 마승', icon: '🕯️', realm: '절정', hp: 194,
      breakThreshold: 6, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '염주격', cost: 1, kind: 'ATTACK', damage: 6, cooldown: 0, priority: 10 },
        { key: 'abyss_expand', name: '심연운기', cost: 3, kind: 'BUFF', powerGain: 2, blockGain: 12, cooldown: 4, priority: 20 },
        { key: 'erode', name: '탈혼장', cost: 2, kind: 'ATTACK_WEAKEN', damage: 10, cooldown: 1, priority: 30 },
        { key: 'devour', name: '아귀탄', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 13, cooldown: 3, priority: 45 },
      ],
    },
    {
      name: '혈마', icon: '👑', realm: '초절정', hp: 204,
      breakThreshold: 9, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '혈조수', cost: 1, kind: 'ATTACK', damage: 6, cooldown: 0, priority: 10 },
        { key: 'empower', name: '혈기운용', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'seize', name: '흡성대법', cost: 3, kind: 'ATTACK_WEAKEN', damage: 10, cooldown: 2, priority: 35 },
        { key: 'tyrant_mace', name: '혈랑파천', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 11, cooldown: 3, priority: 40 },
        { key: 'doom_verdict', name: '혈해무궁', cost: 6, kind: 'ATTACK_VULNERABLE', damage: 13, cooldown: 5, priority: 50 },
      ],
    },
    {
      name: '천마', icon: '💀', realm: '화경', hp: 231,
      breakThreshold: 9, closerStyle: 'CRAFTY',
      skills: [
        { key: 'normal_attack', name: '무형지기', cost: 1, kind: 'ATTACK', damage: 6, cooldown: 0, priority: 10 },
        { key: 'absolute_power', name: '천마신공', cost: 2, kind: 'BUFF', powerGain: 3, blockGain: 14, cooldown: 4, priority: 20 },
        { key: 'core_barrage', name: '삼재장', cost: 3, kind: 'ATTACK', damage: 11, cooldown: 1, priority: 30 },
        { key: 'collapse', name: '붕산권', cost: 4, kind: 'ATTACK_WEAKEN', damage: 13, cooldown: 3, priority: 40 },
        { key: 'judgment', name: '천마군림', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 13, cooldown: 4, priority: 50 },
        { key: 'final_calc', name: '멸천지세', cost: 6, kind: 'ATTACK_VULNERABLE', damage: 13, cooldown: 6, priority: 55 },
      ],
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // 신병이기 (gdd/14-weapons.md) — 문파와 곱해지는 둘째 축.
  //
  // 무기는 수치가 아니라 **규칙**을 비튼다. "피해 +3" 같은 것을 주면
  // 컬러의 출구와 경쟁하게 되고, 그러면 무기가 아니라 그냥 카드다.
  // 그리고 각 무기의 자원은 **어느 색도 쓰지 않는 것**이어야 한다 —
  // 겹치면 특정 조합만 정답이 된다 (gdd/14 14-3).
  //
  // 손은 둘뿐이다. 한손 둘을 쥐거나, 양손 하나를 쥔다.
  // ─────────────────────────────────────────────────────────────
  WEAPONS_ENABLED: true,
  WEAPON_SLOTS: 2,
  WEAPONS: {
    sword: {
      key: 'sword', name: '검(劍)', hands: 1, icon: '🗡',
      flavor: '쾌검은 크게 베지 않는다. 정확히 벤다.',
      rule: '선을 적1로 정확히 넘기면 적에게 피해 4',
      // 자원: 착지 정밀도. 시소의 "작게 넘길수록 크게 돌아온다"를 극단까지
      // 밀어붙인 조건이라, 어느 색도 이 축을 쓰지 않는다.
      // 합당 0.36회로 자주 터지는 편이라 한 방은 작게 잡는다.
      // 6이었을 때 초심자 도달이 맨손 4.52 → 5.40으로 혼자 튀었다.
      preciseLanding: 4,
    },
    saber: {
      key: 'saber', name: '도(刀)', hands: 2, icon: '⚔',
      flavor: '도는 두 번 휘두르지 않는다.',
      rule: '한 합의 첫 초식 피해 +5, 두 번째부터 피해 -3',
      // 자원: 초식 장수 — 다만 **역방향**이다. 적(赤)의 연계가 "나중에 낼수록
      // 강하다"인 반면 도는 "먼저 낼수록 강하다". 같은 자원을 반대로 읽으므로
      // 겹치는 게 아니라 정면으로 맞선다 (14-4의 긴장).
      // ⚠️ +9였을 때 초심자 도달이 맨손 4.40 → 5.75로 혼자 튀었다.
      // 조건이 사실상 매 합 성립해서(합당 0.86회) 다른 무기와 급이 달랐다.
      firstStrike: 5, afterFirstPenalty: 3,
    },
    spear: {
      key: 'spear', name: '창(槍)', hands: 2, icon: '🔱',
      flavor: '창은 가볍게 놀리는 병기가 아니다.',
      rule: '틈 3 이상의 무거운 초식은 피해 +12',
      // 자원: 초식의 틈 크기. 적(赤)의 일격은 "남은 버퍼가 깊을 때" 강하고
      // 이쪽은 "무거운 초식을 낼 때" 강하다 — 버퍼가 얕아도 무거운 한 방을
      // 낼 수 있으므로 둘은 갈린다.
      // ⚠️ 처음엔 "같은 초식을 거듭 낼 때"로 잡았다가 접었다. 같은 카드
      // 두 장을 한 합에 쥐고 낼 일이 거의 없어, 탐색 정책조차 합당 0.02회
      // (조건을 느슨하게 푼 뒤에도 0.20회)밖에 못 냈다.
      // 적 방어도 관통도 재 봤지만 적 방어도가 피해의 3%밖에 안 먹는다.
      // 합당 0.44회로 도(刀)의 절반쯤 터지므로 한 방이 그만큼 커야 한다.
      heavyCost: 3, heavyBonus: 12,
    },
    dagger: {
      key: 'dagger', name: '암기(暗器)', hands: 1, icon: '🎯',
      flavor: '길게 끌수록 손해 보는 쪽은 이쪽이 아니다.',
      rule: '두 합마다 공격 초식 피해 +1 (최대 +6)',
      // 자원: 전투 길이. 흑의 되감기가 "한 합을 늘린다"면 이쪽은 "전투를
      // 늘린다" — 단위가 달라 겹치지 않는다.
      attrition: 1, attritionCap: 6,
    },
    staff: {
      key: 'staff', name: '곤(棍)', hands: 2, icon: '🪵',
      flavor: '물러설 자리를 만드는 것도 무공이다.',
      rule: '방어도를 남긴 채 합을 넘기면 다음 합의 최소 반환 기세 +1',
      // 자원: 남은 방어도. 백의 방어도는 "맞아 내는" 용도인데 이쪽은
      // "안 쓰고 남기는" 용도라 요구하는 플레이가 정반대다.
      guardReturn: 1,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 걸음의 종류 (gdd/13-crossroads.md 13-2)
  //
  // needsChoice가 true면 걸음을 고른 뒤 한 번 더 고른다. 그래야 "수련장에
  // 갔다"가 "쉴 것인가 연마할 것인가"라는 두 번째 결정을 낳는다.
  // ─────────────────────────────────────────────────────────────
  NODES: {
    TRAINING: {
      key: 'TRAINING', name: '수련장(修練場)', icon: '⛩',
      blurb: '운기조식으로 숨을 돌리거나, 익힌 초식을 연마한다.',
      needsChoice: true,
    },
    TAVERN: {
      key: 'TAVERN', name: '주루(酒樓)', icon: '🍶',
      blurb: '앞길의 소문을 듣는다 — 다음 상대들의 빈틈과 성격. 잠시 쉬어간다.',
      needsChoice: false,
    },
    SECT_VISIT: {
      key: 'SECT_VISIT', name: '문파 방문', icon: '🏯',
      blurb: '익힌 초식 하나를 놓고, 본산의 비급이나 타 문파의 무공을 하나 배운다.',
      needsChoice: true,
    },
    FORTUNE: {
      key: 'FORTUNE', name: '기연(奇緣)', icon: '✨',
      blurb: '무엇이 기다리는지는 닿아 보아야 안다.',
      needsChoice: true,
    },
    ELITE: {
      key: 'ELITE', name: '비무대회(比武大會)', icon: '⚔',
      blurb: '앞길에서 만날 고수와 미리 겨룬다. 이기면 크게 얻고, 지면 여기서 끝난다.',
      needsChoice: false,
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 기연 (gdd/13-crossroads.md 13-5)
  //
  // 무협의 기연에는 언제나 대가가 붙는다. 대가 없는 기연은 그냥 무작위
  // 파워업이고, 그러면 "기연을 고를까"가 고민이 아니라 정답이 된다.
  // cost가 이 게임의 고유 축(최소 반환 기세 · 최대 체력 · 덱)을 건드리는
  // 쪽을 고른 이유는, HP나 확률로 지불하면 다른 규칙과 다른 언어가 되기
  // 때문이다.
  // ─────────────────────────────────────────────────────────────
  FORTUNES: [
    {
      key: 'elixir', name: '영약(靈藥)', icon: '🍵',
      story: '동굴 안쪽에 이름 모를 열매가 익어 있습니다. 기운은 웅혼하나 탁합니다.',
      gain: '최대 체력 +15 (즉시 그만큼 회복)',
      cost: '남은 강호행 내내 최소 반환 기세가 1 얕아집니다',
      apply: (run) => { run.playerMaxHp += 15; run.playerHp += 15; run.minReturn -= 1; },
      // 최소 반환은 1 이상을 지켜야 한다 — 0이면 합이 시작되지 않는다
      available: (run) => run.minReturn > 1,
    },
    {
      key: 'manual', name: '비급(祕笈)', icon: '📜',
      story: '무너진 서고에서 낡은 책자를 주웠습니다. 구결은 읽히나 몸이 따라주지 않습니다.',
      gain: '색 밖의 초식 한 자락 — 다만 구결뿐입니다',
      cost: '다음 수련장에서 한 걸음을 들여야 익혀집니다',
      apply: (run) => { run.pendingManual = true; },
      available: (run) => !run.pendingManual,
    },
    {
      key: 'demonic', name: '마공(魔功)', icon: '🩸',
      story: '핏자국이 마르지 않은 석벽에 초식 하나가 새겨져 있습니다. 익히면 되돌릴 수 없습니다.',
      gain: '금기의 초식 1장을 즉시 익힙니다',
      cost: '최대 체력 10을 영구히 잃습니다',
      apply: (run) => { run.playerMaxHp -= 10; run.playerHp = Math.min(run.playerHp, run.playerMaxHp); },
      available: (run) => run.playerMaxHp > 40,
    },
    {
      key: 'relic_blade', name: '신병이기(神兵利器)', icon: '🗡',
      story: '폐허가 된 대장간 한켠에 이름 없는 병기가 꽂혀 있습니다.',
      gain: '신병이기 한 자루',
      cost: '손이 다 찼다면 쥐고 있던 것을 놓아야 합니다',
      apply: () => {},
      available: (run) => TS_DATA.WEAPONS_ENABLED
        && Object.keys(TS_DATA.WEAPONS).some((k) => !run.weapons.includes(k)),
    },
    {
      key: 'hermit', name: '은거 고수', icon: '🧙',
      story: '낚싯대를 든 노인이 겨루자 합니다. 한 수 배우는 대신 짐을 덜라 합니다.',
      gain: '초식 1장을 연마합니다',
      cost: '덱에서 초식 1장을 잊습니다',
      apply: () => {},
      available: (run) => run.deck.length > 8,
    },
  ],

  // 기연 '마공'과 '비급'이 주는 색 밖의 초식. 시작 덱에도 보상 풀에도
  // 없는 것만 둔다 — 기연으로만 닿는다는 감각이 있어야 한다.
  FORTUNE_CARDS: {
    // 마공 — 강력하되 제 몸을 태운다
    demonic: [
      { key: 'blood_oath', name: '혈맹세', cost: 2, damage: 14, block: 0, hpCost: 6 },
      { key: 'demon_grasp', name: '마라수', cost: 3, damage: 10, block: 0, lifesteal: 60 },
      { key: 'soul_burn', name: '연혼결', cost: 2, damage: 8, block: 0, rageScale: 4 },
    ],
    // 비급 — 야전에서 익힌 무색 무공. 어느 문파에도 속하지 않는다
    manual: [
      { key: 'wanderer_step', name: '유운보', cost: 1, damage: 0, block: 6, draw: 1 },
      { key: 'field_cut', name: '야전참', cost: 2, damage: 9, block: 0 },
      { key: 'breath_art', name: '토납법', cost: 1, damage: 0, block: 4, heal: 5 },
    ],
  },
};
