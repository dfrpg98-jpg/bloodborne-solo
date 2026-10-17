# Bloodborne Solo · 기나긴 사냥

브라우저에서 기나긴 사냥 챕터 1~3을 한 명의 플레이어로 진행하는 로컬 게임입니다. 이 브랜치의 개발 버전은 **0.8.13-dev.30**, 마지막 보관 릴리스는 **0.8.12**입니다. dev.30은 적 정보를 진행 상황에 표시하고 창을 제목줄로 최소화하며, M·방향키 이동과 화면 배치를 개선한 검토 후보입니다. 전체 화면 배율과 기본 글자 크기는 유지합니다. 현재 지도 높이를 기본으로 적용하고 높이 전환 버튼은 제거했습니다. [이번 변경의 검증 범위](docs/audits/inline-workspace-v0.8.13-dev.30/verification.json)와 [이동 비용·기존 검증의 한계](docs/audits/movement-v0.8.13-dev.29/verification.json)를 참고하세요. dev.28은 PR #84로 main에 병합했고, dev.29~30은 PR #89에서 검토 중입니다.

수직 이동·정렬된 공격의 방향 반전 수정은 [하인 방향 재점검](docs/audits/minion-facing-v0.8.13-dev.10/README.md)에, 신규 적6종의 외형·표시 크기·실제 검증 사냥은 [적 외형 점검 기록](docs/audits/enemy-sprites-v0.8.13-dev.9/README.md)에 있습니다. dev.8의 UI·규칙·저장 점검과 Unity 이식 준비 결과는 [로컬 검증 기록](docs/audits/local-final-validation-v0.8.13-dev.8/README.md)에서 구분합니다.

현재 위치와 열람 타일, 토큰 회복 예고, 사망 요약, 일반 플레이 우선 도움말, 고정 행동 영역, 혈석 부착 표시·변형 후 재배치의 재현 예시와 확인 범위는 [dev.13 피드백 점검](docs/audits/play-feedback-v0.8.13-dev.13/README.md)에 기록합니다.

dev.15의 종료/자동 회피 안내, 고정 피해 문구·대상 식별·공격 보정 예고는 [실제 플레이 UI 점검](docs/audits/playtest-ui-v0.8.13-dev.15/README.md)에 기록합니다.

전투 전체 순서·다단 피해와 치유 전 사망 예고, 고정 카드·슬롯 선택, 챕터 완료 단계, 시체 획득·유인 안내, 혈석 공격 비교와 꿈 귀환 재배치, 메뉴 불러오기 복귀, 회피 후 자원 낭비 방지, 생존자 손실 확인은 [dev.14 점검 기록](docs/audits/combat-mission-ux-v0.8.13-dev.14/README.md)에 기록합니다.

## 실행

도움말만 따라 검증용 첫 이동·탐험·회피·공격·저장 불러오기를 진행한 결과와 BB-036 안내 보완은 [dev.12 플레이 기록](docs/audits/help-led-qa-v0.8.13-dev.12/README.md)에 있습니다. 타이틀과 BB-035 저장 경합 수정은 [dev.11 점검 기록](docs/audits/title-help-v0.8.13-dev.11/README.md)에 보존합니다.

표시 엔진과 실행 에셋은 저장소에 포함되어 있어 별도의 엔진 설치가 필요하지 않습니다. 저장소를 내려받은 뒤 프로젝트 폴더에서 다음 명령을 실행합니다.

```sh
python -m http.server 8000 --bind 127.0.0.1
```

그다음 Chrome 또는 Edge에서 `http://127.0.0.1:8000/index.html`을 엽니다. 타이틀에서 **시작하기 · 불러오기 · 도움말**을 선택하고, 자동 저장이 있으면 일반/검증 사냥을 따로 이어갈 수 있습니다. 기존 `hunt.html` 북마크의 자동 이어하기도 유지합니다. 도움말은 타이틀과 게임 안에서 같은 내용을 제공합니다.

