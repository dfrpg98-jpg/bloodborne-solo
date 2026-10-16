# 혈석 재배치와 다음 챕터 준비 순서

검토일: 2026-10-17. 범위는 피드백 3번(꿈 귀환·챕터 전환의 혈석 재배치), 5번(특수 준비 전후 시작 칸 선택)이다. 아래의 인쇄 규칙과 구현 해석을 구분한다.

## 1. 시작 칸은 특수 준비를 적용하기 전에 선택한다

**판정: 현재 순서를 유지한다. 특수 지도를 먼저 공개한 뒤 시작 칸을 고르는 방식으로 변경하지 않는다.**

- [CMON 공식 규칙서 v1.1, 10쪽](https://cmon-files.s3.amazonaws.com/pdf/assets_item/resource/250/Bloodborne_Rulebook_v1.1.pdf#page=10)의 `4. CHAPTER SETUP`은 중앙 등불을 놓고 사냥꾼을 원하는 칸에 배치한 다음, 챕터 카드의 준비 항목을 읽고 특수 규칙 카드를 공개·적용하는 순서다. 따라서 특수 배치를 본 뒤 시작 칸을 고르는 것이 일반 준비 순서는 아니다.
- [같은 규칙서 25쪽](https://cmon-files.s3.amazonaws.com/pdf/assets_item/resource/250/Bloodborne_Rulebook_v1.1.pdf#page=25)은 다음 챕터도 통상 준비 절차를 따른다.
- 제공된 한국어 임무 원문 `campaigns/long-hunt/data.json`의 **17번 ‘특수 준비’**는 타일 더미를 만들기 전에 공동묘지·오에돈의 지하묘지·조건을 만족하는 무작위 타일을 가져와 지정한 관계로 연결한다. 사냥꾼 시작 칸 선택을 이 배치 뒤로 옮기는 지시는 없다.
- [CMON 공식 FAQ v1.0, 1쪽](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Boardgame_FAQ_v1.0.pdf#page=1)은 이런 추가 무작위 준비 타일을 타일 더미의 무작위 타일 수에 포함하지 않는다고 설명한다. 시작 칸 선택의 후행을 지시하지 않는다.

기존 `tests/campaign-progression.test.cjs`는 챕터 2·3의 64개 시드씩에 대해 17번 배치의 연결 관계, 추가 타일·더미 수량, 전역 연결성과 저장 재현을 확인한다. 다음 챕터 준비 명령에서 선택한 중앙 등불 칸에 시작하는 것도 확인한다. 이번 검토에서 배치 순서의 규칙 위반을 발견하지 않았으므로 지도 생성 로직은 변경하지 않았다.

## 2. 혈석 재배치의 근거와 해석

**카드에 직접 있는 규칙:** 제공된 전사문 `components/cards.json`의 혈석의 파편·혈석의 덩이·눈물석은 공격 슬롯에 놓고, 무기를 변형할 때 다른 슬롯으로 옮길 수 있다. 파편은 장착 슬롯의 공격 피해를 1 증가시킨다. [공식 FAQ 3쪽](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Boardgame_FAQ_v1.0.pdf#page=3)은 파편이 도구 두 칸 중 하나를 차지하고 소진되지 않으며 장착 슬롯에 계속 적용된다고 설명한다.

**함께 읽은 공식 규칙:** [규칙서 8쪽](https://cmon-files.s3.amazonaws.com/pdf/assets_item/resource/250/Bloodborne_Rulebook_v1.1.pdf#page=8)은 시작 무기 면 선택, [24쪽](https://cmon-files.s3.amazonaws.com/pdf/assets_item/resource/250/Bloodborne_Rulebook_v1.1.pdf#page=24)은 꿈에서 돌아올 때 무기 면 선택, [25쪽](https://cmon-files.s3.amazonaws.com/pdf/assets_item/resource/250/Bloodborne_Rulebook_v1.1.pdf#page=25)은 챕터 사이 보상 유지와 다음 챕터 준비를 설명한다.

**구현에 적용한 해석:** 이 무료 면 선택에서 실제로 반대 면을 선택하면 혈석 재배치를 허용한다는 사용자 요청을 반영한다. 검토한 공식 FAQ에서 ‘꿈 귀환/챕터 시작의 무료 면 선택과 혈석 재배치’라는 조합을 직접 확정하는 문답은 찾지 못했다. 따라서 이 조합 전체가 FAQ의 직접 인용이라고 주장하지 않는다. 또한 무료 면 선택을 기술을 버리는 일반 무기 변형 행동 전체로 취급하지 않는다. 토니트루스 충전 등 별도 변형 행동 효과는 발생시키지 않는다.

## 3. 확인한 결함과 수정

**재현 예시:** 장송의 칼날과 혈석의 파편을 보유하고 챕터 1을 완료한다. 성장과 보상 선택을 마친 뒤 챕터 2 시작 시 반대 무기 면을 선택한다. 수정 전에는 혈석이 기존의 유효한 슬롯에 그대로 남고 `REASSIGN_REWARD`는 ‘변형한 직후’ 조건을 만족하지 못해 거부됐다. 꿈 귀환의 반대 면 선택은 이미 별도 재배치 창이 있어 정상 동작했다.

`src/hunt-engine.js`의 `START_NEXT_CHAPTER`에 명시적 선택 필드 `reassignAttachments: true`를 추가했다.

- 반대 면을 선택한 경우에만 허용하며, `true`/`false` 이외 값은 거부한다.
- 기존 보상 엔진의 변형 직후 창만 연다. 손패·난수·사냥 트랙·화기 준비·무기 충전의 별도 효과는 추가하지 않는다.
- 슬롯 수가 줄어 혈석의 슬롯이 사라지면 필수 재장착을 먼저 해결하고, 그 뒤 선택적 재배치를 허용한다.
- 이후 일반 행동을 시작하면 재배치 창이 닫힌다. 같은 면으로 시작할 때는 새 창이 없다.
- 기존 저장의 명령에는 이 필드가 없으므로 종전의 닫힌 창을 그대로 재현한다. 규칙 버전이나 저장 형식은 변경하지 않는다.

UI 연결 조건: 다음 챕터를 반대 면으로 시작하는 명령에만 이 필드를 넣는다. 기존 꿈 귀환의 `RETURN` 연결은 유지한다. 이 문서의 엔진 검증과 별도로 전체 UI·실브라우저 검증 결과는 주 작업 기록에서 관리한다.

## 4. 실행한 검증

```text
node --test tests/chapter-start-attachments-v0825.test.cjs tests/dream-attachments-v0814.test.cjs tests/campaign-progression.test.cjs
```

**24개 통과, 실패 0개.** 신규 챕터 시작 검사는 공개 명령으로 챕터를 완료한 기존 명령 기록을 재생한다. 현재 규칙 14의 챕터 2 전환과 기존 규칙 11의 챕터 3 전환을 모두 확인했다.

- 반대 면 시작 후 실제 혈석 재배치, 저장 내보내기/불러오기 완전 일치.
- 슬롯 감소 시 필수 재장착 우선, 정상 행동 이후 재배치 불가, 잘못된 요청의 원본 상태 불변.
- 토니트루스의 별도 변형 충전 미발동.
- 수정 전 기록한 기존 명령의 저장 SHA-256 일치(반대 면·같은 면 모두).
- 기존 꿈 귀환 검사에서 실제 재배치 후 다음 공격에 파편의 추가 피해가 새 슬롯에 한 번만 적용되는 것, 필수 재장착과 UI 팝업 연결도 재확인.
- 챕터 2·3의 특수 준비 및 선택한 시작 칸 유지에 관한 기존 회귀 검사.

이 실행은 대상 엔진/DOM 회귀 검사이며 전체 CI나 실제 브라우저 플레이 완료를 뜻하지 않는다.

## 5. 커뮤니티·위키 조사 범위와 한계

공식 자료 외에도 다음 검색을 수행했다: `site:reddit.com/r/bloodbornebg "chapter" "setup"`, `site:reddit.com/r/bloodbornebg "starting" "setup" "chapter"`, `"Bloodborne" "Bloodstone Shard" "Dream" board game`, `Bloodborne board game wiki FAQ transform bloodstone`.

검색에서 [r/bloodbornebg FAQ 위키](https://www.reddit.com/r/bloodbornebg/wiki/faq/), [tile continuity 토론](https://www.reddit.com/r/bloodbornebg/comments/kuhdco/a_question_about_tile_continuity/), [전투 중 변형 토론](https://www.reddit.com/r/bloodbornebg/comments/ti30jt/can_i_transform_my_trick_weapons_while_fighting/)을 찾았다. FAQ 위키와 첫 토론의 JSON 본문 접근은 403으로 차단되었다. 검색 결과만으로 이 글들이 위 결합 규칙을 확정한다고 인용하지 않는다. 검색에 섞인 Fextralife·Fandom·Wikidot의 비디오게임 혈석 설명은 보드게임 판정 근거에서 제외했다. 커뮤니티 본문을 전부 검토했다거나 인터넷상 이견이 없다는 뜻도 아니다. 시작 칸 순서 판정은 직접 읽은 공식 10쪽에 근거한다.

공식 PDF는 로컬에 추가 사본을 저장하지 않고 메모리에서 읽었다. 확인한 원문 파일 SHA-256:

- CMON S3 규칙서 v1.1(13,779,817바이트): `543d20e266db85303af877c1568eb1bdbebca451f0e74e72544943ecb699c8f9`.
- CMON FAQ v1.0(5,081,655바이트): `56e47d28bfdb0e964374e8fef883dea147534a9a7338ef9fd63e2b9084c45b4b`.
