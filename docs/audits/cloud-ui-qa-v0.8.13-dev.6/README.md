# 클라우드 UI 후속 검증 · 0.8.13-dev.6

비공개 소스 artifact11826706048을 받아 ZIP digest `949df154fd470478612eef5443f262319699336b6e214edc4833398087b5cf2a`, 내부 tar.gz `7ca00ccc6205445cc3ea582906ac8c03a49a6936384222dfe2996ae9d9a54321`, source.commit `4ecb68c01662310375f8fb0bdd7b672a56e2075c`를 대조했습니다. 직접 Git clone의 인증을 우회하지 않았습니다.

클라우드 셸의 `node scripts/test-ci.cjs` 최종 실행은 **2648통과·0실패**, 정상 종료0, 최종 TAP 집계까지 확인했습니다. [final-ci.json](final-ci.json)에 결과를 보존합니다. 후속 UI가 추가되기 전의2610통과를 재사용하지 않았습니다. 처음 확보한 소스의3실패는 [initial-ci.json](initial-ci.json), 소스 수정 도중 실행한 중간 결과는 [mixed-source-intermediate-ci.json](mixed-source-intermediate-ci.json), 최종 집계가 누락되어 CI가 거절한 실행은 [incomplete-ci.json](incomplete-ci.json)로 분리합니다. 마지막 실행은 제품/테스트 소스를 고정하고 수행했습니다. `hunt-app.js`의 LF 정규화와 캐시 식별자 정리는 동작 변경이 아닙니다. 동일 코드 커밋27d9e4b의 [GitHub Actions38423767850](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38423767850)도 전체 회귀와 Unity 이식 준비 job이 실제 성공했습니다. Unity 이식 준비는 C# 전체 reducer나 실제 Editor 실행 완료가 아닙니다. 별도 DOM/모델62검사의 결과는 [targeted-ui-checks.json](targeted-ui-checks.json)이며 실제 브라우저 검사로 세지 않습니다.

클라우드 셸의 서버는 제공된 별도 브라우저에서 `ERR_CONNECTION_REFUSED`였고 셸용 Chromium 다운로드도 실패했습니다. 실제 UI 검사는 비공개 GitHub Actions의 Ubuntu 서버와 **Chromium151.0.7922.34**에서 수행했습니다. [최종 브라우저 실행38423767765](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38423767765)은 커밋 `27d9e4b47e9b2023584cd8d90deb1eac36f8b338`에서 성공했습니다. [browser-complete.json](browser-complete.json)은22개의 검사/관찰 항목, 실패0·페이지 오류0·원본 화면26장을 기록합니다. 항목 수에는 viewport 관찰과 재현 명령 메타데이터도 포함되므로22개의 독립적인 규칙 테스트라고 소개하지 않습니다. 관찰은 실제 Chromium 자동 클릭이며 사용자의 직접 수동 플레이와도 구분합니다.

모든 시작점은 `E.create/E.dispatch`로 새로 생성해 `E.exportSave/E.importSave`를 대조하고 제품의 실제 파일 불러오기로 열었습니다. 생성한 QA 저장은 메모리에서만 사용하고 결과 artifact/Git에 업로드하지 않습니다. 임무 조건과 토큰을 손수 조립하거나 QA 메타를 제거하지 않았습니다. 준비 명령은 `scripts/cloud-ui-qa.cjs`에 있으며 실제 클릭의 결과와 엔진의 합법적인 다음 결과를 비교합니다.

