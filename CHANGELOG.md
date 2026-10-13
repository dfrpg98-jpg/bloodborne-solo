# 버전 이력

현재 개발 버전은0.8.13-dev.4이고 마지막 보관 릴리스는0.8.12입니다. 아래26개 태그는 기존 릴리스 스냅샷에서 이관했습니다. Git의 커밋 날짜는 실제 이관 시점이며 과거 개발 날짜를 재현하지 않습니다.

태그의 실행 파일은 해당 보관본과 바이트를 대조했습니다. 원본 사진 폴더는 제외했습니다. 초기0.6.0–0.8.2의 사진 자료실·사진 기반 화면을 완전히 재현하려면 로컬에 보존한 당시 ZIP을 사용해야 합니다. 원본 ZIP의 SHA-256은 [릴리스 목록](docs/history/releases.json)에 기록했습니다.

정식0.8.13 태그는 만들지 않았습니다. 0.8.13-dev.1의 점검 수정과 이식 준비 위에 임무 변화 안내를 추가한 개발본입니다.

## 0.8.13-dev.4 · 연속 플레이 점검과 진행 전환 선택 초기화

- BB-011: 검증 사냥에서 재앙의 야수를 선택한 뒤 적이 없는 일반 사냥으로 돌아오면, 이전 지도 선택이 남아 기본 이동이 접힌 메뉴 안으로 들어가던 UI 오류를 수정했습니다. 새 사냥·저장 복귀·파일 불러오기에서 이전 지도와 적 선택을 초기화합니다. 게임 판정과 저장 형식은 유지합니다.
- 새 검증 사냥을 챕터 1부터 3까지 중간 불러오기 없이 실제 브라우저로 이어서 완수했습니다. 임무 알림 뒤 이동·전투·필수 보상·기절 비용·마지막 꿈·챕터 전환을 구분해 확인했습니다. 자세한 실행 수와 수정 재검증은 [점검 기록](docs/audits/README.md)에 보존합니다.

## 0.8.13-dev.3 · 검증용 플레이모드의 챕터 2·3 UI 점검

- BB-009: ‘재앙의 야수를 처치해 계몽 토큰 제거.’처럼 불완전하게 끝나던 임무 지시문을 ‘재앙의 야수를 처치해 계몽 토큰을 제거하세요.’로 수정했습니다. 처치·봉인·기부 지시의 목적격 조사도 보완했습니다.
- BB-010: 성직자 야수와 소환된 적들이 같은 칸에 있을 때 보스 마커를 눌러도 아래쪽 적이 선택되던 오류를 수정했습니다. 아래 적의 투명 이미지 영역이 위 마커를 덮지 않도록 했으며 실제 마커·배치·게임 판정은 유지합니다.
- 검증용 무기·소모품과 정상 명령으로 만든 QA 저장을 제품의 ‘불러오기’로 재사용해 챕터 2·3의 조건별 임무 알림을 실제 브라우저에서 확인했습니다. 엔진으로 준비한 구간과 실제 화면에서 수행한 트리거를 구분합니다. 정규 장비로 캠페인을 완주했다는 증거로 소개하지 않습니다.
- UI 점검에 검증용 플레이모드를 우선 사용하는 절차를 QA_GUIDE.txt에 명시했습니다. 자세한 재현 예시와 증거는 [오류 목록](docs/bugs.md)과 [점검 기록](docs/audits/README.md)에 보존합니다.

## 0.8.13-dev.2 · 임무 변화 안내

- 예: 마당 등불에서 이동을 마쳐 임무가 등장하면 ‘새로운 임무’와 현재 처치 목표를 표시합니다. 확인한 뒤 사냥을 이어가며 확인에는 손패나 행동을 사용하지 않습니다.
- 임무 완수 시 실제 완수한 내용, 획득한 계몽 수, 제거된 안개를 보여줍니다. 같은 행동에서 여러 임무가 바뀌면 한 화면에 함께 표시합니다. 보상 공개를 새로운 임무로 중복 알리지 않습니다.
- ‘현재 목표’의 변경 강조와 미확인 수, 다시 보기 버튼, 일지의 최근 변화 기록을 추가했습니다. 최근 변화는 현재 접속 세션의 기록이며 저장 불러오기는 지나간 알림을 다시 띄우지 않습니다.
- BB-008: 이오세프카를 공격하기로 이미 선택한 뒤에도 ‘공격하거나 실험을 돕기’로 남던 현재 목표를 ‘진료소의 이오세프카를 처치하세요’로 수정했습니다.
- 엔진 판정과 기존 저장 형식은 유지합니다. 초기 DOM 컨트롤·공개 명령·저장 대조 이후 실제 브라우저 검증을 추가했습니다. 정규 모드의 챕터1과 검증용 모드의 챕터2·3 기록은 [점검 인덱스](docs/audits/README.md)에서 각각 확인합니다.

