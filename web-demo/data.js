// 카드/적/게이지 데이터 — gdd/05, 09, 10, 11 문서 기준
const TS_DATA = {
  GAUGE_MIN: -6,
  GAUGE_MAX: 6,
  BREAK_THRESHOLD: 6,
  STARTING_GAUGE: -3, // P3
  STARTING_PLAYER_HP: 80,
  HAND_SIZE: 5, // 시작 핸드 크기 (이후로는 사용한 만큼만 보충 — gdd 07 문서)
  PASS_MEMORY_PENALTY: 3, // 패스 시 보스에게 상납하는 메모리(게이지 이동량)
  PASS_BONUS_DRAW: 1, // 메모리 상납 직후 보상으로 드로우하는 카드 수
  COMBO_THRESHOLD: 3, // 이번 턴 카드 사용 수가 이 값에 도달할 때마다 추가 드로우
  MIN_MEMORY_RETURN: 3, // 보스 페이즈가 끝날 때 보장되는 최소 메모리(P3)
  STAGE_HEAL_RATIO: 0.5, // 스테이지 클리어 후 잃은 체력의 50% 회복 (gdd 09 문서 9-4)
  REWARD_CHOICES: 3, // 보상으로 제시되는 카드 장수

  // ─────────────────────────────────────────────────────────────
  // 카드 효과 필드 (gdd/05-mvp-spec.md 5-1)
  //   effect: 태그형 1회성/지속 효과
  //   draw / rewind / heal / hpCost / counter / breakThresholdDown / bossWeaken:
  //     숫자 필드로 표현되는 단순 효과 (여러 개 동시 적용 가능)
  // ─────────────────────────────────────────────────────────────
  COLORS: {
    RED: { name: '레드', icon: '🔥', desc: '고코스트 피니셔로 한 방에 BREAK를 노리는 화력 덱' },
    BLUE: { name: '블루', icon: '💧', desc: '드로우와 게이지 되감기로 턴을 길게 끄는 테크니컬 덱' },
    BLACK: { name: '블랙', icon: '🛡️', desc: '방어도와 반격, BREAK 임계점 조작으로 버티는 방어 덱' },
    YELLOW: { name: '옐로우', icon: '✨', desc: '체력을 자원으로 쓰고 회복으로 버티는 줄타기 덱' },
  },

  // 시작 덱 (컬러별 10장) — gdd/11-card-tiers.md
  STARTER_DECKS: {
    RED: [
      { key: 'strike', name: '베기', cost: 1, damage: 5, block: 0, count: 3, desc: '피해 5' },
      { key: 'defend', name: '수비', cost: 1, damage: 0, block: 5, count: 3, desc: '방어도 5' },
      { key: 'breakthrough', name: '돌파', cost: 2, damage: 9, block: 0, count: 2, effect: 'REDUCE_NEXT_COST', desc: '피해 9, 다음 카드 비용 -1' },
      { key: 'focus', name: '기 모으기', cost: 1, damage: 0, block: 0, count: 1, effect: 'DOUBLE_NEXT_ATTACK', desc: '다음 공격 카드 피해 2배' },
      { key: 'gigaburst', name: '기간틱 버스트', cost: 5, damage: 28, block: 0, count: 1, desc: '피해 28' },
    ],
    BLUE: [
      { key: 'jab', name: '연타', cost: 1, damage: 6, block: 0, count: 3, desc: '피해 6' },
      { key: 'tuneup', name: '회로 정비', cost: 1, damage: 0, block: 0, count: 3, draw: 1, desc: '카드 1장 드로우' },
      { key: 'rewind', name: '메모리 되감기', cost: 1, damage: 0, block: 0, count: 2, rewind: 1, desc: '게이지를 P 방향으로 1칸 되돌림' },
      { key: 'chain', name: '연쇄 반응', cost: 2, damage: 12, block: 0, count: 1, draw: 1, desc: '피해 12, 카드 1장 드로우' },
      { key: 'overload_info', name: '정보 과부하', cost: 1, damage: 6, block: 0, count: 1, draw: 1, desc: '피해 6, 카드 1장 드로우' },
    ],
    BLACK: [
      { key: 'guard', name: '강건한 수비', cost: 1, damage: 0, block: 8, count: 3, desc: '방어도 8' },
      { key: 'anchor', name: '앵커 강타', cost: 2, damage: 11, block: 3, count: 3, desc: '피해 11, 방어도 3' },
      { key: 'fortify', name: '굳히기', cost: 1, damage: 0, block: 4, count: 2, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '굳히기', amount: 2, turns: 2 }, desc: '방어도 4, 2턴간 턴 시작 시 방어도 +2' },
      { key: 'reboot', name: '재부팅', cost: 2, damage: 0, block: 6, count: 1, counter: 8, desc: '방어도 6, 다음 피격 시 반격 8' },
      { key: 'threshold', name: '임계점 압박', cost: 2, damage: 0, block: 0, count: 1, breakThresholdDown: 1, desc: '이번 전투 BREAK 기준값 1 감소 (최소 E4)' },
    ],
    YELLOW: [
      { key: 'siphon', name: '생명 착취', cost: 1, damage: 9, block: 0, count: 3, hpCost: 1, desc: 'HP 1 소모, 피해 9' },
      { key: 'firstaid', name: '응급 처치', cost: 1, damage: 0, block: 0, count: 3, heal: 5, desc: '체력 5 회복' },
      { key: 'corrode', name: '부식', cost: 2, damage: 7, block: 0, count: 2, bossWeaken: true, desc: '피해 7, 다음 보스 공격 피해 -25%' },
      { key: 'regen', name: '재생 오라', cost: 1, damage: 0, block: 0, count: 1, effect: 'PERSISTENT_HEAL_ON_TURN_START', persistentPayload: { id: 'aura-heal-on-turn', name: '재생 오라', amount: 3, turns: 2 }, desc: '2턴간 턴 시작 시 체력 3 회복' },
      { key: 'resolve', name: '결의', cost: 1, damage: 13, block: 0, count: 1, hpCost: 2, desc: 'HP 2 소모, 피해 13' },
    ],
  },

  // 보상 카드 풀 — 티어2는 스테이지 4~7, 티어3은 8~10 (gdd/09 9-3)
  REWARD_POOLS: {
    RED: {
      2: [
        { key: 'tamer_overdrive', name: '테이머: 폭주 코어', cost: 3, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '폭주 코어', amount: 3, turns: 3 }, desc: '3턴간 공격 카드 피해 +3' },
        { key: 'option_warmup', name: '옵션: 예열 가속', cost: 1, damage: 0, block: 0, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '예열 가속', amount: 4, turns: 2 }, desc: '2턴간 턴 시작 시 방어도 +4' },
        { key: 'option_crackshot', name: '옵션: 균열탄', cost: 2, damage: 4, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '균열탄', amount: 10, turns: 2 }, desc: '피해 4, 2턴간 보스 받는 피해 +10%' },
      ],
      3: [
        { key: 'ultimate_core', name: '궁극 코어 각성', cost: 4, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '궁극 코어', amount: 6, turns: 4 }, desc: '4턴간 공격 카드 피해 +6' },
        { key: 'final_detonation', name: '종언의 폭발', cost: 5, damage: 30, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '종언의 폭발', amount: 20, turns: 3 }, desc: '피해 30, 3턴간 보스 받는 피해 +20%' },
        { key: 'decisive', name: '결전의 일격', cost: 6, damage: 35, block: 0, desc: '피해 35 (중립에서 쓰면 곧바로 BREAK)' },
      ],
    },
    BLUE: {
      2: [
        { key: 'datastream', name: '데이터 스트림', cost: 2, damage: 0, block: 0, draw: 2, desc: '카드 2장 드로우' },
        { key: 'hack', name: '시스템 해킹', cost: 2, damage: 8, block: 0, rewind: 1, desc: '피해 8, 게이지 1칸 되감기' },
        { key: 'cache_amp', name: '옵션: 캐시 증폭', cost: 2, damage: 0, block: 0, effect: 'PERSISTENT_DAMAGE_BOOST', persistentPayload: { id: 'aura-damage-boost', name: '캐시 증폭', amount: 2, turns: 3 }, desc: '3턴간 공격 카드 피해 +2' },
      ],
      3: [
        { key: 'overflow', name: '오버플로우', cost: 4, damage: 18, block: 0, draw: 2, desc: '피해 18, 카드 2장 드로우' },
        { key: 'infinite_loop', name: '무한 루프', cost: 3, damage: 0, block: 0, rewind: 2, draw: 2, desc: '게이지 2칸 되감기, 카드 2장 드로우' },
        { key: 'codebreak', name: '코드 브레이크', cost: 5, damage: 26, block: 0, desc: '피해 26' },
      ],
    },
    BLACK: {
      2: [
        { key: 'heavyarmor', name: '중장갑', cost: 2, damage: 0, block: 12, desc: '방어도 12' },
        { key: 'counter_protocol', name: '반격 프로토콜', cost: 2, damage: 0, block: 5, counter: 8, desc: '방어도 5, 다음 피격 시 반격 8' },
        { key: 'barrier', name: '옵션: 방벽 전개', cost: 3, damage: 0, block: 0, effect: 'PERSISTENT_BLOCK_ON_TURN_START', persistentPayload: { id: 'aura-block-on-turn', name: '방벽', amount: 6, turns: 3 }, desc: '3턴간 턴 시작 시 방어도 +6' },
      ],
      3: [
        { key: 'absolute_guard', name: '절대 방어', cost: 3, damage: 0, block: 20, desc: '방어도 20' },
        { key: 'threshold_collapse', name: '임계 붕괴', cost: 4, damage: 0, block: 0, breakThresholdDown: 2, desc: 'BREAK 기준값 2 감소 (최소 E4)' },
        { key: 'anchor_finish', name: '앵커 피니시', cost: 5, damage: 24, block: 10, desc: '피해 24, 방어도 10' },
      ],
    },
    YELLOW: {
      2: [
        { key: 'devotion', name: '헌신', cost: 2, damage: 14, block: 0, hpCost: 4, desc: 'HP 4 소모, 피해 14' },
        { key: 'healing_light', name: '치유의 빛', cost: 2, damage: 0, block: 0, heal: 10, desc: '체력 10 회복' },
        { key: 'decay_spread', name: '옵션: 부패 확산', cost: 2, damage: 6, block: 0, effect: 'PERSISTENT_BOSS_VULNERABLE', persistentPayload: { id: 'aura-boss-vulnerable', name: '부패', amount: 15, turns: 2 }, desc: '피해 6, 2턴간 보스 받는 피해 +15%' },
      ],
      3: [
        { key: 'sacrifice', name: '희생의 일격', cost: 3, damage: 28, block: 0, hpCost: 8, desc: 'HP 8 소모, 피해 28' },
        { key: 'great_regen', name: '대재생', cost: 3, damage: 0, block: 0, heal: 18, effect: 'PERSISTENT_HEAL_ON_TURN_START', persistentPayload: { id: 'aura-heal-on-turn', name: '대재생', amount: 4, turns: 3 }, desc: '체력 18 회복, 3턴간 턴 시작 시 4 회복' },
        { key: 'doom_pact', name: '종말의 계약', cost: 5, damage: 32, block: 0, hpCost: 5, desc: 'HP 5 소모, 피해 32' },
      ],
    },
  },

  // 카드 강화("+") — gdd/11-card-tiers.md 11-2. key → 덮어쓸 필드
  UPGRADES: {
    strike: { damage: 8 }, defend: { block: 8 }, breakthrough: { damage: 13 },
    focus: { draw: 1 }, gigaburst: { damage: 38 },
    jab: { damage: 5 }, tuneup: { draw: 2 }, rewind: { rewind: 2 },
    chain: { damage: 9 }, overload_info: { damage: 4 },
    guard: { block: 12 }, anchor: { damage: 10, block: 5 }, fortify: { block: 7 },
    reboot: { counter: 9 }, threshold: { breakThresholdDown: 2 },
    siphon: { damage: 10 }, firstaid: { heal: 9 }, corrode: { damage: 8 },
    regen: { heal: 4 }, resolve: { damage: 15 },
  },

  // ─────────────────────────────────────────────────────────────
  // 적 로스터 — gdd/10-enemy-roster.md
  // 기술 비용은 1~5 (E5까지만 유효 진입). 모든 적은 비용 1·쿨다운 0의
  // 기본 공격을 가져야 루프 종료가 보장된다 (gdd/08 8-2).
  // 피해 수치는 "마무리 일격" 규칙 도입 후 시뮬레이션으로 재조정된 값.
  // ─────────────────────────────────────────────────────────────
  ENEMIES: [
    {
      name: '초심자의 파수꾼', icon: '🗿', hp: 75,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 2, cooldown: 0, priority: 10 },
        { key: 'power_charge', name: '동력 충전', cost: 2, kind: 'BUFF', powerGain: 1, blockGain: 6, cooldown: 4, priority: 20 },
        { key: 'heavy_strike', name: '강타', cost: 3, kind: 'ATTACK_WEAKEN', damage: 4, cooldown: 2, priority: 30 },
        { key: 'aoe_slam', name: '광역 강타', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 5, cooldown: 4, priority: 40 },
      ],
    },
    {
      name: '충격 드론', icon: '🛸', hp: 85,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 2, cooldown: 0, priority: 10 },
        { key: 'dash', name: '돌진', cost: 2, kind: 'ATTACK', damage: 3, cooldown: 1, priority: 25 },
        { key: 'blast', name: '폭발 추진', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 5, cooldown: 3, priority: 35 },
      ],
    },
    {
      name: '방벽 수호자', icon: '🛡️', hp: 95,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 3, cooldown: 0, priority: 10 },
        { key: 'plating', name: '강화 장갑', cost: 2, kind: 'BUFF', powerGain: 1, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'counter_charge', name: '반격 격돌', cost: 3, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 2, priority: 30 },
      ],
    },
    {
      name: '쌍검 그림자', icon: '🥷', hp: 108,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 3, cooldown: 0, priority: 10 },
        { key: 'slash_combo', name: '연속 베기', cost: 2, kind: 'ATTACK', damage: 4, cooldown: 1, priority: 25 },
        { key: 'shadow_strike', name: '그림자 강타', cost: 3, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 2, priority: 35 },
        { key: 'night_raid', name: '심야 습격', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 7, cooldown: 3, priority: 45 },
      ],
    },
    {
      name: '약화의 주술사', icon: '🔮', hp: 120,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 4, cooldown: 0, priority: 10 },
        { key: 'dark_cycle', name: '어둠 순환', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 8, cooldown: 4, priority: 20 },
        { key: 'curse', name: '저주 부여', cost: 2, kind: 'ATTACK_WEAKEN', damage: 5, cooldown: 1, priority: 30 },
        { key: 'wither', name: '쇠약의 손길', cost: 3, kind: 'ATTACK_VULNERABLE', damage: 7, cooldown: 2, priority: 35 },
      ],
    },
    {
      name: '폭주 코어 알파', icon: '⚙️', hp: 135,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 3, cooldown: 0, priority: 10 },
        { key: 'amplify', name: '동력 증폭', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 8, cooldown: 4, priority: 20 },
        { key: 'heavy_strike', name: '강타', cost: 3, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 2, priority: 30 },
        { key: 'blast_wave', name: '광역 폭발', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 8, cooldown: 4, priority: 40 },
      ],
    },
    {
      name: '쌍둥이 감시자', icon: '👁️', hp: 150,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 4, cooldown: 0, priority: 10 },
        { key: 'regroup', name: '재편성', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'sync_hit', name: '동시 타격', cost: 2, kind: 'ATTACK', damage: 5, cooldown: 1, priority: 25 },
        { key: 'watcher_rage', name: '감시자의 분노', cost: 3, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 2, priority: 35 },
        { key: 'doom_gaze', name: '파멸의 응시', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 4, priority: 45 },
      ],
    },
    {
      name: '심연의 포식자', icon: '🐙', hp: 168,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 4, cooldown: 0, priority: 10 },
        { key: 'abyss_expand', name: '심연 팽창', cost: 3, kind: 'BUFF', powerGain: 2, blockGain: 12, cooldown: 4, priority: 20 },
        { key: 'erode', name: '침식', cost: 2, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 1, priority: 30 },
        { key: 'devour', name: '포식', cost: 3, kind: 'ATTACK_VULNERABLE', damage: 7, cooldown: 2, priority: 35 },
        { key: 'annihilate', name: '절멸의 파동', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 10, cooldown: 5, priority: 45 },
      ],
    },
    {
      name: '메모리 폭군', icon: '👑', hp: 185,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'empower', name: '권능 증폭', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 10, cooldown: 4, priority: 20 },
        { key: 'seize', name: '기억 압류', cost: 3, kind: 'ATTACK_WEAKEN', damage: 8, cooldown: 2, priority: 35 },
        { key: 'tyrant_mace', name: '폭군의 철퇴', cost: 4, kind: 'ATTACK_VULNERABLE', damage: 9, cooldown: 3, priority: 40 },
        { key: 'doom_verdict', name: '종언 선고', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 11, cooldown: 5, priority: 50 },
      ],
    },
    {
      name: '코어 프라임', icon: '💀', hp: 210,
      skills: [
        { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 5, cooldown: 0, priority: 10 },
        { key: 'absolute_power', name: '절대 동력', cost: 2, kind: 'BUFF', powerGain: 3, blockGain: 14, cooldown: 4, priority: 20 },
        { key: 'core_barrage', name: '코어 연타', cost: 3, kind: 'ATTACK', damage: 9, cooldown: 1, priority: 30 },
        { key: 'collapse', name: '붕괴의 일격', cost: 4, kind: 'ATTACK_WEAKEN', damage: 10, cooldown: 3, priority: 40 },
        { key: 'judgment', name: '심판의 포효', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 12, cooldown: 4, priority: 50 },
        { key: 'final_calc', name: '최종 연산', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 12, cooldown: 6, priority: 55 },
      ],
    },
  ],
};
