# Unity 개발 준비물

이 폴더는 Unity 이식 준비 자료입니다. 실행 중인 웹 게임이나 저장을 변경하지 않았으며 출시물도 아닙니다. 실제 C# 게임 규칙, Unity 맵 장면, 캐릭터 애니메이션은 아직 완성되거나 실행 검증되지 않았습니다.

현재 JS 엔진을 기준 구현으로 보존하고, 작은 C# 단위부터 동일 입력의 결과를 비교하는 방식으로 진행합니다. 버전, 실제 데이터 수, 출처 커밋과 파일 해시는 `MigrationPrivate/export-report.json`, `source-manifest-v1.json`에 기록합니다. 향후 감사 수정본도 두 생성기의 첫 번째 인수에 폴더를 전달하면 별도로 준비할 수 있습니다.

| 준비물 | 용도 |
|---|---|
| `ReferenceEngine/` | 원본 authoritative reducer와 전체 로컬 의존성 복사본. 규칙을 C#으로 바꾸는 동안 회귀 기준으로 사용 |
| `MigrationPrivate/content-v1.json` | 무기, 화기, 기본/확장 적, 보스, NPC, 보상, 소모품, 60개 임무, 타일 geometry와 시각 정의의 버전 있는 JSON |
| `MigrationPrivate/command-catalog-v1.json` | handler와 명령 종류의 출처 목록. 복잡한 선택 payload와 처리 순서는 원본 엔진이 검증 |
| `MigrationPrivate/Parity/` | 76개 자연 명령 trace, 14,477개 명령, 단계별 private/public/event hash, 공개 checkpoint, 최종 원본 저장. rules13 전체 캠페인 15개와 무기 양면 시작 30개, rules14 전체 캠페인 15개, rules 7~12와 누락 버전의 과거 저장, rules14 처치 반응·치유로 죽음 방지 및 rules13 명시적 재정 채택/이어서 처리하는 trace 포함 |
| `UnityStarter/Assets/` | 기존 원본 런타임 PNG/SVG/atlas, 공개 타일/무기 시각 JSON, 독립 C# 난수/좌표 구현, JSON DTO 및 Editor 검사 메뉴 |
| `schemas/` | content, command, save 후보, public view의 JSON Schema. 형식 검사가 실제 규칙 검증을 대신하지 않음 |
| `tools/oracle.cjs` | Node stdio 개발용 bridge. 원본 명령을 순서대로 처리하고 원자적으로 commit한 뒤 공개 snapshot과 기존 animation adapter 결과만 반환 |

함수는 JSON으로 이식되지 않습니다. 제외된 함수 이름은 `executableMembersExcluded`로 기록하고 원본 소스도 보존했습니다. JSON 데이터를 가져오기만 하면 모든 규칙이 작동한다는 뜻이 아닙니다. 사진 경로의 출처 메타데이터는 private 데이터에 남을 수 있지만 원본 참조 사진 픽셀은 복사하지 않았습니다.

## 지금 실행할 수 있는 검증

Node가 이미 설치되어 있어 아래 명령을 이 폴더에서 실행할 수 있습니다. `generate-fixtures`는 출처 폴더의 실제 fixture를 읽습니다. 다른 개발 수정본을 검증할 때도 원본 폴더를 덮어쓰지 말고 독립 복사본에서 실행합니다.

전체 계약 검사에는 `package.json`과 lockfile에 고정한 pnpm11.25.0/Ajv8.20.0을 사용합니다. 게임 실행에는 이 개발 의존성이 필요하지 않습니다. Node24와 pnpm을 준비한 뒤 이 폴더에서 `pnpm install --frozen-lockfile --ignore-scripts`를 실행합니다. JSON Schema는 각 절대 `$id`로 등록하며 저장 schema의 명령 `$ref`는 등록된 URN을 가리킵니다. 구조 검증은 실제 규칙 재생을 대체하지 않습니다.

```powershell
node tools/export.cjs ..
node tools/generate-fixtures.cjs ..
node --test tests/*.test.cjs
node tools/verify-csharp-primitives.cjs
node tools/check-current-campaigns.cjs ..
node tools/validate.cjs
node tools/oracle.cjs
```

