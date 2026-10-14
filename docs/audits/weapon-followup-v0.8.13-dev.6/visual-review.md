# 실제 시각 표본 검토

기본32 전체256PNG를 실제지도영역으로 확대하여 확인했다. 각32WebM의 첫 이동/유료 변형/첫 공격/둘째 공격 requestedAtMs/1000+.25와+.90초 PTS를 디코딩한256프레임, 무료 변형5건의15프레임도 확인했다. 실제 PTS 범위는 첫이동2.158–3.557초, 유료변형6.290–8.925초, 첫공격8.668–11.519초, 둘째공격14.738–17.747초. 무료변형은 이질적1거절11.111–12.011초, 루드비히0거절11.067–11.967초, 말뚝0거절16.777–17.677초, 루드비히0수락11.506–12.406초, 이질적1수락10.538–11.438초.

추가15대표는 각 행 모든PNG73장 및 후속명령 최대6건의 requestedAtMs/1000+.15와+.65초를 디코딩한166프레임이다. 아래 범위는 연속 전체 재생이 아니라 지정 표본의 최소/최대 PTS다. 요청 시각과 실제 클릭 시각은 다르며, PTS와 화면 시간은 각각 원본에 기록된 시간축으로 읽는다.

| WebM 프로필 | 표본 PTS초 |
|---|---|
| ludwigs-holy-blade-0-free-accept-survive | 5.379–16.602 |
| ludwigs-holy-blade-0-free-accept-kill | 5.346–11.213 |
| ludwigs-holy-blade-0-free-decline-kill | 4.568–10.899 |
| uncanny-ludwigs-holy-blade-1-free-accept-kill | 4.713–11.045 |
| stake-driver-0-free-accept-kill | 4.396–9.999 |
| stake-driver-1-all-push-2 | 4.965–22.675 |
| beast-claw-1-kill-move-2 | 3.810–21.677 |
| burial-1-pull-3 | 5.479–15.439 |
| beast-claw-1-mission-interruption | 4.415–26.929 |
| chikage-1-dodge-heal-multi-target | 10.478–30.272 |
| hunter-axe-1-kill-chain | 6.045–12.427 |
| ludwigs-holy-blade-1-clear-kill-rapid | 6.996–13.694 |
| uncanny-ludwigs-holy-blade-0-clear-kill-rapid | 7.291–14.352 |
| kirkhammer-0-clear-kill-rapid | 9.921–18.472 |
| threaded-cane-0-dodge-area-kill-human | 4.670–16.802 |

Ludwig 수락생존/말뚝밀치기2/발톱이동2/장송끌어오기3의 실제 줌·팬 화면에서도 지형에 대한 인물 위치가 유지됐다. 임무 알림/동행 모달과 회피 다중 대상 선택 뒤 다음 전투·idle로 이어졌다. 두 최종 원본 canvas도 직접 확대했다. 몸통은 분리되어 있고 가까운 발밑 원·피규어 번호를 몸통 겹침으로 세지 않았다. 일부 PTS 표본은 소모품 모달/녹화 여백이어서 sprite 판정에서 제외하고 인접 canvas와후속PNG를 사용했다.

Root 추가 확인: 실제 빠른native클릭 자료38491810513의 말뚝/루드비히소검슬롯/이질적거절/지팡이회피에 대해 100ms 간격16프레임씩 디코딩한시간차표본을 직접 봤다. 실제 클릭간격142.6–225.6ms. 살아있는 인물의 잘못된 정착 칸이나 지속 몸통 가림을 확정하지 못했다. 공격 포즈/무기 궤적/이미 처치된 인물의 제거와 이후 이동을 구분했다.

이 검토는 모든영상의모든프레임 및 모든73개 추가 프로필의 픽셀 전수검사가 아니다. 모델이나 DOM 끝점 좌표로 중간 canvas 위치를 대신하지 않았으며, 샘플링 간격보다 짧은 이상을 배제한다는 보증은 하지 않는다.
