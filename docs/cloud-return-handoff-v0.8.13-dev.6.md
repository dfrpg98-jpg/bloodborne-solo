# 클라우드 최종 인수 · v0.8.13-dev.6

기록 확정: 2026-10-14 KST. 클라우드 개발/검증 실행 단계는 종료하고 아래 자료를 로컬 인수한다. 전체 영상 모든 프레임 및 가려진 추격 구간의 검토가 끝났다는 뜻은 아니다.

## 현재 로컬 인수 상태 · 2026-10-14

최종 클라우드 문서 커밋 `dcb6172288b126356081d7146862694666bf8efe`의 문서·공개 증거81개를 기존 로컬 수정 위로 가져왔습니다. 제품 파일 변경은0개이며, `docs/bugs.md`는 클라우드 BB-027 완료 기록과 로컬 BB-028·BB-029를 모두 보존해 합칩니다. 클라우드 검증 소스33c와 현재 로컬 제품08d를 구분합니다.

현재 로컬 제품은 `08d6405178111a11fe437309f4b7563fae84bea2`입니다. BB-028 임무 알림 수정([PR37](https://github.com/dfrpg98-jpg/bloodborne-solo/pull/37))에 BB-029 손패 높이 수정([PR39](https://github.com/dfrpg98-jpg/bloodborne-solo/pull/39))을 추가했습니다. 기본 두 카드의 한 줄 스크롤을 없애고 실제 브라우저10상태·Node 전체CI2669통과/실패0을 확인했습니다. [손패 재현·증거·한계](audits/hand-row-sizing-v0.8.13-dev.6/README.md)를 따릅니다. 이전 인수 문서의 ‘다음 BB-028’과 ‘로컬 미배포’는 당시 클라우드 범위를 나타내는 역사 기록이며, 현재 다음 오류ID는 BB-030입니다.

`C:/Users/GOOD/Documents/Codex/bloodborne-solo`에서 문서와 실행 코드를 관리하며, 기존 Desktop 실행본의312개 허용 파일은08d의 디스크·HTTP SHA와 일치합니다. 손패 변경은2파일만 교체했고 삭제는0개입니다. 개인 저장·참고자료188개는 이전 SHA와 같습니다. `http://127.0.0.1:8786/bloodborne-solo/hunt.html`은 검증한 실행 파일만 읽는 서버로 연결했습니다. 원본 클라우드 ZIP과 추가 로컬 시각 표본은 별도 로컬 `work/weapon-followup-audit`에 보존하며, 문서 인수가 남은 모션 확인의 완료를 뜻하지 않습니다.

## 코드와 전체CI

- 마지막 제품 수정: c42c5e32c8ed02b4248b966083e3cceef4a5c6f4(BB-027 undefined pending속성 기록 수정).
- 검증 소스:33c236767d94ea5efa4c75bf1330e41721e91747. 이후 커밋3d3c6f8/300228c/186984b/33c2367은 QA/helper/workflow 변경만 있다.
- 전체 push [38492083994](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38492083994), PR [38492087248](https://github.com/dfrpg98-jpg/bloodborne-solo/actions/runs/38492087248): 회귀·Unity preparation success. 로컬 클라우드 node scripts/test-ci.cjs2665통과/실패0(462.657초).
- [제품 동일 blob/tree 증거](audits/weapon-followup-v0.8.13-dev.6/product-identity.json). 이 인수 커밋은 문서/증거만 변경한다. 사진 미업로드로 제외하는4사진검사를 완료로 세지 않는다.

## 실제 UI·모델·시각 검토

| 범위 | 실제 확인과 근거 |
|---|---|
| 기본30형태+무료변형수락2 | source238b6c1/run38486340270. 공개 가져오기1회→첫전투/후속→새 일반MOVE/STEP/STOP_MOVE→둘째전투/후속. [32행 표](audits/weapon-followup-v0.8.13-dev.6/base32-completion-table.md) |
| 고유 효과 추가 프로필 | [73행 완료표](audits/weapon-followup-v0.8.13-dev.6/effect-branch-completion-table.md). 계속 플레이72·정상 최종loss1. 최초66의62성공/4실패와 그4선택재실행, 별도 정상종료1/효과 수치5/다른속도회피1을 프로필ID로 중복제거. 기본32와 합쳐 전체 모든 조합을 검증했다는 수치로 쓰지 않는다. |
| 모델 | 정상create/dispatch와 엄격 export/import로 체크포인트·예상명령을 준비했다. 모델57/66준비를 actual수로 확대하지 않는다. 실제 클릭의 상태/명령/phase/pending는 실행별JSON에서 확인한다. |
| 시각 표본 | 기본256PNG·32WebM의256프레임·무료변형15프레임, 대표15의73PNG·166프레임·줌팬4, root의 빠른후속 시간차 표본. [PTS 범위/한계](audits/weapon-followup-v0.8.13-dev.6/visual-review.md). 전체영상 전프레임 검사 아님. |
| 빠른 후속 | 38490812586 정상6경로,38491810513 실제142.6–225.6ms4경로;252.9/276.6ms2실패는 타이밍 하네스 조건. 마지막38492083986 루드비히137.5/134.2ms·도끼236.6ms 및 다음행동/레이테르 다른속도회피 성공. 실제간격을 숨기지 않음. |

## 실제 오류와 근거

- BB-025/Issue32: 실제 임무10·31·타일17 원문3사진과 공식FAQv1.0에서 두 면제를 뒷받침하는 원문을 찾지 못했다. 과거규칙14 명령 재생을 보존하고 안전 단계에서 APPLY_TILE_SPEED_RULING으로 이후 공격에 -1. 실제5경로38488907907 성공. [근거/숫자/재현](audits/tile-speed-policy-v0.8.13-dev.6/README.md). 공식 개별 판정으로 추측을 소개하지 않음.
- BB-026/Issue33: 같은이름 적 선택피해 연출 중복. 수정 전38483687579/후38484278818 실제3무기 검증,415ab 전체CI성공. [원본6PNG/2JSON/해시](audits/weapon-followup-target-v0.8.13-dev.6/README.md).656b48ca 통합.
- BB-027/Issue34: 치카게 회피HP3→4 후 다중선택 정상저장 재생거부. 수정전38488907921/shard2, 수정후38490210418 같은선택→다음이동/전투 성공. 최소수정c42c5e32·중간저장 매단계 회귀.
- 별도 로컬 BB-028/Issue36/draftPR37: 로컬 root가 알림 생성/정책전환 순서의 낡은 면제문구를4cbdef417c9810e3c558b78c3a6a8aae970a9ec7에서 수정했다. 로컬 전체CI2669·실제11명령·8786재확인 완료 보고는 클라우드 검증과 구분한다. 중복 변경하지 않았다.

## 증거와 인수 파일

[artifact ID/ZIP SHA](audits/weapon-followup-v0.8.13-dev.6/artifact-index.json), [다운로드 원본 파일 SHA838개](audits/weapon-followup-v0.8.13-dev.6/downloaded-original-sha256.json), [실행별 공개JSON](audits/weapon-followup-v0.8.13-dev.6/actual-result-index.json), [기본32 PNG 파생JPEG 색인](audits/weapon-followup-v0.8.13-dev.6/evidence/derived-evidence-index.json). 기본ZIP11859343434:304855881bytes/SHA250c0fdd19b38c63b52a1689d0047f06f04d712fcbf74f100b5f4415cec254ab.

이 커밋의 변경 파일은 후속audit의 공개JSON/완료표/해시/파생JPEG, 원래map-motion README의 누락 해소 설명, 예배당 최종브라우저/CI기록, 규칙근거검토의 최신상태, docs/bugs.md, 기존cloud-handoff 및QA_GUIDE, 이 인수 문서다. 제품JS/HTML/테스트/workflow 변경 없음.

## 남은 확인과 로컬 상태

- 전체영상 모든프레임의 시각 검토는 미완료. 로컬 독립검토에서 장송·발톱·루드비히 양면 및 무료수락8프로필의 추격 중간 일부가 QA회복/소모품 모달로 가려졌으므로 해당 구간을 완료로 세지 않는다. 모델/공개 논리위치를 가려진 실제canvas 증거로 대신하지 않는다. 정상원래fixture의beforeWalk 경로를 다시 시작하고 소모품창을 닫은 뒤 같은STEP/STOP_MOVE/추격의 실제canvas를 촬영하는 자료가 실행 가능한 후속이다.
- 새 revision clearEffects의 공격/사망타이머 정리는 검토후보다. 이번 지정표본에서 잘못된 생존인물 정착/지속몸통겹침으로 확정하지 않았다. 애니메이션 모든프레임 유지 보증 없음.
- 공식규칙서v1.1 본문은 확보하지 못했고 공식FAQv1.0/실제3사진 대조 범위만 주장한다. 모든 카드/임무/보상의 교차조합 전수검사가 아니다.
- 로컬 root가33c+4cb를 canonical/Desktop에 반영,312파일disk/HTTP SHA일치·개인/원본188파일해시보존·실제8786 재검증을 완료했다고 보고했다. 클라우드가 로컬배포를 수행한 것은 아니다. 현재 로컬코드와 이 문서전용커밋을 동기화하는 작업은 로컬 root가 맡는다.
- 개인플레이/인증/원본 참고사진/rawQA저장 Git업로드 없음. PR15 draft, main병합/태그/정식릴리스 없음. [단일진행표 Issue35](https://github.com/dfrpg98-jpg/bloodborne-solo/issues/35).
