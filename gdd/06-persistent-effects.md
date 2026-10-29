# 6. 심법 · 진법 — 지속 효과 (Persistent Effects)

> 용어는 [12-murim-terms.md](12-murim-terms.md) 12-2를 따릅니다 — 합 · 기세 ·
> 틈 · 심법(자기 강화) · 진법(장 전체) · 사혈 노출.

초기 카드는 전부 "즉시 1회성"이었습니다 (피해를 주거나, 방어도를 얻거나,
다음 카드 한 장에만 영향을 주는 정도). 여기에 **여러 합에 걸쳐 효과가
남는** 카드 유형을 더해 덱 전략을 넓힙니다. 무림에서 둘로 나뉩니다 —
**심법(心法)** 은 내 몸에 거는 것, **진법(陣法)** 은 장 전체에 깔아 두는
것입니다. 원형은 필드에 상주해 계속 효과를 주는 TCG의 설치형 카드입니다.

## 6-1. 데이터 모델

`PersistentEffect`와 `BattleState.activeEffects`의 필드 정의는
[05-mvp-spec.md](05-mvp-spec.md) 5-1을 참고하세요. `kind`는 네 가지입니다:

- `DAMAGE_BOOST` — 공격 카드 피해에 `amount` 가산
- `BLOCK_ON_TURN_START` — 합 시작 시 방어도 `amount` 지급
- `HEAL_ON_TURN_START` — 합 시작 시 체력 `amount` 회복
- `BOSS_VULNERABLE_AURA` — 적이 받는 피해 `amount`% 증폭

## 6-2. 지속시간 카운트 규칙

카드에 적힌 "N합 지속"은 효과 종류에 따라 카운트 시작 시점이 다릅니다.

- **즉시 적용형** (`DAMAGE_BOOST`, `BOSS_VULNERABLE_AURA`): 카드를 사용한
  바로 그 합부터 효과가 적용되며, 그 합을 1합차로 셉니다. 즉 "3합 지속"
  카드를 낸 합을 포함해 총 3번의 내 합 동안 유지됩니다.
- **합 시작 트리거형** (`BLOCK_ON_TURN_START`, `HEAL_ON_TURN_START`): 카드를
  사용한 합에는 발동하지 않고, 그다음 내 합부터 합이 시작할 때마다
  발동합니다. "2합 지속"이면 다음 합과 그다음 합, 총 2회 발동 후
  소멸합니다.

같은 `id`의 지속 효과를 중복 사용하면 **수치는 합산**, **지속시간은 새
카드의 값으로 갱신**됩니다 (짧게 남은 것을 새로 갱신해 쌓는 방식).

## 6-3. 카드에 적용된 예시

이름과 수치는 `web-demo/data.js`가 정본입니다. 아래는 읽기 위한 사본입니다.

| 초식 | `kind` | 효과 |
| --- | --- | --- |
| 심법: 폭혈운기 | `DAMAGE_BOOST` | 3합간 공격 카드 피해 +3 |
| 진법: 열기진 | `BLOCK_ON_TURN_START` | 2합간 매 합 시작 시 방어도 +4 |
| 심법: 환혈공 | `HEAL_ON_TURN_START` | 2합간 매 합 시작 시 체력 +3 |
| 진법: 균열진 | `BOSS_VULNERABLE_AURA` | 즉시 피해 13 + 2합간 적이 받는 피해 +10% |

`BOSS_VULNERABLE_AURA`는 [02-boss-intent-thresholds.md](02-boss-intent-thresholds.md)의
파훼 **사혈 노출**(+50%)과 별개로 가산됩니다 — 최종 배율은
`1 + (사혈 노출이면 0.5) + (아우라 % 합)/100` 로 계산해 한 번에 곱합니다.

## 6-4. 합 루프 반영

[04-turn-loop-state-machine.md](04-turn-loop-state-machine.md) 4-1의 내 합
**1단계(심법 · 진법 처리)**가 이 장의 규칙입니다.

1. 활성 `BLOCK_ON_TURN_START` · `HEAL_ON_TURN_START` 효과 발동
2. 모든 `activeEffects`의 `turnsRemaining` 1 감소
3. `turnsRemaining`이 0이 된 효과 제거 (만료 로그 출력)
4. 이어서 4-1의 **2단계(손패 보충)**

## 6-5. 다른 문파로의 확장

이 틀은 적 전용이 아니라 범용입니다. 백(금강사)의 "빈틈 끌어내리기"나
자(마교)의 확정 디버프도 `kind`를 추가하는 방식으로 같은 `activeEffects`
배열에 얹을 수 있도록 설계했습니다 (선행 작업 목록은
[05-mvp-spec.md](05-mvp-spec.md) 5-5 참고).

## 6-6. "다음 카드 한 장" 보너스는 합을 넘어도 유지

`파옥일섬`(다음 카드 틈 −1), `축기결`(다음 공격 카드 피해 2배)처럼
**"다음 카드 한 장에만" 적용되는 1회성 보너스**(`pendingCostReduction`,
`pendingDamageMultiplier`)는 지속 효과 시스템(위 6-1~6-4)과는 별개의
더 단순한 상태지만, 같은 원칙을 적용합니다: **합이 바뀐다고 자동으로
사라지지 않고, 실제로 카드 한 장에 소비될 때까지 유지**됩니다.

합 경계에서 리셋해버리면 `파옥일섬`을 그 합의 마지막 카드로 써서 기세가
넘어간 경우 보너스가 아무에게도 적용되지 못하고 사라지기 때문입니다.
1합짜리 지속 효과처럼 동작하되, 소멸 조건이 지속시간이 아니라 "다음
카드 사용"이라고 보면 됩니다.

관련 문서: [04-turn-loop-state-machine.md](04-turn-loop-state-machine.md),
[05-mvp-spec.md](05-mvp-spec.md),
[11-card-tiers.md](11-card-tiers.md)
