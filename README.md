# Bloodborne Solo · 기나긴 사냥

브라우저에서 기나긴 사냥 챕터 1~3을 한 명의 플레이어로 진행하는 로컬 게임입니다. 현재 게임 버전은 `package.json`을 기준으로 하며, GitHub 이관 기준 실행 버전은 **0.8.12**입니다.

## 실행

표시 엔진과 실행 에셋은 저장소에 포함되어 있어 별도의 엔진 설치가 필요하지 않습니다. 저장소를 내려받은 뒤 프로젝트 폴더에서 다음 명령을 실행합니다.

```sh
python -m http.server 8000 --bind 127.0.0.1
```

그다음 Chrome 또는 Edge에서 `http://127.0.0.1:8000/hunt.html`을 엽니다. 진행은 브라우저의 주소별 저장소에 자동 저장되므로, 기존 주소에서 새 주소로 옮기기 전 메뉴의 **저장 내보내기**로 진행 파일을 보관하고 새 주소에서 불러옵니다. Git에는 개인 플레이 저장을 넣지 않습니다.

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

새 기능이나 수정은 브랜치와 Pull Request에서 검토하고, 관련 Issue에 재현 방법·규칙 근거·변경 내용·실제 점검 결과를 함께 기록합니다. [개발 절차](CONTRIBUTING.md)를 따르고 출시 버전은 `package.json`, 변경 이력, Git 태그를 맞춥니다. 과거 ZIP에서 가져온 버전의 커밋은 이관 시점의 기록이며 과거에 작성한 Git 커밋으로 표시하지 않습니다.

규칙서·임무 원문·공식 FAQ와 프로젝트 재정은 [규칙 결정 기록](docs/decisions.md)에서 구분합니다. [이전 README](docs/archive/README-legacy.txt), [개발 기록](docs/development/DEVELOPMENT.md), `docs/verification/legacy/VERIFICATION_v*.txt`는 작성 당시 기록입니다. 현재 실행 방법과 프로젝트 재정은 이 README와 결정 기록을 우선합니다.

## 코드와 자료

`src/hunt-engine.js`는 명령과 상태 검증, `src/chapter-engine.js`는 칸·타일·출입구·출현, `src/mission-engine.js`는 공개된 임무·분기·대상 조건을 처리합니다. UI와 연출은 같은 규칙 엔진을 사용합니다. 카메라와 외형은 규칙 행동이나 비용을 추가하지 않습니다.

루트에는 `index.html`·`hunt.html`과 기본 설정·프로젝트 안내를 둡니다. 나머지 파일은 다음 폴더로 구분합니다.

| 폴더 | 내용 |
|---|---|
| `src/`, `styles/`, `pages/` | 실행 코드·스타일·부속 화면 |
| `assets/`, `fonts/`, `campaigns/`, `components/` | 게임 에셋·서체·캠페인·구성품 데이터 |
| `tests/`, `scripts/` | 회귀 검사·빌드·점검 도구 |
| `docs/verification/` | [검증용 플레이 안내](docs/verification/QA_GUIDE.txt)·이전 검증 기록(`legacy/`) |
| `docs/guides/` | 지도·HUD·카메라·적·무기 표시 안내 |
| `docs/rules/checklist/`, `docs/provenance/` | 규칙 대조표·원본 자료 목록 |
| `docs/audits/`, `docs/history/` | 점검 근거·출시 이력 |
| `docs/development/`, `docs/archive/` | 개발 설계·입력 양식·이전 안내 |
| `docs/maintenance/` | 파일 정리의 대조·검증 기록 |

이동 전후 경로는 `scripts/project-runtime-paths.json`과 `scripts/project-document-paths.json`에 기록했습니다. 과거 감사 문서의 당시 경로와 해시는 그대로 보존합니다. `main`의 실행 버전은 0.8.12이며 개발 중인 변경은 각 개발 브랜치와 PR에서 확인합니다.

실행에 필요한 `assets/`, `fonts/`, `campaigns/`, `components/`, `tests/` 및 출처·해시 기록은 버전 관리합니다. 사용자가 제공한 원본 사진 폴더(`참고자료/`, `components/images/`, `campaigns/long-hunt/images/`)와 플레이 저장, 중복 ZIP, 임시 브라우저 QA 페이지는 로컬에 보존합니다. 역사적인 출처 메타데이터의 과거 로컬 경로는 자료 수집 기록이며 실행 경로가 아닙니다.

현재 범위는 기나긴 사냥의 단일 플레이입니다. 다른 캠페인과 멀티플레이는 이후 작업입니다. 외형은 기존 0.8.3 에셋 기반이며, 현재 지도 렌더링과 야수의 발톱 수정은 유지합니다.
