# 점검 기록

이 폴더의 JSON은 실제 실행 결과와 규칙 대조 기록입니다. 로컬 사용자 경로는 `local-development-archive`, `local-reference-project`, `local-reference-archive`로 바꿨으며 검사 내용·통과 수·원본 해시는 유지했습니다. 경로 표기는 출처 식별자이며 GitHub에서 존재하는 파일 경로를 뜻하지 않습니다.

- `mission-location-audit-v0.8.12.json`: 60개 임무와6개 챕터 문서를 대조했습니다. 위치 조건30개는 통과,27개는 독립 위치 조건 없음,3개는 사용자 재정이며 확인된 위치 오류는0개입니다.
- `location-scope-checks.json`: 위치 범위28개 검사 통과.
- `location-render-checks.json`: 지도 배치·표시26개 검사 통과.
- `location-install-proof.json`: 기존0.8.12의509파일을 변경하지 않고 위치 검사만 추가한 증거.
- `departure-package-checks-v0.8.12.json`: 생존자 동행과 관련 범위375개 검사 통과. 전체 테스트 합계나 현재 GitHub Actions 성공을 주장하는 수치가 아닙니다.
- `departure-review-v0.8.12.json`: 동행 확인과 실제 임무 조건의 검토 기록.

GitHub Actions가 실제 실행한 최신 전체 결과는 Actions의 `game-regression-results` 아티팩트에서 확인합니다. 참고사진의 실제 바이트를 읽는4개 검사는 CI에서 제외하고 로컬 전체 검사에서 확인합니다.
