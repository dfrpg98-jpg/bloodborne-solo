(function (root) {
  "use strict";
  const source = {
  "schemaVersion": 1,
  "sourceAudit": {
    "sourceDirectory": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기",
    "photoCount": 28,
    "weaponCount": 14,
    "method": "사용자가 제공한 한국어 장치무기 양면 시트 원본 JPG 28장을 직접 판독하여 전사. 공격 슬롯은 실제 1~3개를 그대로 보존.",
    "note": "사진 아랫줄은 반대 면 요약이며 현재 면 효과에 중복 적용하지 않습니다. 사진 원본은 배포 폴더에 복제하지 않았고 경로·SHA-256·수정 시각으로 출처를 보존합니다.",
    "defaultFirearmSource": {
      "filename": "화기 관련 정보.txt",
      "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\화기\\화기 관련 정보.txt",
      "sha256": "403caa540af80bcf885208158ae88d0657a3aa4e802dc6b40d543ec2e8e156c6",
      "lastModified": "2026-10-11T14:48:43.160Z",
      "text": "1. 장치무기 별 기본화기\n칼날 지팡이 - 대포\n이질적인 루드비히의 성검, 말뚝박이 - 교단의 연발총\n루드비히의 성검 - 에블린\n나머지 장치무기 - 야수 사냥의 단총\n\n2. 화기카드 종류 및 개수 (기본화기 제외)\n에블린(3장), 대포(3장), 교단의 연발총(3장), 로즈마리누스(1장), 화염방사기(2장), 루드비히의 장총(1장), 야수 사냥의 산탄총(1장)\n\n"
    }
  },
  "weapons": [
    {
      "id": "threaded-cane",
      "name": "칼날 지팡이",
      "defaultFirearm": "cannon",
      "source": [
        {
          "filename": "20261011_235247.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235247.jpg",
          "sha256": "50ed3abad6ec02a87c00a37f56076933fd848c95c1c87ac623d472535ee58fbe",
          "lastModified": "2026-10-10T23:34:26.000Z"
        },
        {
          "filename": "20261011_235252.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235252.jpg",
          "sha256": "92df4d11fc782718ad0553c9bd12731d31d0f99e0f57d8a85490dcc8258698b1",
          "lastModified": "2026-10-10T23:34:26.000Z"
        }
      ],
      "faces": [
        {
          "id": "A",
          "name": "채찍 형태",
          "text": "회피할 때: 1칸 내에 있는 모든 적에게 1피해를 줍니다.",
          "effect": {
            "code": "dodge_damage_all_within_one",
            "parameters": {
              "range": 1,
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 휘두르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "후려치기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "후려치기",
              "speed": 2,
              "damage": 2
            }
          ],
          "oppositeFaceSummary": {
            "text": "동일한 속도를 갖는 적의 공격도 방해 가능합니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235247.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235247.jpg",
            "sha256": "50ed3abad6ec02a87c00a37f56076933fd848c95c1c87ac623d472535ee58fbe",
            "lastModified": "2026-10-10T23:34:26.000Z"
          }
        },
        {
          "id": "B",
          "name": "지팡이 형태",
          "text": "동일한 속도를 갖는 적의 공격도 방해 가능합니다.",
          "effect": {
            "code": "stagger_equal_speed",
            "parameters": {}
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "급소 찌르기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "회피할 때: 1칸 내에 있는 모든 적에게 1피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235252.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235252.jpg",
            "sha256": "92df4d11fc782718ad0553c9bd12731d31d0f99e0f57d8a85490dcc8258698b1",
            "lastModified": "2026-10-10T23:34:26.000Z"
          }
        }
      ]
    },
    {
      "id": "hunter-axe",
      "name": "야수 사냥의 도끼",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235259.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235259.jpg",
          "sha256": "200c1e481fca1dc918df667b83aad344018e72accb50785c312148fcdee649f0",
          "lastModified": "2026-10-10T23:34:26.000Z"
        },
        {
          "filename": "20261011_235305.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235305.jpg",
          "sha256": "26cd40f10723fcddc6da6c28a4349ad4efefa2cc6ab78352fa518951cb69020b",
          "lastModified": "2026-10-10T23:34:26.000Z"
        }
      ],
      "faces": [
        {
          "id": "A",
          "name": "짧은 도끼 형태",
          "text": "리게인 공격 후: 당신이 준 피해만큼 치유합니다.",
          "effect": {
            "code": "regain_heal_damage_dealt",
            "parameters": {
              "slot": 2
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "리게인 공격",
              "speed": 2,
              "damage": 2,
              "code": "regain"
            }
          ],
          "oppositeFaceSummary": {
            "text": "적을 처치할 때: 1칸 내에 있는 적 하나에게 2피해를 줍니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235259.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235259.jpg",
            "sha256": "200c1e481fca1dc918df667b83aad344018e72accb50785c312148fcdee649f0",
            "lastModified": "2026-10-10T23:34:26.000Z"
          }
        },
        {
          "id": "B",
          "name": "긴 도끼 형태",
          "text": "적을 처치할 때: 1칸 내에 있는 적 하나에게 2피해를 줍니다.",
          "effect": {
            "code": "kill_damage_one_within_one",
            "parameters": {
              "range": 1,
              "damage": 2
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "휘두르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "강력한 찍기",
              "speed": 1,
              "damage": 3
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "강력한 찍기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "리게인 공격 후: 당신이 준 피해만큼 치유합니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235305.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235305.jpg",
            "sha256": "26cd40f10723fcddc6da6c28a4349ad4efefa2cc6ab78352fa518951cb69020b",
            "lastModified": "2026-10-10T23:34:26.000Z"
          }
        }
      ]
    },
    {
      "id": "rifle-spear",
      "name": "총창",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235310.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235310.jpg",
          "sha256": "249b6ab881db0a001188024327365caaffb64dd5b72e7d05a6063ff2b77868e6",
          "lastModified": "2026-10-10T23:34:22.000Z"
        },
        {
          "filename": "20261011_235321.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235321.jpg",
          "sha256": "78787c0506b1fe342ecaa237fcd281a0d0611677bfb2a9949bed3a75209c5e29",
          "lastModified": "2026-10-10T23:34:22.000Z"
        }
      ],
      "faces": [
        {
          "id": "A",
          "name": "일자 창 형태",
          "text": "적이 이동해 들어올 때: 슬롯 하나에 카드 1장을 뒷면으로 놓으면서 그 적에게 2피해를 줍니다.",
          "effect": {
            "code": "enemy_entry_place_card_damage_two",
            "parameters": {
              "damage": 2
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "찌르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "찌르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "찌르기",
              "speed": 2,
              "damage": 2
            }
          ],
          "oppositeFaceSummary": {
            "text": "이번 라운드에 수행한 이동 행동마다 +1피해를 줍니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235310.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235310.jpg",
            "sha256": "249b6ab881db0a001188024327365caaffb64dd5b72e7d05a6063ff2b77868e6",
            "lastModified": "2026-10-10T23:34:22.000Z"
          }
        },
        {
          "id": "B",
          "name": "날이 펼쳐진 형태",
          "text": "이번 라운드에 수행한 이동 행동마다 +1피해를 줍니다.",
          "effect": {
            "code": "damage_per_move_action_this_round",
            "parameters": {
              "damagePerAction": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "꿰뚫기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "적이 이동해 들어올 때: 슬롯 하나에 카드 1장을 뒷면으로 놓으면서 그 적에게 2피해를 줍니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235321.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235321.jpg",
            "sha256": "78787c0506b1fe342ecaa237fcd281a0d0611677bfb2a9949bed3a75209c5e29",
            "lastModified": "2026-10-10T23:34:22.000Z"
          }
        }
      ]
    },
    {
      "id": "saw-spear",
      "name": "톱 단창",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235327.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235327.jpg",
          "sha256": "4becf238b9ae7382699a87054ba7bb9085fd231f5bd376471ffdfec9dfea4f40",
          "lastModified": "2026-10-10T23:34:22.000Z"
        },
        {
          "filename": "20261011_235331.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235331.jpg",
          "sha256": "8a49c421f6954b19ed6d49b92c528887ae554f3b369371da40e9189f544d98b3",
          "lastModified": "2026-10-10T23:34:20.000Z"
        }
      ],
      "faces": [
        {
          "id": "A",
          "name": "짧은 형태",
          "text": "적을 처치할 때: 카드 1장을 뽑고 치유 1을 합니다.",
          "effect": {
            "code": "kill_draw_one_heal_one",
            "parameters": {
              "draw": 1,
              "heal": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "강력한 후리기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "방해 효과를 적용하는 공격은 +1피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235327.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235327.jpg",
            "sha256": "4becf238b9ae7382699a87054ba7bb9085fd231f5bd376471ffdfec9dfea4f40",
            "lastModified": "2026-10-10T23:34:22.000Z"
          }
        },
        {
          "id": "B",
          "name": "긴 형태",
          "text": "방해 효과를 적용하는 공격은 +1피해를 줍니다.",
          "effect": {
            "code": "stagger_attack_damage_one",
            "parameters": {
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            }
          ],
          "oppositeFaceSummary": {
            "text": "적을 처치할 때: 카드 1장을 뽑고 치유 1을 합니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235331.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235331.jpg",
            "sha256": "8a49c421f6954b19ed6d49b92c528887ae554f3b369371da40e9189f544d98b3",
            "lastModified": "2026-10-10T23:34:20.000Z"
          }
        }
      ]
    },
    {
      "id": "uncanny-ludwigs-holy-blade",
      "name": "이질적인 루드비히의 성검",
      "defaultFirearm": "repeating-pistol",
      "source": [
        {
          "filename": "20261011_235336.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235336.jpg",
          "sha256": "61f3f1d9b02249f83d93673b966068b139b4415165bc00a6168cb2a63c2a1985",
          "lastModified": "2026-10-10T23:34:22.000Z"
        },
        {
          "filename": "20261011_235343.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235343.jpg",
          "sha256": "af6e08d96f0dbfaa8543455047d43191a1e5566aad027a73f28c24f08f5cecd9",
          "lastModified": "2026-10-10T23:34:20.000Z"
        }
      ],
      "faces": [
        {
          "id": "A",
          "name": "소검 형태",
          "text": "슬롯을 비울 때마다, 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
          "effect": {
            "code": "clear_slot_damage_one_same_space",
            "parameters": {
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속 찌르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "신속 찌르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "강력한 가르기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "콤보 공격으로 공격한 후: 무료로 무기 변형을 할 수 있습니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235336.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235336.jpg",
            "sha256": "61f3f1d9b02249f83d93673b966068b139b4415165bc00a6168cb2a63c2a1985",
            "lastModified": "2026-10-10T23:34:22.000Z"
          }
        },
        {
          "id": "B",
          "name": "대검 형태",
          "text": "콤보 공격으로 공격한 후: 무료로 무기 변형을 할 수 있습니다.",
          "effect": {
            "code": "combo_after_attack_free_transform",
            "parameters": {
              "slot": 0
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "콤보 공격",
              "speed": 2,
              "damage": 2,
              "code": "combo_free_transform"
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "모아 찌르기",
              "speed": 2,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "슬롯을 비울 때마다, 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235343.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235343.jpg",
            "sha256": "af6e08d96f0dbfaa8543455047d43191a1e5566aad027a73f28c24f08f5cecd9",
            "lastModified": "2026-10-10T23:34:20.000Z"
          }
        }
      ]
    },
    {
      "id": "tonitrus",
      "name": "토니트루스",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235349.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235349.jpg",
          "sha256": "9645aafdea65ad7ebe7225d09561df96f39add34bb809baff99e6c17dddf3794",
          "lastModified": "2026-10-10T23:34:20.000Z"
        },
        {
          "filename": "20261011_235355.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235355.jpg",
          "sha256": "0e2eb0eac60b9b0e82d69855abf90e06bf28eb09193d001d50e56d377cd07d98",
          "lastModified": "2026-10-10T23:34:20.000Z"
        }
      ],
      "faces": [
        {
          "id": "A",
          "name": "전기 꺼진 형태",
          "text": "변형이 끝난 후: 이번 라운드의 다음 공격은 +1속도와 +1피해를 획득합니다.",
          "effect": {
            "code": "transform_next_attack_speed_damage_one",
            "parameters": {
              "speed": 1,
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "후리기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "후리기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "묵직한 찍기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "변형이 끝난 후: 이번 라운드의 다음 공격은 +1속도와 +1피해를 획득합니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235349.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235349.jpg",
            "sha256": "9645aafdea65ad7ebe7225d09561df96f39add34bb809baff99e6c17dddf3794",
            "lastModified": "2026-10-10T23:34:20.000Z"
          }
        },
        {
          "id": "B",
          "name": "전기 켜진 형태",
          "text": "변형이 끝난 후: 이번 라운드의 다음 공격은 +1속도와 +1피해를 획득합니다.",
          "effect": {
            "code": "transform_next_attack_speed_damage_one",
            "parameters": {
              "speed": 1,
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "후리기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "후리기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "묵직한 찍기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "변형이 끝난 후: 이번 라운드의 다음 공격은 +1속도와 +1피해를 획득합니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235355.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235355.jpg",
            "sha256": "0e2eb0eac60b9b0e82d69855abf90e06bf28eb09193d001d50e56d377cd07d98",
            "lastModified": "2026-10-10T23:34:20.000Z"
          }
        }
      ]
    },
    {
      "id": "blade-of-mercy",
      "name": "자비의 칼날",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235402.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235402.jpg",
          "sha256": "71d61c77b6e07eadf9cbeadd1a36405c642056f292eee0cacfc2d80a6d73f589",
          "lastModified": "2026-10-10T23:34:18.000Z"
        },
        {
          "filename": "20261011_235408.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235408.jpg",
          "sha256": "955b44c955e70a54fb42a4feb13f389cd4933576834deb0dc32a7f2800071ab9",
          "lastModified": "2026-10-10T23:34:16.000Z"
        }
      ],
      "faces": [
        {
          "id": "A",
          "name": "합쳐진 형태",
          "text": "동일한 속도를 갖는 적의 공격도 방해 가능합니다.",
          "effect": {
            "code": "stagger_equal_speed",
            "parameters": {}
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "강력한 가르기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "마무리 콤보는 채워진 공격 슬롯마다 +1피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 3,
                "damage": 1
              }
            ]
          },
          "source": {
            "filename": "20261011_235402.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235402.jpg",
            "sha256": "71d61c77b6e07eadf9cbeadd1a36405c642056f292eee0cacfc2d80a6d73f589",
            "lastModified": "2026-10-10T23:34:18.000Z"
          }
        },
        {
          "id": "B",
          "name": "쌍검 형태",
          "text": "마무리 콤보는 채워진 공격 슬롯마다 +1피해를 줍니다.",
          "effect": {
            "code": "finishing_combo_damage_per_filled_slot",
            "parameters": {
              "slot": 2,
              "damagePerSlot": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "마무리 콤보",
              "speed": 3,
              "damage": 1,
              "code": "finishing_combo"
            }
          ],
          "oppositeFaceSummary": {
            "text": "동일한 속도를 갖는 적의 공격도 방해 가능합니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235408.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235408.jpg",
            "sha256": "955b44c955e70a54fb42a4feb13f389cd4933576834deb0dc32a7f2800071ab9",
            "lastModified": "2026-10-10T23:34:16.000Z"
          }
        }
      ]
    },
    {
      "id": "ludwigs-holy-blade",
      "name": "루드비히의 성검",
      "defaultFirearm": "evelyn",
      "source": [
        {
          "filename": "20261011_235414.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235414.jpg",
          "sha256": "373d74fcb0cc6a07220521d0d369ed491a9b359f8a9a5f0c9deb83af3cae7168",
          "lastModified": "2026-10-10T23:34:16.000Z"
        },
        {
          "filename": "20261011_235419.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235419.jpg",
          "sha256": "e023a444ef0a71dce837e012cf0ed03774120c05a54d3f27dd62ec6be98a30ba",
          "lastModified": "2026-10-10T23:34:16.000Z"
        }
      ],
      "faces": [
        {
          "id": "greatsword",
          "name": "대검 형태",
          "text": "다단 가르기로 공격한 후: 무료로 무기 변형을 할 수 있습니다.",
          "effect": {
            "code": "combo_after_attack_free_transform",
            "parameters": {
              "slot": 0
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "다단 가르기",
              "speed": 2,
              "damage": 2,
              "code": "combo_free_transform"
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "내려찍기",
              "speed": 1,
              "damage": 4
            }
          ],
          "oppositeFaceSummary": {
            "text": "슬롯을 비울 때마다, 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235414.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235414.jpg",
            "sha256": "373d74fcb0cc6a07220521d0d369ed491a9b359f8a9a5f0c9deb83af3cae7168",
            "lastModified": "2026-10-10T23:34:16.000Z"
          }
        },
        {
          "id": "sword",
          "name": "소검 형태",
          "text": "슬롯을 비울 때마다, 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
          "effect": {
            "code": "clear_slot_damage_one_same_space",
            "parameters": {
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 찌르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            }
          ],
          "oppositeFaceSummary": {
            "text": "다단 가르기로 공격한 후: 무료로 무기 변형을 할 수 있습니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 4
              }
            ]
          },
          "source": {
            "filename": "20261011_235419.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235419.jpg",
            "sha256": "e023a444ef0a71dce837e012cf0ed03774120c05a54d3f27dd62ec6be98a30ba",
            "lastModified": "2026-10-10T23:34:16.000Z"
          }
        }
      ]
    },
    {
      "id": "logarius-wheel",
      "name": "로가리우스의 바퀴",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235424.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235424.jpg",
          "sha256": "a33d5ffa52bb61b17dd63de85c1935973e6248880698a0346f786bdc8aca7d08",
          "lastModified": "2026-10-10T23:34:16.000Z"
        },
        {
          "filename": "20261011_235431.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235431.jpg",
          "sha256": "b898e945b2ec1907e082ffbc8dd25383593d072fb4efac2f0c802b7958e86c01",
          "lastModified": "2026-10-10T23:34:16.000Z"
        }
      ],
      "faces": [
        {
          "id": "wheel",
          "name": "바퀴 형태",
          "text": "공격할 때: 치유 1을 합니다.",
          "effect": {
            "code": "attack_heal",
            "parameters": {
              "heal": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "후려치기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "내려찍기",
              "speed": 1,
              "damage": 3
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "내려찍기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "공격할 때: 피해를 최대 2까지 받으면서, 그만큼 추가로 피해를 줄 수 있습니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235424.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235424.jpg",
            "sha256": "a33d5ffa52bb61b17dd63de85c1935973e6248880698a0346f786bdc8aca7d08",
            "lastModified": "2026-10-10T23:34:16.000Z"
          }
        },
        {
          "id": "empowered-wheel",
          "name": "강화 바퀴 형태",
          "text": "공격할 때: 피해를 최대 2까지 받으면서, 그만큼 추가로 피해를 줄 수 있습니다.",
          "effect": {
            "code": "attack_sacrifice_damage",
            "parameters": {
              "maxSelfDamage": 2,
              "damagePerSelfDamage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "강화 후려치기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "강화 내려찍기",
              "speed": 1,
              "damage": 3
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "강화 내려찍기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "공격할 때: 치유 1",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235431.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235431.jpg",
            "sha256": "b898e945b2ec1907e082ffbc8dd25383593d072fb4efac2f0c802b7958e86c01",
            "lastModified": "2026-10-10T23:34:16.000Z"
          }
        }
      ]
    },
    {
      "id": "kirkhammer",
      "name": "교단의 돌망치",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235436.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235436.jpg",
          "sha256": "030b1a0e013ac10b9d92048019a29a6d8588098a04f49c4c25d0fddd834ec7c9",
          "lastModified": "2026-10-10T23:34:16.000Z"
        },
        {
          "filename": "20261011_235442.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235442.jpg",
          "sha256": "4d4e616b303306e6a1008ad9da94f1c7162cada997e742d06c35cab52506c0f4",
          "lastModified": "2026-10-10T23:34:16.000Z"
        }
      ],
      "faces": [
        {
          "id": "sword",
          "name": "소검 형태",
          "text": "슬롯을 비울 때마다, 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
          "effect": {
            "code": "clear_slot_damage_one_same_space",
            "parameters": {
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속 찌르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            }
          ],
          "oppositeFaceSummary": {
            "text": "파괴적인 내려찍기로 공격할 때: 방해받을 수 없지만, 회피할 수도 없습니다.",
            "slots": [
              {
                "speed": 1,
                "damage": 3
              },
              {
                "speed": 1,
                "damage": 4
              }
            ]
          },
          "source": {
            "filename": "20261011_235436.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235436.jpg",
            "sha256": "030b1a0e013ac10b9d92048019a29a6d8588098a04f49c4c25d0fddd834ec7c9",
            "lastModified": "2026-10-10T23:34:16.000Z"
          }
        },
        {
          "id": "hammer",
          "name": "돌망치 형태",
          "text": "파괴적인 내려찍기로 공격할 때: 방해받을 수 없지만, 회피할 수도 없습니다.",
          "effect": {
            "code": "destructive_attack_no_interrupt_or_dodge",
            "parameters": {
              "slot": 1,
              "uninterruptible": true,
              "noDodge": true
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "묵직한 휘두르기",
              "speed": 1,
              "damage": 3
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "파괴적인 내려찍기",
              "speed": 1,
              "damage": 4,
              "code": "destructive_no_interrupt_or_dodge"
            }
          ],
          "oppositeFaceSummary": {
            "text": "슬롯을 비울 때마다, 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235442.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235442.jpg",
            "sha256": "4d4e616b303306e6a1008ad9da94f1c7162cada997e742d06c35cab52506c0f4",
            "lastModified": "2026-10-10T23:34:16.000Z"
          }
        }
      ]
    },
    {
      "id": "stake-driver",
      "name": "말뚝박이",
      "defaultFirearm": "repeating-pistol",
      "source": [
        {
          "filename": "20261011_235447.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235447.jpg",
          "sha256": "dc7da33af9689d0c1129254883bfec2aaac080f9991e1cc2167d469d7015b448",
          "lastModified": "2026-10-10T23:34:12.000Z"
        },
        {
          "filename": "20261011_235453.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235453.jpg",
          "sha256": "f50444544f8d42aad0e924a2c6e11a7321b693ba491eee95d5083a0a3692ab38",
          "lastModified": "2026-10-10T23:34:12.000Z"
        }
      ],
      "faces": [
        {
          "id": "loading",
          "name": "장전 형태",
          "text": "장전용 가르기로 공격한 후: 무료로 무기 변형을 할 수 있습니다.",
          "effect": {
            "code": "combo_after_attack_free_transform",
            "parameters": {
              "slot": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "찌르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "장전용 가르기",
              "speed": 2,
              "damage": 2,
              "code": "combo_free_transform"
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "관통",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "공격 후: 1칸 이내에 있는 모든 적을 최대 2칸 멀리 이동시킵니다.",
            "slots": [
              {
                "speed": 1,
                "damage": 4
              }
            ]
          },
          "source": {
            "filename": "20261011_235447.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235447.jpg",
            "sha256": "dc7da33af9689d0c1129254883bfec2aaac080f9991e1cc2167d469d7015b448",
            "lastModified": "2026-10-10T23:34:12.000Z"
          }
        },
        {
          "id": "charged",
          "name": "폭파 형태",
          "text": "공격 후: 1칸 이내에 있는 모든 적을 최대 2칸 멀리 이동시킵니다.",
          "effect": {
            "code": "after_attack_push_all_within_one",
            "parameters": {
              "range": 1,
              "maxDistance": 2
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "폭파",
              "speed": 1,
              "damage": 4,
              "text": "1칸 이내에 있는 다른 모든 적에게 2피해를 줍니다.",
              "splash": {
                "range": 1,
                "damage": 2
              }
            }
          ],
          "oppositeFaceSummary": {
            "text": "장전용 가르기로 공격한 후: 무료로 무기 변형을 할 수 있습니다.",
            "slots": [
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235453.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235453.jpg",
            "sha256": "f50444544f8d42aad0e924a2c6e11a7321b693ba491eee95d5083a0a3692ab38",
            "lastModified": "2026-10-10T23:34:12.000Z"
          }
        }
      ]
    },
    {
      "id": "chikage",
      "name": "치카게",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235459.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235459.jpg",
          "sha256": "ec0ebb40494730a4f80b34311bcb115bbe6683aab64b891704bd293aa62602f7",
          "lastModified": "2026-10-10T23:34:10.000Z"
        },
        {
          "filename": "20261011_235504.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235504.jpg",
          "sha256": "85a76ab6213ffc7b6e2d88cd3452ee691c785dca594d5d25d6218e5d1e3be215",
          "lastModified": "2026-10-10T23:34:10.000Z"
        }
      ],
      "faces": [
        {
          "id": "blood-blade",
          "name": "혈검 형태",
          "text": "공격할 때: 1피해를 받으면서 +1속도 또는 +1피해를 획득할 수 있습니다.",
          "effect": {
            "code": "attack_sacrifice_speed_or_damage",
            "parameters": {
              "selfDamage": 1,
              "speed": 1,
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            }
          ],
          "oppositeFaceSummary": {
            "text": "회피할 때: 치유 1을 하고 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235459.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235459.jpg",
            "sha256": "ec0ebb40494730a4f80b34311bcb115bbe6683aab64b891704bd293aa62602f7",
            "lastModified": "2026-10-10T23:34:10.000Z"
          }
        },
        {
          "id": "katana",
          "name": "도검 형태",
          "text": "회피할 때: 치유 1을 하고 당신이 위치한 칸에 있는 적 하나에게 1피해를 줍니다.",
          "effect": {
            "code": "dodge_heal_damage_one_same_space",
            "parameters": {
              "heal": 1,
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 베기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            }
          ],
          "oppositeFaceSummary": {
            "text": "공격할 때: 1피해를 받으면서 +1속도 또는 +1피해를 획득할 수 있습니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 2,
                "damage": 2
              }
            ]
          },
          "source": {
            "filename": "20261011_235504.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235504.jpg",
            "sha256": "85a76ab6213ffc7b6e2d88cd3452ee691c785dca594d5d25d6218e5d1e3be215",
            "lastModified": "2026-10-10T23:34:10.000Z"
          }
        }
      ]
    },
    {
      "id": "beast-claw",
      "name": "야수의 발톱",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235510.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235510.jpg",
          "sha256": "ed1484c264d2bde8e36b0d5e584a74187fbe6384c4149559e833906c2a942fad",
          "lastModified": "2026-10-10T23:34:10.000Z"
        },
        {
          "filename": "20261011_235516.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235516.jpg",
          "sha256": "55d0a31234ddce3c7cc5e194593432932ed5da516e277326d607332d120921dd",
          "lastModified": "2026-10-10T23:34:10.000Z"
        }
      ],
      "faces": [
        {
          "id": "frenzy",
          "name": "발톱 형태",
          "text": "공격할 때: 당신의 체력이 3 이하라면, 공격은 +1속도와 +1피해를 획득합니다.",
          "effect": {
            "code": "low_health_speed_damage",
            "parameters": {
              "maxHp": 3,
              "speed": 1,
              "damage": 1
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 가르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "광란의 베기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "처치할 때: 치유 2와 이동 2칸",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235510.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235510.jpg",
            "sha256": "ed1484c264d2bde8e36b0d5e584a74187fbe6384c4149559e833906c2a942fad",
            "lastModified": "2026-10-10T23:34:10.000Z"
          }
        },
        {
          "id": "kill-and-move",
          "name": "변형 발톱 형태",
          "text": "처치할 때: 치유 2와 이동 2칸",
          "effect": {
            "code": "kill_heal_and_move",
            "parameters": {
              "heal": 2,
              "move": 2
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 가르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "긋기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "강력한 후리기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "공격할 때: 당신의 체력이 3 이하라면, 공격은 +1속도와 +1피해를 획득합니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235516.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235516.jpg",
            "sha256": "55d0a31234ddce3c7cc5e194593432932ed5da516e277326d607332d120921dd",
            "lastModified": "2026-10-10T23:34:10.000Z"
          }
        }
      ]
    },
    {
      "id": "reiterpallasch",
      "name": "레이테르팔라슈",
      "defaultFirearm": "hunter-pistol",
      "source": [
        {
          "filename": "20261011_235522.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235522.jpg",
          "sha256": "1e44bc2ee12c2f786281a5403db8cb3705873157c9572520eb7f57a1e441aa26",
          "lastModified": "2026-10-11T15:44:31.622Z"
        },
        {
          "filename": "20261011_235528.jpg",
          "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235528.jpg",
          "sha256": "3edc3bb706a48a4bc387a30da42f87a4ee8a24fa1fecc482d33a9ac86698913d",
          "lastModified": "2026-10-11T15:44:36.764Z"
        }
      ],
      "faces": [
        {
          "id": "matched-dodge",
          "name": "찌르기 형태",
          "text": "적의 공격과 같은 속도로 회피할 때, 그 적에게 2피해를 줍니다.",
          "effect": {
            "code": "dodge_matching_speed_damage",
            "parameters": {
              "damage": 2
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "신속한 찌르기",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "가르기",
              "speed": 2,
              "damage": 2
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "급소 찌르기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "수은탄 사격에 카드 1장을 뒷면으로 놓습니다: 당신이 위치한 칸의 적 하나에게 2피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235522.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235522.jpg",
            "sha256": "1e44bc2ee12c2f786281a5403db8cb3705873157c9572520eb7f57a1e441aa26",
            "lastModified": "2026-10-11T15:44:31.622Z"
          }
        },
        {
          "id": "quicksilver-shot",
          "name": "수은탄 사격 형태",
          "text": "수은탄 사격에 카드 1장을 뒷면으로 놓습니다: 당신이 위치한 칸의 적 하나에게 2피해를 줍니다.",
          "effect": {
            "code": "quicksilver_place_card_damage_same_space",
            "parameters": {
              "slot": 1,
              "damage": 2
            }
          },
          "slots": [
            {
              "id": "slot-1",
              "index": 0,
              "name": "응수",
              "speed": 3,
              "damage": 1
            },
            {
              "id": "slot-2",
              "index": 1,
              "name": "수은탄 사격",
              "speed": 2,
              "damage": 2,
              "code": "quicksilver_shot"
            },
            {
              "id": "slot-3",
              "index": 2,
              "name": "급소 찌르기",
              "speed": 1,
              "damage": 3
            }
          ],
          "oppositeFaceSummary": {
            "text": "적의 공격과 같은 속도로 회피할 때, 그 적에게 2피해를 줍니다.",
            "slots": [
              {
                "speed": 3,
                "damage": 1
              },
              {
                "speed": 2,
                "damage": 2
              },
              {
                "speed": 1,
                "damage": 3
              }
            ]
          },
          "source": {
            "filename": "20261011_235528.jpg",
            "path": "C:\\Users\\GOOD\\Desktop\\보겜프로젝트\\bloodborne-solo\\참고자료\\장치무기\\20261011_235528.jpg",
            "sha256": "3edc3bb706a48a4bc387a30da42f87a4ee8a24fa1fecc482d33a9ac86698913d",
            "lastModified": "2026-10-11T15:44:36.764Z"
          }
        }
      ]
    }
  ]
};
  if (typeof module !== "undefined" && module.exports) module.exports = source;
  else root.BBExtendedWeaponSource = source;
})(typeof globalThis !== "undefined" ? globalThis : this);
