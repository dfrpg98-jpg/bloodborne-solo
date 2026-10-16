# 마비 안개와 성직자 야수 회복 · 규칙 출처

2026-10-16, 제품 기준 `16addd1`. 공식 자료의 일반 규칙과 제공 카드 전사문을 대조한 기록입니다. 제품·테스트·전투 판정은 변경하지 않았으며, 다른 담당자가 검증 중인 실제 저장이나 전투 결과를 이 문서의 검증 결과로 취급하지 않습니다.

## 확인한 공식 자료

[CMON 공식 제품 페이지](https://www.cmon.com/products/bloodborne-the-board-game/)의 Rules & More는 규칙서 v1.1과 FAQ v1.0을 제공합니다. 아래 쪽수는 PDF 페이지와 인쇄 쪽수가 같습니다.

| 자료 | 위치 | 확인한 내용 |
| --- | --- | --- |
| [공식 규칙서 v1.1](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Rulebook_v1.1.pdf#page=17) | 17쪽, Consumables | 소모품은 카드가 정한 시점에 사용하고 카드에 적힌 혜택을 얻습니다. 공격할 때 사용하는 소모품은 공격을 고르는 시점에 사용합니다. |
| [공식 규칙서 v1.1](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Rulebook_v1.1.pdf#page=20) | 20쪽, Flip Enemy Action card | 짧은 원문: **“Abilities are not Attacks, and thus contain only effects.”** 전용 능력은 공격과 구분되며, 별도 시점·속도가 없으면 공개 즉시 처리합니다. |
| [공식 규칙서 v1.1](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Rulebook_v1.1.pdf#page=23) | 23쪽, Boss Enemies | 보스 행동 덱에도 공격과 전용 능력이 구분되어 있습니다. 보스 행동을 공개한다는 사실만으로 모든 보스 행동이 공격이 되지는 않습니다. |
| [공식 FAQ v1.0](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Boardgame_FAQ_v1.0.pdf#page=3) | 3쪽, Basic/Special에 있는 Ability 질문 | 짧은 원문: **“These are Abilities for all gameplay purposes”**. 기본·특수 위치에 적힌 전용 능력도 공격으로 취급하지 않으며, 공격을 대상으로 하는 방해나 사냥꾼의 단총의 적용 대상이 아니라고 설명합니다. |
| [공식 FAQ v1.0](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Boardgame_FAQ_v1.0.pdf#page=2) | 2쪽, Block 후속 질문; 3쪽, Block 항목 | 방어는 공격에 연결된 효과가 아니고 별도 속도가 없으므로 공격·능력의 속도에 기다리지 않고 적용된다고 설명합니다. 이것은 방어의 처리 시점 근거이며, 마비 안개와 회복의 조합을 직접 판정한 답변은 아닙니다. |

규칙서 본문은 [CMON 공식 파일 저장소의 v1.1 PDF](https://cmon-files.s3.amazonaws.com/pdf/assets_item/resource/250/Bloodborne_Rulebook_v1.1.pdf)에서 메모리로 받아 17·20·23·26쪽을 추출하여 확인했습니다. 이 파일은 13,779,817 bytes, SHA-256 `543d20e266db85303af877c1568eb1bdbebca451f0e74e72544943ecb699c8f9`입니다. 공식 사이트의 현재 업로드 주소는 검색 본문으로 20쪽을 확인했지만 직접 다운로드는 HTTP 403이었으므로, 두 주소의 파일 바이트가 동일하다고 검증한 것은 아닙니다. FAQ는 공식 업로드 PDF의 본문과 3쪽 화면을 확인했습니다.

## 카드 자료와 구현의 구분

- [마비 안개 카드 전사](../../../components/cards.json)의 `numbing-mist` 항목은 **“적의 공격은 모든 효과를 잃습니다.”**, 사용 시점은 **“공격할 때”**입니다. 출처 표시는 사용자 전사문입니다. 이번 조사에서 공식 영문 카드 사진을 확보한 것은 아닙니다.
- [성직자 야수 제공 전사](../../../components/cleric-beast-source.txt)의 10·16행은 회복의 계몽 토큰 제거·피해 2 방어·행동 덱 섞기를 기록합니다. [보스 정의](../../../boss-components.js)는 이를 `type: "ability"`, `code: "cleric-recovery"`로 분류합니다. 이 코드의 분류 자체가 공식 출처는 아닙니다.
- `components/cards.json`의 일반 규칙 배열에 있는 ‘공격이 아닌 전용 능력을 제거하지 않는다’는 문장은 프로젝트의 해석·구현 설명입니다. 공식 카드의 추가 문구나 FAQ 직접 답변으로 인용하지 않습니다.

## 결론과 남은 경계

**공식적으로 확인한 것:** 공격과 전용 능력은 별도 범주이며, 보스 행동에도 두 범주가 있습니다. 별도 시점이 없는 방어는 즉시 적용되는 효과입니다.

**문구를 적용한 해석:** 제공된 마비 안개 문구는 적의 **공격**을 대상으로 합니다. 회복이 현재 분류대로 전용 능력이라면, 회복의 계몽 제거·방어·덱 섞기를 제거하지 않는 처리는 위 일반 규칙과 일치합니다. 효과를 제거한다는 문구를 적의 모든 행동·모든 전용 능력 제거로 확대할 근거는 확보하지 못했습니다. 정확한 원본 카드의 분류·문구를 추가 대조할 여지는 남습니다.

**직접 조합 FAQ 미확보:** 공식 FAQ v1.0의 검색 가능한 전체 본문에서 Mist·Recovery·Consumable을 확인하고 CMON 공식 도메인 검색을 수행했으나, 마비 안개와 성직자 야수 회복을 직접 지목한 답변은 찾지 못했습니다. 인터넷 전체에 그런 답변이 없다고 단정하지 않습니다.

**우선 수정 범위:** UI가 ‘모든 부가효과 제거’처럼 범위를 생략했다면 ‘적 공격의 효과 제거’로 한정하고, 공개된 행동이 전용 능력일 때는 해당 능력에 적용되지 않음을 알리는 것이 적절합니다. 방어 2가 남는 경우 예고 피해에도 이를 드러내야 합니다. 이번 출처 조사만으로 core engine 판정을 변경하거나 실제 전투 결함을 확정하지 않습니다.

## 후속 커뮤니티 조사와 사용자 채택 · 2026-10-16

BGG 토론 **Numbing Mist, Bolt Paper and other such Consumables**의17개 게시물을 인앱 브라우저에서 직접 읽었습니다. 검색 도구가 처음 반환한 질문·첫 답변만으로 결론을 낸 것은 아닙니다.

- Adam Ross(@ajr30), [2021-02-01 답변](https://boardgamegeek.com/thread/2592397/article/36887909#36887909): 능력 자체를 제거하지 않고 후속 공격의 효과를 제거한다는 설명입니다. 능력이 다음 공격에 독을 추가하면 그 독도 안개로 제거한다고 구분합니다.
- 같은 작성자의 [2021-02-02 답변](https://boardgamegeek.com/thread/2592397/article/36897517#36897517)은 능력으로 증가한 속도·피해는 유지하고, 공격에 붙은 독 같은 효과는 제거한다는 근거를 설명합니다.
- Conor Mullin(@easterncalculus)의 [추가 공개 구분](https://boardgamegeek.com/thread/2592397/article/36897417#36897417)은 능력으로 다음 행동을 공개해 나온 기본 공격도 공격으로 취급하는 경우와, 공격 없이 적만 출현시키는 능력을 구별합니다.
- [@WrecktangleBGG의 반론](https://boardgamegeek.com/thread/2592397/article/36901773#36901773)은 능력이 붙인 속도·피해 증가를 수치와 효과 중 어디에 분류할지 공식 해명이 필요하다는 의견입니다. 토론을 만장일치나 공식 답변으로 소개하지 않습니다. 해당 답변자들의 제작사 공식 답변 권한은 확인되지 않았습니다.
- [Reddit의 능력 범위 토론](https://www.reddit.com/r/bloodbornebg/comments/ltyil2/question_about_numbing_mist/)과 [방해·기절 질문](https://www.reddit.com/r/bloodbornebg/comments/v6xubk/staggerstun_at_the_same_speed/)도 확인했지만, BGG 답변을 공식 판정으로 격상시키는 근거로 쓰지 않습니다.

사용자는 조사 결과를 읽고 **BGG의 위 답변대로 진행**하기로 선택했습니다. 현재 적용 지위는 [사용자 채택 재정](../../decisions.md)이며 `officialConfirmed: false`입니다. 공격/능력의 일반 구분을 확인한 공식 자료, 직접 조합의 커뮤니티 해석, 사용자의 채택을 별도로 기록합니다. 기존 실행 판정은 유지합니다.
