# 타임라인 시소 (Timeline Seesaw) 기획 문서

플레이어와 보스가 하나의 단일 게이지를 공유하며, 빌드업을 통해 폭발적인
콤보를 터뜨리고 보스를 그로기(Break)시키는 덱빌딩 로그라이크 프로토타입
설계안입니다.

## 문서 구성

| 문서 | 내용 |
| --- | --- |
| [01-core-system-gauge.md](01-core-system-gauge.md) | 공유 메모리 게이지, 턴 교대 규칙, 자원 반환(시소 원리) |
| [02-boss-intent-thresholds.md](02-boss-intent-thresholds.md) | BREAK 임계점 판정과 임계점 조작 우선순위 |
| [03-color-archetypes.md](03-color-archetypes.md) | 레드/블루/블랙/옐로우 4가지 덱 속성별 전략 |
| [04-turn-loop-state-machine.md](04-turn-loop-state-machine.md) | 전투 턴 루프 및 상태 머신 다이어그램 |
| [05-mvp-spec.md](05-mvp-spec.md) | 웹 데모용 데이터 모델, 카드 세트, 보스 스펙 |
| [06-persistent-effects.md](06-persistent-effects.md) | 테이머/옵션형 지속 효과(N턴 지속 버프) 시스템 |
| [07-turn-economy-revision.md](07-turn-economy-revision.md) | 드로우 액션(메모리→카드), 핸드 유지형 드로우, 콤보 드로우 |
| [08-boss-skill-loop.md](08-boss-skill-loop.md) | 보스 기술 루프 — 게이지가 음수가 될 때까지 반복 행동 (턴 종료 규칙과 대칭) |
| [09-run-structure.md](09-run-structure.md) | 런 구조 — 스테이지 1~10, 덱 성장 곡선(10장→20장), 스테이지 간 회복 |
| [10-enemy-roster.md](10-enemy-roster.md) | 스테이지별 적 10종 스탯/기술 구성 |
| [11-card-tiers.md](11-card-tiers.md) | 카드 티어 체계(저점→고점) + 컬러별(레드/블루/블랙/옐로우) 카드 목록 |

## 한 줄 요약

- **핵심 축:** `-6(플레이어) ~ 0(중립) ~ +6(브레이크)` 단일 게이지
- **긴장감의 원천:** 카드를 쓸수록 게이지가 보스 쪽으로 밀리고, `0`을
  넘어가면 즉시 턴이 종료됩니다. 보스는 자기 기술 비용만큼 게이지를
  되밀며, **페이즈를 끝내는 마지막 기술이 가장 비싼 것**이라 작게 넘길수록
  큰 기술이 마무리로 나오고 그만큼 깊은 버퍼가 돌아옵니다 (최소 `P3` 보장)
- **목표:** 콤보를 쌓아 게이지를 `E6(BREAK)`까지 밀어붙이며, 데미지를
  누적해 `bossHp`를 0 이하로 만들면 승리
- **검증 우선순위:** 자원 표시줄(게이지) 애니메이션 + 카드 드래그 앤 드롭만
  구현되어도 핵심 플레이 감각(줄다리기, 브레이크 노림수) 검증 가능
