# 점검 기록

- [실제 지도 모션·UI 개선 인계](map-motion-ui-qa-v0.8.13-dev.6/README.md): 검증용 플레이모드의 정상 무기15종30형태를 이동·추격·변형·공격으로 실제 브라우저 확인했습니다. 새 UI1~12와 최종 통합CI의 남은 검증은 [클라우드 인계](../cloud-handoff-v0.8.13-dev.6.md)와 구분합니다.

- [캐릭터 전체 프레임 점검](animation-frame-qa-v0.8.13-dev.5/results.json): 무기30형태720프레임과 공통 캐릭터5종80프레임의 원본·등록·경계·접지를 확인했습니다. BB-012~016의 실제 재현·수정·원본 해시·모의검사·브라우저 재생을 구분하고 수정 전/후 화면을 보존합니다.

이 폴더의 JSON은 실제 실행 결과와 규칙 대조 기록입니다. 로컬 사용자 경로는 `local-development-archive`, `local-reference-project`, `local-reference-archive`로 바꿨으며 검사 내용·통과 수·원본 해시는 유지했습니다. 경로 표기는 출처 식별자이며 GitHub에서 존재하는 파일 경로를 뜻하지 않습니다.

- `mission-location-audit-v0.8.12.json`: 60개 임무와6개 챕터 문서를 대조했습니다. 위치 조건30개는 통과,27개는 독립 위치 조건 없음,3개는 사용자 재정이며 확인된 위치 오류는0개입니다.
- `location-scope-checks.json`: 위치 범위28개 검사 통과.
- `location-render-checks.json`: 지도 배치·표시26개 검사 통과.
- `location-install-proof.json`: 기존0.8.12의509파일을 변경하지 않고 위치 검사만 추가한 증거.
- `departure-package-checks-v0.8.12.json`: 생존자 동행과 관련 범위375개 검사 통과. 전체 테스트 합계나 현재 GitHub Actions 성공을 주장하는 수치가 아닙니다.
- `departure-review-v0.8.12.json`: 동행 확인과 실제 임무 조건의 검토 기록.
- [mission-feedback-v0.8.13-dev.2.json](mission-feedback-v0.8.13-dev.2.json): 임무 알림 표시 모듈과 UI·임무 관련386개 검사 통과 기록. 자연 엔진 재생·DOM 검사와 실제 브라우저 검증을 구분합니다.
- [mission-browser-qa-v0.8.13-dev.2/results.json](mission-browser-qa-v0.8.13-dev.2/results.json): 실제 브라우저 컨트롤로 챕터1 완수와 챕터2 진입을 진행한23개 확인 및 스크린샷. 938×1252 화면에서 임무 등장·변경·완수, 확인 비용, 보상 선택, 동행 질문, 일지·새로고침을 점검했습니다. 다른 챕터2·3 분기(BB-008 포함), 작은·낮은 화면과 브라우저 가져오기·내보내기는 미검증입니다.

- [mission-browser-qa-v0.8.13-dev.3/results.json](mission-browser-qa-v0.8.13-dev.3/results.json): 기존 검증용 플레이모드와 정상 QA 저장의 제품 불러오기를 사용한 챕터2·3의49회 알림 표시·확인(수정 재검증 포함), 챕터1 준비5회와 추가3개 확인입니다. 문구 BB-009와 마커 클릭 BB-010의 실제 재현·수정 전후,57개 화면, 일반 저장 복귀를 보존합니다. 정상 명령으로 만든65개 재현용 QA 저장도 포함합니다. 엔진 준비 검증64행/62입력은 실제 브라우저 검증 수와 구분하며, 정규 장비 완주·작고 낮은 화면의 검증을 주장하지 않습니다.

GitHub Actions가 실제 실행한 최신 전체 결과는 Actions의 `game-regression-results` 아티팩트에서 확인합니다. 참고사진의 실제 바이트를 읽는4개 검사는 CI에서 제외하고 로컬 전체 검사에서 확인합니다.

- `release-readiness-2026-10-13.md`: 현재 개발본의 엄격 점검, 구체적인 재현 오류, 원문 대조와 미확정 범위.
- `release-readiness-results.json`: 실제 완료된 로컬 검증 수와 증거 해시. 원격 CI 완료는 해당 PR/Actions 실행에서 별도로 확인합니다.
- Unity 준비물의 생성·검증 결과는 `unity-port/Validation/*.json`과 Actions의 `unity-preparation-results` 아티팩트에서 확인합니다. 실제 Unity Editor나 전체 C# 게임이 실행됐다는 뜻이 아닙니다.

- [mission-continuous-qa-v0.8.13-dev.4/results.json](mission-continuous-qa-v0.8.13-dev.4/results.json): 검증용 플레이모드에서 챕터1~3을 중간 저장 불러오기 없이 실제 브라우저로 연속 완주했습니다. 0.8.13-dev.3 첫 실행과 BB-011 수정 후0.8.13-dev.4 재실행은 각각260공개 명령, 명령 후 알림26묶음·32이벤트이며 초기 안내1회는 따로 기록합니다. 보상·기절 비용·강화·다음 챕터가 이어지는지 확인했습니다. 전체 플레이 저장은 로컬에만 보존하고 QA 설정·공개 명령·관찰·원본 JPEG와 해시를 기록했습니다. 반복 실행·모델 기대값·DOM 비교를 고유 테스트 수로 합산하지 않습니다.