oracle 입력 예시는 한 줄에 JSON 하나입니다. 성공 응답은 `view`와 `actions`만 반환합니다. `export-save`는 사용자가 저장하거나 개발 parity를 확인할 때의 별도 명시적 작업이며 프런트엔드 binding으로 사용하지 않습니다.

```json
{"id":1,"op":"create","setup":{"seed":90,"weaponId":"burial","face":1,"options":{"campaign":true}}}
{"id":2,"op":"view"}
{"id":3,"op":"dispatch","expectedRevision":0,"commands":[{"type":"END_TURN"}]}
```

`propose`는 기존 `hunt-departure.plan`을 사용해 생존자 동행 선택을 제공합니다. `dispatch`는 이미 선택한 원본 명령을 받습니다. UI 선택창, 카드 비용, 사건 순서, replay 기록을 새 bridge에서 재해석하지 않습니다. 부적절한 단계, 오래된 revision 또는 batch의 후속 명령 실패는 commit되지 않습니다.

## Unity에서 이어갈 때

Unity Hub/Editor는 PATH와 일반 설치 경로에서 발견되지 않았습니다. .NET 8 runtime은 있으나 SDK는 없습니다. Unity 설치 없이 데이터 export, JS parity, 저장 복원과 공개 정보 검사, 독립 C# 난수/geometry 검증까지 준비할 수 있습니다. 독립 C# 검증은 이미 설치된 Windows .NET Framework compiler를 사용합니다.

