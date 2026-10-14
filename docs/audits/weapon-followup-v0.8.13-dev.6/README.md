# 15정규무기×2형태 · 후속 선택과 다음 이동/전투 감사

기존 map-motion audit의 complete는 지정된 STEP/STOP_MOVE/TRANSFORM/ATTACK/RESOLVE 실행까지였습니다. 27개는 플레이어 단계로 끝났지만, 루드비히0은 free_transform 선택이 남았고 다른2개 후속 snapshot은 예전 단계였습니다. 기존30개에 다음 새 이동/전투까지 실제 클릭한 증거는 없었습니다. 게임 오류로 막힌 것이 아니라 완료 기준과 실행 범위의 누락입니다.

지원 브랜치 `qa/weapon-followup-base-20261014` / `238b6c1aab8b24373a132c22e93c0afc2e86a848`의 실제 Chromium [Actions38486340270](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38486340270)은32개 연속 경로를 성공했습니다. 15종2형태30개와 루드비히0/이질적성검1 무료변형 수락2개이며 기본 행은 거절합니다. 각 행은 정상 create/dispatch QA 체크포인트 한 번의 공개 가져오기 뒤 첫 전투/모든 후속→일반 MOVE/STEP/STOP_MOVE→두 번째 전투/모든 후속입니다. state exact/command once/Phaser ready/full/own weapon ready를 확인했고 failures/pageErrors/consoleErrors는0입니다. 이는 실제 UI 연속 실행 결과이며 아직 모든 영상의 시각 검토 완료 결과는 아닙니다.

[원본 artifact11859343434](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38486340270/artifacts/11859343434): 256PNG+32WebM+results, ZIP304855881bytes·SHA256 `250c0fdd19b38c63b52a1689d0047f06f04d712fcbf74f100b5f4415cec254ab`. 원시 QA 저장·개인 플레이·인증·원본 참고 사진은 없습니다.

별도66개 효과 분기를 정상 명령으로 준비해 후속과 다음 이동/전투까지 재생했습니다. [준비 모델](branch-preparation-model.json)은 실제 브라우저 증거가 아닙니다. scripts/helpers/cloud-weapon-branch-plans.cjs와 scripts/cloud-weapon-followup-branches.cjs가 희생/대상 선택/처치 연쇄/무료변형/슬롯 비우기/0·1·2칸 이동·밀치기/진입/회피/사격/충전 만료를 실제 공개 UI로 확인합니다. 하나의 사례는 중간 재수입 없이 끝내며 네 개의 독립 shard로 나눕니다. 실패나 미해결 단계는 별도로 기록하고 다른 저장을 가져와 성공으로 바꾸지 않습니다.

영상/화면 검토는 사람 속도와 빠른 후속을 구분하고 실제 action/screenshot timestamps를 사용합니다. DOM 위치는 논리 끝점이며 현재 canvas중간좌표의 증거로 대신하지 않습니다. 긴 무기 궤적과 지속 몸통/발 가림, 정상 처치/초기화/새 챕터 이동을 구분합니다. 선택 종료와 다음 hunter 복귀 및 현재/이후 자원 수치를 확인할 때까지 전체 효과 검증 완료라고 보고하지 않습니다.

BB-026은 동명 적 타격 대상 연출 오류로 별도 실제 재현/수정/재검증되었습니다. [Issue33](https://github.com/dfrpg98-jpg/bloodborne-solo/issues/33)과 [전후 원본 증거](../weapon-followup-target-v0.8.13-dev.6/README.md)를 확인하세요. PR15 draft, main 병합/태그/릴리스 및 사용자 로컬8786 배포 없음.