| 사용자 피드백 | 실제 브라우저에서 확인한 범위 |
| --- | --- |
| 1 화기 설명 | 1208/848/390px 장착 이름 hover/focus, 자연 획득한 화기 보상 이름·2장 준비 비용·실제 장착 |
| 2 왼쪽 타일 | 중앙 등불·예배당의 규칙/칸/현재 적, 임무 대상 체력·계몽 및 상세 열기 |
| 3 이동 컨트롤러 | 카드 비용·실제 STEP/종료·같은 방향2개 목적지 선택·생존자 동행 확인, 임무31의 실제 타일 방향 선택/배치 |
| 4 회전 글자 | seed7의 회전1 타일 SVG가 blob으로 교체되고 이미지 디코딩이 완료되는지 확인, 실제 예배당/폐가 화면 |
| 5 선택 해제 | 카드·빈 슬롯 재클릭 aria-pressed true→false, 저장 보존·실제 공격 |
| 6 손패 | 6장·3/1열과 세로 스크롤, 실제 이동 비용으로5장·4장까지 줄여 렌더 확인 |
| 7 사용 슬롯 | 실제 공격 후 사용됨·disabled, 슬롯 내용 높이와 세로 스크롤 접근 |
| 8 가독성 | 위3개 viewport 사진과 수정 전후 비교. 모든 기기/글꼴/무기 설명의 전수 가독성 검사는 아님 |
| 9 공격 비교 | 정상 장송의 칼날의 실제 공격·RESOLVE, 적용 속도·피해·효과·처리 순서 |
| 10 임무 변경 | 임무3/10/31/36의 실제 트리거 클릭→변화 알림→확인→현재 대상 상세, 확인 전후 저장 보존 |
| 11 이름 없는 타일 | 자연 명령132개로 도달한 tile05의 실제 칸 이름, 지도/위치/일지의 개발 명칭 제거 |
| 12 적용 수치 | 자연 예배당2→1 및 공개 강화, seed7의 정상 재앙의 야수 추격 후 ‘달려들어 뜯기’1→0의 실제 공격·RESOLVE |

seed7의1→0 예시는 QA 무기/적 상태를 조립한 경우가 아닙니다. 정상 장송의 칼날로 QA 이동을 사용하여 예배당→폐가를 탐험하고 적이 있는 방에 들어갔다가 예배당까지 돌아오면 정상 재앙의 야수가 실제 추격으로 도착합니다. 이 뒤의 STEP/ATTACK/RESOLVE는 실제 브라우저에서 클릭했습니다. QA 저장의 준비 구간과 이 실제 행동은 최종 JSON에서 구분합니다.

BB-023의 화면 밖 화기 설명과 BB-024의 좁은 슬롯 글자 겹침을 수정했습니다. 첫 브라우저의 잘못된2→1/1→0 가정과 두 대상 선택 버튼의 strict locator 실패는 [browser-initial.json](browser-initial.json), [browser-fixes-intermediate.json](browser-fixes-intermediate.json)에 남기고 게임 오류와 구분했습니다. 수정 후 hover/focus tooltip의 네 경계가 viewport 안에 있고, 슬롯 자체가 글자를 넘치게 그리지 않으며 필요한 내부 스크롤이 있는지 실제 브라우저에서 검사했습니다.

Git에는 수정 전후와 검증 장면의 JPEG 검토 사본을 [evidence](evidence/)에 보존합니다. [screenshot-index.json](screenshot-index.json)은 사본과 원본 PNG의 각각의 SHA-256, 실제 실행 번호와 변환 사실을 기록합니다. 원본 PNG는 비공개 Actions artifact로26장 보존되며2026-10-20 만료됩니다. JPEG를 원본 PNG 바이트라고 주장하지 않습니다.

[규칙 근거 검토](rule-evidence-review.md)는 실제 원문 사진3장·공식 FAQ·현행 정책의 경계를 기록합니다. 원문 사진 대조는 완료했지만, 피신처/여성 환자의 속도 감소 면제는 근거를 확보하지 못했습니다. 이 정책 변경과 기존 규칙14 저장 전환의 검토는 남아 있습니다. 정규 장비 캠페인 완주, Unity 전체 C# reducer/Editor 실행, 병합·태그·정식 릴리스의 완료 증거가 아닙니다.

## 2cd935a 소스 고정 후 재확인

2026-10-14 후속에서 커밋 `2cd935a438f98e47bcfca1fceb0a3cbb06bdee9d`의 [회귀38427821578](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38427821578), [회귀38427816398](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38427816398)의 regression·unity-preparation job과 [실제 브라우저38427816119](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38427816119)의 browser job이 모두 completed/success임을 연결 GitHub에서 다시 확인했습니다. UI1~12 검증은 완료 기록으로 유지하며, Issue32의 후속 판정 변경 검증과 구분합니다. 이 성공을 새 규칙 수정 커밋의 CI로 대신하지 않습니다.