진행은 브라우저의 주소별 저장소에 자동 저장되므로, 기존 주소에서 새 주소로 옮기기 전 메뉴의 **저장 내보내기**로 진행 파일을 보관하고 새 주소에서 불러옵니다. Git에는 개인 플레이 저장을 넣지 않습니다. 타이틀이나 준비 화면에 들어간 것만으로 이전 진행을 덮어쓰지 않으며 **새 사냥 시작**을 확정하면 해당 모드의 진행을 교체합니다.

## 점검

자동 점검은 Node.js 24를 사용합니다. 별도 npm 의존성 설치는 필요하지 않습니다.

```sh
node scripts/test-ci.cjs
```

이 명령은 실행 코드·지도·에셋·임무·전투·기존 저장 호환의 회귀 검사를 실행합니다. 참고 사진의 실제 바이트를 읽는 4개 검사만 제외하고, 제외 목록과 실제 통과·실패 수를 `test-results/ci.json`에 남깁니다. 전체 로그는 `test-results/ci.tap`에 있습니다. GitHub Actions의 동일 검사는 실제 실행 결과를 아티팩트로 보관합니다.

원본 사진 대조까지 포함하려면 기존 개발 자료를 보관한 프로젝트의 전체 경로를 `BB_REFERENCE_ROOT`에 지정하고 전체 검사를 실행합니다.

```powershell
$env:BB_REFERENCE_ROOT = '원본 자료를 보관한 프로젝트의 전체 경로'
npm test
Remove-Item Env:BB_REFERENCE_ROOT
```

`BB_REFERENCE_ROOT`는 원본 사진 출처 검사에만 쓰이며, 실행 코드·게임 데이터·플레이 저장을 다른 폴더에서 읽게 하지 않습니다. 검사 대상 원본을 찾지 못하면 전체 검사는 실패합니다. 빠른 검증 모드의 승리는 정상 구성품으로 캠페인을 완주했다는 증거와 구분합니다. 조립 상태 검사, 저장 명령 재생, 실제 브라우저 조작, 사용자의 직접 플레이는 각각 따로 기록합니다.

## 개발과 이력

