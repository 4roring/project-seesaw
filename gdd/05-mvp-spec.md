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

  // 숫자 필드 — 여러 개를 한 장에 동시에 붙일 수 있다
  draw?: number;                // 즉시 드로우 장수
  rewind?: number;              // 게이지를 P 방향으로 되돌리는 칸 수
  heal?: number;                // 즉시 회복량
  hpCost?: number;              // HP를 코스트로 소모 (남은 HP 이상이면 사용 불가)
  counter?: number;             // 다음 피격 1회에 돌려줄 반격 피해
  breakThresholdDown?: number;  // 이번 전투 BREAK 기준값 감소 (최소 E4)
  bossWeaken?: boolean;         // 다음 보스 공격 피해 -25%
  discardAll?: number;          // 남은 손패를 전부 파기, 파기 1장당 피해 +N (블루)
  chain?: number;               // 이번 턴에 이미 쓴 카드 1장당 피해 +N (레드)
  chainBlock?: number;          // 이번 턴에 이미 쓴 카드 1장당 방어도 +N (레드)
  blockToDamage?: number;       // 현재 방어도 x N 을 피해에 가산 (블랙)
  lifesteal?: number;           // 입힌 피해의 N%를 회복 (옐로우)

  // 카드 자체의 성질
  unique?: boolean;             // 덱에 1장만 — 보상 풀에서 제외
  exhaust?: boolean;            // 사용 후 버린 더미로 가지 않고 이번 전투에서 소멸

  effect: null
    | 'REDUCE_NEXT_COST'        // 다음 카드 비용 -1
    | 'DOUBLE_NEXT_ATTACK'      // 다음 공격 카드 피해 2배
    | 'PERSISTENT_DAMAGE_BOOST'
    | 'PERSISTENT_BLOCK_ON_TURN_START'
    | 'PERSISTENT_BOSS_VULNERABLE'
    | 'PERSISTENT_HEAL_ON_TURN_START';
  persistentPayload?: { id: string; name: string; amount: number; turns: number };
}

// [불변 규칙] rewind 카드는 반드시 cost - rewind >= 1.
//   버린 더미는 다시 섞여 들어오므로 메모리 순증(cost <= rewind) 카드는
//   장수와 무관하게 한 턴을 무한히 늘리는 영구기관이 된다. 순증 카드를
//   만들려면 exhaust로 1회용임을 보장해야 한다 (11-card-tiers.md 11-5).

// 지속 효과 — 규칙은 06-persistent-effects.md
interface PersistentEffect {
  id: string;
  name: string;
  kind: 'DAMAGE_BOOST' | 'BLOCK_ON_TURN_START' | 'BOSS_VULNERABLE_AURA'
      | 'HEAL_ON_TURN_START';
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
  cardsDiscardedThisTurn: number;  // 패 파기로 버린 장수 — 보충 드로우에 포함

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
정본이며, 스테이지 1~10의 적 10종이 모두 구현되어 있습니다. 행동 규칙은
[08-boss-skill-loop.md](08-boss-skill-loop.md)를 따릅니다.

## 5-5. 남아 있는 스키마 한계

4색 카드가 요구하던 스키마 확장(임계점 축소, 게이지 되감기, HP 대체
코스트, 확정 디버프, 피격 반격)은 모두 5-1에 반영돼 구현되었습니다.
아직 남아 있는 한계는 하나입니다.

- 보스가 플레이어에게 거는 약화/취약은 단일 불리언(정확히 1턴 / 1회
  소모)입니다. 여러 턴 지속되는 보스발 디버프가 필요해지면, 플레이어
  지속 효과가 쓰는 `activeEffects` 배열 구조로 통합하는 것을 권장합니다.

관련 문서: [11-card-tiers.md](11-card-tiers.md) (카드 목록),
[10-enemy-roster.md](10-enemy-roster.md) (적 데이터),
[08-boss-skill-loop.md](08-boss-skill-loop.md) (보스 행동 규칙)
