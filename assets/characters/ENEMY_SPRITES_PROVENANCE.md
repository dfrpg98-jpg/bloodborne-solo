# 적 전용 스프라이트 출처 · 0.8.13-dev.9

2026-10-14. 기나긴 사냥의 여섯 캐릭터를 구분하기 위해 OpenAI ImageGen으로 투명 배경의 새 16포즈 그림을 생성했습니다. 사용자가 제공한 원본 게임 그림과 위키·게임 영상은 외형 대조 자료로 사용했습니다. 참고 사진·카드 글자·영상 HUD를 런타임 이미지로 복사하지 않았습니다. 기존 `provenance.json`은 v0.8.2 공통 캐릭터 그림에 관한 기록이며, 새 여섯 PNG의 출처는 이 문서로 구분합니다.

선택한 생성 PNG와 런타임 PNG의 바이트 및 SHA256이 모두 동일합니다. 원본 픽셀은 수정하지 않고, 프레임 crop·trim·소유 영역·발 원점·표시 크기는 별도 atlas/manifest 메타데이터로 관리합니다. 최종 성직자 야수 표시 메타데이터는 `displayHeight: 400`입니다. 마지막 코드 변경 후 관련205개·전체 CI2711개가 통과했고 실패·취소·스킵0입니다. 실제 QA와 로컬 적용·PR 검토의 범위는 [감사 기록](../../docs/audits/enemy-sprites-v0.8.13-dev.9/README.md)에 있습니다.

## 채택한 파일

| 시각 ID / 런타임 PNG | 생성 파일 식별자 | 원본 PNG 크기 | 변경하지 않은 SHA256 |
|---|---|---|---|
| [`huntsman-mob.png`](huntsman-mob.png) | `exec-cba18ec2-df1f-4e57-9e51-c7ef55ad81f4.png` | 1230×1278 | `ef50789dbefefbbbd8d34ee7ad6ccd2fd6fbe47f5278affe1245c55d4a65fd38` |
| [`huntsmans-minion.png`](huntsmans-minion.png) | `exec-0a84d7c6-d21c-4e22-a976-a00d0a9db393.png` | 1254×1254 | `dccacb4a1ceea110b7ad6f65aca94a21366cb9d2c50eb463239e832af6dc736b` |
| [`scourge-beast.png`](scourge-beast.png) | `exec-58bb1974-9f7c-4d25-a8e7-8ff5a99f06da.png` | 1254×1254 | `de2263e279c0848ac0f0a86c09902bf3b7da9cebe606a28653eb94b41fde077f` |
| [`female-patient.png`](female-patient.png) | `exec-4803e831-b8a6-485c-a173-919380af3736.png` | 1254×1254 | `e5083982e32e16568866e2b1f45b139cfce37fb79cff8da59f673589be731c95` |
| [`iosefka.png`](iosefka.png) | `exec-efa9b1ca-d3f8-4ce5-9628-a41510fae80d.png` | 1254×1254 | `05b1c757d02d9aa925c226aec9bb814c1ffb96623155eac00befc11e176a390f` |
| [`cleric-beast.png`](cleric-beast.png) | `exec-5d3ff4cd-53ee-413b-ab73-d8de4bb0609b.png` | 1402×1122 | `9154cebc4dd93ea0fe53a7aaf0c64166a5b200f24888c8ba2792baf3a6be6d43` |

각 PNG에는 같은 이름의 `.atlas.json`이 있으며 [manifest.json](manifest.json)에 동일한 atlas 데이터와 해시가 있습니다. 무리·하인·야수·환자·이오세프카·보스의 논리 캐릭터 ID는 `enemy-visuals.js`에서 연결합니다. 여섯 장에 각각 16개씩 있는 정적 원본 포즈, 합계 96포즈를 원본 크기로 직접 검수했습니다. 이것을 모든 실제 중간 애니메이션 프레임 검수나 전체 캠페인 완주로 세지 않습니다.

## 참고 자료와 외형의 핵심

