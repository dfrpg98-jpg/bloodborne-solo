# dev.38 화면 배치와 행동 단축키 실제 검증

2026-10-18, 설치된 Chrome 155에서 임시 프로필과 Chromium sandbox를 사용했다. 최종 제품 해시를 유지한 실행에서 화면 배치 110개와 행동 키·소모품·초기화 안내 89개, 합계 199개 검사가 모두 통과했다. 사용 중인 브라우저에 연결하거나 사용자의 저장을 변경하지 않았다. 게임 상태와 이벤트를 페이지에 주입하지 않았으며, 페이지 평가는 화면의 위치·크기·스타일·선택 상태를 읽는 데만 사용했다.

## 재현

저장소 루트에서 정적 서버를 `http://127.0.0.1:8860`에 실행한 뒤, 설치된 Playwright 모듈 경로를 두 실행기에 전달한다.

```powershell
$playwrightPath = 'C:\Users\GOOD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
node docs/audits/layout-shortcuts-v0.8.13-dev.38/verify-loadout.cjs $playwrightPath
node docs/audits/layout-shortcuts-v0.8.13-dev.38/verify-browser.cjs $playwrightPath
```

`verify-loadout.cjs`는 공개 `E.create`와 `DREAM`·`REFILL` 명령으로 슬롯 1·2·3개 무기와 꿈 복귀 저장을 만든다. `verify-browser.cjs`는 다음의 공개 경로를 사용한다.

- 일반 캠페인: seed 90, 야수의 발톱, rules 13과 `tests/fixtures/weapon-campaign-completion/beast-claw-0.json`의 명령 앞부분.
- 타일 배치: `tests/fixtures/map-preview-dev38-recipes.json`의 `tile-07` 전체 공개 명령.
- 소모품 개수: 정상 캠페인 시작 소모품으로 해독제를 선택한 저장.
- 공격 확인 단축키: 공식 전투 연습의 남성 야수 환자 B면. 이 사례는 캠페인 완주 증거로 사용하지 않는다.

각 저장은 실제 파일 선택창으로 불러온다. 행동은 마우스와 실제 키보드 입력으로 수행하고, 메뉴의 저장 버튼으로 내려받은 결과를 별도의 reducer 실행과 바이트 단위로 비교한다. 이동 선언 정책과 자동 전투 후속 처리는 실제 컨트롤러와 같은 공개 정책 함수·명령을 적용한다.

## 검증 범위

- 2035×1252, 1714×1252, 1280×720, 1231×1252에서 화기가 무기 제목·효과 옆 오른쪽에 하나만 표시되고, 모든 슬롯이 같은 행·너비·높이를 가지는지 확인한다. 2035 화면의 화기 높이는 49px이다. 좁은 화면은 화기 문구를 줄바꿈하며 버튼을 모두 표시한다.
- 슬롯 수가 다른 무기와 복귀 픽리스트를 확인하고, 미리보기·원상복원이 저장·손패·화기를 변경하지 않는지 확인한다.
- MOVE·TRANSFORM·DREAM·ATTACK의 비활성 확인 버튼에도 아래쪽 작은 `Space` 안내가 유지되는지, 카드를 선택한 뒤 한 번만 확정되는지 확인한다. 취소 버튼의 `Esc / Backspace` 안내와 선택 복원도 확인한다.
- Space로 턴 종료·이동 종료·손패 보충·타일 배치를 실행하고, 키를 누른 채 단계가 바뀌어도 다음 행동이 연쇄 실행되지 않는지 확인한다.
- 열린 창·최소화된 창·입력란이 배경 행동을 차단하는지 확인한다. 전투에서 미선택 회피를 임의로 건너뛰지 않으며, 선택한 회피나 명시적으로 초점을 둔 전투 처리 버튼을 실행하는지 확인한다.
- 실제 Chrome에서 발견한 기본 키 동작 누수도 회귀 검사한다. 미정 전투의 손패 버튼에 초점이 있어도 Space가 선택을 바꾸지 않으며, Shift+Space가 초점이 있는 행동 확인·턴 종료 버튼을 실행하지 않아야 한다.
- 소모품과 장비 패널의 시작 위치가 일치하고 보유 개수는 `1장`만 표시되는지 확인한다. 초기화 안내는 글자 11px·오른쪽 여백 12px·규칙 설명 툴팁을 확인한다.

결과와 제품 파일의 시작·종료 SHA-256은 함께 보관한 `loadout-verification.json`, `keyboard-verification.json`에 기록한다. 실행 도중 제품 파일이 바뀌면 검증을 실패시킨다. 타일 미리보기·회전별 방향 이름의 별도 검증은 `../map-preview-labels-v0.8.13-dev.38/`에 있다.

실제 스크린샷·입력 저장·다운로드는 실행 시 생성되는 무시 경로 `test-results/loadout-dev38/`, `test-results/layout-shortcuts-dev38/`에 보존한다. 검증 결과 파일의 스크린샷 이름과 내려받기 목록으로 연결된다.
