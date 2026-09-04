// 카드/적/기세 데이터 — gdd/05, 09, 10, 11 문서 기준
const TS_DATA = {
  // 기세 축은 아6 ~ 적6 고정이다. 빈틈(breakThreshold)은 게이지 축의 칸이
  // 아니라 "한 합에 몰아쳐야 하는 총 틈"이므로 별개 눈금이다 (gdd/02 2-2).
  GAUGE_MIN: -6,
  GAUGE_MAX: 6,
  STARTING_GAUGE: -3, // 아3
  STARTING_PLAYER_HP: 80,
  HAND_SIZE: 5, // 시작 핸드 크기 (이후로는 사용한 만큼만 보충 — gdd 07 문서)
  DRAW_ACTION_COST: 2, // "숨 고르기"가 내주는 기세 (적 쪽으로 미는 양)
  DRAW_ACTION_CARDS: 1, // "숨 고르기"로 뽑는 카드 수
  COMBO_THRESHOLD: 3, // 이번 합의 카드 사용 수가 이 값에 도달할 때마다 추가 드로우
  MIN_MOMENTUM_RETURN: 3, // 적 페이즈가 끝날 때 보장되는 최소 기세(아3)
  STAGE_HEAL_RATIO: 0.5, // 스테이지 클리어 후 잃은 체력의 50% 회복 (gdd 09 문서 9-4)
  REWARD_CHOICES: 3, // 보상으로 제시되는 카드 장수

  // ─────────────────────────────────────────────────────────────
  // 카드 효과 필드 (gdd/05-mvp-spec.md 5-1)
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
    RED: { name: '적(赤)', sect: '화산파', icon: '🌸', desc: '초식을 이어 쓸수록 커지는 연환으로 한 합에 터뜨리는 문파' },
    BLUE: { name: '흑(黑)', sect: '무당파', icon: '☯', desc: '기세를 되감아 합을 늘리고, 쌓인 손패를 한 번에 환전하는 문파' },
    BLACK: { name: '백(白)', sect: '금강사', icon: '卍', desc: '금강불괴와 반탄강기로 버티고 파훼 임계점을 끌어내리는 문파' },
    YELLOW: { name: '자(紫)', sect: '마교', icon: '血', desc: '제 피를 태워 초식을 내고 흡성으로 되메우는 금기의 무공' },
  },

  // 시작 덱 (컬러별 10장) — gdd/11-card-tiers.md
  STARTER_DECKS: {
    // 적(赤)은 "여러 장을 모아 한 합에 연계로 터뜨리는" 문파 — chain 카드가 축이다.
    RED: [
      { key: 'strike', name: '매화점점', cost: 1, damage: 5, block: 0, count: 2, desc: '피해 5' },
      { key: 'defend', name: '호신강기', cost: 1, damage: 0, block: 6, count: 2, desc: '방어도 6' },
      { key: 'brace', name: '기수응세', cost: 1, damage: 0, block: 5, count: 1, chainBlock: 4, desc: '방어도 5 + 이번 합에 쓴 초식 1장당 방어도 4' },
      { key: 'breakthrough', name: '파옥일섬', cost: 2, damage: 9, block: 0, count: 2, effect: 'REDUCE_NEXT_COST', desc: '피해 9, 다음 초식의 틈 -1' },
      { key: 'focus', name: '축기결', cost: 1, damage: 0, block: 0, count: 1, effect: 'DOUBLE_NEXT_ATTACK', desc: '다음 공격 카드 피해 2배' },
      { key: 'chainstrike', name: '연환매화', cost: 1, damage: 3, block: 0, count: 1, chain: 4, desc: '피해 3 + 이번 합에 쓴 초식 1장당 피해 4' },
      { key: 'chain_burst', name: '매화만개', cost: 3, damage: 8, block: 0, count: 1, chain: 7, desc: '피해 8 + 이번 합에 쓴 초식 1장당 피해 7' },
    ],
    BLUE: [
      { key: 'jab', name: '점혈수', cost: 1, damage: 5, block: 0, count: 2, desc: '피해 5' },
      // 흑의 생존 수단은 방어도가 아니라 흘리기다 — 사량발천근의 그림 그대로,
      // 깎는 게 아니라 넘긴다. 시작 덱에 없으면 이 색은 경감 수단이 0이 된다.
      { key: 'deflect', name: '유운신법', cost: 1, damage: 0, block: 0, count: 1, evade: 1, desc: '다음 피격 1회를 흘려보냄' },
      { key: 'tuneup', name: '운기조식', cost: 1, damage: 0, block: 0, count: 2, draw: 1, desc: '카드 1장 드로우' },
      // 기세 순증 카드라 소멸(1회용)이 필수 — 안 그러면 덱이 다시 섞이면서
      // 무한히 재사용된다. 1회용인 대신 되감기 2로 크게 되돌린다.
      { key: 'rewind', name: '반박귀진', cost: 0, damage: 0, block: 0, count: 1, unique: true, exhaust: true, rewind: 2, desc: '틈 0 · 기세 2 회복 · 사용 후 소멸' },
      { key: 'chain', name: '연환장', cost: 2, damage: 12, block: 0, count: 1, draw: 1, desc: '피해 12, 카드 1장 드로우' },
      { key: 'overload_info', name: '행운유수', cost: 1, damage: 5, block: 0, count: 2, draw: 1, desc: '피해 5, 카드 1장 드로우' },
      // 패 파기 페이오프 — 흑(黑)은 드로우로 손패를 쌓으므로 그걸 화력으로 환전한다.
      // 파기한 장수는 다음 턴 보충에 포함되어 손패가 영구히 줄지 않는다.
      { key: 'memflush', name: '배수일전', cost: 2, damage: 4, block: 0, count: 1, discardAll: 5, desc: '피해 4 + 손패를 전부 파기하고 버린 1장당 피해 5' },
    ],
    BLACK: [
      { key: 'guard', name: '금강불괴', cost: 1, damage: 0, block: 8, count: 3, desc: '방어도 8' },
      { key: 'anchor', name: '금강저', cost: 2, damage: 11, block: 3, count: 3, desc: '피해 9, 방어도 3' },
      { key: 'fortify', name: '반석세', cost: 1, damage: 0, block: 4, count: 2, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '반석세', amount: 2, turns: 2 }, desc: '방어도 4, 2합간 합 시작 시 방어도 +2' },
      { key: 'reboot', name: '반탄강기', cost: 2, damage: 0, block: 6, count: 1, counter: 8, desc: '방어도 6, 다음 피격 시 반탄 8' },
      // 임계점 조작은 "틈이 큰 초식 한 장"과 짝을 이뤄야만 값을 한다 (파훼는
      // 한 장으로만 낼 수 있으므로). 그 짝이 없으면 완전한 백지 카드가 되므로
      // 최소한 몸값은 하도록 방어도를 붙였다.
      { key: 'threshold', name: '파계진언', cost: 2, damage: 0, block: 7, count: 1, breakThresholdDown: 2, desc: '방어도 7, 이번 전투 빈틈 2 감소' },
    ],
    YELLOW: [
      { key: 'siphon', name: '흡성소법', cost: 1, damage: 7, block: 0, count: 3, hpCost: 1, lifesteal: 50, desc: 'HP 1 소모, 피해 7, 입힌 피해의 50% 회복' },
      { key: 'firstaid', name: '회춘결', cost: 1, damage: 0, block: 0, count: 3, heal: 8, desc: '체력 8 회복' },
      { key: 'corrode', name: '부식장', cost: 2, damage: 7, block: 0, count: 2, bossWeaken: true, desc: '피해 7, 다음 적 공격 피해 -25%' },
      { key: 'regen', name: '심법: 환혈공', cost: 1, damage: 0, block: 0, count: 1, effect: 'PERSISTENT_HEAL_ON_TURN_START', persistentPayload: { id: 'aura-heal-on-turn', name: '환혈공', amount: 5, turns: 2 }, desc: '2합간 합 시작 시 체력 5 회복' },
      { key: 'resolve', name: '혈기충천', cost: 1, damage: 13, block: 0, count: 1, hpCost: 2, desc: 'HP 2 소모, 피해 13' },
    ],
  },

  // 보상 카드 풀 — 티어1은 스테이지 1~3, 티어2는 4~7, 티어3은 8~10 (gdd/09 9-3)
  // 티어1 풀은 시작 덱과 함께 섞여 나온다 (시작 덱 복사본만 나오던 문제 해소).
  REWARD_POOLS: {
    RED: {
      1: [
        { key: 'rapid_slash', name: '낙매분분', cost: 1, damage: 4, block: 0, chain: 3, desc: '피해 4 + 이번 합에 쓴 초식 1장당 피해 3' },
        { key: 'counter_rage', name: '노화반격', cost: 2, damage: 8, block: 6, desc: '피해 8, 방어도 6' },
        { key: 'chain_wall', name: '매화방신', cost: 1, damage: 0, block: 2, chainBlock: 4, desc: '방어도 2 + 이번 합에 쓴 초식 1장당 방어도 4' },
        { key: 'flame_edge', name: '화룡수', cost: 2, damage: 11, block: 0, desc: '피해 11' },
        { key: 'ignite', name: '발화결', cost: 1, damage: 4, block: 0, effect: 'REDUCE_NEXT_COST', desc: '피해 4, 다음 초식의 틈 -1' },
        { key: 'double_load', name: '쌍수결', cost: 2, damage: 6, block: 0, draw: 1, desc: '피해 6, 카드 1장 드로우' },
      ],
      2: [
        { key: 'tamer_overdrive', name: '심법: 폭혈운기', cost: 3, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '폭혈운기', amount: 3, turns: 3 }, desc: '3합간 공격 초식 피해 +3' },
        { key: 'option_warmup', name: '진법: 열기진', cost: 1, damage: 0, block: 0, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '열기진', amount: 4, turns: 2 }, desc: '2합간 합 시작 시 방어도 +4' },
        { key: 'option_crackshot', name: '진법: 균열진', cost: 2, damage: 13, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '균열진', amount: 10, turns: 2 }, desc: '피해 13, 2합간 적이 받는 피해 +10%' },
        { key: 'flame_combo', name: '화염연격', cost: 3, damage: 20, block: 0, desc: '피해 20' },
        { key: 'chain_storm', name: '연환폭풍', cost: 3, damage: 8, block: 0, chain: 5, desc: '피해 8 + 이번 합에 쓴 초식 1장당 피해 5' },
        { key: 'heat_vent', name: '열기토납', cost: 2, damage: 9, block: 0, chainBlock: 4, desc: '피해 9 + 이번 합에 쓴 초식 1장당 방어도 4' },
      ],
      3: [
        { key: 'ultimate_core', name: '심법: 화경운기', cost: 4, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '화경운기', amount: 6, turns: 4 }, desc: '4합간 공격 초식 피해 +6' },
        { key: 'final_detonation', name: '겁화만천', cost: 5, damage: 40, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '겁화만천', amount: 20, turns: 3 }, desc: '피해 40, 3합간 적이 받는 피해 +20%' },
        { key: 'decisive', name: '일검단천', cost: 6, damage: 48, block: 0, desc: '피해 48 (중립에서 쓰면 곧바로 파훼)' },
        { key: 'overdrive_chain', name: '폭혈연환', cost: 4, damage: 31, block: 0, draw: 1, desc: '피해 31, 카드 1장 드로우' },
        { key: 'chain_finale', name: '매화종막', cost: 5, damage: 20, block: 0, chain: 10, desc: '피해 20 + 이번 합에 쓴 초식 1장당 피해 10' },
        { key: 'final_chain', name: '매화천강', cost: 4, damage: 12, block: 0, chain: 8, desc: '피해 12 + 이번 합에 쓴 초식 1장당 피해 8' },
        { key: 'blaze_dance', name: '열화난무', cost: 3, damage: 6, block: 0, chain: 7, draw: 1, desc: '피해 6 + 이번 합에 쓴 초식 1장당 피해 7, 카드 1장 드로우' },
        { key: 'heat_armor', name: '화갑호신', cost: 3, damage: 8, block: 10, chainBlock: 6, desc: '피해 8, 방어도 10 + 이번 합에 쓴 초식 1장당 방어도 6' },
      ],
    },
    BLUE: {
      1: [
        { key: 'datashard', name: '편운수', cost: 1, damage: 6, block: 0, desc: '피해 6' },
        { key: 'parallel_scan', name: '양의분심', cost: 1, damage: 0, block: 0, draw: 2, desc: '카드 2장 드로우' },
        { key: 'backup_circuit', name: '유수방신', cost: 2, damage: 4, block: 6, desc: '피해 4, 방어도 6' },
        { key: 'calc_boost', name: '청심결', cost: 2, damage: 8, block: 0, draw: 1, desc: '피해 8, 카드 1장 드로우' },
        { key: 'delay_loop', name: '완류세', cost: 2, damage: 0, block: 8, rewind: 1, desc: '방어도 8, 기세 1 되감기' },
        { key: 'cloud_step', name: '제운종', cost: 2, damage: 0, block: 0, evade: 1, draw: 1, desc: '다음 피격 1회를 흘려보냄, 카드 1장 드로우' },
      ],
      2: [
        { key: 'datastream', name: '유수연환', cost: 2, damage: 10, block: 0, draw: 2, desc: '피해 10, 카드 2장 드로우' },
        { key: 'hack', name: '사량발천', cost: 2, damage: 13, block: 0, rewind: 1, desc: '피해 13, 기세 1 되감기' },
        { key: 'cache_amp', name: '진법: 양의진', cost: 2, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '양의진', amount: 2, turns: 3 }, desc: '3합간 공격 초식 피해 +2' },
        { key: 'parallel', name: '양의쌍수', cost: 3, damage: 19, block: 0, draw: 1, desc: '피해 19, 카드 1장 드로우' },
        { key: 'cache_burn', name: '배수결의', cost: 2, damage: 6, block: 0, discardAll: 7, desc: '피해 6 + 파기한 1장당 피해 7' },
        { key: 'logic_bomb', name: '태극붕권', cost: 3, damage: 14, block: 8, desc: '피해 14, 방어도 8' },
        { key: 'defrag', name: '조식정기', cost: 2, damage: 0, block: 0, draw: 2, rewind: 1, desc: '카드 2장 드로우, 기세 1 되감기' },
        { key: 'redirect', name: '이화접목', cost: 2, damage: 0, block: 0, evade: 2, desc: '다음 피격 2회를 흘려보냄' },
      ],
      3: [
        { key: 'overflow', name: '창해노도', cost: 4, damage: 31, block: 0, draw: 2, desc: '피해 31, 카드 2장 드로우' },
        { key: 'infinite_loop', name: '무극환류', cost: 3, damage: 0, block: 0, rewind: 2, draw: 2, desc: '기세 2 되감기, 카드 2장 드로우' },
        { key: 'codebreak', name: '태극파천', cost: 5, damage: 40, block: 0, desc: '피해 40' },
        { key: 'system_down', name: '역천환류', cost: 5, damage: 39, block: 0, rewind: 2, desc: '피해 39, 기세 2 되감기' },
        { key: 'infinite_calc', name: '만류귀종', cost: 4, damage: 30, block: 0, draw: 3, desc: '피해 30, 카드 3장 드로우' },
        { key: 'total_flush', name: '배수천붕', cost: 3, damage: 8, block: 0, discardAll: 11, desc: '피해 8 + 파기한 1장당 피해 11' },
        { key: 'deep_calc', name: '현천심법', cost: 5, damage: 34, block: 0, draw: 2, rewind: 1, desc: '피해 34, 카드 2장 드로우, 기세 1 되감기' },
        { key: 'firewall', name: '현무방벽', cost: 2, damage: 0, block: 18, draw: 1, desc: '방어도 18, 카드 1장 드로우' },
        { key: 'taiji_step', name: '태극신법', cost: 3, damage: 0, block: 0, evade: 3, draw: 2, desc: '다음 피격 3회를 흘려보냄, 카드 2장 드로우' },
      ],
    },
    BLACK: {
      1: [
        { key: 'ironwall', name: '철벽공', cost: 1, damage: 0, block: 7, desc: '방어도 7' },
        { key: 'shield_bash', name: '강기충', cost: 2, damage: 0, block: 0, blockToDamage: 1, desc: '현재 방어도만큼 피해' },
        { key: 'counter_stance', name: '반탄세', cost: 1, damage: 0, block: 4, counter: 5, desc: '방어도 4, 다음 피격 시 반탄 5' },
        { key: 'check_strike', name: '항마장', cost: 2, damage: 8, block: 4, desc: '피해 8, 방어도 4' },
      ],
      2: [
        { key: 'heavyarmor', name: '중갑호신', cost: 2, damage: 0, block: 12, desc: '방어도 10' },
        { key: 'counter_protocol', name: '반탄진기', cost: 2, damage: 0, block: 5, counter: 8, desc: '방어도 5, 다음 피격 시 반탄 8' },
        { key: 'barrier', name: '진법: 나한진', cost: 3, damage: 0, block: 0, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '나한진', amount: 5, turns: 3 }, desc: '3합간 합 시작 시 방어도 +5' },
        { key: 'steel_counter', name: '금강반탄', cost: 3, damage: 19, block: 8, counter: 6, desc: '피해 19, 방어도 8, 반격 6' },
        { key: 'rampart_strike', name: '벽력금강', cost: 3, damage: 5, block: 6, blockToDamage: 1, desc: '피해 5 + 현재 방어도만큼, 방어도 6' },
      ],
      3: [
        { key: 'absolute_guard', name: '부동명왕', cost: 3, damage: 0, block: 20, desc: '방어도 17' },
        { key: 'threshold_collapse', name: '멸계진언', cost: 4, damage: 0, block: 16, breakThresholdDown: 4, desc: '방어도 16, 빈틈 4 감소' },
        { key: 'anchor_finish', name: '금강멸적', cost: 5, damage: 39, block: 10, desc: '피해 39, 방어도 10' },
        { key: 'fortress', name: '철옹금성', cost: 4, damage: 0, block: 26, counter: 10, desc: '방어도 22, 반격 10' },
        { key: 'crush', name: '항마멸쇄', cost: 6, damage: 47, block: 8, desc: '피해 47, 방어도 8' },
        { key: 'absolute_reflect', name: '만법귀일', cost: 4, damage: 10, block: 12, blockToDamage: 1, desc: '피해 10 + 현재 방어도만큼, 방어도 12' },
      ],
    },
    YELLOW: {
      1: [
        { key: 'bloodsuck', name: '흡혈수', cost: 1, damage: 6, block: 0, lifesteal: 50, desc: '피해 6, 입힌 피해의 50% 회복' },
        { key: 'life_cycle', name: '순환결', cost: 1, damage: 0, block: 0, heal: 6, draw: 1, desc: '체력 6 회복, 카드 1장 드로우' },
        { key: 'endure', name: '인고결', cost: 2, damage: 10, block: 0, hpCost: 3, desc: 'HP 3 소모, 피해 10' },
        { key: 'purify', name: '청혈결', cost: 1, damage: 0, block: 0, heal: 4, bossWeaken: true, desc: '체력 4 회복, 다음 적 공격 피해 -25%' },
      ],
      2: [
        { key: 'devotion', name: '사혈지법', cost: 2, damage: 13, block: 0, hpCost: 4, desc: 'HP 4 소모, 피해 13' },
        { key: 'healing_light', name: '회광반조', cost: 2, damage: 0, block: 0, heal: 14, desc: '체력 14 회복' },
        { key: 'decay_spread', name: '진법: 부패진', cost: 2, damage: 13, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '부패진', amount: 15, turns: 2 }, desc: '피해 13, 2합간 적이 받는 피해 +15%' },
        { key: 'blood_pact', name: '혈계지약', cost: 3, damage: 20, block: 0, hpCost: 5, desc: 'HP 5 소모, 피해 20' },
        { key: 'drain_wave', name: '흡성파', cost: 3, damage: 16, block: 0, lifesteal: 50, desc: '피해 16, 입힌 피해의 50% 회복' },
      ],
      3: [
        { key: 'sacrifice', name: '사혈일격', cost: 3, damage: 24, block: 0, hpCost: 8, desc: 'HP 8 소모, 피해 24' },
        { key: 'great_regen', name: '대환단공', cost: 3, damage: 0, block: 0, heal: 18, effect: 'PERSISTENT_HEAL_ON_TURN_START', persistentPayload: { id: 'aura-heal-on-turn', name: '대환단공', amount: 4, turns: 3 }, desc: '체력 18 회복, 3합간 합 시작 시 4 회복' },
        { key: 'doom_pact', name: '멸혼혈약', cost: 5, damage: 40, block: 0, hpCost: 5, desc: 'HP 5 소모, 피해 40' },
        { key: 'life_convert', name: '환혈전공', cost: 4, damage: 31, block: 0, heal: 8, desc: '피해 31, 체력 8 회복' },
        { key: 'final_awakening', name: '마혼각성', cost: 6, damage: 48, block: 0, hpCost: 10, desc: 'HP 10 소모, 피해 48' },
        { key: 'great_drain', name: '흡성신공', cost: 5, damage: 36, block: 0, lifesteal: 50, desc: '피해 36, 입힌 피해의 50% 회복' },
      ],
    },
  },

  // 카드 강화("+") — gdd/11-card-tiers.md 11-2. key → 덮어쓸 필드
  UPGRADES: {
    strike: { damage: 8 }, defend: { block: 9 }, breakthrough: { damage: 13 },
    focus: { draw: 1 }, chain_burst: { chain: 10 }, chainstrike: { chain: 6 },
    rapid_slash: { chain: 5 }, brace: { chainBlock: 5 }, flame_edge: { damage: 15 },
    ignite: { damage: 7 }, double_load: { damage: 9 }, counter_rage: { damage: 11 },
    chain_wall: { chainBlock: 6 },
    jab: { damage: 7 }, tuneup: { draw: 2 }, rewind: { rewind: 3 },
    datashard: { damage: 9 }, parallel_scan: { draw: 3 }, backup_circuit: { block: 9 },
    calc_boost: { damage: 11 }, delay_loop: { block: 12 },
    deflect: { evade: 2 }, cloud_step: { evade: 2 }, redirect: { evade: 3 },
    memflush: { discardAll: 7 },
    chain: { damage: 9 }, overload_info: { damage: 4 },
    guard: { block: 12 }, anchor: { damage: 13, block: 5 }, fortify: { block: 7 },
    ironwall: { block: 10 }, shield_bash: { damage: 5 }, counter_stance: { counter: 8 },
    check_strike: { damage: 11 },
    reboot: { counter: 9 }, threshold: { breakThresholdDown: 3 },
    siphon: { damage: 10 }, firstaid: { heal: 12 }, corrode: { damage: 8 },
    drain_wave: { damage: 20 },
    bloodsuck: { damage: 9 }, life_cycle: { heal: 9 }, endure: { damage: 13 },
    purify: { heal: 7 },
    regen: { heal: 7 }, resolve: { damage: 15 },
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
      name: '노상 낭인', icon: '🗡️', realm: '삼류', hp: 75,
      breakThreshold: 7, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '헛손질', cost: 1, kind: 'ATTACK', damage: 2, cooldown: 0, priority: 10 },
        { key: 'power_charge', name: '기수식', cost: 2, kind: 'BUFF', powerGain: 1, blockGain: 6, cooldown: 4, priority: 20 },
        { key: 'heavy_strike', name: '내려베기', cost: 3, kind: 'ATTACK_WEAKEN', damage: 4, cooldown: 2, priority: 30 },
        { key: 'aoe_slam', name: '횡소천군', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 5, cooldown: 4, priority: 40 },
      ],
    },
    {
      name: '흑풍 도적', icon: '🪓', realm: '삼류', hp: 85,
      breakThreshold: 6, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '헛손질', cost: 1, kind: 'ATTACK', damage: 2, cooldown: 0, priority: 10 },
        { key: 'dash', name: '흑풍보', cost: 2, kind: 'ATTACK', damage: 4, cooldown: 1, priority: 25 },
        { key: 'blast', name: '난도질', cost: 3, kind: 'ATTACK_VULNERABLE', damage: 6, cooldown: 3, priority: 35 },
      ],
    },
    {
      name: '철벽 무승', icon: '🛡️', realm: '이류', hp: 95,
      breakThreshold: 12, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '장타', cost: 1, kind: 'ATTACK', damage: 3, cooldown: 0, priority: 10 },
        { key: 'plating', name: '금강신공', cost: 2, kind: 'BUFF', powerGain: 1, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'counter_charge', name: '나한권', cost: 3, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 2, priority: 30 },
        { key: 'temple_quake', name: '진산장', cost: 6, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 4, priority: 40 },
      ],
    },
    {
      name: '쌍도 자객', icon: '🥷', realm: '이류', hp: 108,
      breakThreshold: 9, closerStyle: 'CRAFTY',
      skills: [
        { key: 'normal_attack', name: '스침', cost: 1, kind: 'ATTACK', damage: 3, cooldown: 0, priority: 10 },
        { key: 'slash_combo', name: '연환도', cost: 2, kind: 'ATTACK', damage: 5, cooldown: 1, priority: 25 },
        { key: 'shadow_strike', name: '암향표', cost: 3, kind: 'ATTACK_WEAKEN', damage: 7, cooldown: 2, priority: 35 },
        { key: 'night_raid', name: '월야습', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 3, priority: 45 },
      ],
    },
    {
      name: '독무 술사', icon: '☠️', realm: '일류', hp: 120,
      breakThreshold: 9, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '독침', cost: 1, kind: 'ATTACK', damage: 4, cooldown: 0, priority: 10 },
        { key: 'dark_cycle', name: '독공운기', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 8, cooldown: 4, priority: 20 },
        { key: 'curse', name: '부식독장', cost: 2, kind: 'ATTACK_WEAKEN', damage: 5, cooldown: 1, priority: 30 },
        { key: 'wither', name: '만독지기', cost: 3, kind: 'ATTACK_VULNERABLE', damage: 7, cooldown: 2, priority: 35 },
        { key: 'venom_tide', name: '독무창천', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 4, priority: 45 },
      ],
    },
    {
      // 빈틈이 작으면 자주 파훼당하므로 싸움이 짧아야 한다. 빈틈이 작은데
      // HP까지 높으면 소모전이 되어 버프가 누적되는 적에게 일방적으로
      // 유리해진다 (gdd/10 10-3).
      name: '폭혈 광인', icon: '🔥', realm: '일류', hp: 100,
      breakThreshold: 6, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '주먹질', cost: 1, kind: 'ATTACK', damage: 4, cooldown: 0, priority: 10 },
        { key: 'amplify', name: '폭혈공', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 6, cooldown: 4, priority: 20 },
        { key: 'heavy_strike', name: '분쇄권', cost: 3, kind: 'ATTACK_WEAKEN', damage: 9, cooldown: 2, priority: 30 },
      ],
    },
    {
      name: '쌍생 검객', icon: '⚔️', realm: '절정', hp: 150,
      breakThreshold: 10, closerStyle: 'CRAFTY',
      skills: [
        { key: 'normal_attack', name: '견제검', cost: 1, kind: 'ATTACK', damage: 4, cooldown: 0, priority: 10 },
        { key: 'regroup', name: '쌍생운기', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'sync_hit', name: '합격검', cost: 2, kind: 'ATTACK', damage: 5, cooldown: 1, priority: 25 },
        { key: 'watcher_rage', name: '쌍룡출해', cost: 3, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 2, priority: 35 },
        { key: 'doom_gaze', name: '천라검막', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 4, priority: 45 },
      ],
    },
    {
      name: '심연 마승', icon: '🕯️', realm: '절정', hp: 168,
      breakThreshold: 8, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '염주격', cost: 1, kind: 'ATTACK', damage: 4, cooldown: 0, priority: 10 },
        { key: 'abyss_expand', name: '심연운기', cost: 3, kind: 'BUFF', powerGain: 2, blockGain: 12, cooldown: 4, priority: 20 },
        { key: 'erode', name: '탈혼장', cost: 2, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 1, priority: 30 },
        { key: 'devour', name: '아귀탄', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 3, priority: 45 },
      ],
    },
    {
      name: '혈마', icon: '👑', realm: '초절정', hp: 185,
      breakThreshold: 12, closerStyle: 'DOMINANT',
      skills: [
        { key: 'normal_attack', name: '혈조수', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'empower', name: '혈기운용', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'seize', name: '흡성대법', cost: 3, kind: 'ATTACK_WEAKEN', damage: 8, cooldown: 2, priority: 35 },
        { key: 'tyrant_mace', name: '혈랑파천', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 3, priority: 40 },
        { key: 'doom_verdict', name: '혈해무궁', cost: 6, kind: 'ATTACK_VULNERABLE', damage: 11, cooldown: 5, priority: 50 },
      ],
    },
    {
      name: '천마', icon: '💀', realm: '화경', hp: 210,
      breakThreshold: 13, closerStyle: 'CRAFTY',
      skills: [
        { key: 'normal_attack', name: '무형지기', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'absolute_power', name: '천마신공', cost: 2, kind: 'BUFF', powerGain: 3, blockGain: 14, cooldown: 4, priority: 20 },
        { key: 'core_barrage', name: '삼재장', cost: 3, kind: 'ATTACK', damage: 9, cooldown: 1, priority: 30 },
        { key: 'collapse', name: '붕산권', cost: 4, kind: 'ATTACK_WEAKEN', damage: 10, cooldown: 3, priority: 40 },
        { key: 'judgment', name: '천마군림', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 12, cooldown: 4, priority: 50 },
        { key: 'final_calc', name: '멸천지세', cost: 6, kind: 'ATTACK_VULNERABLE', damage: 12, cooldown: 6, priority: 55 },
      ],
    },
  ],
};
