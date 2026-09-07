// 카드 설명 생성 — 손으로 쓴 설명은 강화 시 원래 효과를 잃어버리므로
// (예: "피해 9, 다음 초식의 틈 -1" → 강화하면 "피해 13"만 남음),
// 필드에서 직접 만들어 데이터와 텍스트가 어긋나지 않게 한다.
const TS_Text = (() => {
  const D = TS_DATA;

  // 필드 → 사람이 읽는 조각. 순서가 곧 문장 순서다.
  // label은 강화 비교표에서 쓰는 짧은 이름.
  const FIELDS = [
    { key: 'hpCost', label: 'HP 소모', text: (v) => `HP ${v} 소모` },
    { key: 'damage', label: '피해', text: (v) => `피해 ${v}` },
    { key: 'chain', label: '연계 피해', text: (v) => `이번 합에 쓴 초식 1장당 피해 +${v}` },
    { key: 'discardAll', label: '파기 피해', text: (v) => `손패를 전부 파기하고 파기 1장당 피해 +${v}` },
    { key: 'blockToDamage', label: '방어도 환산', text: (v) => (v === 1 ? '현재 방어도만큼 피해 추가' : `현재 방어도 ${v}배만큼 피해 추가`) },
    { key: 'lifesteal', label: '흡혈', text: (v) => `입힌 피해의 ${v}% 회복` },
    { key: 'block', label: '방어도', text: (v) => `방어도 ${v}` },
    { key: 'chainBlock', label: '연계 방어도', text: (v) => `이번 합에 쓴 초식 1장당 방어도 +${v}` },
    { key: 'heal', label: '회복', text: (v) => `체력 ${v} 회복` },
    { key: 'draw', label: '드로우', text: (v) => `카드 ${v}장 드로우` },
    { key: 'rewind', label: '되감기', text: (v) => `기세 ${v} 되감기` },
    { key: 'counter', label: '반탄', text: (v) => `다음 피격 시 반탄 ${v}` },
    { key: 'evade', label: '흘리기', text: (v) => `다음 피격 ${v}회를 흘려보냄` },
    { key: 'breakThresholdDown', label: '빈틈 감소', text: (v) => `이번 전투 빈틈 ${v} 감소` },
  ];

  const FLAGS = [
    { key: 'bossWeaken', text: '다음 적 공격 피해 -25%' },
    { key: 'exhaust', text: '사용 후 소멸' },
  ];

  const EFFECTS = {
    REDUCE_NEXT_COST: () => '다음 초식의 틈 -1',
    DOUBLE_NEXT_ATTACK: () => '다음 공격 초식 피해 2배',
    PERSISTENT_DAMAGE_BOOST: (p) => `${p.turns}합간 공격 초식 피해 +${p.amount}`,
    PERSISTENT_BLOCK_ON_TURN_START: (p) => `${p.turns}합간 합 시작 시 방어도 +${p.amount}`,
    PERSISTENT_BOSS_VULNERABLE: (p) => `${p.turns}합간 적이 받는 피해 +${p.amount}%`,
    PERSISTENT_HEAL_ON_TURN_START: (p) => `${p.turns}합간 합 시작 시 체력 +${p.amount}`,
  };

  function describe(card) {
    const parts = [];
    FIELDS.forEach((f) => { if (card[f.key]) parts.push(f.text(card[f.key])); });
    FLAGS.forEach((f) => { if (card[f.key]) parts.push(f.text); });
    const eff = EFFECTS[card.effect];
    if (eff) parts.push(eff(card.persistentPayload || {}));
    return parts.length ? parts.join(', ') : '효과 없음';
  }

  // 강화하면 무엇이 어떻게 바뀌는가. [{label, from, to}]
  function upgradeDiff(card) {
    const patch = D.UPGRADES[card.key];
    if (!patch) return [];
    const rows = [];
    FIELDS.forEach((f) => {
      if (patch[f.key] == null) return;
      rows.push({ label: f.label, from: card[f.key] || 0, to: patch[f.key] });
    });
    return rows;
  }

  function canUpgrade(card) {
    return !card.upgraded && !!D.UPGRADES[card.key];
  }

  return { describe, upgradeDiff, canUpgrade };
})();
