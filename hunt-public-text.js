(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BBHuntPublicText = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Presentation only: no engine imports, DOM, commands, storage, or mutations.
  const branches = { 29: [30, 33], 45: [46, 51, 52, 24], 53: [54, 35], 56: [57, 59, 33] };
  const branchText = {
    29: { 30: "앞서 자비를 베푼 결과, 예배당에서 새로운 상황을 마주합니다.", 33: "예배당을 피신처로 마련하기 위해 필요한 일을 확인합니다." },
    45: {
      46: "진료소를 안전한 피신처로 마련하고 이오세프카의 연구를 마쳤습니다. 그 결과, 진료소에서 새로운 진실을 마주합니다.",
      51: "안전한 피신처로 마련한 진료소에 새로운 위협이 나타났습니다.",
      52: "이오세프카의 연구를 마쳤습니다. 이제 진료소를 생존자들의 피신처로 마련할 일을 확인합니다.",
      24: "진료소에서 해결해야 할 일을 조사합니다."
    },
    53: { 54: "앞선 구조의 결과에 따라 대교에서 새로운 상황을 마주합니다.", 35: "대교에서 벌어진 사건을 조사합니다." },
    56: { 57: "전에 받은 불길한 경고에 따라, 예배당에서 새로운 상황을 마주합니다.", 59: "안전한 피신처로 마련한 예배당에서 지금 필요한 일을 확인합니다.", 33: "예배당을 생존자들의 피신처로 마련할 일을 확인합니다." }
  };
  const asContext = value => typeof value === "string" ? value : value?.context || "mission";
  function particle(noun, original) {
    const syllable = noun.codePointAt(noun.length - 1), ending = syllable >= 0xAC00 && syllable <= 0xD7A3 ? (syllable - 0xAC00) % 28 : 0;
    if (["를", "을"].includes(original)) return ending ? "을" : "를";
    if (["가", "이"].includes(original)) return ending ? "이" : "가";
    if (["은", "는"].includes(original)) return ending ? "은" : "는";
    if (["와", "과"].includes(original)) return ending ? "과" : "와";
    if (["로", "으로"].includes(original)) return !ending || ending === 8 ? "로" : "으로";
    return original;
  }
  function clean(value, options = "mission") {
    const context = asContext(options), noun = ["skill", "stat", "combat"].includes(context) ? "기술" :
      ["item", "consumable"].includes(context) ? "소모품" : ["equipment", "reward"].includes(context) ? "장비" : "임무";
    let text = String(value ?? "");
    text = text.replace(/\[\s*속도\s*(\d+)\s*\]\s*속도로\s*/g, "[속도 $1]로 ");
    // Named opponents refer to the actor, not to a hand skill or a new mission.
    // This only transforms a name already present in the public input.
    text = text.replace(/(성직자 야수|이오세프카|여성 야수 환자|야수 사냥 무리|야수 사냥 하인|재앙의 야수)(?:\s*NPC)?\s*카드(에게|에|의|를|을|가|이|은|는|으로|로|와|과)?/g,
      (_, name, suffix) => name + (suffix === "에" || suffix === "에게" ? "에게" : suffix === "의" ? "의" : suffix ? particle(name, suffix) : ""));
    text = text.replace(/기나긴\s*사냥\s+\d+\s*·\s*/g, "기나긴 사냥 · ");
    text = text.replace(/장치무기\s*카드/g, "장치무기").replace(/화기\s*카드/g, "화기")
      .replace(/소모품\s*카드/g, "소모품").replace(/(?:스탯|공격용|공격)\s*카드/g, "기술")
      .replace(/(?:적\s*)?행동\s*카드/g, "행동").replace(/계몽\s*카드/g, "계몽 기록");
    // Drawing an otherwise unqualified card means drawing from the hunter's
    // stat deck, including when the instruction appears on an equipment panel.
    // Keep explicit equipment/consumable/action sources out of this shortcut.
    text = text.replace(/(^|[\s.,!?;:()[\]])카드(?:\s*(\d+)\s*장(?:을)?|를(?:\s*(\d+)\s*장)?)(?=\s*뽑)/g,
      (whole, lead, countBefore, countAfter, offset, source) => {
        const prefix = source.slice(0, offset + lead.length);
        if (/(?:보상|장비|소모품|화기|장치무기|계몽|행동)(?:\s*덱에서)?\s*$/.test(prefix)) return whole;
        const count = countBefore || countAfter;
        return lead + (count ? `기술 ${count}개를` : "기술을");
      });
    // Never look up an unopened reference's title just to replace its number.
    text = text.replace(/\d+\s*번(?:\s*[,·]\s*\d+\s*번)*\s*카드(?:들)?(?:를)?\s*(?:새로\s*)?공개(?:합니다|했습니다)\.?/g, "새로운 이야기가 이어집니다.");
    text = text.replace(/\d+\s*번(?:을|를)?(?=\s*(?:이번\s*챕터에서\s*)?(?:새로\s*)?공개)/g, "새로운 임무를");
    text = text.replace(/([^\n:：]+)[:：]\s*새로운 이야기가 이어집니다\./g, (_, condition) => {
      const head = condition.trim();
      if (/완수합니다$/.test(head)) return head + ".";
      if (/(?:한다|말한다)$/.test(head)) return head.replace(/한다$/, "합니다") + ". 새로운 이야기가 이어집니다.";
      return head + " 새로운 이야기가 이어집니다.";
    });
    text = text.replace(/\d+\s*번(?:\s*[,·]\s*\d+\s*번)*\s*카드(?:들)?/g, "임무 기록")
      .replace(/카드/g, noun)
      .replace(/(?:앞면|뒷면|[AB]\s*면)(?:으)?로\s*뒤집습니다/g, "다른 형태로 전환합니다")
      .replace(/(?:앞면|뒷면|[AB]\s*면)(?:으)?로\s*뒤집으세요/g, "다른 형태로 전환하세요")
      .replace(/(?:앞면|뒷면|[AB]\s*면)(?:으)?로\s*뒤집기/g, "다른 형태로 전환")
      .replace(/(?:앞면|뒷면|[AB]\s*면)(?:으)?로\s*(?:전환|변형)/g, "다른 형태로 전환")
      .replace(/(?:A\s*\/\s*B|앞\s*\/\s*뒷)\s*면/g, "변형 상태")
      // A weapon's face label is presentation shorthand, but placing a hand
      // card face down is an action cost: removing it leaves "으로 놓고" and
      // hides that the card's stat effects do not execute.
      .replace(/(?:앞면|뒷면)(?!\s*(?:으)?로\s*(?:놓|두|사용|배치))|[AB]\s*면/g, "")
      .replace(/계몽(을)?\s*(\d+)장/g, "계몽$1 $2개")
      .replace(/계몽(을)?\s*둘\s*이상/g, "계몽$1 2개 이상")
      .replace(/공개된\s*구조\s*임무의\s*선택\s*해결/g, "구조 임무에서 제시한 선택을 해결하세요.")
      .replace(/이번 챕터 계몽 2개 획득/g, "이번 챕터에서 계몽 2개를 획득하세요.")
      .replace(/\[피해\]/g, "피해").replace(/\[초기화\]/g, "사냥 초기화")
      .replace(/\s*·\s*(?=·|$)/g, "").replace(/^\s*·\s*/g, "").replace(/\s{2,}/g, " ").trim();
    text = text.replace(/(기술|장비|소모품|임무|계몽 기록|행동|화기|장치무기)(를|을|가|이|은|는|으로|로|와|과)(?=$|[\s.,!?;:·)])/g,
      (_, label, suffix) => label + particle(label, suffix));
    text = text.replace(/(기술|장비|소모품|임무|계몽 기록)\s*(\d+)\s*장(을|이|은|으로|과)?/g,
      (_, label, count, suffix) => `${label} ${count}개${suffix ? particle("개", suffix) : ""}`);
    if (/[：:]$/.test(text)) text = text.slice(0, -1).trim() + ".";
    return text;
  }
  function sentence(value) {
    const text = clean(value).replace(
      /(재앙의 야수 우두머리|성직자 야수|여성 야수 환자|야수 사냥 무리|야수 사냥 하인|재앙의 야수|소모품|계몽 토큰)(?=\s+(?:최종\s+)?(?:처치|봉인|기부|제거)$)/g,
      (_, noun) => noun + particle(noun, "를"));
    if (!text || /[.!?]$/.test(text)) return text;
    if (/처치$/.test(text)) return text + "하세요.";
    if (/호위$/.test(text)) return text + "하세요.";
    if (/상호작용$/.test(text)) return text + "하세요.";
    if (/이동 종료$/.test(text)) return text.replace(/이동 종료$/, "이동을 마치세요.");
    if (/바치기$/.test(text)) return text.replace(/바치기$/, "바치세요.");
    if (/기부$/.test(text)) return text + "하세요.";
    if (/인도$/.test(text)) return text + "하세요.";
    if (/돕기$/.test(text)) return text.replace(/돕기$/, "돕세요.");
    if (/회피$/.test(text)) return text + "하세요.";
    if (/완수할 수 없음$/.test(text)) return text.replace(/완수할 수 없음$/, "완수할 수 없습니다.");
    if (/해결$/.test(text)) return text + "하세요.";
    if (/전환$/.test(text)) return text + "하세요.";
    if (/유인$/.test(text)) return text + "하세요.";
    if (/봉인$/.test(text)) return text + "해 두세요.";
    if (/제거$/.test(text)) return text + "하세요.";
    return text + ".";
  }
  function campaign(data) { return data || (typeof globalThis !== "undefined" ? globalThis.BBLongHunt : null) || { cards: [], chapters: [], preface: [] }; }
  function record(state, chapter) {
    const m = state?.mission;
    if (!m) return null;
    const number = chapter ?? m.chapter;
    return number === m.chapter ? m : (m.history || []).find(item => item.chapter === number) || null;
  }
  function known(number, state, chapter) { return !!record(state, chapter)?.revealed?.includes(Number(number)); }
  function entry(source, state, options = {}) {
    if (!source || !state?.mission) return null;
    const data = campaign(options.data), current = options.chapter ?? source.chapter ?? state.mission.chapter;
    if (source.key === "intro" || source.id === "intro") {
      const intro = (data.preface || []).find(item => item.id === "intro");
      return intro ? { key: source.key || "intro", chapter: null, title: clean(intro.title), type: "도입부", narrative: intro.narrative, rules: [] } : null;
    }
    const number = Number(source.number), visible = record(state, current);
    if (!visible || !known(number, state, current)) return null;
    const actual = (data.cards || []).find(item => item.number === number);
    if (!actual) return null;
    let rules;
    if (branches[number]) {
      // Use the already-resolved public branch, not ownership after later rewards.
      // An old save awaiting the chapel timing decision has no resolved branch yet.
      const pending = number === 56 && current === state.mission.chapter && state.mission.choice === "chapel-order";
      const resolved = pending ? null : visible.revealed.find(next => branches[number].includes(next));
      rules = resolved ? [branchText[number][resolved]] : ["이곳의 상황을 확인하고 있습니다. 현재 진행 중인 사건을 먼저 해결하세요."];
    } else {
      const count = state.hunters?.length || 1;
      rules = actual.rules.map(rule => sentence(String(rule).replace(/\[사냥꾼 수\]\+1/g, String(count + 1)).replace(/\[사냥꾼 수\]/g, String(count))));
    }
    return { key: source.key, number, chapter: current, title: clean(actual.title), type: clean(actual.type),
      rules: [...new Set(rules)], completed: !!visible.completed?.includes(number), discarded: !!visible.discarded?.includes(number) };
  }
  function objective(source, state, view) {
    if (!source || source.status === "미발견") return null;
    const m = state?.mission;
    if (!m || view?.chapter !== m.chapter) return null;
    const gate = { mob: 5, shelter: 8, rescue: 12, bridge: 35, truth: 46 }[source.id];
    const numbered = source.id?.match(/^card-(\d+)$/);
    if (gate && !known(gate, state) || numbered && !known(Number(numbered[1]), state)) return null;
    let description = m.chapter === 1 && source.id === "main" && !known(2, state)
      ? "계몽 2개 이상을 모은 뒤 중앙 등불 타일에서 이동을 마치세요."
      : source.id === "truth" && known(47, state) && !known(49, state)
        ? "진료소의 이오세프카를 처치하세요." : sentence(source.description);
    const required = source.id === "main", guidance = [], actionTypes = [];
    const sources = required ? m.chapter === 1 ? [1, 2] : m.chapter === 2 ? [18, 19, 20, 21, 22] : [40, 41, 42, 43]
      : ({ mob: [5, 6], shelter: [8, 9, 10], rescue: [12, 13, 14], bridge: [35, 36, 37], truth: [46, 47, 49] }[source.id] || (numbered ? [Number(numbered[1])] : []));
    if (required && m.chapter === 2 && known(18, state) && !known(19, state)) {
      // The disclosed hunting mission itself states both acquisition and lure.
      // Do not infer a future boss, reward, or task from this early objective.
      guidance.push("재앙의 야수를 처치할 때마다 시체 토큰 1개를 얻습니다. 야수 사냥 하인·무리를 처치해도 시체를 얻지 못합니다.",
        "자기 차례에 소모품 1개를 버리면 자신이 있는 칸에 재앙의 야수를 유인할 수 있습니다.",
        "공동묘지 타일에서 보유한 시체를 바치세요.");
      description += " 재앙의 야수를 처치해 시체를 얻으세요. 소모품 1개를 버려 현재 칸에 야수를 유인할 수 있습니다.";
      actionTypes.push("MISSION_LURE", "MISSION_CORPSES");
    }
    if (source.id === "card-57") {
      // Card 57 is already public here. Its counter is remaining mission
      // tokens, so show qualifying kills instead of an unexplained countdown.
      const total = Math.max(1, Object.keys(state.hunters || {}).length) + 1,
        remaining = m.counters?.[57],
        finished = m.completed?.includes(58) || ["완료", "complete", "completed", "done"].includes(source.status),
        progress = Number.isInteger(remaining) && remaining >= 0 && remaining <= total
          ? `${total - remaining}/${total}` : finished ? `${total}/${total}` : `총 ${total}회`;
      description = `NPC와 같은 칸의 무리/하인 처치 ${progress}${finished ? "" : " · NPC 칸에서 도보 동행 가능"}`;
    }
    return { ...source, title: clean(source.title), description,
      kind: required ? "required" : "insight", categoryLabel: required ? "필수 목표" : "계몽 선택 임무",
      reward: required ? null : { kind: "insight", amount: 1, text: "완수 시 계몽 1개" },
      guidance, actionTypes, sourceCards: sources.filter(number => known(number, state)) };
  }
  function chapter(state, view, sourceData) {
    const m = state?.mission, data = campaign(sourceData);
    if (!m || !view || view.chapter !== m.chapter) return null;
    const definition = (data.chapters || []).find(item => item.number === m.chapter);
    const objectives = (view.objectives || []).map(item => objective(item, state, view)).filter(Boolean);
    const finished = item => ["완료", "complete", "completed", "done"].includes(item.status);
    const main = objectives.find(item => item.id === "main") || objectives[0] || null;
    const activations = (definition?.onMovementEnd || []).map(trigger => ({
      id: "visit-" + trigger.tileName, title: trigger.tileName, known: trigger.reveal.some(number => known(number, state)),
      description: `${trigger.tileName} 타일에서 이동을 마치면 그곳의 상황과 새로운 단서를 확인합니다.`
    }));
    return { chapter: m.chapter, title: "기나긴 사냥 · 챕터 " + m.chapter, main,
      primary: objectives.find(item => !finished(item)) || objectives[0] || null,
      objectives, activations, insightObjectives: objectives.filter(item => item.kind === "insight"),
      insightChoiceDescription: "개별 계몽 임무는 선택해서 진행합니다. 필수 목표에서 계몽을 요구하면 필요한 개수만큼 획득하세요.",
      insightDescription: `이번 챕터에서 획득한 계몽 ${view.insight || 0}개`,
      entries: (m.revealed || []).map(number => entry({ number }, state, { data })).filter(Boolean) };
  }
  return Object.freeze({ clean, sentence, entry, objective, chapter });
});