| 캐릭터 | 외형 기준과 사용한 자료 |
|---|---|
| 야수 사냥 무리 | 마른 수염 남성·낡은 모자·긴 코트·도끼/횃불. 사용자 `Huntsman_concept_art.webp`, `Huntsman4.webp`, `Huntsman12.png` 및 여러 복장 그림을 열어 대조. [Huntsman 위키](https://bloodborne.fandom.com/wiki/Huntsman), [변종 설명](https://bloodborne.wikidot.com/hunter-mob), [게임 모델 갤러리](https://www.bloodborne-wiki.com/2024/08/huntsman-torch-axe-gallery.html). 다양한 복장·무기의 집단이며 이번 시트는 한 대표의 외형을 끝까지 유지합니다. |
| 야수 사냥 하인 | 넓은 어깨·허리·붕대 머리/팔다리·미색 누더기 셔츠·갈색 멜빵 바지·석재 벽돌. 사용자 `Huntsman's Minion (6).png`를 대조. [Brick Minion 설명](https://www.bloodborne-wiki.com/2015/03/brick-troll.html), [모델 갤러리](https://www.bloodborne-wiki.com/2024/08/huntsmans-minion-brick-gallery.html). 석상 곤봉 변종과 이번 벽돌형을 구분합니다. |
| 재앙의 야수 | 낮은 늑대형 몸·긴 앞팔/발톱·짙은 털·찢어진 몸통/허리 천. 제공 카드와 원본 모델 측면을 대조. [Scourge Beast 위키](https://bloodborne.fandom.com/wiki/Scourge_Beast), [모델 갤러리](https://www.bloodborne-wiki.com/2024/08/scourge-beast-gallery.html). 성직자 야수의 뿔·큰 비대칭 팔을 붙이지 않습니다. |
| 여성 야수환자 | 얼굴을 전부 덮는 올리브·황토색 베일·누더기 드레스·마른 팔·긴 발톱·맨발. 사용자 `Beast Patient (Female).png` 및 추가 원본 자료를 대조. [Beast Patient Female](https://www.bloodborne-wiki.com/2015/06/beast-patient-female.html). 백색 교단복 NPC와 구분합니다. |
| 이오세프카 | 얼굴 노출·묶은 회갈색 머리·백색 교단복·맨발·검 한 자루/권총 한 자루. 사용자 `image_Impostor_Iosefka.png`를 대조. [Imposter Iosefka](https://bloodborne.fandom.com/wiki/Imposter_Iosefka), [Impostor Doctor](https://bloodborne.wikidot.com/impostor-doctor). 위키의 장비 설명 차이로 보드게임의 공격 규칙을 바꾸지 않습니다. |
| 성직자 야수 | 가지뿔·갈비뼈·긴 회백색 갈기·거대한 왼팔/작은 오른팔·구부러진 긴 다리. 사용자 `boss_cleric-beast.png`, 원본 몸통 그림과 저장된 게임 영상 장면을 대조. [Cleric Beast](https://www.bloodborne-wiki.com/2015/03/cleric-beast.html), [Esoterickk 게임 영상](https://www.youtube.com/watch?v=v98DFCw3KQs). 대기에서는 입을 닫고 공격 표현과 구분합니다. |

공식 게임 영상 출처는 [PlayStation Gamescom 게임플레이](https://blog.playstation.com/2014/08/12/bloodborne-gamescom-ps4-gameplay-trailer/)와 [PlayStation이 소개한 IGN 첫 18분](https://blog.br.playstation.com/2015/02/02/assista-os-primeiros-18-minutos-de-bloodborne/)을 확인했습니다. 후자는 기사 자체가 이전 개발 빌드라고 명시하므로 최종 원본 모델보다 우선하지 않습니다. 이번 참고 조사에서 이 영상들을 전편 재생한 것으로 표시하지 않고, 제공된 원본 이미지와 이전에 저장된 게임 장면의 실제 열람 범위를 구분합니다. 참고자료 원본 파일은 Git에 추가하지 않습니다.

## 프레임과 표시 계약

| 동작 | 프레임 | 제품 기본 재생 |
|---|---|---|
| 대기 | 0–3 | 3fps 반복 |
| 걷기 | 4–7 | 10fps 반복 |
| 공격 | 8–11 | 14fps 1회 |
| 피격 | 12–13 | 8fps 1회 |
| 쓰러짐 | 14–15 | 5fps 1회 |

모든 원본은 오른쪽을 향한 동일한 저작 시점을 기준으로 합니다. atlas는 각 포즈를 512×512 source 좌표에 등록하고 발 기준을 유지합니다. `spriteSourceSize`와 `clipRects`는 crop 사각형 안의 다른 포즈 조각을 다시 그리지 않기 위한 필수 정보입니다. PNG 전체 크기나 trim의 아래 끝을 캐릭터 몸 높이·발 원점으로 대체하지 않습니다.

환자 A/B와 보스 1/2페이즈는 같은 그림을 사용하고 규칙 면/단계는 엔진에 남습니다. 공통 공격 4포즈는 모든 인쇄 공격·능력에 개별 애니메이션을 완성했다는 뜻이 아닙니다. 최종 보스는 `displayHeight: 400`, 지도 예약 `60×56%`이며 실제 몸 높이·Gallery 카메라·배치의 범위는 감사 기록에 따로 기록했습니다.

## 검증과 이식 범위

정적 96포즈 검수와 별도로 실제 QA 플레이 9시나리오/19행동 명령, import 정책 명령 9개를 확인했습니다. 정상 import 36회와 전체 상태 대조 9/9, 공개 actor 37개의 새 시각 ID 연결을 확인했습니다. 최종 보스 크기로 2페이즈 공격·해결을 별도 재실행했고, 추가 import 4회와 플레이 명령 2개/정책 채택 1개 뒤 저장이 기존 실제 저장과 바이트까지 일치했습니다. 원래 9시나리오 수는 유지합니다. 짧은 정상/저속 동작은 시간 순서의 화면 표본으로 검수하며 연속 영상의 모든 중간 프레임 검수라고 하지 않습니다. 원본사진 전용4검사와 원격 CI 실행은 이번2711개 로컬 완료 수에 합산하지 않습니다.

기존 Unity exporter는 새 PNG·atlas·공통 JSON manifest를 재귀복사할 수 있습니다. 기존 Unity 공개 actor에 여섯 skin ID를 연결하는 단계, animation 계약 데이터와 실제 Importer는 다음 작업입니다. Importer는 512 source/trim/같은 발 기준/오른쪽 기본 방향/clipRects 포함 마스크를 보존해야 합니다. 이미지나 모델을 교체해도 논리 칸과 출현 마커·이동 경로를 바꾸지 않습니다. 이 Markdown 출처 메모와 식별자 연결도 다음 이식 준비물에서 별도로 보존해야 합니다.

실제 Unity Editor 실행·전체 C# 게임·씬/Animator 이식이 끝났다는 의미는 아닙니다. 원시 QA 저장·개인 플레이 기록·사용자 참고 사진은 이 출처 문서나 저장소에 복사하지 않습니다.