dev.23까지의 누적 변경을 `main`에 통합했습니다. [통합 PR #76](https://github.com/dfrpg98-jpg/bloodborne-solo/pull/76), [검증·브랜치·PR 정리 목록](docs/maintenance/git-integration-2026-10-16.json)에서 포함된 커밋과 과거 이력의 보존 태그를 확인할 수 있습니다. 이후 수정은 변경 이력과 후속 PR에서 관리하며 정식 릴리스와 개발 버전은 구분합니다.

새 기능이나 수정은 브랜치와 Pull Request에서 검토하고, 관련 Issue에 재현 방법·규칙 근거·변경 내용·실제 점검 결과를 함께 기록합니다. [개발 절차](CONTRIBUTING.md)를 따르고 출시 버전은 `package.json`, 변경 이력, Git 태그를 맞춥니다. 과거 ZIP에서 가져온 버전의 커밋은 이관 시점의 기록이며 과거에 작성한 Git 커밋으로 표시하지 않습니다.

규칙서·임무 원문·공식 FAQ와 프로젝트 재정은 [규칙 결정 기록](docs/decisions.md)에서 구분합니다. 과거 설명은 [이전 README](docs/archive/README-legacy.txt), [개발 기록](docs/development/DEVELOPMENT.md), `docs/verification/legacy/VERIFICATION_v*.txt`에 원문을 보존합니다. 현재 실행 방법과 프로젝트 재정은 이 README와 결정 기록을 우선합니다.

## 코드와 자료

`src/hunt-engine.js`는 명령과 상태 검증, `src/chapter-engine.js`는 칸·타일·출입구·출현, `src/mission-engine.js`는 공개된 임무·분기·대상 조건을 처리합니다. UI와 연출은 같은 규칙 엔진을 사용합니다. 카메라와 외형은 규칙 행동이나 비용을 추가하지 않습니다.

루트에는 시작 화면과 플레이 화면, 버전·실행 설정, 프로젝트 안내를 둡니다. 나머지는 용도에 따라 다음 폴더에서 찾을 수 있습니다.

| 폴더 | 내용 |
|---|---|
| `src/`, `styles/`, `pages/` | JavaScript, 화면 스타일, 부속 화면 |
| `assets/`, `fonts/`, `campaigns/`, `components/` | 실행 에셋·서체·캠페인·구성품 데이터 |
| `tests/`, `scripts/` | 회귀 검사·빌드·점검 도구 |
| `docs/verification/` | [검증용 플레이 안내](docs/verification/QA_GUIDE.txt), 이전 검증 기록(`legacy/`) |
| `docs/guides/` | 카메라·지도·HUD·적·무기 표시 안내 |
| `docs/rules/checklist/`, `docs/provenance/` | 규칙 대조표·원본 자료 목록 |
| `docs/audits/`, `docs/history/` | 오류 재현·검증 근거·출시 이력 |
| `docs/development/`, `docs/archive/` | 개발 설계·입력 양식·이전 프로젝트 안내 |
| `docs/maintenance/` | 파일 정리 내역·중복 백업 대조·정리 후 확인 화면 |
| `unity-port/` | Unity 이식 계약·내보내기·가져오기 준비물 |

기존 문서의 이동 전후 경로는 `scripts/project-document-paths.json`에 기록했습니다. 과거 점검 자료 안의 당시 경로와 해시는 역사적 근거로 보존합니다.

로컬 중복 정리 목록은 [용량 대조 기록](docs/maintenance/storage-audit-2026-10-16.json)에 있습니다. 삭제 후보는 사용자가 먼저 내용을 확인하도록 옛 작업 폴더의 `삭제대상_검토후삭제/`에 모읍니다. 검증에서 생성한 PNG와 중복 전체 백업 ZIP을 별도 하위 폴더로 나누며, [이동 기록](docs/maintenance/delete-handoff-2026-10-16.json)에 원래 위치·종류·개수·용량을 기록합니다. 원본 사진·검증 영상·판정 기록·Git 이력은 보존합니다. 이동 기록이 있으면 이전 `cleanup-workspace.ps1 -Apply` 명령은 삭제를 실행하지 않고 중단합니다. 중복 전체 ZIP을 새로 만들지 않습니다.

실행에 필요한 `assets/`, `fonts/`, `campaigns/`, `components/`, `tests/` 및 출처·해시 기록은 버전 관리합니다. 사용자가 제공한 원본 사진 폴더(`참고자료/`, `components/images/`, `campaigns/long-hunt/images/`)와 플레이 저장, 중복 ZIP, 임시 브라우저 QA 페이지는 로컬에 보존합니다. 역사적인 출처 메타데이터의 과거 로컬 경로는 자료 수집 기록이며 실행 경로가 아닙니다.

현재 범위는 기나긴 사냥의 단일 플레이입니다. 다른 캠페인과 멀티플레이는 이후 작업입니다. 기존 사냥꾼·장치무기 외형과 지도 렌더링을 유지하며, dev.9에서는 기나긴 사냥의 적 6종을 전용 스킨으로 구분합니다. 외형 검사와 실제 플레이 점검은 범위와 결과를 따로 기록합니다.

확인된 오류는 [오류 목록](docs/bugs.md)에 재현 예시, 수정 전·후 동작, 규칙 근거와 검사 파일을 함께 기록합니다. [엄격 점검 기록](docs/audits/release-readiness-2026-10-13.md)은 검증 범위와 남은 불확실성을 구분합니다.

[Unity 개발 준비물](unity-port/README.md)은 현재 규칙·데이터·에셋을 내보내는 생성기, 공개 정보 계약, 명령 재생 기준, C# 난수·타일 좌표 구현과 Editor 가져오기 틀을 제공합니다. 전체 C# 규칙 엔진과 실제 Unity 장면은 이후 구현·실행 검증이 필요합니다. GitHub Actions는 게임 회귀 검사와 Unity 준비물 생성을 각각 실행합니다.