새 2D Unity 프로젝트를 **Unity 6.3 LTS**로 만들고 `UnityStarter/Assets/Bloodborne`을 복사합니다. `UnityStarter/Packages/manifest.json`의 Newtonsoft dependency만 새 프로젝트 manifest에 합칩니다. 기존 manifest 전체를 교체하지 않습니다. 이 자료는 프로젝트에 가져오는 overlay이며 검증된 Unity 프로젝트나 빌드가 아닙니다. 정확한 Editor patch는 Hub의 지원되는 6.3 LTS 중 설치 후 기록합니다. [Unity 공식 지원 표](https://unity.com/releases/unity-6/support)는 6.3 LTS를 2027년 12월까지 지원한다고 안내합니다.

`com.unity.nuget.newtonsoft-json` 3.2.2는 [Unity 공식 Editor release notes](https://unity.com/releases/editor/whats-new/6000.0.79f1)에서 확인한 버전입니다. [Unity JSON 설명](https://docs.unity.com/en-us/engine/6000.0/manual/scripting/compilation-and-code-reload/script-serialization/json-serialization)에 따라 원본의 dictionary와 임의 명령 payload를 보존하려고 `JObject/JArray` 계약을 준비했습니다. 이 의존성의 실제 6.3 Editor 설치/compile는 다음 단계에서 확인해야 합니다.

1. Editor에서 `Bloodborne Port/Validate private content package`로 외부 private content를 점검합니다. `MigrationPrivate`와 `ReferenceEngine`은 `Assets`, `Resources`, `StreamingAssets`로 통째로 넣지 않습니다. 화면은 `IPlayableRulesBridge`의 공개 결과만 받습니다.
2. C# domain에서 chapter graph, 카드/장비 규칙, 전투 timing, mission/reward 순서, save replay를 작은 단위로 구현합니다. 매 단계에서 동일 seed와 모든 original command를 실행하여 private 상태, public projection, event 순서를 JS 기준과 비교합니다. 배열 순서, uint 오버플로, RNG 호출 횟수, 누락 값과 null, reward/화기/무기/mission dispatcher 우선순위를 유지합니다.
3. 과거 저장은 저장 당시 rulesVersion으로 먼저 전체 명령을 재생하고 원본 상태를 비교합니다. 누락 버전을 현재 버전으로 추정하지 않습니다. `applyChapelRuling` 및 `applyCombatReactionRuling`의 현재 프로젝트 재정 채택은 import 검증 **후** 별도 명령으로 남깁니다. rules14의 `kill_react`에서 황홀/야수 룬과 `PASS_KILL_REACTION`의 정확한 순서를 보존합니다. 새로운 15개 rules14 전체 캠페인 trace는 원래 플레이 명령 순서를 유지하면서 반응창에서 91개 명시적 PASS를 추가했습니다. 획득 보상 장착/보관과 다음 원래 명령의 합법적인 룬 사용을 먼저 처리하며 무조건 PASS하지 않습니다. rules13 trace도 그대로 보존합니다.
4. 맵은 타일 단위 logical graph와 시각 geometry를 나눕니다. y-down 퍼센트 좌표에서 타일을 회전한 후 Unity y-up 좌표로 바꿉니다. 칸을 타일 전체로 넓히지 않으며 임무18/21/41 및 예배당 순서의 사용자 재정은 `MigrationPrivate/decisions.md`와 회귀 검사를 그대로 보존합니다.
5. PNG atlas는 Phaser의 trimmed frame, sourceSize, spriteSourceSize, 아래 기준 origin을 변환해야 합니다. 단순 grid slicing은 사용하지 않습니다. `w-beast-claw-b-v0810`과 공통5종의 공격10/11, 공통 사냥꾼의 죽음14/15에는 `clipRects`가 있습니다. 확장한 crop만 읽으면 옆 포즈 조각이 다시 나타나므로 이 포함 영역을 Unity의 mask/shader 처리로 보존해야 합니다. crop의 끝은 투명 패딩을 포함하며 접지 원점과 다릅니다. 일반 공통 skin의 originY는460/512, beast는 실제 발 위치432/512를 사용합니다. SVG는 Unity의 vector 처리 또는 검증된 raster 변환이 추가로 필요합니다. 30개 무기 형태별 idle/walk/attack-slot/hit/death/transform animation과 Tonitrus pre-attack charge glow는 이벤트 계약을 검증한 뒤 연결합니다. 현재 준비물은 이 데이터를 보존하며 전체 Unity 캐릭터 renderer 구현·Editor 실행 완료를 뜻하지 않습니다.
6. 공개 mission text는 기존 `hunt-public-text` 규칙처럼 공개된 기록만 사용합니다. 아직 열지 않은 카드 제목·보상·분기 결과나 deck 순서를 UI에 보내지 않습니다. `PublicFrame`의 구조/금지 필드 검사와 poison 회귀 검사를 유지합니다.

모든 현재/과거 trace와 timing 예외가 C#에서 통과하고 Unity Editor에서 실제 장면·입력·저장·맵·애니메이션을 실행한 뒤에만 C# reducer를 authoritative 구현으로 바꿉니다. 개발용 Node oracle은 desktop parity의 참고 도구이며 mobile/WebGL 또는 완성 게임의 배포 구조가 아닙니다.

## 검증 범위

`Validation/csharp-primitives-report.json`은 실제 compile/run된2337개 unsigned RNG, seed mix, shuffle 및 tile 좌표 parity를 확인합니다. `tests/preparation.test.cjs`의10개 검사는 공개 정보 경계, 원자적인 다중 명령, 정확한 저장 복원 후 채택, source/asset hash와 export 범위, Tonitrus 전투 연습, rules14 15개 캠페인의 모든 명령 단계에서 oracle 공개 snapshot/event parity를 검사합니다. 공개 장면 ID는 준비 시드에서 만들지 않으며 실패한 불러오기는 기존 진행과 세션 ID를 보존합니다.

`Validation/csharp-contracts-report.json`은 실제 `PortContracts.cs`를 PowerShell Roslyn과 설치된 Newtonsoft로 컴파일하고 실행한21개 계약 검사입니다. 날짜처럼 보이는 문자열의 정확한 값/offset, 누락·null payload, 중복 키/뒤에 붙은 JSON 거부, 공개 경계와 원본 content/save 읽기를 검사합니다. 이것은 Unity Editor나 Unity 패키지 버전으로 컴파일했다는 증거가 아닙니다.

`Validation/schema-report.json`은 Ajv draft2020-12로 모든 schema를 등록하고76개 저장·14,477명령·1,300공개 checkpoint 및 음성 사례를 검사한15863개 구조 검사입니다. 실제 명령 규칙은 원본 reducer가 검증하고 비공개 키의 재귀 경계는 별도 projection/contract 검사가 확인합니다. 전체 C# 규칙 엔진, 실제 Unity Editor/package compile, sprite/map rendering과 animations는 아직 검증되지 않았습니다.