## 0.8.13-dev.1 · 출시 전 점검과 Unity 준비

- BB-001: 장송의 칼날 속도3 범위 피해로 주변 적을 처치하고 재앙의 야수의 속도1·피해4 공격이 남았을 때, 처치 치유 선택 전에 플레이어가 사망하던 오류를 수정했습니다. 체력4 → 처치 문자로5 → 피해4 → 체력1 생존을 실제 공개 명령과 브라우저에서 확인합니다.
- BB-002: 임무41이 납골당 진입을 막고 있어도 중앙 등불에서 두 칸을 이동 후보로 표시하던 오류를 수정했습니다. 명령 거부와 후보 표시가 같은 진입 조건을 사용합니다.
- BB-003: 처치 문자 하나를 사용해도 다른 문자를 사용할 수 있는 새 반응창에 맞춰 종료 안내 문구를 수정했습니다.
- BB-004: Unity 준비물의 공개 장면 ID에 준비 시드가 포함되던 문제를 수정했습니다. 시드와 무관한 세션 ID를 쓰고 실패한 불러오기는 기존 진행/ID를 보존합니다.
- BB-005~007: Unity 저장 schema의 등록 참조/null 명령, C# 날짜 문자열 보존, 토니트루스 전투 연습의 공개 외형 재생 오류를 수정했습니다. 예: `+05:30` ISO 문자열이 로컬 `+09:00` 날짜로 바뀌지 않도록 원래 문자열을 읽습니다. 실제 JSON validator와 C# DTO compile/runtime 검사를 추가했습니다.
- 기존 저장의 원래 재생 결과를 보존하고 현재 처치 판정 채택을 별도 명령으로 기록합니다. 자세한 예시·근거·검사는 [오류 목록](docs/bugs.md)에 기록합니다.
- Unity 이식용 source/content/asset 생성기, 공개 정보 계약, 현재·과거 명령 기준과 C# 난수·타일 좌표/Editor 가져오기 틀을 추가했습니다. 전체 C# 게임과 Unity 장면 실행은 아직 구현·검증하지 않았습니다.
- 정식 릴리스·태그는 만들지 않습니다. 모든 수치는 [점검 기록](docs/audits/release-readiness-2026-10-13.md)의 실제 완료 결과를 기준으로 합니다.

## 이관 후 개발

- 규칙 결정 기록과 임무 위치 점검 근거를 보존했습니다.
- 원본 사진을 업로드하지 않고 실행할 수 있는 자동 검증과 이슈·검토 양식을 추가했습니다.
- 임무18·21·41의 타일 전체 재정을 포함한28개 위치 검사를 추가했습니다. 기존 실행 로직은 유지합니다.

## 보관된 릴리스

| 태그 | 버전 관리 파일 | 스냅샷 커밋 |
| --- | ---: | --- |
| [v0.6.0](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.6.0) | 176 | `7cb27c0b3ca7` |
| [v0.6.1](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.6.1) | 204 | `07c378c4f483` |
| [v0.6.2](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.6.2) | 209 | `dac6c6d3309d` |
| [v0.7.0](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.0) | 215 | `8004310fdb87` |
| [v0.7.1](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.1) | 232 | `a3f43620fc18` |
| [v0.7.2](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.2) | 256 | `fbb14eb4fa46` |
| [v0.7.3](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.3) | 261 | `1353865bc737` |
| [v0.7.4](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.4) | 334 | `dbdfba87320f` |
| [v0.7.5](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.5) | 346 | `a033bbe75b6a` |
| [v0.7.6](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.6) | 350 | `4f252e3fb282` |
| [v0.7.7](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.7) | 355 | `5e33a6d2f642` |
| [v0.7.8](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.8) | 362 | `f3264d8360d4` |
| [v0.7.9](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.7.9) | 366 | `fec78cbec899` |
| [v0.8.0](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.0) | 371 | `b733e974f28e` |
| [v0.8.1](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.1) | 382 | `6ad086cc236a` |
| [v0.8.2](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.2) | 404 | `e0d1c3aa5280` |
| [v0.8.3](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.3) | 477 | `876b0234190c` |
| [v0.8.4](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.4) | 520 | `e7979d2a870b` |
| [v0.8.5](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.5) | 487 | `c48846e0cfcd` |
| [v0.8.6](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.6) | 488 | `26bcc3083461` |
| [v0.8.7](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.7) | 489 | `b83eaa8a268a` |
| [v0.8.8](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.8) | 489 | `27ad6bc01648` |
| [v0.8.9](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.9) | 494 | `2e4d52245d48` |
| [v0.8.10](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.10) | 504 | `1e291d5b2924` |
| [v0.8.11](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.11) | 506 | `c54d0946f376` |
| [v0.8.12](https://github.com/dfrpg98-jpg/bloodborne-solo/tree/v0.8.12) | 509 | `4b8df3b295ee` |
