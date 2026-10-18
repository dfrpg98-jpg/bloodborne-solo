# 재앙의 야수 다단 가르기 후속 처리 검증

dev.37은 적이 이미 죽은 추가 타격에서 회피·사용 가능한 보상·필수 보상 선택이 모두 없을 때만 기존 `EXTRA_TAKE` 명령을 자동으로 기록합니다. 추가 피해와 사망 판정은 기존 엔진이 수행합니다. 회피하거나 처치 보상을 사용할 수 있으면 선택 단계를 유지합니다.

## 검증 범위

[verification.json](verification.json)의 별도 Chrome 실제 화면 검사 **70개가 모두 통과**했습니다. 정상 캠페인의 공개 명령으로 구성한 네 저장과 공개 명령으로 파생한 추가 타격 대기 저장을 공식 파일 선택기로 불러오고, 실제 버튼 조작 후 내려받은 저장을 독립적인 엔진 결과와 바이트 단위로 비교했습니다. 브라우저 프로필은 임시로 분리했으며 사용자 브라우저·저장에는 접근하지 않았습니다. 실행 전후 제품 소스 해시가 같고 처리되지 않은 페이지 예외도 없었습니다.

| 사례 | 실제 화면에서 확인한 결과 |
| --- | --- |
| 필수 보상 뒤 강제 추가 타격 | 사냥꾼 체력 **4**, 적 체력 1, 양측 속도 2에서 첫 피해 2로 체력 2가 됩니다. 적 처치·임무 완료·필수 혈석 보상 선택을 마친 뒤, 가능한 회피와 선택 보상이 없으면 `EXTRA_TAKE`가 자동으로 기록되어 추가 피해 2와 사망을 처리합니다. |
| 피의 기쁨 선택 보존 | 사용 가능한 피의 기쁨이 있으면 보상을 건너뛰지 않습니다. 장비 탭에서 직접 사용한 뒤에만 남은 강제 추가 타격을 자동 처리합니다. |
| 죽은 적의 회피 가능한 추가 타격 | 적이 죽고 필수 보상이 끝나도 회피 카드와 충분한 속도의 빈 슬롯이 있으면 선택 단계가 유지됩니다. `EXTRA_DODGE`와 `EXTRA_TAKE`를 각각 직접 선택해 비용·피해·최종 저장을 대조했습니다. |
| 양측 체력 1의 동시 치명타 | 원래 전투의 `RESOLVE`만 기록하고 추가 타격은 생성하지 않습니다. 사망 후 지도 초기화로 같은 ID의 적이 다시 출현할 수 있으므로, 최종 적 목록만으로 생존을 판정하지 않았습니다. |
| 추가 타격 대기 저장 불러오기 | 필수 보상 선택을 공개 명령으로 끝내고 자동 편의 처리 직전에 저장한 `combat_extra`를 불러오면 `EXTRA_TAKE`를 정확히 한 번 기록합니다. |

화면에서 자동 처리를 마친 저장과 추가 타격 대기 저장을 불러와 처리한 저장 모두 새로고침 후 바이트가 같았습니다. 새로고침으로 `EXTRA_TAKE`가 중복 기록되지 않았습니다.

사용자가 제시한 **사냥꾼 체력 3**의 정확한 수치 경계는 [전투 후속 처리 구성요소 검사](../../../tests/followup-combat-dev37.test.cjs)와 [자동 처리 컨트롤러 검사](../../../tests/automatic-posthumous-combat-dev36.test.cjs)에서 다룹니다. 실제 Chrome의 강제 처리 사례는 공개 명령으로 도달한 **체력 4**의 인접 사례입니다. 이 브라우저 보고서를 정확한 체력 3 저장의 실화면 검증으로 해석하면 안 됩니다.

임무 완료 후 정상적으로 전투를 마치면 자동으로 마지막 꿈에 들어가 체력을 회복할 수 있습니다. 따라서 `inDream: true` 또는 최종 체력 6만으로 사망했다고 판정하지 않았습니다. 회피 성공은 공식 명령·저장 대조와 새 사망 알림 부재로 확인했고, 사망은 실제 피해·사망 기록과 화면 알림으로 구분했습니다.

## 재현

[public-recipes.json](public-recipes.json)은 각 사례의 시작 설정과 전체 공개 명령을 포함합니다. 실행 스크립트는 `E.create`와 `E.dispatch`로 저장을 재구성하고, 지정된 SHA-256 및 엄격한 저장 재불러오기를 먼저 확인합니다. 직접 편집한 전투 상태나 브라우저 내부 엔진 호출은 사용하지 않습니다.

저장소 루트의 최신 게임을 `http://127.0.0.1:8860`에서 제공하고, 설치된 Playwright 모듈 경로를 전달합니다. Chrome 채널이 설치되어 있어야 합니다.

```powershell
node docs/audits/scourge-followup-v0.8.13-dev.37/verify-browser.cjs 'C:\Users\GOOD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
```

스크립트는 새 임시 Chrome 프로필을 만들며 로컬 게임 출처와 자체 `data:`·`blob:` 요청만 허용합니다. 결과는 이 폴더의 `verification.json`에 기록합니다. 입력 저장·실제 다운로드·스크린샷은 Git에서 제외된 `test-results/scourge-followup-dev37/browser/`에 생성됩니다.

대표 화면은 다음 파일입니다.

- `natural-forced-mission-reward-before-extra.png`: 필수 보상을 먼저 선택하는 화면.
- `natural-forced-mission-reward-death.png`: 자동 추가 피해 2로 사망한 알림.
- `natural-mission-optional-reward-optional-reward-preserved.png`: 사용 가능한 처치 보상이 남아 있는 선택 단계.
- `natural-dead-legal-dodge-dodge-available-choice.png`: 카드·빈 슬롯을 고른 후 활성화된 추가 타격 회피.
- `natural-mutual-lethal-resolve-death.png`: 동시 치명타 처리 후 사망 알림.

제품 소스는 이 검증 작업에서 변경하지 않았습니다.
