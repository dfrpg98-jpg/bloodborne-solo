# dev.36 행동 선택과 지도 검증

검증은 사용자 Chrome이나 플레이 저장에 연결하지 않고 별도 임시 프로필의 설치된 Chrome 155에서 수행했습니다. 로컬 8860만 허용하고 Chromium sandbox를 켰으며, 실제 파일 선택기·마우스 클릭·다운로드를 사용했습니다. 페이지 내부 상태나 localStorage에 저장을 주입하지 않았습니다.

| 범위 | 실제 Chrome 검사 | 출처와 재현 |
| --- | ---: | --- |
| 행동 선택·취소·확정, 적 몸체와 등불 겹침, 지도 배율·회전·칸 클릭·시작 hover | 78 통과 | [검사 결과](verification.json), [실행 스크립트](verify-browser.cjs) |
| 화기 위치·3개 화면 크기·귀환 형태 미리보기 | 21 통과 | [검사 결과](../loadout-return-v0.8.13-dev.36/verification.json), [실행 스크립트](../loadout-return-v0.8.13-dev.36/verify-browser.cjs) |
| 선택 없는 죽음의 메아리 자동 처리·공식 불러오기·선택 가능한 처치 효과 유지 | 18 통과 | [검사 결과](../automatic-posthumous-v0.8.13-dev.36/verification.json), [실행 스크립트](../automatic-posthumous-v0.8.13-dev.36/verify-browser.cjs) |

행동·지도 검사는 정상 캠페인의 공개 명령 prefix 4·17·134와 새 사냥으로 구성했습니다. 별도 사후공격 검사는 공개 구성품 연습 모드이며 정규 캠페인 완주 증거가 아닙니다. 사용자 저장, 생성된 검증 저장과 다운로드, 스크린샷은 Git에서 제외한 `test-results/`에 있습니다. 실행 스크립트가 공개 생성·명령으로 재현하며 보고서에는 출처와 해시만 남깁니다.

다음처럼 설치된 Playwright 경로를 인수로 전달하여 재현합니다. 로컬 서버는 저장소 루트를 8860에서 제공해야 합니다.

```powershell
node docs/audits/hunt-actions-map-v0.8.13-dev.36/verify-browser.cjs '<installed-playwright-module-path>'
node docs/audits/loadout-return-v0.8.13-dev.36/verify-browser.cjs '<installed-playwright-module-path>'
node docs/audits/automatic-posthumous-v0.8.13-dev.36/verify-browser.cjs '<installed-playwright-module-path>'
```

컨트롤러 검사는 실제 앱의 동일 이벤트 핸들러와 원래 엔진 명령 결과를 대조합니다. 새 검사는 네 행동의 카드 필수·취소 저장 불변·선택 복원·슬롯 기본값과 변경, 스프라이트 범위·회전 표기·합법 이동·호위 확인, 자동 사후공격의 피해·독·사망·선택 보존을 검사합니다. 기존 325명령 챕터 1~3 UI 재생과 45개 무기 UI 경로도 새 선택 순서로 통과했습니다.

지도 기본 100%는 종전 지도 크기의 1.44배입니다. 타일 그림·출입구에 글자가 겹치지 않도록 그림 아래 캡션 줄을 확보했고, 실제 사각형으로 겹침이 없음을 확인했습니다. 공격 준비에서 선택된 슬롯을 다시 눌러도 슬롯이 유지되어 표시된 예고와 확정 명령이 일치합니다.

자동 사후공격은 선택이 없는 남성 야수 환자의 ‘죽음의 메아리’만 처리합니다. 회피 가능한 사후 공격·처치 보상은 그대로 선택하며, 기존 규칙과 저장 형식은 변경하지 않습니다. 실제 NumLock 켜짐 입력의 기존 자동화 제한은 [dev.35 기록](../numpad-v0.8.13-dev.35/verification.json)에 구분되어 있습니다.
