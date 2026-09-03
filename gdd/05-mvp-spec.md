# 5. 웹 데모(MVP) 구현 명세

웹 환경에서 코어 밸런스를 빠르게 검증하기 위한 최소 구현(Scope)
가이드라인입니다. **데이터 스키마의 단일 출처**이기도 합니다 — 다른
문서는 규칙을 설명하고, 필드 정의는 여기만 봅니다.

## 5-1. 데이터 모델

```typescript
// 카드 — 목록은 11-card-tiers.md가 정본
interface Card {
  key: string;
  name: string;
  color: 'RED' | 'BLUE' | 'BLACK' | 'YELLOW';
  cost: number;         // 게이지 전진 수치
  damage: number;
  block: number;
  desc: string;
  effect: null
    | 'REDUCE_NEXT_COST'        // 다음 카드 비용 -1
    | 'DOUBLE_NEXT_ATTACK'      // 다음 공격 카드 피해 2배
    | 'PERSISTENT_DAMAGE_BOOST'
    | 'PERSISTENT_BLOCK_ON_TURN_START'
    | 'PERSISTENT_BOSS_VULNERABLE';
  persistentPayload?: { id: string; name: string; amount: number; turns: number };
}

// 지속 효과 — 규칙은 06-persistent-effects.md
interface PersistentEffect {
  id: string;
  name: string;
  kind: 'DAMAGE_BOOST' | 'BLOCK_ON_TURN_START' | 'BOSS_VULNERABLE_AURA';
  amount: number;
  turnsRemaining: number;
}

interface BattleState {
  turn: number;
  gauge: number;              // -6 (P6) ~ +6 (E6)
  status: 'PLAYING' | 'WON' | 'LOST';

  playerHp: number;
  playerMaxHp: number;
  playerBlock: number;

  bossHp: number;
  bossMaxHp: number;
  bossBlock: number;
  bossScalingPower: number;   // '동력 충전' 계열 기술로 누적되는 영구 공격력
  isBossStunned: boolean;
  bossCooldowns: Record<string, number>;  // 08 문서 — 기술 key → 남은 쿨다운

  // 정확히 1턴만 유효한 상태
  playerWeakenActive: boolean;      // 내 카드 피해 -25%
  bossVulnerableActive: boolean;    // 보스가 받는 피해 +50% (BREAK 유래)
  // 다음 피격 1회에 소모되는 상태
  playerVulnerableActive: boolean;  // 보스 공격 피해 +50%

  // "다음 카드 한 장" 보너스 — 소비될 때까지 턴을 넘겨도 유지 (06 문서)
  pendingCostReduction: number;
  pendingDamageMultiplier: number;

  activeEffects: PersistentEffect[];  // 06 문서

  // 턴 이코노미 (07 문서)
  cardsPlayedThisTurn: number;
  comboCounter: number;
  comboBonusDrawsThisTurn: number;

  drawPile: Card[];
  hand: Card[];
  discardPile: Card[];
  log: string[];
}
```

## 5-2. 승리/패배 조건

- **승리:** `bossHp`가 `0` 이하가 되는 시점 (턴 진행 중 언제든 즉시 판정).
- **패배:** `playerHp`가 `0` 이하가 되는 시점 (보스 기술 루프 도중이면
  그 즉시 루프를 중단).
- BREAK는 즉사 효과가 아니라 템포 수단이며, 실제 승패는 `damage`/`block`
  누적으로 결정됩니다.

## 5-3. 카드 세트

시작 덱과 티어별 보상 풀은 [11-card-tiers.md](11-card-tiers.md)가
정본입니다. 현재 웹 데모는 **레드** 카드만 구현되어 있습니다.

## 5-4. 보스 스펙

스테이지별 적 데이터는 [10-enemy-roster.md](10-enemy-roster.md)가
정본이며, 현재 웹 데모는 스테이지 1(초심자의 파수꾼, HP 120)만
구현되어 있습니다. 행동 규칙은 [08-boss-skill-loop.md](08-boss-skill-loop.md)를
따릅니다.

## 5-5. 확장 시 선행돼야 할 스키마 (MVP 범위 밖)

블루/블랙/옐로우 카드([11-card-tiers.md](11-card-tiers.md) 11-4~11-6)를
구현하려면 아래가 먼저 필요합니다.

- `breakThreshold: number` — 블랙의 임계점 축소 (기본값 6)
- 게이지 되감기 카드 효과 (`REWIND_GAUGE`) — 블루
- HP를 코스트처럼 소모하는 대체 코스트 처리 — 옐로우
  (현재 `Card.cost`는 게이지 전진량 단일 의미로만 쓰임)
- 보스에게 거는 확정 디버프, 피격 반격 트리거
- 보스가 플레이어에게 거는 약화/취약은 현재 단일 불리언(정확히 1턴/1회
  소모)입니다. 여러 턴 지속되는 디버프가 필요해지면 `activeEffects`와
  같은 배열 구조로 통합하는 것을 권장합니다.

관련 문서: [11-card-tiers.md](11-card-tiers.md) (카드 목록),
[10-enemy-roster.md](10-enemy-roster.md) (적 데이터),
[08-boss-skill-loop.md](08-boss-skill-loop.md) (보스 행동 규칙)
