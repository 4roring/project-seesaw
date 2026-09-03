// 카드/보스/게이지 상수 정의 — gdd/05-mvp-spec.md 기준
const TS_DATA = {
  GAUGE_MIN: -6,
  GAUGE_MAX: 6,
  BREAK_THRESHOLD: 6,
  STARTING_GAUGE: -3, // P3
  STARTING_PLAYER_HP: 70, // gdd 문서에 명시 없음 — 데모용 임의값
  STARTING_BOSS_HP: 120,
  HAND_SIZE: 5, // 시작 핸드 크기 (이후로는 사용한 만큼만 보충 — gdd 07 문서)
  PASS_MEMORY_PENALTY: 3, // 패스 시 보스에게 상납하는 메모리(게이지 이동량)
  PASS_BONUS_DRAW: 1, // 메모리 상납 직후 보상으로 드로우하는 카드 수
  COMBO_THRESHOLD: 3, // 이번 턴 카드 사용 수가 이 값에 도달할 때마다 추가 드로우
  MIN_MEMORY_RETURN: 3, // 보스 페이즈가 끝날 때 플레이어에게 보장되는 최소 메모리(P3)

  // 레드 아키타입 13장 (gdd/05-mvp-spec.md 4-2)
  // effect가 'PERSISTENT_*'인 카드는 gdd/06-persistent-effects.md의
  // 지속 효과(테이머/옵션형) 시스템을 사용한다. persistentPayload 참고.
  CARD_DEFS: [
    { key: 'strike', name: '베기', color: 'RED', cost: 1, damage: 5, block: 0, count: 3, effect: null, desc: '피해 5' },
    { key: 'defend', name: '수비', color: 'RED', cost: 1, damage: 0, block: 5, count: 3, effect: null, desc: '방어도 5' },
    { key: 'breakthrough', name: '돌파', color: 'RED', cost: 2, damage: 9, block: 0, count: 2, effect: 'REDUCE_NEXT_COST', desc: '피해 9, 다음 카드의 비용 1 감소' },
    { key: 'focus', name: '기 모으기', color: 'RED', cost: 1, damage: 0, block: 0, count: 1, effect: 'DOUBLE_NEXT_ATTACK', desc: '이번 턴 다음 공격 카드의 피해량 2배' },
    { key: 'gigaburst', name: '기간틱 버스트', color: 'RED', cost: 5, damage: 28, block: 0, count: 1, effect: null, desc: '피해 28' },
    {
      key: 'tamer_overdrive', name: '테이머: 폭주 코어', color: 'RED', cost: 3, damage: 0, block: 0, count: 1,
      effect: 'PERSISTENT_DAMAGE_BOOST',
      persistentPayload: { id: 'aura-damage-boost', name: '폭주 코어', amount: 3, turns: 3 },
      desc: '지속효과 — 3턴간 공격 카드 피해 +3',
    },
    {
      key: 'option_warmup', name: '옵션: 예열 가속', color: 'RED', cost: 1, damage: 0, block: 0, count: 1,
      effect: 'PERSISTENT_BLOCK_ON_TURN_START',
      persistentPayload: { id: 'aura-block-on-turn', name: '예열 가속', amount: 4, turns: 2 },
      desc: '지속효과 — 2턴간 매 턴 시작 시 방어도 +4',
    },
    {
      key: 'option_crackshot', name: '옵션: 균열탄', color: 'RED', cost: 2, damage: 4, block: 0, count: 1,
      effect: 'PERSISTENT_BOSS_VULNERABLE',
      persistentPayload: { id: 'aura-boss-vulnerable', name: '균열탄', amount: 10, turns: 2 },
      desc: '피해 4, 지속효과 — 2턴간 보스가 받는 피해 +10%',
    },
  ],

  // 보스 기술 루프 — gdd/08-boss-skill-loop.md
  // 보스는 게이지가 음수가 될 때까지 아래 기술을 반복 사용한다.
  // priority가 높을수록 우선 선택되고, cooldown이 0인 기술만 쓸 수 있다.
  // 일반 공격의 비용은 반드시 1로 고정 — 게이지가 정확히 0일 때도 억지로
  // 쓸 수 있는 기술이 최소 하나 있어야 루프 종료가 보장된다(7-4 참고).
  // 나머지 기술은 "강할수록 비싸게" 올려서, 강한 기술을 쓸수록 플레이어가
  // 돌려받는 P 버퍼도 커지도록 했다(7-5 참고).
  // 피해 수치는 "마무리 일격" 규칙(8-4) 도입 후 시뮬레이션으로 재조정된 값이다.
  // 큰 기술이 매 페이즈 클로저로 나가게 되면서 페이즈당 피해가 크게 늘어,
  // E1 평균 12.5 / E3 16.2 / E5 19.0이 되도록 하향했다.
  BOSS_SKILLS: [
    { key: 'normal_attack', name: '일반 공격', cost: 1, kind: 'ATTACK', damage: 3, cooldown: 0, priority: 10 },
    { key: 'power_charge', name: '동력 충전', cost: 2, kind: 'BUFF', powerGain: 2, blockGain: 6, cooldown: 3, priority: 20 },
    { key: 'heavy_strike', name: '강타', cost: 3, kind: 'ATTACK_WEAKEN', damage: 6, cooldown: 2, priority: 30 },
    { key: 'aoe_slam', name: '광역 강타', cost: 5, kind: 'ATTACK_VULNERABLE', damage: 11, cooldown: 4, priority: 40 },
  ],
};
