window.BBLongHunt = {
  "schemaVersion": 1,
  "id": "long-hunt-ko",
  "name": "기나긴 사냥",
  "language": "ko",
  "sourceDate": "2026-10-11",
  "status": "transcribed_reference_not_playable",
  "automated": false,
  "numberingBasis": "사용자가 지정한 파일명 오름차순: 도입부·준비/임무 7개 다음을 카드 1~60으로 매핑. 촬영된 면에는 번호가 없어 사용자 제공 순서를 사용함.",
  "transcriptionPolicy": "게임 처리 문구를 전사하고 줄바꿈·아이콘·일부 공백을 정규화했다. 속도 아이콘은 1~3, 혈액방울은 피해로 기록했다. 서사 전체는 함께 제공되는 사진에서 확인할 수 있다. 데이터의 링크는 참조 목록이며 무조건 실행할 명령이 아니다.",
  "symbols": {
    "[사냥꾼 수]": "게임에 참여하는 사냥꾼 수",
    "[초기화]": "사냥 트랙의 붉은 초기화 기호",
    "[피해]": "혈액방울 기호",
    "[등불 기호]": {
      "label": "등불이 그려진 파란 원",
      "image": "images/symbol-a.png"
    },
    "[갈색 출현 기호]": {
      "label": "갈색 원의 적 출현 기호",
      "image": "images/symbol-b.png"
    },
    "[보라색 손 모양 출현 기호]": {
      "label": "보라색 원의 손 모양 적 출현 기호",
      "image": "images/symbol-c.png"
    },
    "[소모품 기호]": "녹색 소모품 아이콘"
  },
  "chapters": [
    {
      "number": 1,
      "enemies": [
        "야수 사냥 무리",
        "야수 사냥 하인",
        "재앙의 야수"
      ],
      "requiredTiles": [
        "마당 등불",
        "민가",
        "오에돈 예배당",
        "폐가"
      ],
      "randomTiles": {
        "perHunter": 2,
        "maximum": 6
      },
      "specialSetupCards": [],
      "onStartReveal": [
        1
      ],
      "onMovementEnd": [
        {
          "scope": "tile",
          "tileName": "마당 등불",
          "reveal": [
            5
          ]
        },
        {
          "scope": "tile",
          "tileName": "민가",
          "reveal": [
            8
          ]
        },
        {
          "scope": "tile",
          "tileName": "폐가",
          "reveal": [
            12
          ]
        }
      ]
    },
    {
      "number": 2,
      "enemies": [
        "야수 사냥 무리",
        "야수 사냥 하인",
        "재앙의 야수"
      ],
      "requiredTiles": [
        "공동묘지",
        "이오세프카의 진료소",
        "오에돈 예배당",
        "대교",
        "오에돈의 지하묘지"
      ],
      "randomTiles": {
        "perHunter": 2,
        "maximum": 5
      },
      "specialSetupCards": [
        17
      ],
      "onStartReveal": [
        18
      ],
      "onMovementEnd": [
        {
          "scope": "tile",
          "tileName": "이오세프카의 진료소",
          "reveal": [
            24
          ]
        },
        {
          "scope": "tile",
          "tileName": "오에돈 예배당",
          "reveal": [
            29
          ]
        },
        {
          "scope": "tile",
          "tileName": "대교",
          "reveal": [
            35
          ]
        }
      ]
    },
    {
      "number": 3,
      "enemies": [
        "야수 사냥 무리",
        "야수 사냥 하인",
        "재앙의 야수"
      ],
      "requiredTiles": [
        "공동묘지",
        "이오세프카의 진료소",
        "오에돈 예배당",
        "대교",
        "오에돈의 지하묘지"
      ],
      "randomTiles": {
        "perHunter": 2,
        "maximum": 5
      },
      "specialSetupCards": [
        17
      ],
      "onStartReveal": [
        40
      ],
      "onMovementEnd": [
        {
          "scope": "tile",
          "tileName": "이오세프카의 진료소",
          "reveal": [
            45
          ]
        },
        {
          "scope": "tile",
          "tileName": "대교",
          "reveal": [
            53
          ]
        },
        {
          "scope": "tile",
          "tileName": "오에돈 예배당",
          "reveal": [
            56
          ]
        }
      ]
    }
  ],
  "preface": [
    {
      "id": "intro",
      "type": "도입부",
      "title": "기나긴 사냥 — 도입부",
      "rules": [],
      "narrative": "야수병으로 탄생한 괴물 가운데 가장 악랄한 것이 바로 재앙의 야수이다. 이 날렵하고도 치명적인 흉물들은, 본래는 인간이었지만 야수병에 걸려 변이된 자들이다. 근래 들어 야수들이 야남 시가지에 더욱 빈번하게 출몰하는 가운데, 우리는 야수의 머릿수를 불리는 근원을 밝혀내고 놈들을 최대한 많이 제거하기 위해 사냥에 나섰다.",
      "reveal": [],
      "source": {
        "sortPosition": 1,
        "filename": "20261011_123638.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "1a28197127c9372d1189dd40bdfe79564b4138cf63fb8536d297b5162f0321cc"
      },
      "image": "images/intro.jpg",
      "narrativeSource": "text_and_image"
    },
    {
      "id": "chapter-1-setup",
      "type": "준비",
      "title": "기나긴 사냥 — 챕터 1 준비",
      "chapter": 1,
      "rules": [
        "적: 야수 사냥 무리, 야수 사냥 하인, 재앙의 야수.",
        "타일: 마당 등불, 민가, 오에돈 예배당, 폐가, 무작위 타일 [사냥꾼 수]×2개 (최대 6개)."
      ],
      "reveal": [],
      "source": {
        "sortPosition": 2,
        "filename": "20261011_123651.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "7a19911a356791493ed43463ad8e3f9d57b29dfa9e1b137f978fce07acc9bd38"
      },
      "image": "images/chapter-1-setup.jpg",
      "narrativeSource": "image"
    },
    {
      "id": "chapter-1-missions",
      "type": "임무 안내",
      "title": "기나긴 사냥 — 챕터 1 임무",
      "chapter": 1,
      "rules": [
        "사냥 시작 시: 1번 카드를 공개합니다.",
        "마당 등불 타일에서 이동을 마치면: 5번 카드를 공개합니다.",
        "민가 타일에서 이동을 마치면: 8번 카드를 공개합니다.",
        "폐가 타일에서 이동을 마치면: 12번 카드를 공개합니다."
      ],
      "reveal": [
        1,
        5,
        8,
        12
      ],
      "source": {
        "sortPosition": 3,
        "filename": "20261011_123656.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "a01d8ed6fe9c2a8e5a7efaae0768430f5691313baf367fe08120bcbb5d860285"
      },
      "image": "images/chapter-1-missions.jpg",
      "narrativeSource": "image"
    },
    {
      "id": "chapter-2-setup",
      "type": "준비",
      "title": "기나긴 사냥 — 챕터 2 준비",
      "chapter": 2,
      "rules": [
        "적: 야수 사냥 무리, 야수 사냥 하인, 재앙의 야수.",
        "타일: 공동묘지, 이오세프카의 진료소, 오에돈 예배당, 대교, 오에돈의 지하묘지, 무작위 타일 [사냥꾼 수]×2개 (최대 5개).",
        "특수 규칙 카드: 기나긴 사냥 17번 카드."
      ],
      "reveal": [
        17
      ],
      "source": {
        "sortPosition": 4,
        "filename": "20261011_123701.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "cef97fa34141aa15392278af35da9776f6e2f6e07fc7a9f108cfbcfc3f2d1806"
      },
      "image": "images/chapter-2-setup.jpg",
      "narrativeSource": "image"
    },
    {
      "id": "chapter-2-missions",
      "type": "임무 안내",
      "title": "기나긴 사냥 — 챕터 2 임무",
      "chapter": 2,
      "rules": [
        "사냥 시작 시: 18번 카드를 공개합니다.",
        "이오세프카의 진료소 타일에서 이동을 마치면: 24번 카드를 공개합니다.",
        "오에돈 예배당 타일에서 이동을 마치면: 29번 카드를 공개합니다.",
        "대교 타일에서 이동을 마치면: 35번 카드를 공개합니다."
      ],
      "reveal": [
        18,
        24,
        29,
        35
      ],
      "source": {
        "sortPosition": 5,
        "filename": "20261011_123705.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "013e0799a7928bf80dffc94fd5ef3df770ca939aa6110e74dc584b630fd4d56e"
      },
      "image": "images/chapter-2-missions.jpg",
      "narrativeSource": "image"
    },
    {
      "id": "chapter-3-missions",
      "type": "임무 안내",
      "title": "기나긴 사냥 — 챕터 3 임무",
      "chapter": 3,
      "rules": [
        "사냥 시작 시: 40번 카드를 공개합니다.",
        "이오세프카의 진료소 타일에서 이동을 마치면: 45번 카드를 공개합니다.",
        "대교 타일에서 이동을 마치면: 53번 카드를 공개합니다.",
        "오에돈 예배당 타일에서 이동을 마치면: 56번 카드를 공개합니다."
      ],
      "reveal": [
        40,
        45,
        53,
        56
      ],
      "source": {
        "sortPosition": 6,
        "filename": "20261011_123710.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "16309829f76373b96d034be9f553495072db75bd022dc4b2b7b65fe40ad1f8c7"
      },
      "image": "images/chapter-3-missions.jpg",
      "narrativeSource": "image"
    },
    {
      "id": "chapter-3-setup",
      "type": "준비",
      "title": "기나긴 사냥 — 챕터 3 준비",
      "chapter": 3,
      "rules": [
        "적: 야수 사냥 무리, 야수 사냥 하인, 재앙의 야수.",
        "타일: 공동묘지, 이오세프카의 진료소, 오에돈 예배당, 대교, 오에돈의 지하묘지, 무작위 타일 [사냥꾼 수]×2개 (최대 5개).",
        "특수 규칙 카드: 기나긴 사냥 17번 카드."
      ],
      "reveal": [
        17
      ],
      "source": {
        "sortPosition": 7,
        "filename": "20261011_123714.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "0b271f7f22e93abc27b091c0e639ed9f5fbc15fb6d44d79b43bf2fcba351265f"
      },
      "image": "images/chapter-3-setup.jpg",
      "narrativeSource": "image"
    }
  ],
  "cards": [
    {
      "number": 1,
      "type": "사냥 임무",
      "title": "재앙의 근원",
      "rules": [
        "계몽을 2장 이상 모은 후, 중앙 등불 타일에서 이동을 마치면: 2번 카드를 공개합니다."
      ],
      "reveal": [
        2
      ],
      "id": "card-01",
      "readStatus": "legible",
      "source": {
        "sortPosition": 8,
        "filename": "20261011_124218.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "cd5831f7b80b0d2e85dcc72877ebae5156478cb2d85c35206414b47b653ab156"
      },
      "image": "images/card-01.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 2,
      "type": "사냥 임무",
      "title": "재앙의 근원",
      "rules": [
        "3번 카드를 공개합니다.",
        "중앙 등불 타일이 안개 진입로에 둘러싸입니다. 그곳의 [등불 기호] 칸에 재앙의 야수 하나가 출현합니다. [초기화] 때, 이 적이 이 칸에 재출현합니다.",
        "이 재앙의 야수를 처치하면 사냥을 완수합니다: 4번 카드를 공개합니다."
      ],
      "reveal": [
        3,
        4
      ],
      "id": "card-02",
      "readStatus": "legible",
      "source": {
        "sortPosition": 9,
        "filename": "20261011_124224.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "ca4f6e2b2bd1f9122bea361db1b9891bc5eb7c635794ed8a543b2c4c600b91f9"
      },
      "image": "images/card-02.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 3,
      "type": "특수 규칙",
      "title": "무리의 우두머리",
      "rules": [
        "이 카드에 계몽 토큰 [사냥꾼 수]개를 놓습니다. 해당 재앙의 야수가 처치되는 대신 이 카드에서 토큰 1개를 제거하고 그 적의 모든 [피해]를 치유합니다. 이 계몽 토큰은 [초기화] 때 초기 수량이 되도록 보충됩니다.",
        "이 적의 전용 능력을 대체합니다:",
        "전용 능력: 광포한 — 재앙의 야수가 재빠른 휩쓸기 공격을 합니다. 방해할 수 없습니다. +1[피해]를 주고 방해와 기절을 획득합니다."
      ],
      "reveal": [],
      "id": "card-03",
      "readStatus": "legible",
      "source": {
        "sortPosition": 10,
        "filename": "20261011_124230.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "5951603a92ea62af14c3634699b4bf147c5f7b543b0e5cb6cf149725d907530f"
      },
      "image": "images/card-03.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 4,
      "type": "보상",
      "title": "목표 처치: 재앙의 야수 우두머리",
      "rules": [
        "혈석의 파편과 카릴 문자: 달 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "혈석의 파편",
        "카릴 문자: 달"
      ],
      "id": "card-04",
      "readStatus": "legible",
      "source": {
        "sortPosition": 11,
        "filename": "20261011_124236.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "eebd233fb952151d4cbcbb4e31537b9fe53fa19852ed55a5f8275551257d1ede"
      },
      "image": "images/card-04.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 5,
      "type": "계몽 임무",
      "title": "사냥을 시작하다",
      "rules": [
        "6번 카드를 공개합니다.",
        "마당 등불 타일이 안개 진입로에 둘러싸입니다. 그곳의 [등불 기호] 칸에 야수 사냥 무리 하나가 출현합니다. [초기화] 때, 이 적이 이 칸에 재출현합니다.",
        "이 야수 사냥 무리를 처치하면 이번 임무를 완수합니다: 7번 카드를 공개합니다."
      ],
      "reveal": [
        6,
        7
      ],
      "id": "card-05",
      "readStatus": "legible",
      "source": {
        "sortPosition": 12,
        "filename": "20261011_124242.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "657eb6b2310b22fa24093cd27ed58e18e465fe2ab57382cc0cf7654e1a31318b"
      },
      "image": "images/card-05.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 6,
      "type": "특수 규칙",
      "title": "군중",
      "rules": [
        "이 카드에 계몽 토큰 1개를 놓습니다. 사냥꾼이 셋 이상이면, 계몽 토큰 1개를 추가로 놓습니다. 해당 야수 사냥 무리가 처치되는 대신 이 카드에서 토큰 1개를 제거하고 그 적의 모든 [피해]를 치유합니다. 이 계몽 토큰은 [초기화] 때 초기 수량이 되도록 보충됩니다."
      ],
      "reveal": [],
      "id": "card-06",
      "readStatus": "legible",
      "source": {
        "sortPosition": 13,
        "filename": "20261011_124248.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "6e020b10715a97c145fddf8b574808a3aa8be74e850ac0c56f6cfae1f5ab6094"
      },
      "image": "images/card-06.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 7,
      "type": "보상",
      "title": "사냥을 시작하다",
      "rules": [
        "랜턴 보상과 루드비히의 장총 화기를 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "랜턴",
        "루드비히의 장총"
      ],
      "id": "card-07",
      "readStatus": "legible",
      "source": {
        "sortPosition": 14,
        "filename": "20261011_124256.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "ade5b139752a915d1ff06e92e30f8fee17218e1e59b7bf72c98835eb8047d7f8"
      },
      "image": "images/card-07.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 8,
      "type": "계몽 임무",
      "title": "피신처",
      "rules": [
        "민가 칸에 생존자 토큰 1개를 놓습니다. 해당 칸에서 이동해 나가는 사냥꾼은 이 토큰을 집어들 수 있습니다. 이 토큰을 가진 사냥꾼이 순간이동하거나 사냥꾼의 꿈에 입장하면, 이 토큰을 민가로 되돌려놓습니다.",
        "이 토큰을 가진 채로 오에돈 예배당 타일에서 이동을 마치면: 9번 카드를 공개합니다."
      ],
      "reveal": [
        9
      ],
      "id": "card-08",
      "readStatus": "legible",
      "source": {
        "sortPosition": 15,
        "filename": "20261011_124303.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "ce2ca3282bd464b3e4d1e999c475a79c2d6bbd4b07edc16bc45baae5ca3a85bf"
      },
      "image": "images/card-08.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 9,
      "type": "계몽 임무",
      "title": "피신처",
      "rules": [
        "10번 카드를 공개합니다.",
        "오에돈 예배당 타일이 안개 진입로에 둘러싸입니다. 그곳의 [등불 기호] 칸에 재앙의 야수 하나가 출현합니다. [초기화] 때, 이 적이 이 칸에 재출현합니다. 이 적은 오에돈 예배당의 효과에 면역입니다.",
        "이 재앙의 야수를 처치하면 이번 임무를 완수합니다: 11번 카드를 공개합니다."
      ],
      "reveal": [
        10,
        11
      ],
      "id": "card-09",
      "readStatus": "legible",
      "source": {
        "sortPosition": 16,
        "filename": "20261011_124309.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "12547a5d1d7223b9068e770b249db21f8729258de04defe71a17e87b671f45db"
      },
      "image": "images/card-09.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 10,
      "type": "특수 규칙",
      "title": "포악한",
      "rules": [
        "이 카드에 계몽 토큰 1개를 놓습니다. 사냥꾼이 셋 이상이면, 계몽 토큰 1개를 추가로 놓습니다. 해당 재앙의 야수가 처치되는 대신 이 카드에서 토큰 1개를 제거하고 그 적의 모든 [피해]를 치유합니다. 이 계몽 토큰은 [초기화] 때 초기 수량이 되도록 보충됩니다.",
        "이 적의 특수 공격을 대체합니다:",
        "특수 공격: 피의 광란 — 속도 3, 피해 2. 재앙의 야수가 [피해]를 받은 상태라면, +2[피해]를 줍니다.",
        "재앙의 야수를 처치하면, 사냥꾼은 회피(속도 1)를 하거나 3[피해]를 받아야 합니다."
      ],
      "reveal": [],
      "id": "card-10",
      "readStatus": "legible",
      "source": {
        "sortPosition": 17,
        "filename": "20261011_124313.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "fa0d742219e958a245ae7a8c603cf2510fa451ffdbf9b35caa8c86c25d07553d"
      },
      "image": "images/card-10.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 11,
      "type": "보상",
      "title": "무사히 밤을 넘기다",
      "rules": [
        "소모품 1장과 카릴 문자: 손톱자국 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "소모품 1장",
        "카릴 문자: 손톱자국"
      ],
      "id": "card-11",
      "readStatus": "legible",
      "source": {
        "sortPosition": 18,
        "filename": "20261011_124318.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "7e16717cec6f70b44054d09502cbd04a8598307125732a32f8c89978927d5efc"
      },
      "image": "images/card-11.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 12,
      "type": "계몽 임무",
      "title": "구조",
      "rules": [
        "폐가 칸에 생존자 토큰 1개를 놓습니다.",
        "생존자 토큰과 상호작용하면: 13번 카드를 공개합니다."
      ],
      "reveal": [
        13
      ],
      "id": "card-12",
      "readStatus": "legible",
      "source": {
        "sortPosition": 19,
        "filename": "20261011_124324.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "1cde0a6ae6c175b82108b0a41f20ab0b0338011758bbf47611301f4a82830f44"
      },
      "image": "images/card-12.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 13,
      "type": "계몽 임무",
      "title": "구조",
      "rules": [
        "생존자 토큰을 4칸 멀리 이동시킵니다. 생존자는 이렇게 이동하는 동안 타일을 공개할 수도 있습니다. 매 차례가 끝날 때마다 생존자는 자신과 가장 가까운 사냥꾼으로부터 1칸 멀리 이동합니다. 이때는 더 이상 타일을 공개하지 않습니다.",
        "생존자 토큰이 있는 칸에서 이동을 마치고, 해당 칸으로 적의 추격이 일어나지 않게 하면 이번 임무를 완수합니다: 14번 카드를 공개합니다."
      ],
      "reveal": [
        14
      ],
      "id": "card-13",
      "readStatus": "legible",
      "source": {
        "sortPosition": 20,
        "filename": "20261011_124330.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "d5efd2dc121ebbcfc7fd9543b9168de077a7d4132693adb89355d97b691cb02e"
      },
      "image": "images/card-13.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 14,
      "type": "계몽 임무",
      "title": "구조",
      "rules": [
        "다음 중 하나를 선택하면 이번 임무를 완수합니다:",
        "여자를 공격한다: 15번 카드를 공개합니다.",
        "여자에게 도망치라고 말한다: 16번 카드를 공개합니다."
      ],
      "reveal": [
        15,
        16
      ],
      "id": "card-14",
      "readStatus": "legible",
      "source": {
        "sortPosition": 21,
        "filename": "20261011_124336.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "3702f1494dc76df62fe6e8b535f7bf8684cf9d19491b3724d5a5cee2ac084ecc"
      },
      "image": "images/card-14.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 15,
      "type": "보상",
      "title": "자비란 없다",
      "rules": [
        "이번 임무를 완수한 사냥꾼은 피의 유지 1개와 카릴 문자: 피의 기쁨 보상을 획득합니다."
      ],
      "reveal": [],
      "rewards": [
        "피의 유지 1개",
        "카릴 문자: 피의 기쁨"
      ],
      "id": "card-15",
      "readStatus": "legible",
      "source": {
        "sortPosition": 22,
        "filename": "20261011_124343.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "c6d52d83f6eda7076cf3c69fadfa85d00b617081fb54c90341d8a7efd1cfb51a"
      },
      "image": "images/card-15.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 16,
      "type": "보상",
      "title": "자비를 베풀다",
      "rules": [
        "이번 임무를 완수한 사냥꾼은 소모품 1장과 카릴 문자: 눈 보상을 획득합니다."
      ],
      "reveal": [],
      "rewards": [
        "소모품 1장",
        "카릴 문자: 눈"
      ],
      "id": "card-16",
      "readStatus": "legible",
      "source": {
        "sortPosition": 23,
        "filename": "20261011_124349.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "5b44694bc30bcdad8cd730f785906a50a2aff6d87f32ba4edbe8b25a8c0fcef6"
      },
      "image": "images/card-16.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 17,
      "type": "특수 규칙",
      "title": "특수 준비",
      "rules": [
        "타일 더미를 생성하기 전에, 공동묘지, 오에돈의 지하묘지, 사용하지 않는 무작위 타일 1개를 가져옵니다. 이때, 무작위 타일로 출입구가 2개 이상인 타일이 나올 때까지 새로 뽑습니다.",
        "공동묘지를 중앙 등불에 이어지게 놓고, (앞에서 가져온) 무작위 타일을 중앙 등불과 이어지게 놓되 공동묘지의 맞은편에 놓은 다음, 오에돈의 지하묘지를 이 무작위 타일에 이어지게 놓습니다."
      ],
      "reveal": [],
      "id": "card-17",
      "readStatus": "legible",
      "source": {
        "sortPosition": 24,
        "filename": "20261011_124354.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "c9e46d5930683ea5a9969cc2582a9217e1adc0c75de6799674ec192f8d4f4721"
      },
      "image": "images/card-17.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 18,
      "type": "사냥 임무",
      "title": "재앙의 근원",
      "rules": [
        "사냥꾼은 자신의 차례에 소모품 1장을 버리면서, 자신이 위치한 칸에 재앙의 야수 하나를 출현시킬 수 있습니다. 재앙의 야수를 처치할 때마다 시체 토큰 1개를 획득합니다. 공동묘지에 있는 사냥꾼은 자신이 가진 시체 토큰을 버릴 수 있습니다. 이렇게 버린 시체 토큰은 이 카드에 놓습니다.",
        "이 카드에 시체 토큰이 [사냥꾼 수]+1개 놓여 있을 때: 19번 카드를 공개합니다."
      ],
      "reveal": [
        19
      ],
      "id": "card-18",
      "readStatus": "legible",
      "source": {
        "sortPosition": 25,
        "filename": "20261011_124400.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "78c1675446c04fe87cc8e3e86845d0b72edf098cbca7836ea14214e39720833c"
      },
      "image": "images/card-18.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 19,
      "type": "사냥 임무",
      "title": "재앙의 근원",
      "rules": [
        "사냥꾼들이 이번 챕터에서 계몽을 둘 이상 모았을 때: 20번 카드를 공개합니다."
      ],
      "reveal": [
        20
      ],
      "id": "card-19",
      "readStatus": "legible",
      "source": {
        "sortPosition": 26,
        "filename": "20261011_124407.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "f3b2db0e76079f13bb5e2049ac41a979bef2efe231dc6931e2eceec8cb1d0957"
      },
      "image": "images/card-19.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 20,
      "type": "사냥 임무",
      "title": "재앙의 근원",
      "rules": [
        "공동묘지 타일이 안개 진입로에 둘러싸입니다. 그곳의 [갈색 출현 기호] 칸에 성직자 야수가 출현합니다. [초기화] 때, 이 적이 이 칸에 재출현합니다.",
        "성직자 야수가 2페이즈에 진입하면: 21번, 22번 카드를 공개합니다."
      ],
      "reveal": [
        21,
        22
      ],
      "id": "card-20",
      "readStatus": "legible",
      "source": {
        "sortPosition": 27,
        "filename": "20261011_124411.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "27b97b6068aa3553d7323e4ece1b0b2db655cfc1b9430f9bec3863bba06f6cca"
      },
      "image": "images/card-20.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 21,
      "type": "사냥 임무",
      "title": "재앙의 근원",
      "rules": [
        "공동묘지 타일에서 안개 진입로를 모두 제거합니다. 성직자 야수에게 놓인 계몽 토큰을 모두 제거합니다.",
        "성직자 야수가 오에돈의 지하묘지로 들어갈 때 이번 임무를 완수합니다: 23번 카드를 공개합니다."
      ],
      "reveal": [
        23
      ],
      "id": "card-21",
      "readStatus": "legible",
      "source": {
        "sortPosition": 28,
        "filename": "20261011_124417.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "4103f82170413c53275d25b430278091169d3cf440bf92ae946a9e19a74378d7"
      },
      "image": "images/card-21.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 22,
      "type": "특수 규칙",
      "title": "멈출 줄 모르는 난동",
      "rules": [
        "성직자 야수는 피해를 입지 않습니다.",
        "[초기화] 때, 공동묘지의 [갈색 출현 기호] 칸에 기존 적 대신 성직자 야수가 재출현합니다.",
        "매 라운드가 끝날 때마다, 성직자 야수는 특별히 추가 활성화를 한 번 합니다. 이때, 체력이 가장 낮은 사냥꾼을 향해 이동하고 공격합니다."
      ],
      "reveal": [],
      "id": "card-22",
      "readStatus": "legible",
      "source": {
        "sortPosition": 29,
        "filename": "20261011_124421.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "df4788a9a3aeccaa1858d08747fab84acf71f265b287cadfb4c2cbc10c0dc50a"
      },
      "image": "images/card-22.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 23,
      "type": "보상",
      "title": "야수를 가두었다",
      "rules": [
        "피의 유지 1개와 야수의 포효 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "피의 유지 1개",
        "야수의 포효"
      ],
      "id": "card-23",
      "readStatus": "legible",
      "source": {
        "sortPosition": 30,
        "filename": "20261011_124425.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "a586ed09b61e5137f3cd7dc17fc303604e52065cd9bf0e909d0e08f73859bbd8"
      },
      "image": "images/card-23.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 24,
      "type": "계몽 임무",
      "title": "이오세프카의 연구",
      "rules": [
        "이오세프카의 진료소 타일에서 야수 사냥 무리 또는 야수 사냥 하인을 처치하면: 25번 카드를 공개합니다."
      ],
      "reveal": [
        25
      ],
      "id": "card-24",
      "readStatus": "legible",
      "source": {
        "sortPosition": 31,
        "filename": "20261011_124430.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "52ace5755bd098f1fc89f7423f9c5f329d7e60669ed806db967424cbb17d04fb"
      },
      "image": "images/card-24.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 25,
      "type": "계몽 임무",
      "title": "이오세프카의 연구",
      "rules": [
        "27번 카드를 공개합니다.",
        "이오세프카의 진료소 타일에 있는 재앙의 야수를 처치하면 이번 임무를 완수합니다: 26번 카드를 공개합니다."
      ],
      "reveal": [
        27,
        26
      ],
      "id": "card-25",
      "readStatus": "legible",
      "source": {
        "sortPosition": 32,
        "filename": "20261011_124434.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "e53d68e3b6437b234df291e68bf35b41e5ea8339e0367f7e3f7b82d06f0780f2"
      },
      "image": "images/card-25.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 26,
      "type": "보상",
      "title": "이오세프카의 연구",
      "rules": [
        "소모품 1장과 이오세프카의 수혈액 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "소모품 1장",
        "이오세프카의 수혈액"
      ],
      "id": "card-26",
      "readStatus": "legible",
      "source": {
        "sortPosition": 33,
        "filename": "20261011_124441.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "34ce759dcb5a369786a43387337db289193ce6bfb5b3f995a087a50c6ef2121c"
      },
      "image": "images/card-26.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 27,
      "type": "계몽 임무",
      "title": "이오세프카의 진료소를 피신처 삼아",
      "rules": [
        "사냥꾼이 [소모품 기호] 칸에서 소모품을 집어들 때, 생존자 토큰 1개도 함께 획득합니다. 사냥꾼이 순간이동하거나 사냥꾼의 꿈에 입장하면, 자신이 가진 생존자 토큰을 잃습니다. 이오세프카의 진료소 타일에서 이동을 마친 사냥꾼은 자신이 가진 생존자 토큰들을 이 카드에 놓습니다.",
        "이 카드에 토큰이 [사냥꾼 수]+1개 놓여 있을 때 이번 임무를 완수합니다: 28번 카드를 공개합니다."
      ],
      "reveal": [
        28
      ],
      "id": "card-27",
      "readStatus": "legible",
      "source": {
        "sortPosition": 34,
        "filename": "20261011_124446.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "0134ff0ff4e9b174ad3a8a907d50ffe7c64571c96da87672c4267010f16326de"
      },
      "image": "images/card-27.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 28,
      "type": "보상",
      "title": "안전한 피신처: 이오세프카의 진료소",
      "rules": [
        "오에돈 예배당을 피신처로 삼아 계몽 임무는 더 이상 완수할 수 없습니다.",
        "사자의 선물 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "사자의 선물"
      ],
      "locksMissions": [
        33
      ],
      "id": "card-28",
      "readStatus": "legible",
      "source": {
        "sortPosition": 35,
        "filename": "20261011_124450.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "c7fa45a85eaa65727d70b2e76a32a60afbbf0b7f6151e6844a934aec4a3ece29"
      },
      "image": "images/card-28.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 29,
      "type": "계몽 임무",
      "title": "오에돈 예배당",
      "rules": [
        "자비를 베풀다를 가졌다면: 30번 카드를 공개합니다.",
        "그렇지 않으면: 33번 카드를 공개합니다."
      ],
      "reveal": [
        30,
        33
      ],
      "checksCards": [
        16
      ],
      "id": "card-29",
      "readStatus": "legible",
      "source": {
        "sortPosition": 36,
        "filename": "20261011_124456.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "d6e48bc2f15a975b9cfb0b41b61850710ad075e4c0870d221dd4bd6c19594269"
      },
      "image": "images/card-29.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 30,
      "type": "계몽 임무",
      "title": "오에돈 예배당 대학살",
      "rules": [
        "31번 카드를 공개합니다.",
        "오에돈 예배당 타일이 안개 진입로에 둘러싸입니다. 오에돈 예배당의 [등불 기호] 칸에 여성 야수 환자 하나가 출현합니다. [초기화] 때, 이 적이 이 칸에 재출현합니다. 이 적은 오에돈 예배당의 효과에 면역입니다.",
        "이 야수 환자를 처치하면 이번 임무를 완수합니다: 32번 카드를 공개합니다."
      ],
      "reveal": [
        31,
        32
      ],
      "id": "card-30",
      "readStatus": "legible",
      "source": {
        "sortPosition": 37,
        "filename": "20261011_124501.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "dafa536e512c1ed8f4a8f28d5a626cd1ec60be260a689787162b04db72bf1d35"
      },
      "image": "images/card-30.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 31,
      "type": "특수 규칙",
      "title": "격노한",
      "rules": [
        "이 카드에 계몽 토큰 2개를 놓습니다. 사냥꾼이 셋 이상이면, 계몽 토큰 1개를 추가로 놓습니다. 해당 야수 환자가 처치되는 대신 이 카드에서 토큰 1개를 제거하고 그 적의 모든 [피해]를 치유합니다. 이 계몽 토큰은 [초기화] 때 초기 수량이 되도록 보충됩니다.",
        "이 적의 특수 공격을 대체합니다:",
        "특수 공격: 갈가리 찢기 — 속도 3, 피해 3. 기절.",
        "야수 환자를 처치하면 사냥꾼은 회피(속도 1)를 하거나 3[피해]를 받아야 합니다."
      ],
      "reveal": [],
      "id": "card-31",
      "readStatus": "legible",
      "source": {
        "sortPosition": 38,
        "filename": "20261011_124506.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "a349cadc9ff819903a7a0bff01014ecce826085f442f6230c5e04e5a2baa049b"
      },
      "image": "images/card-31.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 32,
      "type": "보상",
      "title": "마음이 약해진 대가",
      "rules": [
        "소모품 1장과 카릴 문자: 형태 없는 오에돈 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "소모품 1장",
        "카릴 문자: 형태 없는 오에돈"
      ],
      "id": "card-32",
      "readStatus": "legible",
      "source": {
        "sortPosition": 39,
        "filename": "20261011_124510.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "83b743b3999877c550f39aa5ae0749a9e08cdff3e9c53a4d1addb127cf3f35fd"
      },
      "image": "images/card-32.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 33,
      "type": "계몽 임무",
      "title": "오에돈 예배당을 피신처로 삼아",
      "rules": [
        "사냥꾼이 [소모품 기호] 칸에서 소모품을 집어들 때, 생존자 토큰 1개도 함께 획득합니다. 사냥꾼이 순간이동하거나 사냥꾼의 꿈에 입장하면, 자신이 가진 생존자 토큰을 잃습니다. 오에돈 예배당 타일에서 이동을 마친 사냥꾼은 자신이 가진 생존자 토큰들을 이 카드에 놓습니다.",
        "이 카드에 토큰이 [사냥꾼 수]+1개 놓여 있을 때 이번 임무를 완수합니다: 34번 카드를 공개합니다."
      ],
      "reveal": [
        34
      ],
      "id": "card-33",
      "readStatus": "legible",
      "source": {
        "sortPosition": 40,
        "filename": "20261011_124514.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "bfae9da349e70452831e03041e720391a7671500387ab5998bbaddf21d535634"
      },
      "image": "images/card-33.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 34,
      "type": "보상",
      "title": "안전한 피신처: 오에돈 예배당",
      "rules": [
        "이오세프카의 진료소를 피신처 삼아 계몽 임무는 더 이상 완수할 수 없습니다.",
        "카릴 문자: 오에돈의 꿈틀거림 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "카릴 문자: 오에돈의 꿈틀거림"
      ],
      "locksMissions": [
        27,
        52
      ],
      "id": "card-34",
      "readStatus": "legible",
      "source": {
        "sortPosition": 41,
        "filename": "20261011_124518.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "151e9e09cf8f7eee343b220c1813a2e7ec525369e7fb02421a7c5cfc730ba35c"
      },
      "image": "images/card-34.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 35,
      "type": "계몽 임무",
      "title": "아슬아슬한 구조",
      "rules": [
        "36번 카드를 공개합니다.",
        "대교 타일이 안개 진입로에 둘러싸입니다. [보라색 손 모양 출현 기호] 칸에 기존 적 대신 야수 사냥 하인 하나가 출현합니다. [초기화] 때, 이 적이 이 칸에 재출현합니다.",
        "이 야수 사냥 하인을 처치하면: 37번 카드를 공개합니다."
      ],
      "reveal": [
        36,
        37
      ],
      "id": "card-35",
      "readStatus": "legible",
      "source": {
        "sortPosition": 42,
        "filename": "20261011_124525.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "5b265c2c2b3d5d5cab72d7665eb1193daaf1b47cc8d3c4e7c7f5fe7bfe90f4e1"
      },
      "image": "images/card-35.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 36,
      "type": "특수 규칙",
      "title": "불굴",
      "rules": [
        "이 카드에 계몽 토큰 1개를 놓습니다. 해당 야수 사냥 하인이 처치되는 대신 이 카드에서 토큰 1개를 제거하고 그 적의 모든 [피해]를 치유합니다. 이 계몽 토큰은 [초기화] 때 초기 수량이 되도록 보충됩니다.",
        "이 적의 특수 공격을 대체합니다:",
        "특수 공격: 고통 면역 — 속도 1, 피해 4. 사냥꾼의 공격에서 2[피해]를 방어합니다. 방해할 수 없습니다."
      ],
      "reveal": [],
      "id": "card-36",
      "readStatus": "legible",
      "source": {
        "sortPosition": 43,
        "filename": "20261011_124531.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "07b36bab031ac42831c33792de019eebf03c560c73c47279ae44b4dcae6a44af"
      },
      "image": "images/card-36.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 37,
      "type": "계몽 임무",
      "title": "아슬아슬한 구조",
      "rules": [
        "대교 칸에 생존자 토큰 1개를 놓습니다. 해당 칸에서 이동해 나가는 사냥꾼은 이 토큰을 집어들 수 있습니다. 이 토큰을 가진 사냥꾼이 순간이동하거나 사냥꾼의 꿈에 입장하면, 이 토큰을 대교의 [보라색 손 모양 출현 기호] 칸에 재출현시킵니다.",
        "다음 중 하나를 달성하면 이번 임무를 완수합니다:",
        "이 토큰을 가진 사냥꾼이 이오세프카의 진료소 타일에서 이동을 마치면: 38번 카드를 공개합니다.",
        "이 토큰을 가진 사냥꾼이 오에돈 예배당 타일에서 이동을 마치면: 39번 카드를 공개합니다."
      ],
      "reveal": [
        38,
        39
      ],
      "id": "card-37",
      "readStatus": "legible",
      "source": {
        "sortPosition": 44,
        "filename": "20261011_124535.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "26af302c06078b917b14dcc73161c440f26c830efe3c53b2a4ac03159ec15465"
      },
      "image": "images/card-37.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 38,
      "type": "보상",
      "title": "사냥에서 살아남다",
      "rules": [
        "고대 사냥꾼의 유골 보상과 교단의 연발총 화기를 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "고대 사냥꾼의 유골",
        "교단의 연발총"
      ],
      "id": "card-38",
      "readStatus": "legible",
      "source": {
        "sortPosition": 45,
        "filename": "20261011_124539.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "291913f7986b49611b29d8c95ebabee2e131b20f7c46779f7cbe12f5dc29dcd9"
      },
      "image": "images/card-38.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 39,
      "type": "보상",
      "title": "불길한 경고",
      "rules": [
        "고대 사냥꾼의 유골 보상과 교단의 연발총 화기를 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "고대 사냥꾼의 유골",
        "교단의 연발총"
      ],
      "id": "card-39",
      "readStatus": "legible",
      "source": {
        "sortPosition": 46,
        "filename": "20261011_124546.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "2474d28ce9cb43ba8ea079339a0232c137d6989dc213bad22b192789ba6cb116"
      },
      "image": "images/card-39.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 40,
      "type": "사냥 임무",
      "title": "재앙의 근원",
      "rules": [
        "41번 카드를 공개합니다.",
        "오에돈의 지하묘지 타일이 안개 진입로에 둘러싸입니다. 그곳의 [등불 기호] 칸에 성직자 야수가 출현합니다.",
        "성직자 야수를 처치하면 사냥을 완수합니다: 44번 카드를 공개합니다."
      ],
      "reveal": [
        41,
        44
      ],
      "id": "card-40",
      "readStatus": "legible",
      "source": {
        "sortPosition": 47,
        "filename": "20261011_124550.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "7b607b972056d0ef9d5e9699480c9532a26b995ad580718dbcc7dfb8ee6f2e29"
      },
      "image": "images/card-40.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 41,
      "type": "특수 규칙",
      "title": "가두다",
      "rules": [
        "사냥꾼은 오에돈의 지하묘지로 들어갈 수 없습니다.",
        "사냥꾼들이 이번 챕터에서 계몽을 둘 이상 모았을 때 (또는) 사냥 트랙의 두 번째 [초기화] 칸(여기에 계몽 토큰 1개를 놓아 표시해둡니다)에 도달했을 때: 42번, 43번 카드를 공개합니다."
      ],
      "reveal": [
        42,
        43
      ],
      "id": "card-41",
      "readStatus": "legible",
      "source": {
        "sortPosition": 48,
        "filename": "20261011_124557.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "62c61f9a0bd8160846f13460e782b3a494d7a0e3e6d1ae2b5b81e765a7a5ebd9"
      },
      "image": "images/card-41.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 42,
      "type": "특수 규칙",
      "title": "풀려나다",
      "rules": [
        "가두다 카드를 제거합니다. 오에돈의 지하묘지 타일에서 안개 진입로를 모두 제거합니다.",
        "매 라운드가 끝날 때마다, 성직자 야수가 사냥꾼과 같은 칸에 있지 않으면, 성직자 야수는 가장 가까운 사냥꾼 중에서 체력이 가장 낮은 사냥꾼을 향해 4칸 이동하고 공격합니다. 그렇지 않으면, 성직자 야수는 자신이 위치한 칸에 있는 체력이 가장 낮은 사냥꾼을 공격합니다. 이 적은 [초기화] 때 제거되지 않고, 그 대신 [피해]를 모두 치유하고 계몽 토큰을 모두 제거합니다."
      ],
      "reveal": [],
      "removesCards": [
        41
      ],
      "id": "card-42",
      "readStatus": "legible",
      "source": {
        "sortPosition": 49,
        "filename": "20261011_124602.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "336936caaca7decb41aa9fb5ed076a1dd822d1b742341cad2f53262b88f6d247"
      },
      "image": "images/card-42.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 43,
      "type": "특수 규칙",
      "title": "무리 소환",
      "rules": [
        "성직자 야수가 회복을 공개할 때마다, 성직자 야수가 위치한 칸에 재앙의 야수 하나가 출현합니다. 이러한 재앙의 야수는 [초기화] 때 재출현하지 않습니다.",
        "사냥꾼들이 무리를 정리하다 카드를 갖고 있거나 앞으로 획득하게 되면, 이 카드를 버립니다."
      ],
      "reveal": [],
      "checksCards": [
        55
      ],
      "id": "card-43",
      "readStatus": "legible",
      "source": {
        "sortPosition": 50,
        "filename": "20261011_124606.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "65066a1031611f7e6ab1973aeec1c2c7630cc72a025a55e1a482a8d3e3e14ed7"
      },
      "image": "images/card-43.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 44,
      "type": "결말",
      "title": "사냥 완수",
      "rules": [],
      "reveal": [],
      "id": "card-44",
      "readStatus": "legible",
      "source": {
        "sortPosition": 51,
        "filename": "20261011_124611.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "3f29f2fa1b68d6db2f114424318a921bda54a1e073761b81c698c12042c57d1a"
      },
      "image": "images/card-44.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 45,
      "type": "계몽 임무",
      "title": "이오세프카의 진료소",
      "rules": [
        "안전한 피신처: 이오세프카의 진료소 카드와 이오세프카의 연구 카드를 둘 다 갖고 있다면: 46번 카드를 공개합니다.",
        "안전한 피신처: 이오세프카의 진료소 카드는 갖고 있지만, 이오세프카의 연구 카드는 갖고 있지 않으면: 51번 카드를 공개합니다.",
        "이오세프카의 연구 카드는 갖고 있지만, 안전한 피신처: 이오세프카의 진료소 카드는 갖고 있지 않으면: 52번 카드를 공개합니다.",
        "그렇지 않으면: 24번 카드를 공개합니다."
      ],
      "reveal": [
        46,
        51,
        52,
        24
      ],
      "checksCards": [
        28,
        26
      ],
      "id": "card-45",
      "readStatus": "legible",
      "source": {
        "sortPosition": 52,
        "filename": "20261011_124615.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "883cccc3362cae60f774839088d00306c0cd7845c952dd75b2212cfa678e085c"
      },
      "image": "images/card-45.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 46,
      "type": "계몽 임무",
      "title": "진실이 드러나다",
      "rules": [
        "다음 중 하나를 선택합니다:",
        "이오세프카를 공격한다: 47번 카드를 공개합니다.",
        "이오세프카를 돕는다: 49번 카드를 공개합니다."
      ],
      "reveal": [
        47,
        49
      ],
      "id": "card-46",
      "readStatus": "legible",
      "source": {
        "sortPosition": 53,
        "filename": "20261011_124618.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "70a4360be346cb763a941697c88f8cf58f14d2efab425dc1cf378abf42687de5"
      },
      "image": "images/card-46.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 47,
      "type": "계몽 임무",
      "title": "진실이 드러나다",
      "rules": [
        "이오세프카의 진료소 타일이 안개 진입로에 둘러싸입니다. 그곳의 [등불 기호] 칸에 이오세프카 토큰이 출현합니다. [초기화] 때, 이 적이 이 칸에 재출현합니다.",
        "이오세프카를 처치하면 이번 임무를 완수합니다: 48번 카드를 공개합니다."
      ],
      "reveal": [
        48
      ],
      "id": "card-47",
      "readStatus": "legible",
      "source": {
        "sortPosition": 54,
        "filename": "20261011_124622.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "02c91339b24b423796a3de8e81e72b5203a0edf665869db190f62b9ea3d9ef45"
      },
      "image": "images/card-47.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 48,
      "type": "보상",
      "title": "목표 처치: 이오세프카",
      "rules": [
        "소모품 1장과 이브리에타스의 전조 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "소모품 1장",
        "이브리에타스의 전조"
      ],
      "id": "card-48",
      "readStatus": "legible",
      "source": {
        "sortPosition": 55,
        "filename": "20261011_124626.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "ec0aace71417524d51bd4f6f5612549eb96d3538ecded09990b77a37319284c1"
      },
      "image": "images/card-48.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 49,
      "type": "계몽 임무",
      "title": "대의",
      "rules": [
        "생존자 토큰 1개를 당신이 위치한 칸에 놓은 뒤 4칸 멀리 이동시킵니다. 매 차례가 끝날 때마다, 생존자 토큰은 자신과 가장 가까운 사냥꾼으로부터 1칸 멀리 이동합니다. 이 토큰이 위치한 칸에서 상호작용해서 이 생존자를 붙잡을 수 있습니다. 사냥꾼이 순간이동하거나 사냥꾼의 꿈에 입장하면, 사냥꾼이 위치했던 칸에 이 토큰을 떨어뜨립니다.",
        "이 토큰을 가진 사냥꾼이 이오세프카의 진료소 타일에서 이동을 마치면 이번 임무를 완수합니다: 50번 카드를 공개합니다."
      ],
      "reveal": [
        50
      ],
      "id": "card-49",
      "readStatus": "legible",
      "source": {
        "sortPosition": 56,
        "filename": "20261011_124630.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "61222598a50394e3c46636a4c124ad7b48c99747d494eae1977606cbac1ef8fa"
      },
      "image": "images/card-49.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 50,
      "type": "보상",
      "title": "계속되는 실험",
      "rules": [
        "소모품 1장과 이브리에타스의 전조 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "소모품 1장",
        "이브리에타스의 전조"
      ],
      "id": "card-50",
      "readStatus": "legible",
      "source": {
        "sortPosition": 57,
        "filename": "20261011_124634.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "e711f4e0a10a706068b772dc7d536cd2a37d15b3122d2fd3b9a6238203df7dfd"
      },
      "image": "images/card-50.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 51,
      "type": "계몽 임무",
      "title": "이오세프카의 연구",
      "rules": [
        "이오세프카의 진료소 타일에서 재앙의 야수를 처치하면 이번 임무를 완수합니다: 26번 카드를 공개합니다."
      ],
      "reveal": [
        26
      ],
      "id": "card-51",
      "readStatus": "legible",
      "source": {
        "sortPosition": 58,
        "filename": "20261011_124639.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "d106704124bd55ba64338bfd240c06b39686777b5376718d69889f0699f50d99"
      },
      "image": "images/card-51.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 52,
      "type": "계몽 임무",
      "title": "이오세프카의 진료소를 피신처 삼아",
      "rules": [
        "사냥꾼이 [소모품 기호] 칸에서 소모품을 집어들 때, 생존자 토큰 1개도 함께 획득합니다. 사냥꾼이 순간이동하거나 사냥꾼의 꿈에 입장하면, 자신이 가진 생존자 토큰을 잃습니다. 이오세프카의 진료소 타일에서 이동을 마친 사냥꾼은 자신이 가진 생존자 토큰들을 이 카드에 놓습니다.",
        "이 카드에 토큰이 [사냥꾼 수]+1개 놓여 있을 때 이번 임무를 완수합니다: 28번 카드를 공개합니다."
      ],
      "reveal": [
        28
      ],
      "id": "card-52",
      "readStatus": "legible",
      "source": {
        "sortPosition": 59,
        "filename": "20261011_124645.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "69530f7d60f9dccd0b085d89e8ca908c0f04e4c01935a8be7c84efa332872522"
      },
      "image": "images/card-52.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 53,
      "type": "계몽 임무",
      "title": "대교",
      "rules": [
        "불길한 경고 카드 또는 사냥에서 살아남다 카드를 갖고 있다면: 54번 카드를 공개합니다.",
        "그 외의 경우: 35번 카드를 공개합니다."
      ],
      "reveal": [
        54,
        35
      ],
      "checksCards": [
        39,
        38
      ],
      "id": "card-53",
      "readStatus": "legible",
      "source": {
        "sortPosition": 60,
        "filename": "20261011_124649.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "15c63ab25cff27af1038edef3c202cc89fe715541cfb341195b0c23e4394af52"
      },
      "image": "images/card-53.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 54,
      "type": "계몽 임무",
      "title": "무리를 정리하다",
      "rules": [
        "이 카드에 계몽 토큰 [사냥꾼 수]+2개를 놓습니다. 재앙의 야수를 처치할 때마다, 이 카드에서 토큰 1개를 제거합니다.",
        "이 카드에 놓인 토큰이 없다면 이번 임무를 완수합니다: 55번 카드를 공개합니다."
      ],
      "reveal": [
        55
      ],
      "id": "card-54",
      "readStatus": "legible",
      "source": {
        "sortPosition": 61,
        "filename": "20261011_124653.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "b537388c61e7e94da2c6415defbb49bf19bed2de2f3bd422e8da17e361e751ef"
      },
      "image": "images/card-54.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 55,
      "type": "보상",
      "title": "무리를 정리하다",
      "rules": [
        "사형 집행인의 장갑 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "사형 집행인의 장갑"
      ],
      "id": "card-55",
      "readStatus": "legible",
      "source": {
        "sortPosition": 62,
        "filename": "20261011_124656.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "39b6d649e48602a5566adcb953e08ca006c37284b6209fbfc0aa611baad9120a"
      },
      "image": "images/card-55.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 56,
      "type": "계몽 임무",
      "title": "오에돈 예배당",
      "rules": [
        "불길한 경고 카드를 갖고 있다면: 57번 카드를 공개합니다.",
        "불길한 경고 카드는 갖고 있지 않지만, 안전한 피신처: 오에돈 예배당 카드는 갖고 있다면: 59번 카드를 공개합니다.",
        "그 외의 경우: 33번 카드를 공개합니다."
      ],
      "reveal": [
        57,
        59,
        33
      ],
      "checksCards": [
        39,
        34
      ],
      "id": "card-56",
      "readStatus": "legible",
      "source": {
        "sortPosition": 63,
        "filename": "20261011_124702.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "425233c4cfbb5b6b5221cd436fcaed48d0f910c61ac4c83af6265b35d8ac20ba"
      },
      "image": "images/card-56.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 57,
      "type": "계몽 임무",
      "title": "구원",
      "rules": [
        "이 카드에 계몽 토큰 [사냥꾼 수]+1개를 놓습니다. 오에돈 예배당 칸에 NPC 토큰 1개를 놓습니다. NPC가 위치한 칸에서 이동해 나가는 사냥꾼은, NPC와 함께 이동할 수 있습니다. NPC가 위치한 칸에서 야수 사냥 무리 또는 야수 사냥 하수인을 처치할 때마다, 이 카드에서 토큰 1개를 제거합니다.",
        "이 카드에 놓인 토큰이 없다면 이번 임무를 완수합니다: 58번 카드를 공개합니다."
      ],
      "reveal": [
        58
      ],
      "openQuestions": [],
      "id": "card-57",
      "readStatus": "legible",
      "source": {
        "sortPosition": 64,
        "filename": "20261011_124706.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "67671d824d00a4430b61a812820f0d521ed865a391c79e04368235fcfba97f3d"
      },
      "image": "images/card-57.jpg",
      "narrativeSource": "image",
      "resolvedQuestions": [
        "Q57"
      ]
    },
    {
      "number": 58,
      "type": "보상",
      "title": "사냥의 짜릿함",
      "rules": [
        "소모품 1장과 카릴 문자: 사냥 보상을 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "소모품 1장",
        "카릴 문자: 사냥"
      ],
      "id": "card-58",
      "readStatus": "legible",
      "source": {
        "sortPosition": 65,
        "filename": "20261011_124709.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "e3f41b59f41c3c36443c5cba1e8934edce0d3c7cce184404f30b306e7a192435"
      },
      "image": "images/card-58.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 59,
      "type": "계몽 임무",
      "title": "생존자를 위한 물자",
      "rules": [
        "이 카드에 계몽 토큰 [사냥꾼 수]+1개를 놓습니다. 오에돈 예배당 타일에서 이동을 마친 사냥꾼은 가지고 있는 소모품을 원하는 만큼 버릴 수 있습니다. 이렇게 버린 소모품마다, 이 카드에서 토큰 1개를 제거합니다.",
        "이 카드에 놓인 토큰이 없다면 이번 임무를 완수합니다: 60번 카드를 공개합니다."
      ],
      "reveal": [
        60
      ],
      "id": "card-59",
      "readStatus": "legible",
      "source": {
        "sortPosition": 66,
        "filename": "20261011_124716.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "3d2abfb292e776ba69b649e187c8884e6b1c8e0f0b5aac5f16b7c2d1086b0049"
      },
      "image": "images/card-59.jpg",
      "narrativeSource": "image"
    },
    {
      "number": 60,
      "type": "보상",
      "title": "생존자를 지켜내다",
      "rules": [
        "정령의 빈 껍데기 보상과 화염방사기 화기를 사냥꾼들끼리 나누어 갖습니다."
      ],
      "reveal": [],
      "rewards": [
        "정령의 빈 껍데기",
        "화염방사기"
      ],
      "id": "card-60",
      "readStatus": "legible",
      "source": {
        "sortPosition": 67,
        "filename": "20261011_124720.jpg",
        "archive": "기나긴사냥60.zip",
        "sha256": "deaa00a7e52255793129de3555bb93833c9222236c3322500aaa464524cf3e01"
      },
      "image": "images/card-60.jpg",
      "narrativeSource": "image"
    }
  ],
  "questions": [
    {
      "id": "Q57",
      "card": 57,
      "sourceFilename": "20261011_124706.jpg",
      "kind": "terminology",
      "printed": "야수 사냥 하수인",
      "relatedPrinted": "야수 사냥 하인",
      "question": "57번 구원의 야수 사냥 하수인은 준비 카드의 야수 사냥 하인과 같은 적을 뜻하나요?",
      "resolution": {
        "canonicalName": "야수 사냥 하인",
        "confirmedBy": "user",
        "confirmedOn": "2026-10-11",
        "note": "사용자가 57번 구원 카드의 야수 사냥 하수인은 야수 사냥 하인을 뜻한다고 확인함."
      },
      "image": "images/card57-term.png",
      "status": "resolved"
    }
  ],
  "missingComponents": [
    {
      "priority": 3,
      "scope": "챕터 2~3",
      "kind": "적·NPC·보스",
      "names": [
        "성직자 야수",
        "여성 야수 환자",
        "이오세프카"
      ],
      "needed": "성직자 야수 양면 보스 시트와 행동 카드 전체, 여성 야수 환자 양면 카드, 이오세프카 NPC 카드"
    }
  ],
  "enemyNameAliases": [
    {
      "printedName": "야수 사냥 하수인",
      "canonicalName": "야수 사냥 하인",
      "enemyId": "huntsmans-minion",
      "sourceCard": 57,
      "confirmation": "Q57"
    }
  ],
  "enemies": [
    {
      "id": "huntsman-mob",
      "name": "야수 사냥 무리",
      "health": 4,
      "miniatureCount": 4,
      "movementOverride": null,
      "sides": [
        {
          "id": "a",
          "label": "A면",
          "basicAttack": {
            "name": "도끼 휘두르기",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": []
          },
          "specialAttack": {
            "name": "방패 치기",
            "speed": 2,
            "damage": 2,
            "keywords": [
              "방해",
              "기절"
            ],
            "rules": []
          },
          "ability": {
            "name": "발광한 무리",
            "speed": null,
            "precedesHunterOnTie": null,
            "rules": [
              "다른 적 행동 카드 1장을 공개합니다.",
              "야수 사냥 무리의 다음 공격은 +1 [속도]와 +1 [피해]를 획득합니다."
            ]
          },
          "passiveRules": [],
          "readStatus": "legible",
          "openQuestions": [],
          "source": {
            "archive": "20261011_140211.zip",
            "filename": "20261011_140148.jpg",
            "sortPosition": 1,
            "sha256": "f540d3578b732170edfdd69a299c9d709eda13980c515122ba210959fea887cc"
          },
          "image": "images/enemy-140148.jpg"
        },
        {
          "id": "b",
          "label": "B면",
          "basicAttack": {
            "name": "도끼 휘두르기",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": []
          },
          "specialAttack": {
            "name": "소총 사격",
            "speed": 1,
            "damage": 4,
            "keywords": [
              "기절"
            ],
            "rules": []
          },
          "ability": {
            "name": "화염병 투척",
            "speed": 1,
            "precedesHunterOnTie": true,
            "rules": [
              "[속도 1] 속도로(사냥꾼과 같은 속도라면, 사냥꾼 공격 전에), 야수 사냥 무리를 1칸 멀리 이동시킵니다.",
              "이 적이 떠난 칸에 있는 모든 사냥꾼은 회피([속도 2])하거나 3 [피해]를 받아야 합니다."
            ]
          },
          "passiveRules": [],
          "readStatus": "legible",
          "openQuestions": [],
          "source": {
            "archive": "20261011_140211.zip",
            "filename": "20261011_140155.jpg",
            "sortPosition": 2,
            "sha256": "2426cf4841675f38cbe3f0e89ac9b8e262f1d81da31a2e1c4fb41c1894dd5c11"
          },
          "image": "images/enemy-140155.jpg"
        }
      ],
      "miniatureCountSource": {
        "kind": "user_confirmation",
        "confirmedOn": "2026-10-11",
        "note": "사용자가 세 종류 각각 4개라고 확인함."
      }
    },
    {
      "id": "scourge-beast",
      "name": "재앙의 야수",
      "health": 4,
      "miniatureCount": 4,
      "movementOverride": {
        "activation": 2,
        "pursuit": 2
      },
      "sides": [
        {
          "id": "a",
          "label": "A면",
          "basicAttack": {
            "name": "재빠른 휩쓸기",
            "speed": 3,
            "damage": 2,
            "keywords": [],
            "rules": []
          },
          "specialAttack": {
            "name": "달려들어 뜯기",
            "speed": 1,
            "damage": 4,
            "keywords": [
              "기절",
              "회피할 수 없습니다."
            ],
            "rules": []
          },
          "ability": {
            "name": "야수의 포효",
            "speed": 1,
            "precedesHunterOnTie": true,
            "rules": [
              "[속도 1] 속도로(사냥꾼과 같은 속도라면, 사냥꾼 공격 전에), 이 칸에 재앙의 야수 하나를 출현시킵니다."
            ]
          },
          "passiveRules": [
            "재앙의 야수는 활성화/추격 시 2칸을 이동합니다."
          ],
          "readStatus": "legible",
          "openQuestions": [],
          "source": {
            "archive": "20261011_140211.zip",
            "filename": "20261011_140159.jpg",
            "sortPosition": 3,
            "sha256": "731a2ddf17505f5caf254d26699fe0b1ffa023156442bdc7c044c31b3c8fa2de"
          },
          "image": "images/enemy-140159.jpg"
        },
        {
          "id": "b",
          "label": "B면",
          "basicAttack": {
            "name": "재빠른 휩쓸기",
            "speed": 3,
            "damage": 2,
            "keywords": [],
            "rules": []
          },
          "specialAttack": {
            "name": "다단 가르기",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "이 공격을 회피하거나 방해했더라도, 사냥꾼은 회피([속도 2])하거나 추가로 2 [피해]를 받아야 합니다."
            ]
          },
          "ability": {
            "name": "날것 그대로의 분노",
            "speed": null,
            "precedesHunterOnTie": null,
            "rules": [
              "다른 적 행동 카드 1장을 공개합니다.",
              "재앙의 야수의 다음 공격은 +1 [피해]와 방해를 획득합니다."
            ]
          },
          "passiveRules": [
            "재앙의 야수는 활성화/추격 시 2칸을 이동합니다."
          ],
          "readStatus": "legible",
          "openQuestions": [],
          "source": {
            "archive": "20261011_140211.zip",
            "filename": "20261011_140203.jpg",
            "sortPosition": 4,
            "sha256": "1a072042be041ea77c0d5d840f98e0b3d5e5d500c0d2e53b5e69b0bceb099aae"
          },
          "image": "images/enemy-140203.jpg"
        }
      ],
      "miniatureCountSource": {
        "kind": "user_confirmation",
        "confirmedOn": "2026-10-11",
        "note": "사용자가 세 종류 각각 4개라고 확인함."
      }
    },
    {
      "id": "huntsmans-minion",
      "name": "야수 사냥 하인",
      "health": 5,
      "miniatureCount": 4,
      "movementOverride": null,
      "sides": [
        {
          "id": "a",
          "label": "A면",
          "basicAttack": {
            "name": "느릿느릿한 휘두르기",
            "speed": 1,
            "damage": 3,
            "keywords": [],
            "rules": []
          },
          "specialAttack": {
            "name": "벽돌 휩쓸기",
            "speed": 3,
            "damage": 2,
            "keywords": [
              "방해"
            ],
            "rules": []
          },
          "ability": {
            "name": "어깨 돌진",
            "speed": 1,
            "precedesHunterOnTie": true,
            "rules": [
              "[속도 1] 속도로(사냥꾼과 같은 속도라면, 사냥꾼 공격 전에) 야수 사냥 하인을 2칸 멀리 이동시킵니다.",
              "사냥꾼은 회피([속도 1])하지 않으면, 함께 이동하고 3 [피해]를 받으며 기절에 걸립니다."
            ]
          },
          "passiveRules": [],
          "readStatus": "legible",
          "openQuestions": [],
          "source": {
            "archive": "20261011_140211.zip",
            "filename": "20261011_140208.jpg",
            "sortPosition": 5,
            "sha256": "aaedc63b1e480429784649d939701946f5c920cdf287055eb8998083f0a32e72"
          },
          "image": "images/enemy-140208.jpg"
        },
        {
          "id": "b",
          "label": "B면",
          "basicAttack": {
            "name": "느릿느릿한 휘두르기",
            "speed": 1,
            "damage": 3,
            "keywords": [],
            "rules": []
          },
          "specialAttack": {
            "name": "내려찍기",
            "speed": 1,
            "damage": 4,
            "keywords": [
              "방해할 수 없습니다."
            ],
            "rules": [
              "이 칸에 있는 다른 모든 사냥꾼들이 회피([속도 1])하지 않는다면 그들에게 피해를 1 [피해]씩 줍니다."
            ]
          },
          "ability": {
            "name": "벽돌 후려갈기기",
            "speed": null,
            "precedesHunterOnTie": null,
            "rules": [
              "사냥꾼은 카드 1장을 버리거나 공격에 -2 [속도]를 받고 회피할 수 없습니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ]
          },
          "passiveRules": [],
          "readStatus": "legible",
          "openQuestions": [],
          "source": {
            "archive": "20261011_140211.zip",
            "filename": "20261011_140211.jpg",
            "sortPosition": 6,
            "sha256": "7eeb51d4ae8381c5765db7edc80143c083247aeaf3e6f120c29dbd548faddedb"
          },
          "image": "images/enemy-140211.jpg"
        }
      ],
      "miniatureCountSource": {
        "kind": "user_confirmation",
        "confirmedOn": "2026-10-11",
        "note": "사용자가 세 종류 각각 4개라고 확인함."
      }
    }
  ],
  "enemyTranscriptionPolicy": {
    "receivedOn": "2026-10-11",
    "status": "transcribed_reference_not_executable",
    "sideLabels": "A/B는 적 종류별 파일명 오름차순의 두 사진을 구분하는 표시이며 공식 앞면·뒷면 명칭이 아니다.",
    "icons": "화살표 개수는 속도, 혈액방울은 피해로 전사했다. 회피 괄호 안의 수치는 카드에 인쇄된 속도 기호이며 실제 회피 가능 여부 판정은 공통 규칙을 따른다.",
    "nullValues": "피규어 수량은 사용자 확인에 따라 각 4개다. movementOverride null은 카드에 이동 예외가 인쇄되지 않았음을, ability.speed null은 카드에 속도 기호가 없음을 뜻한다.",
    "sourcePreservation": "아이콘·줄바꿈·일부 공백만 정규화했으며 실제 처리 시점과 예외는 원문 규칙에 따라 구현해야 한다."
  },
  "tiles": [
    {
      "id": "tile-01",
      "name": null,
      "named": false,
      "displayName": "명칭 없는 타일 01",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "gold",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "red",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "top",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "top"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141849.jpg",
        "sortPosition": 1,
        "sha256": "77ed55c78175f031a579f27695db6789550134729ed949e4975ad41bdf22111e"
      },
      "image": "images/tile-01.jpg"
    },
    {
      "id": "tile-02",
      "name": "방범창이 질러진 창문",
      "named": true,
      "displayName": "방범창이 질러진 창문",
      "spaces": [
        {
          "id": "upper-left",
          "label": "왼쪽 위 칸",
          "placeName": "방범창이 질러진 창문",
          "icons": []
        },
        {
          "id": "lower-left",
          "label": "왼쪽 아래 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "red",
              "count": 1
            }
          ]
        },
        {
          "id": "right",
          "label": "오른쪽 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "upper-left",
          "lower-left"
        ],
        [
          "upper-left",
          "right"
        ],
        [
          "lower-left",
          "right"
        ]
      ],
      "exits": [
        {
          "edge": "E",
          "spaceId": "right"
        },
        {
          "edge": "S",
          "spaceId": "lower-left"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141853.jpg",
        "sortPosition": 2,
        "sha256": "68186f0526e1d70f5819de8ed60cdcb8115821b11f409c090adfd294a95feb2a"
      },
      "image": "images/tile-02.jpg"
    },
    {
      "id": "tile-03",
      "name": "폐가",
      "named": true,
      "displayName": "폐가",
      "spaces": [
        {
          "id": "room",
          "label": "위쪽 실내 칸",
          "placeName": "폐가",
          "icons": [
            {
              "kind": "spawn",
              "markerId": "gold",
              "count": 1
            },
            {
              "kind": "spawn",
              "markerId": "purple",
              "count": 1
            },
            {
              "kind": "consumable",
              "count": 2
            }
          ]
        },
        {
          "id": "entry",
          "label": "아래쪽 입구 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "room",
          "entry"
        ]
      ],
      "exits": [
        {
          "edge": "S",
          "spaceId": "entry"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141903.jpg",
        "sortPosition": 3,
        "sha256": "4de96278054e269dd949f9d776c9f297b0d9ae77b82ced0793e26514826dfc85"
      },
      "image": "images/tile-03.jpg"
    },
    {
      "id": "tile-04",
      "name": "마당 등불",
      "named": true,
      "displayName": "마당 등불",
      "spaces": [
        {
          "id": "left",
          "label": "왼쪽 칸",
          "placeName": null,
          "icons": []
        },
        {
          "id": "center",
          "label": "가운데 칸",
          "placeName": "마당 등불",
          "icons": [
            {
              "kind": "lamp",
              "count": 1
            }
          ]
        },
        {
          "id": "right",
          "label": "오른쪽 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "left",
          "center"
        ],
        [
          "center",
          "right"
        ]
      ],
      "exits": [
        {
          "edge": "W",
          "spaceId": "left"
        },
        {
          "edge": "E",
          "spaceId": "right"
        },
        {
          "edge": "S",
          "spaceId": "center"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141907.jpg",
        "sortPosition": 4,
        "sha256": "ce275b1e8695994dc956ae3c0d18a47d324877bfa1db3ee719b690e302856a8a"
      },
      "image": "images/tile-04.jpg"
    },
    {
      "id": "tile-05",
      "name": null,
      "named": false,
      "displayName": "명칭 없는 타일 05",
      "spaces": [
        {
          "id": "upper-left",
          "label": "왼쪽 위 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "gold",
              "count": 1
            }
          ]
        },
        {
          "id": "upper-right",
          "label": "오른쪽 위 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "purple",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "upper-left",
          "upper-right"
        ],
        [
          "upper-left",
          "bottom"
        ],
        [
          "upper-right",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "W",
          "spaceId": "upper-left"
        },
        {
          "edge": "E",
          "spaceId": "upper-right"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141912.jpg",
        "sortPosition": 5,
        "sha256": "e277ac1c2517437b3f259743f7621261826336c2f464098a962ffd98e45efbc8"
      },
      "image": "images/tile-05.jpg"
    },
    {
      "id": "tile-06",
      "name": null,
      "named": false,
      "displayName": "명칭 없는 타일 06",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "purple",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "top",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "W",
          "spaceId": "top"
        },
        {
          "edge": "E",
          "spaceId": "top"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141917.jpg",
        "sortPosition": 6,
        "sha256": "bb927d5341e088a7215fa0249e4977463a5a7c5a10179f725f4c0e232842c816"
      },
      "image": "images/tile-06.jpg"
    },
    {
      "id": "tile-07",
      "name": "성배 교단 예배당",
      "named": true,
      "displayName": "성배 교단 예배당",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": "성배 교단 예배당",
          "icons": [
            {
              "kind": "consumable",
              "count": 2
            }
          ]
        },
        {
          "id": "middle",
          "label": "가운데 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "lamp",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "top",
          "middle"
        ],
        [
          "middle",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [
        "상호작용 했을 때: 1 [소모품]을 사용하면서 피의 유지 1개를 획득할 수 있습니다."
      ],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141921.jpg",
        "sortPosition": 7,
        "sha256": "79e9ee4b4e8efddbe18c0566a6f77c53669f402de7bfd8909cd128ac51a068de"
      },
      "image": "images/tile-07.jpg"
    },
    {
      "id": "tile-08",
      "name": null,
      "named": false,
      "displayName": "명칭 없는 타일 08",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": null,
          "icons": []
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            },
            {
              "kind": "spawn",
              "markerId": "purple",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "top",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "top"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141939.jpg",
        "sortPosition": 8,
        "sha256": "81c119868a9e65d1d6134e8a28cc11041abc0bedd90f5a07da1667937cc57fb2"
      },
      "image": "images/tile-08.jpg"
    },
    {
      "id": "tile-09",
      "name": null,
      "named": false,
      "displayName": "명칭 없는 타일 09",
      "spaces": [
        {
          "id": "upper-left",
          "label": "왼쪽 위 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            }
          ]
        },
        {
          "id": "upper-right",
          "label": "오른쪽 위 칸",
          "placeName": null,
          "icons": []
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "gold",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "upper-left",
          "upper-right"
        ],
        [
          "upper-left",
          "bottom"
        ],
        [
          "upper-right",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "E",
          "spaceId": "upper-right"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141945.jpg",
        "sortPosition": 9,
        "sha256": "5ada5586bc7185c59a2e89da3d73be492984318fa6473bb86cc27d12ed87fd48"
      },
      "image": "images/tile-09.jpg"
    },
    {
      "id": "tile-10",
      "name": null,
      "named": false,
      "displayName": "명칭 없는 타일 10",
      "spaces": [
        {
          "id": "left",
          "label": "건물 왼쪽을 돌아가는 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "red",
              "count": 1
            }
          ]
        },
        {
          "id": "right",
          "label": "건물 오른쪽을 돌아가는 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "left",
          "right"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "left"
        },
        {
          "edge": "W",
          "spaceId": "left"
        },
        {
          "edge": "E",
          "spaceId": "right"
        },
        {
          "edge": "S",
          "spaceId": "right"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141951.jpg",
        "sortPosition": 10,
        "sha256": "a794ef6e8c5f707f2d43bb06bdd706e995db0910aaf636ba99927735a9e55b21"
      },
      "image": "images/tile-10.jpg"
    },
    {
      "id": "tile-11",
      "name": "민가",
      "named": true,
      "displayName": "민가",
      "spaces": [
        {
          "id": "street",
          "label": "위쪽 거리 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "gold",
              "count": 1
            }
          ]
        },
        {
          "id": "house",
          "label": "아래쪽 민가 칸",
          "placeName": "민가",
          "icons": []
        }
      ],
      "adjacency": [
        [
          "street",
          "house"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "street"
        },
        {
          "edge": "W",
          "spaceId": "street"
        },
        {
          "edge": "E",
          "spaceId": "street"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_141956.jpg",
        "sortPosition": 11,
        "sha256": "29986a35552d5d437bffc8930bccbbc208524e31b3d2f9fd18f03904a8e4fed2"
      },
      "image": "images/tile-11.jpg"
    },
    {
      "id": "tile-12",
      "name": "대성당",
      "named": true,
      "displayName": "대성당",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": "대성당",
          "icons": []
        },
        {
          "id": "middle-left",
          "label": "가운데 왼쪽 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "lamp",
              "count": 1
            }
          ]
        },
        {
          "id": "middle-right",
          "label": "가운데 오른쪽 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "top",
          "middle-left"
        ],
        [
          "top",
          "middle-right"
        ],
        [
          "middle-left",
          "middle-right"
        ],
        [
          "middle-left",
          "bottom"
        ],
        [
          "middle-right",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [
        "아무 칸에서 상호작용: 치유 2를 합니다."
      ],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142001.jpg",
        "sortPosition": 12,
        "sha256": "57af30d24dfb677fc0bbf6c0a7374acd238e4afe7ebe03a1b3bcd582f20f6703"
      },
      "image": "images/tile-12.jpg"
    },
    {
      "id": "tile-13",
      "name": "공동묘지",
      "named": true,
      "displayName": "공동묘지",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": null,
          "icons": []
        },
        {
          "id": "middle",
          "label": "가운데 칸",
          "placeName": "공동묘지",
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            },
            {
              "kind": "spawn",
              "markerId": "red",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "top",
          "middle"
        ],
        [
          "middle",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "top"
        },
        {
          "edge": "W",
          "spaceId": "middle"
        },
        {
          "edge": "E",
          "spaceId": "middle"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142005.jpg",
        "sortPosition": 13,
        "sha256": "0895fcc113bd4766cb748a6b798e75139d17577769581f67e4d7d96d01144366"
      },
      "image": "images/tile-13.jpg"
    },
    {
      "id": "tile-14",
      "name": "중앙 등불",
      "named": true,
      "displayName": "중앙 등불",
      "spaces": [
        {
          "id": "left",
          "label": "왼쪽 칸",
          "placeName": null,
          "icons": []
        },
        {
          "id": "center",
          "label": "가운데 칸",
          "placeName": "중앙 등불",
          "icons": [
            {
              "kind": "lamp",
              "count": 1
            }
          ]
        },
        {
          "id": "right",
          "label": "오른쪽 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "left",
          "center"
        ],
        [
          "center",
          "right"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "center"
        },
        {
          "edge": "W",
          "spaceId": "left"
        },
        {
          "edge": "E",
          "spaceId": "right"
        },
        {
          "edge": "S",
          "spaceId": "center"
        }
      ],
      "rules": [
        "중앙 등불 칸에서 상호작용하면: 아무 [등불] 칸 또는 아무 안개 진입로 안의 칸 한 곳으로 순간이동합니다."
      ],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142009.jpg",
        "sortPosition": 14,
        "sha256": "3d43eaac7fe73541ed3162eb9551323722a766cbe8e6e75e3076919f71b9b7c5"
      },
      "image": "images/tile-14.jpg"
    },
    {
      "id": "tile-15",
      "name": "골목길",
      "named": true,
      "displayName": "골목길",
      "spaces": [
        {
          "id": "left",
          "label": "왼쪽 칸",
          "placeName": null,
          "icons": []
        },
        {
          "id": "center",
          "label": "가운데 칸",
          "placeName": "골목길",
          "icons": [
            {
              "kind": "spawn",
              "markerId": "purple",
              "count": 1
            }
          ]
        },
        {
          "id": "right",
          "label": "오른쪽 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "left",
          "center"
        ],
        [
          "center",
          "right"
        ]
      ],
      "exits": [
        {
          "edge": "W",
          "spaceId": "left"
        },
        {
          "edge": "E",
          "spaceId": "right"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142015.jpg",
        "sortPosition": 15,
        "sha256": "32afca668db8701552bf35e1d7fdbe78a73fc60f80fc38dd57214289051425a2"
      },
      "image": "images/tile-15.jpg"
    },
    {
      "id": "tile-16",
      "name": null,
      "named": false,
      "displayName": "명칭 없는 타일 16",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            }
          ]
        },
        {
          "id": "middle",
          "label": "가운데 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "red",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "spawn",
              "markerId": "gold",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "top",
          "middle"
        ],
        [
          "middle",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "W",
          "spaceId": "middle"
        },
        {
          "edge": "E",
          "spaceId": "middle"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142020.jpg",
        "sortPosition": 16,
        "sha256": "b87c88e63091086623ee66791e8a213151b8f3fe69d95eac480ba840b8d94102"
      },
      "image": "images/tile-16.jpg"
    },
    {
      "id": "tile-17",
      "name": "오에돈 예배당",
      "named": true,
      "displayName": "오에돈 예배당",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": "오에돈 예배당",
          "icons": [
            {
              "kind": "lamp",
              "count": 1
            }
          ]
        },
        {
          "id": "lower-left",
          "label": "왼쪽 아래 칸",
          "placeName": null,
          "icons": []
        },
        {
          "id": "lower-right",
          "label": "오른쪽 아래 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "top",
          "lower-left"
        ],
        [
          "top",
          "lower-right"
        ],
        [
          "lower-left",
          "lower-right"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "top"
        },
        {
          "edge": "W",
          "spaceId": "lower-left"
        },
        {
          "edge": "E",
          "spaceId": "lower-right"
        }
      ],
      "rules": [
        "이 타일에 있는 적의 공격은 -1 [속도]를 받습니다."
      ],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142026.jpg",
        "sortPosition": 17,
        "sha256": "645f032d84f3bc13c3061046b36f2339c5b9e716f498d8e8dad4ca82560938e1"
      },
      "image": "images/tile-17.jpg"
    },
    {
      "id": "tile-18",
      "name": "대교",
      "named": true,
      "displayName": "대교",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": "대교",
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            },
            {
              "kind": "spawn",
              "markerId": "purple",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "top",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "N",
          "spaceId": "top"
        },
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [
        "이 타일의 칸 중 적이 있는 칸에서는 사냥꾼이 이동해 나갈 수 없습니다."
      ],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142031.jpg",
        "sortPosition": 18,
        "sha256": "2d88dfd840450fecd24dc320f8d40a0aca5a81197e57da2c9ca355d545449456"
      },
      "image": "images/tile-18.jpg"
    },
    {
      "id": "tile-19",
      "name": "오에돈의 지하묘지",
      "named": true,
      "displayName": "오에돈의 지하묘지",
      "spaces": [
        {
          "id": "top",
          "label": "위 칸",
          "placeName": "오에돈의 지하묘지",
          "icons": [
            {
              "kind": "consumable",
              "count": 1
            }
          ]
        },
        {
          "id": "bottom",
          "label": "아래 칸",
          "placeName": null,
          "icons": [
            {
              "kind": "lamp",
              "count": 1
            }
          ]
        }
      ],
      "adjacency": [
        [
          "top",
          "bottom"
        ]
      ],
      "exits": [
        {
          "edge": "S",
          "spaceId": "bottom"
        }
      ],
      "rules": [
        "무작위로 1장을 뽑는 대신, [소모품] 3장을 뽑아 그중 1장을 선택합니다. 나머지는 덱에 다시 섞어넣습니다."
      ],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142036.jpg",
        "sortPosition": 19,
        "sha256": "5ea0bfd83fbeef6160c386b651d0583c5bd2a4efc6142a7eb4f83a318a029b4c"
      },
      "image": "images/tile-19.jpg"
    },
    {
      "id": "tile-20",
      "name": "이오세프카의 진료소",
      "named": true,
      "displayName": "이오세프카의 진료소",
      "spaces": [
        {
          "id": "room",
          "label": "위쪽 실내 칸",
          "placeName": "이오세프카의 진료소",
          "icons": [
            {
              "kind": "lamp",
              "count": 1
            }
          ]
        },
        {
          "id": "entry",
          "label": "아래쪽 입구 칸",
          "placeName": null,
          "icons": []
        }
      ],
      "adjacency": [
        [
          "room",
          "entry"
        ]
      ],
      "exits": [
        {
          "edge": "S",
          "spaceId": "entry"
        }
      ],
      "rules": [
        "자기 차례마다 한 번씩, 사냥꾼은 1 [피해]를 받으면서 카드 1장을 뽑을 수 있습니다."
      ],
      "readStatus": "visually_transcribed",
      "openQuestions": [],
      "source": {
        "archive": "20261011_142042.zip",
        "filename": "20261011_142042.jpg",
        "sortPosition": 20,
        "sha256": "fcf9de4a4ec17be67952ac1bbfa53fd6a698f42ba68e41ffd5f687030f8c71c8"
      },
      "image": "images/tile-20.jpg"
    }
  ],
  "tileTranscriptionPolicy": {
    "receivedOn": "2026-10-11",
    "status": "reference_graph_not_connected_to_game",
    "orientation": "방향 N/E/S/W는 사진의 위/오른쪽/아래/왼쪽 기준이다. 지도 배치 시 회전하면 출입구 방향도 함께 회전해야 한다.",
    "spaces": "흰 회색 경계선으로 나뉜 칸을 기록했다. 칸 식별자와 설명은 개발용이며 공식 지명은 placeName에만 있다.",
    "namedLocation": "특정 타일과 그 타일의 명칭이 적힌 한 칸은 다르다. named=true는 이름이 적힌 칸이 포함되어 있다는 뜻이다.",
    "scope": "20개 사진의 칸·인접·출입구·기호·문구를 전사했다. 아직 게임 내 이동·타일 회전·공개·효과 실행에 연결하지 않았다.",
    "yardLamp": "마당 등불은 제공된 실물 사진에 보이는 왼쪽·오른쪽·아래쪽 출입구 3개를 기록했다. 위쪽 출입구가 있는 규칙서 예시 그림을 실물 사진에 덧붙이지 않았다.",
    "sourceCount": 20,
    "namedTileCount": 13,
    "unnamedTileCount": 7
  },
  "spawnMarkers": [
    {
      "id": "gold",
      "slot": 1,
      "label": "금색 둥근 야수 머리 기호",
      "activationOrder": 1
    },
    {
      "id": "red",
      "slot": 2,
      "label": "붉은 갈색 세로 기호",
      "activationOrder": 2,
      "legacyText": "[갈색 출현 기호]"
    },
    {
      "id": "purple",
      "slot": 3,
      "label": "보라색 손 모양 기호",
      "activationOrder": 3,
      "legacyText": "[보라색 손 모양 출현 기호]"
    }
  ],
  "chapterSetupRules": {
    "verifiedOn": "2026-10-11",
    "source": "블러드본한국어규칙서_압축(2).pdf",
    "automated": false,
    "runtimeStatus": "chapter1_setup_map_combat",
    "rules": [
      {
        "id": "enemy-types",
        "pages": [
          10
        ],
        "text": "챕터 준비 카드에 지정된 적 3종을 사용한다. 특수 준비 지시를 먼저 확인한다."
      },
      {
        "id": "enemy-sides",
        "pages": [
          10,
          25
        ],
        "text": "매 챕터 준비 때 각 적 카드의 사용할 면을 무작위로 정한다. 같은 종류의 적 피규어는 그 챕터에서 선택된 한 면을 공유한다. 이전 챕터와 같은 결과가 나올 수도 있다."
      },
      {
        "id": "enemy-slots",
        "pages": [
          9,
          10,
          15,
          16,
          25
        ],
        "text": "적 카드 3장을 섞어 사냥 보드의 슬롯 1·2·3에 무작위로 배치한다. 해당 슬롯의 기호가 출현시킬 적 종류를 결정하며 슬롯 순서는 적 활성화 순서에도 적용된다."
      },
      {
        "id": "stable-within-chapter",
        "pages": [
          24
        ],
        "text": "사냥 트랙에 따른 지도 초기화는 적 제거·재출현과 소모품 보충 등을 처리한다. 적 카드의 면과 슬롯 배치를 다시 추첨하지 않는다. 별도 시나리오 지시가 있으면 그 지시를 따른다."
      },
      {
        "id": "spawn",
        "pages": [
          15
        ],
        "text": "타일 공개 시 각 적 출현 기호에 현재 그 슬롯에 배정된 적을 하나씩 놓는다. 등불 기호는 일반 적 출현 기호가 아니다."
      },
      {
        "id": "figure-supply",
        "pages": [
          15
        ],
        "text": "출현할 적 피규어가 모두 사용 중이면 모든 사냥꾼으로부터 가장 먼 해당 적 피규어를 가져와 사용한다. 각 종류의 피규어 공급량은 사용자 확인에 따라 4개다."
      },
      {
        "id": "tiles",
        "pages": [
          10
        ],
        "text": "중앙 등불은 시작 타일로 별도 배치한다. 지정된 타일과 사용하지 않는 타일 중에서 뽑은 무작위 타일을 섞어 타일 더미를 만든다. 무작위 후보에는 명칭이 있는 타일도 포함된다."
      }
    ],
    "codeAudit": [
      {
        "file": "data.js",
        "symbol": "data.spawns / data.enemies",
        "finding": "훈련 적 2종의 종류·출현 위치·활성화 순서·공격·능력이 고정되어 있다."
      },
      {
        "file": "engine.js",
        "symbol": "freshEnemies / resetMap",
        "finding": "고정된 훈련 출현 목록을 복사한다. 기호와 적 종류의 챕터별 대응표는 없다."
      },
      {
        "file": "engine.js",
        "symbol": "reveal",
        "finding": "기본·특수·전용 행동 카드는 무작위 덱에서 뽑지만 해당 적 카드의 앞뒤 면을 선택하는 기능은 없다."
      },
      {
        "file": "campaign.js",
        "symbol": "window.BBLongHunt",
        "finding": "캠페인과 실제 적 양면·타일은 읽기 전용 자료이며 훈련 엔진에 연결되지 않았다."
      }
    ],
    "implementationRequirements": [
      "챕터 시작 시 한 번 생성한 적 ID·선택 면·슬롯·출현 기호·활성화 순서를 챕터 상태에 저장한다.",
      "저장 불러오기·타일 공개·전투·지도 초기화에서는 저장된 배정을 유지한다.",
      "새 챕터의 준비 절차에서만 특수 규칙을 적용하고 새 배정과 타일 더미를 생성한다.",
      "기나긴 사냥 챕터 2·3은 17번 특수 준비 카드의 고정 배치와 추가 무작위 타일 조건을 먼저 적용한다.",
      "실제 적 양면의 모든 예외 능력, 피규어 공급 재사용, 타일 이동과 시나리오 출현을 같은 상태에 연결한다."
    ],
    "chapter1SetupAutomated": true,
    "runtimeEntry": "hunt.html",
    "scopeNote": "챕터 1 준비·탐험·카드 비용·추격·활성화·적 3종 양면 전투를 연결했습니다. 임무·보상·보스·챕터 2~3 준비는 미연결입니다. automated=false는 전체 캠페인 자동화가 완료되지 않았음을 뜻합니다.",
    "codeAuditVersion": "v0.2.4 (historical audit)"
  },
  "componentCatalogue": "../../components/cards.json",
  "temporaryFirearmPolicy": {
    "source": "사용자 지시 2026-10-11 16:36 KST",
    "rule": "모든 추가 화기는 테스트 중 야수 사냥의 단총과 같은 능력·소진·준비 조건을 적용",
    "names": [
      "루드비히의 장총",
      "교단의 연발총",
      "화염방사기"
    ],
    "official": false
  },
  "runtime": {
    "version": "0.5.0",
    "entry": "hunt.html",
    "chapter": 1,
    "setup": "automated",
    "map": "playable",
    "enemyCombat": "six_faces_connected_solo",
    "missions": "not_connected",
    "turnsAndPursuit": "automated",
    "upgrades": "20_kinds_60_cards",
    "tileEffects": "partial_see_hunt_scope",
    "previewEntry": "chapter.html"
  }
};
