# 타임라인 시소 (Timeline Seesaw) 기획 문서

플레이어와 상대가 **하나의 기세(氣勢)**를 나눠 갖고, 이어 쓴 초식으로
상대의 균형을 무너뜨리는(파훼) 무림 덱빌딩 로그라이크 설계안입니다.

용어는 [12-murim-terms.md](12-murim-terms.md)가 정본입니다 — 기세 · 틈 ·
아/적 · 합 · 파훼.

## 문서 구성

| 문서 | 내용 |
| --- | --- |
| [01-core-system-gauge.md](01-core-system-gauge.md) | 공유 기세, 턴 교대 규칙, 자원 반환(시소 원리) |
| [02-boss-intent-thresholds.md](02-boss-intent-thresholds.md) | 파훼 — 한 합의 몰아치기가 적의 빈틈을 넘으면 발동 |
| [03-color-archetypes.md](03-color-archetypes.md) | 오방색 4색(적·흑·백·자)과 문파별 전략 |
| [04-turn-loop-state-machine.md](04-turn-loop-state-machine.md) | 전투 턴 루프 및 상태 머신 다이어그램 |
| [05-mvp-spec.md](05-mvp-spec.md) | 웹 데모용 데이터 모델, 카드 세트, 보스 스펙 |
| [06-persistent-effects.md](06-persistent-effects.md) | 심법/진법형 지속 효과(N합 지속 버프) 시스템 |
| [07-turn-economy-revision.md](07-turn-economy-revision.md) | 숨 고르기(기세→카드), 핸드 유지형 드로우, 연환 드로우 |
| [08-boss-skill-loop.md](08-boss-skill-loop.md) | 적 초식 루프 — 게이지가 음수가 될 때까지 반복 행동 (턴 종료 규칙과 대칭) |
| [09-run-structure.md](09-run-structure.md) | 런 구조 — 스테이지 1~10, 덱 성장 곡선(10장→20장), 스테이지 간 회복 |
| [10-enemy-roster.md](10-enemy-roster.md) | 적 10종 — 개성을 만드는 두 축(빈틈·클로저 성격)과 스테이지 편성 |
| [11-card-tiers.md](11-card-tiers.md) | 경지(티어) 체계 + 컬러별 출구 메커니즘 + 카드 목록 |
| [12-murim-terms.md](12-murim-terms.md) | 무림 용어 정본, 작명 규칙, 이름에 관한 저작권 원칙 |
| [13-crossroads.md](13-crossroads.md) | 갈림길 — 비무 사이의 걸음(수련장·주루·문파 방문·비무대회·기연) |
| [14-weapons.md](14-weapons.md) | 신병이기 — 문파와 곱해지는 둘째 축. 슬롯 2칸 · 규칙 수정자 |

## 한 줄 요약

- **핵심 축:** `아6 ~ 0 ~ 적6` 단일 기세. 초식을 쓸수록 오른쪽으로 밀립니다
- **긴장감의 원천:** 초식을 쓸수록 기세가 적 쪽으로 밀리고, `0`을 넘어가면
  즉시 선(先)이 넘어갑니다. 적은 자기 초식의 틈만큼 기세를 되밀며,
  **페이즈를 끝내는 마지막 초식이 무엇이냐**에 따라 돌아오는 양이 정해집니다
  (패도형은 가장 비싼 것, 노회형은 가장 싼 것 — 최소 `아3` 보장)
- **파훼:** 한 합에 지불한 **틈의 합계**가 그 적의 **빈틈**을 넘으면 적의
  반격을 통째로 지웁니다. 깊은 버퍼를 받을수록 많이 몰아칠 수 있으므로,
  **버퍼를 쌓는 것이 곧 파훼에 가까워지는 것**입니다
- **적 10종의 개성:** 빈틈(파훼가 현실적인가)과 클로저 성격(버퍼 축적이
  통하는가) 두 축의 조합으로, 스테이지마다 **다른 전술**을 요구합니다
