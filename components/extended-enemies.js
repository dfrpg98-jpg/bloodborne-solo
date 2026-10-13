(function(root){
  "use strict";
  const data = {
  "schemaVersion": 1,
  "language": "ko",
  "sourceDate": "2026-10-12",
  "transcriptionPolicy": "적 사진 10장(28면)을 직접 확인하여 기존 여성 야수환자·이오세프카 2종(4면)을 제외한 추가 12종(24면)을 전사했습니다. 속도/피해 아이콘을 숫자로 기록하고 줄바꿈·일부 띄어쓰기를 정리했습니다. 일반 적 A/B는 촬영 순서이며 인원별 1–2/3+ 면은 페이즈가 아닙니다. 실제 플레이 지원 인원은 1명입니다.",
  "id": "bloodborne-extended-enemies-2026-10-12",
  "enemyCards": [
    {
      "id": "church-servant",
      "name": "교단의 종복",
      "sideRole": "random-chapter-face",
      "faces": [
        {
          "sideId": "a",
          "health": 4,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235643.jpg",
            "filename": "20261011_235643.jpg",
            "position": "left",
            "bytes": 5092894,
            "sha256": "7a91b627f6cf74e96e1d4a5bbc2a22c4e8e10377542ac18f9f30823a2160a0ab"
          },
          "basic": {
            "name": "지팡이 공격",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": []
          },
          "special": {
            "name": "비전 폭발",
            "speed": 1,
            "damage": 3,
            "keywords": [
              "기절"
            ],
            "rules": [
              "회피할 수 없습니다.",
              "이 칸에 있는 모든 사냥꾼을 대상으로 삼습니다."
            ],
            "undodgeable": true,
            "allHunters": true
          },
          "ability": {
            "name": "무시무시한 환상",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "사냥꾼은 발광에 걸립니다.",
              "이미 발광에 걸려 있다면, 그 대신 기절에 걸립니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "code": "church-servant-horrifying-illusion",
            "timing": "instant"
          }
        },
        {
          "sideId": "b",
          "health": 4,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235655.jpg",
            "filename": "20261011_235655.jpg",
            "position": "left",
            "bytes": 5150384,
            "sha256": "d1d3b6d57d48e41924dafdc748037aa144558f5b78f323ace0ad3a17c7bcd184"
          },
          "basic": {
            "name": "지팡이 공격",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": []
          },
          "special": {
            "name": "불경한 표식",
            "speed": 2,
            "damage": 3,
            "keywords": [
              "발광"
            ],
            "rules": [
              "사냥꾼이 이미 발광에 걸려 있다면 이번 공격은 +1 피해를 획득합니다."
            ],
            "code": "church-servant-unholy-mark"
          },
          "ability": {
            "name": "비전 탄막",
            "speed": null,
            "damage": 5,
            "keywords": [],
            "rules": [
              "사냥꾼은 공격을 한 후, 5 피해를 받습니다.",
              "사냥꾼은 이를 회피함으로써, 회피의 속도마다 2 피해를 방어할 수 있습니다."
            ],
            "whiteBackground": true,
            "code": "church-servant-arcane-barrage",
            "timing": "after-hunter-attack",
            "dodgeBlockPerSpeed": 2
          }
        }
      ]
    },
    {
      "id": "male-beast-patient",
      "name": "남성 야수환자",
      "sideRole": "random-chapter-face",
      "faces": [
        {
          "sideId": "a",
          "health": 3,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235643.jpg",
            "filename": "20261011_235643.jpg",
            "position": "center",
            "bytes": 5092894,
            "sha256": "7a91b627f6cf74e96e1d4a5bbc2a22c4e8e10377542ac18f9f30823a2160a0ab"
          },
          "basic": {
            "name": "발톱 휩쓸기",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": []
          },
          "special": {
            "name": "화혈병 독소",
            "speed": 2,
            "damage": 3,
            "keywords": [
              "독"
            ],
            "rules": [
              "이미 독에 걸려 있다면, 그 대신 기절에 걸리고 사냥꾼의 공격은 -2 피해를 획득합니다."
            ],
            "code": "male-patient-blood-toxin"
          },
          "ability": {
            "name": "무리지기",
            "speed": 2,
            "damage": 0,
            "keywords": [],
            "rules": [
              "속도 2로 (사냥꾼과 같은 속도라면, 사냥꾼 공격 전에), 이 칸에 남성 야수환자 하나를 출현시킵니다."
            ],
            "whiteBackground": true,
            "code": "male-patient-pack",
            "timing": "speed"
          }
        },
        {
          "sideId": "b",
          "health": 3,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235655.jpg",
            "filename": "20261011_235655.jpg",
            "position": "center",
            "bytes": 5150384,
            "sha256": "d1d3b6d57d48e41924dafdc748037aa144558f5b78f323ace0ad3a17c7bcd184"
          },
          "basic": {
            "name": "발톱 휩쓸기",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": []
          },
          "special": {
            "name": "죽음의 메아리",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "야수 환자가 방해받지 않은 채 처치되면 사냥꾼은 2 피해를 받고 독에 걸립니다."
            ],
            "code": "male-patient-death-echo"
          },
          "ability": {
            "name": "무리지기",
            "speed": 2,
            "damage": 0,
            "keywords": [],
            "rules": [
              "속도 2로 (사냥꾼과 같은 속도라면, 사냥꾼 공격 전에), 이 칸에 남성 야수환자 하나를 출현시킵니다."
            ],
            "whiteBackground": true,
            "code": "male-patient-pack",
            "timing": "speed"
          }
        }
      ]
    },
    {
      "id": "church-giant",
      "name": "교단 거인",
      "sideRole": "random-chapter-face",
      "faces": [
        {
          "sideId": "a",
          "health": 6,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235643.jpg",
            "filename": "20261011_235643.jpg",
            "position": "right",
            "bytes": 5092894,
            "sha256": "7a91b627f6cf74e96e1d4a5bbc2a22c4e8e10377542ac18f9f30823a2160a0ab"
          },
          "basic": {
            "name": "가차 없는 휘두르기",
            "speed": 1,
            "damage": 4,
            "keywords": [],
            "rules": [
              "회피했다면, 사냥꾼의 공격은 +1 피해를 줍니다."
            ],
            "afterDodgeDamageBonus": 1
          },
          "special": {
            "name": "거센 휘두르기",
            "speed": 1,
            "damage": 4,
            "keywords": [],
            "rules": [
              "방해할 수 없습니다.",
              "이 칸에 있는 모든 사냥꾼을 대상으로 삼습니다.",
              "공격당한 사냥꾼은 2칸 멀리 이동합니다."
            ],
            "uninterruptible": true,
            "allHunters": true,
            "forceHunterMove": 2
          },
          "ability": {
            "name": "멍 때리기",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "교단 거인은 공격하지 않습니다."
            ],
            "whiteBackground": true,
            "code": "church-giant-idle",
            "timing": "instant"
          }
        },
        {
          "sideId": "b",
          "health": 6,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235655.jpg",
            "filename": "20261011_235655.jpg",
            "position": "right",
            "bytes": 5150384,
            "sha256": "d1d3b6d57d48e41924dafdc748037aa144558f5b78f323ace0ad3a17c7bcd184"
          },
          "basic": {
            "name": "가차 없는 휘두르기",
            "speed": 1,
            "damage": 4,
            "keywords": [],
            "rules": [
              "회피했다면, 사냥꾼의 공격은 +1 피해를 줍니다."
            ],
            "afterDodgeDamageBonus": 1
          },
          "special": {
            "name": "처형",
            "speed": 1,
            "damage": 6,
            "keywords": [],
            "rules": [
              "방해할 수 없습니다."
            ],
            "uninterruptible": true
          },
          "ability": {
            "name": "멍 때리기",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "교단 거인은 공격하지 않습니다."
            ],
            "whiteBackground": true,
            "code": "church-giant-idle",
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "bloody-crow-cainhurst",
      "name": "카인허스트의 피투성이 까마귀",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 10,
        "2": 10,
        "3": 18,
        "4": 18
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 10,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235734.jpg",
            "filename": "20261011_235734.jpg",
            "position": "left",
            "bytes": 5319135,
            "sha256": "58d179b9569e987584f0d9181e27beeb7d6ae3134ec88146d2f2db9ab1fb9a36"
          },
          "basic": {
            "name": "치카게",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "피투성이 까마귀가 피해를 4 이상 받은 상태라면, 이 공격은 +1 속도와 +1 피해를 획득합니다."
            ],
            "code": "bloody-crow-chikage",
            "woundThreshold": 4
          },
          "special": {
            "name": "교단의 연발총",
            "speed": 3,
            "damage": 2,
            "keywords": [
              "방해"
            ],
            "rules": [
              "모든 공격을 해결한 후, 피투성이 까마귀가 치카게 공격을 한 번 가합니다."
            ],
            "code": "bloody-crow-repeating-pistol"
          },
          "ability": {
            "name": "보급 물자",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "수혈액: 피투성이 까마귀가 피해를 4 이상 받은 상태라면, 치유 3을 합니다. 그렇지 않으면:",
              "고대 사냥꾼의 유골: 사냥꾼의 공격을 회피하고 1칸 멀리 이동합니다."
            ],
            "whiteBackground": true,
            "code": "bloody-crow-supply",
            "timing": "instant",
            "woundThreshold": 4,
            "heal": 3
          }
        },
        {
          "sideId": "3+",
          "health": 18,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235746.jpg",
            "filename": "20261011_235746.jpg",
            "position": "center",
            "bytes": 5363703,
            "sha256": "dcd5d95b3070d6b7e06318f0018ba385f27a9083382a0e8b180bf94c730fc308"
          },
          "basic": {
            "name": "치카게",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "피투성이 까마귀가 피해를 10 이상 받은 상태라면, 이 공격은 +1 속도와 +1 피해를 획득합니다."
            ],
            "code": "bloody-crow-chikage",
            "woundThreshold": 10
          },
          "special": {
            "name": "교단의 연발총",
            "speed": 3,
            "damage": 2,
            "keywords": [
              "방해"
            ],
            "rules": [
              "모든 공격을 해결한 후, 피투성이 까마귀가 치카게 공격을 한 번 가합니다."
            ],
            "code": "bloody-crow-repeating-pistol"
          },
          "ability": {
            "name": "보급 물자",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "수혈액: 피투성이 까마귀가 피해를 10 이상 받은 상태라면, 치유 4를 합니다. 그렇지 않으면:",
              "고대 사냥꾼의 유골: 사냥꾼의 공격을 회피하고 1칸 멀리 이동합니다."
            ],
            "whiteBackground": true,
            "code": "bloody-crow-supply",
            "timing": "instant",
            "woundThreshold": 10,
            "heal": 4
          }
        }
      ]
    },
    {
      "id": "henryk",
      "name": "고대 사냥꾼 헨릭",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 10,
        "2": 10,
        "3": 18,
        "4": 18
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 10,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235734.jpg",
            "filename": "20261011_235734.jpg",
            "position": "center",
            "bytes": 5319135,
            "sha256": "58d179b9569e987584f0d9181e27beeb7d6ae3134ec88146d2f2db9ab1fb9a36"
          },
          "basic": {
            "name": "톱 단창",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "이 칸에 있는 다른 모든 사냥꾼들이 회피(속도 2)하지 않는다면 그들에게 피해를 1씩 줍니다."
            ],
            "collateral": {
              "dodgeSpeed": 2,
              "damage": 1
            }
          },
          "special": {
            "name": "야수 사냥의 단총",
            "speed": 3,
            "damage": 2,
            "keywords": [
              "방해"
            ],
            "rules": []
          },
          "ability": {
            "name": "독칼",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "사냥꾼은 회피(속도 3)하지 않으면, 1 피해를 받고 독에 걸립니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 3,
            "code": "henryk-poison-knife",
            "timing": "instant"
          }
        },
        {
          "sideId": "3+",
          "health": 18,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235746.jpg",
            "filename": "20261011_235746.jpg",
            "position": "left",
            "bytes": 5363703,
            "sha256": "dcd5d95b3070d6b7e06318f0018ba385f27a9083382a0e8b180bf94c730fc308"
          },
          "basic": {
            "name": "톱 단창",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "이 칸에 있는 다른 모든 사냥꾼들이 회피(속도 2)하지 않는다면 그들에게 피해를 1씩 줍니다."
            ],
            "collateral": {
              "dodgeSpeed": 2,
              "damage": 1
            }
          },
          "special": {
            "name": "야수 사냥의 단총",
            "speed": 3,
            "damage": 2,
            "keywords": [
              "방해"
            ],
            "rules": []
          },
          "ability": {
            "name": "독칼",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "사냥꾼은 회피(속도 3)하지 않으면, 1 피해를 받고 독에 걸립니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 3,
            "code": "henryk-poison-knife",
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "eileen",
      "name": "까마귀 에일린",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 10,
        "2": 10,
        "3": 18,
        "4": 18
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 10,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235734.jpg",
            "filename": "20261011_235734.jpg",
            "position": "right",
            "bytes": 5319135,
            "sha256": "58d179b9569e987584f0d9181e27beeb7d6ae3134ec88146d2f2db9ab1fb9a36"
          },
          "basic": {
            "name": "자비의 칼날",
            "speed": 3,
            "damage": 2,
            "keywords": [],
            "rules": [
              "사냥꾼의 공격보다 빠른 속도마다 +1 피해를 줍니다."
            ],
            "code": "eileen-blade-of-mercy"
          },
          "special": {
            "name": "패링",
            "speed": 3,
            "damage": 3,
            "keywords": [
              "방해",
              "기절"
            ],
            "rules": []
          },
          "ability": {
            "name": "야수 사냥의 단총",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "사냥꾼이 회피(속도 3)하지 않으면, 사냥꾼의 공격을 방해합니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 3,
            "code": "eileen-pistol",
            "timing": "instant"
          }
        },
        {
          "sideId": "3+",
          "health": 18,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235746.jpg",
            "filename": "20261011_235746.jpg",
            "position": "right",
            "bytes": 5363703,
            "sha256": "dcd5d95b3070d6b7e06318f0018ba385f27a9083382a0e8b180bf94c730fc308"
          },
          "basic": {
            "name": "자비의 칼날",
            "speed": 3,
            "damage": 2,
            "keywords": [],
            "rules": [
              "사냥꾼의 공격보다 빠른 속도마다 +1 피해를 줍니다."
            ],
            "code": "eileen-blade-of-mercy"
          },
          "special": {
            "name": "패링",
            "speed": 3,
            "damage": 3,
            "keywords": [
              "방해",
              "기절"
            ],
            "rules": []
          },
          "ability": {
            "name": "야수 사냥의 단총",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "사냥꾼이 회피(속도 3)하지 않으면, 사냥꾼의 공격을 방해합니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 3,
            "code": "eileen-pistol",
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "djuras-ally",
      "name": "듀라의 동료",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 10,
        "2": 10,
        "3": 18,
        "4": 18
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 10,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235830.jpg",
            "filename": "20261011_235830.jpg",
            "position": "left",
            "bytes": 5316085,
            "sha256": "e0dc7f62f0b48f15538a0d192433c9c6e8e0719136708f822fdcbd611e82bb02"
          },
          "basic": {
            "name": "톱 단창",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "이 칸에 있는 다른 모든 사냥꾼들이 회피(속도 2)하지 않는다면 그들에게 피해를 1씩 줍니다."
            ],
            "collateral": {
              "dodgeSpeed": 2,
              "damage": 1
            }
          },
          "special": {
            "name": "리게인 공격",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "공격 후, 이 공격이 피해를 주었다면 듀라의 동료가 치유 2를 합니다."
            ],
            "code": "djuras-ally-regain"
          },
          "ability": {
            "name": "피의 갈망",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "다른 적 행동 카드 1장을 공개합니다.",
              "듀라의 동료의 다음 공격은 +1 속도와 방해를 획득합니다."
            ],
            "whiteBackground": true,
            "code": "djuras-ally-bloodlust",
            "timing": "instant"
          }
        },
        {
          "sideId": "3+",
          "health": 18,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235844.jpg",
            "filename": "20261011_235844.jpg",
            "position": "left",
            "bytes": 5456761,
            "sha256": "2866f9b1417176848efb0adf6ea1ea96b94c27a4525220bf829645f7eb341104"
          },
          "basic": {
            "name": "톱 단창",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "이 칸에 있는 다른 모든 사냥꾼들이 회피(속도 2)하지 않는다면 그들에게 피해를 1씩 줍니다."
            ],
            "collateral": {
              "dodgeSpeed": 2,
              "damage": 1
            }
          },
          "special": {
            "name": "리게인 공격",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "공격 후, 이 공격이 피해를 주었다면 듀라의 동료가 치유 2를 합니다."
            ],
            "code": "djuras-ally-regain"
          },
          "ability": {
            "name": "피의 갈망",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "다른 적 행동 카드 1장을 공개합니다.",
              "듀라의 동료의 다음 공격은 +1 속도와 방해를 획득합니다."
            ],
            "whiteBackground": true,
            "code": "djuras-ally-bloodlust",
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "alfred",
      "name": "혈족 사냥꾼 알프레드",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 10,
        "2": 10,
        "3": 18,
        "4": 18
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 10,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235830.jpg",
            "filename": "20261011_235830.jpg",
            "position": "center",
            "bytes": 5316085,
            "sha256": "e0dc7f62f0b48f15538a0d192433c9c6e8e0719136708f822fdcbd611e82bb02"
          },
          "basic": {
            "name": "교단의 돌망치",
            "speed": 1,
            "damage": 3,
            "keywords": [
              "기절"
            ],
            "rules": []
          },
          "special": {
            "name": "화려한 콤보",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "모든 공격을 해결한 후, 알프레드가 교단의 돌망치 공격을 한 번 가합니다."
            ],
            "code": "alfred-combo"
          },
          "ability": {
            "name": "루드비히의 장총",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "사냥꾼은 회피(속도 2)하거나 (또는) 방해받고 기절에 걸려야 합니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 2,
            "code": "alfred-rifle",
            "timing": "instant"
          }
        },
        {
          "sideId": "3+",
          "health": 18,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235844.jpg",
            "filename": "20261011_235844.jpg",
            "position": "center",
            "bytes": 5456761,
            "sha256": "2866f9b1417176848efb0adf6ea1ea96b94c27a4525220bf829645f7eb341104"
          },
          "basic": {
            "name": "교단의 돌망치",
            "speed": 1,
            "damage": 3,
            "keywords": [
              "기절"
            ],
            "rules": []
          },
          "special": {
            "name": "화려한 콤보",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "모든 공격을 해결한 후, 알프레드가 교단의 돌망치 공격을 한 번 가합니다."
            ],
            "code": "alfred-combo"
          },
          "ability": {
            "name": "루드비히의 장총",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "사냥꾼은 회피(속도 2)하거나 (또는) 방해받고 기절에 걸려야 합니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 2,
            "code": "alfred-rifle",
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "djura",
      "name": "고대 사냥꾼 듀라",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 10,
        "2": 10,
        "3": 18,
        "4": 18
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 10,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235830.jpg",
            "filename": "20261011_235830.jpg",
            "position": "right",
            "bytes": 5316085,
            "sha256": "e0dc7f62f0b48f15538a0d192433c9c6e8e0719136708f822fdcbd611e82bb02"
          },
          "basic": {
            "name": "말뚝박이",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "적 활성화: 그 대신, 듀라가 말뚝 발사 공격을 한 번 가합니다."
            ],
            "code": "djura-stake-driver"
          },
          "special": {
            "name": "말뚝 발사",
            "speed": 1,
            "damage": 4,
            "keywords": [
              "기절"
            ],
            "rules": [
              "이 칸에 있는 다른 모든 사냥꾼들이 회피(속도 1)하지 않는다면 그들에게 피해를 2씩 줍니다."
            ],
            "collateral": {
              "dodgeSpeed": 1,
              "damage": 2
            }
          },
          "ability": {
            "name": "산탄총",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "이 칸에 있는 모든 사냥꾼은 회피(속도 2)하거나 (또는) 1 피해를 받고 기절에 걸려야 합니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 2,
            "code": "djura-shotgun",
            "allHunters": true,
            "timing": "instant"
          }
        },
        {
          "sideId": "3+",
          "health": 18,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235844.jpg",
            "filename": "20261011_235844.jpg",
            "position": "right",
            "bytes": 5456761,
            "sha256": "2866f9b1417176848efb0adf6ea1ea96b94c27a4525220bf829645f7eb341104"
          },
          "basic": {
            "name": "말뚝박이",
            "speed": 2,
            "damage": 3,
            "keywords": [],
            "rules": [
              "적 활성화: 그 대신, 듀라가 말뚝 발사 공격을 한 번 가합니다."
            ],
            "code": "djura-stake-driver"
          },
          "special": {
            "name": "말뚝 발사",
            "speed": 1,
            "damage": 4,
            "keywords": [
              "기절"
            ],
            "rules": [
              "이 칸에 있는 다른 모든 사냥꾼들이 회피(속도 1)하지 않는다면 그들에게 피해를 2씩 줍니다."
            ],
            "collateral": {
              "dodgeSpeed": 1,
              "damage": 2
            }
          },
          "ability": {
            "name": "산탄총",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "이 칸에 있는 모든 사냥꾼은 회피(속도 2)하거나 (또는) 1 피해를 받고 기절에 걸려야 합니다.",
              "다른 적 행동 카드 1장을 공개합니다."
            ],
            "whiteBackground": true,
            "dodgeSpeed": 2,
            "code": "djura-shotgun",
            "allHunters": true,
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "blood-knight",
      "name": "혈족의 기사",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 10,
        "2": 10,
        "3": 18,
        "4": 18
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 10,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235858.jpg",
            "filename": "20261011_235858.jpg",
            "position": "left",
            "bytes": 5458195,
            "sha256": "a7af8b7219a016a569583bdad42fcde0224f981860415227b7b093cfe5c7294b"
          },
          "basic": {
            "name": "검 가르기",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "혈족의 기사가 피의 타락을 하나라도 갖고 있다면, 그중 하나를 제거하고 이번 공격은 +1 속도와 +1 피해를 획득합니다."
            ],
            "code": "blood-knight-sword"
          },
          "special": {
            "name": "치명적인 응수",
            "speed": 3,
            "damage": 2,
            "keywords": [
              "방해",
              "기절"
            ],
            "rules": [
              "이번 공격으로 피해를 준다면, 혈족의 기사는 계몽 토큰(피의 타락) 1개를 획득합니다."
            ],
            "code": "blood-knight-riposte"
          },
          "ability": {
            "name": "피 집중",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "혈족의 기사는 계몽 토큰(피의 타락) 1개를 획득합니다.",
              "혈족의 기사가 가진 피의 타락마다, 사냥꾼 공격에서 1 피해를 방어합니다."
            ],
            "whiteBackground": true,
            "code": "blood-knight-focus",
            "timing": "instant"
          }
        },
        {
          "sideId": "3+",
          "health": 18,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235911.jpg",
            "filename": "20261011_235911.jpg",
            "position": "left",
            "bytes": 5408697,
            "sha256": "d0ab2f2650a554e9e1afa043a14919a0d784b3457948064f65dee68e43166a62"
          },
          "basic": {
            "name": "검 가르기",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "혈족의 기사가 피의 타락을 하나라도 갖고 있다면, 그중 하나를 제거하고 이번 공격은 +1 속도와 +1 피해를 획득합니다."
            ],
            "code": "blood-knight-sword"
          },
          "special": {
            "name": "치명적인 응수",
            "speed": 3,
            "damage": 2,
            "keywords": [
              "방해",
              "기절"
            ],
            "rules": [
              "이번 공격으로 피해를 준다면, 혈족의 기사는 계몽 토큰(피의 타락) 1개를 획득합니다."
            ],
            "code": "blood-knight-riposte"
          },
          "ability": {
            "name": "피 집중",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "혈족의 기사는 계몽 토큰(피의 타락) 1개를 획득합니다.",
              "혈족의 기사가 가진 피의 타락마다, 사냥꾼 공격에서 1 피해를 방어합니다."
            ],
            "whiteBackground": true,
            "code": "blood-knight-focus",
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "cainhurst-knight-servant",
      "name": "카인허스트의 하수인(기사)",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 7,
        "2": 7,
        "3": 13,
        "4": 13
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 7,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235858.jpg",
            "filename": "20261011_235858.jpg",
            "position": "center",
            "bytes": 5458195,
            "sha256": "a7af8b7219a016a569583bdad42fcde0224f981860415227b7b093cfe5c7294b"
          },
          "basic": {
            "name": "레이피어",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "회피할 수 없습니다.",
              "사냥꾼의 공격이 속도 2 또는 1이라면, 1 피해를 방어합니다."
            ],
            "undodgeable": true,
            "code": "cainhurst-knight-rapier"
          },
          "special": {
            "name": "치명적인 찌르기",
            "speed": 1,
            "damage": 4,
            "keywords": [],
            "rules": []
          },
          "ability": {
            "name": "쳐내기",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "이 공격을 방해하지 않았다면, 사냥꾼의 공격을 방해하고 사냥꾼은 본인 공격의 피해만큼 피해를 받습니다."
            ],
            "whiteBackground": true,
            "code": "cainhurst-knight-parry",
            "timing": "instant"
          }
        },
        {
          "sideId": "3+",
          "health": 13,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235911.jpg",
            "filename": "20261011_235911.jpg",
            "position": "center",
            "bytes": 5408697,
            "sha256": "d0ab2f2650a554e9e1afa043a14919a0d784b3457948064f65dee68e43166a62"
          },
          "basic": {
            "name": "레이피어",
            "speed": 2,
            "damage": 2,
            "keywords": [],
            "rules": [
              "회피할 수 없습니다.",
              "사냥꾼의 공격이 속도 2 또는 1이라면, 1 피해를 방어합니다."
            ],
            "undodgeable": true,
            "code": "cainhurst-knight-rapier"
          },
          "special": {
            "name": "치명적인 찌르기",
            "speed": 1,
            "damage": 4,
            "keywords": [],
            "rules": []
          },
          "ability": {
            "name": "쳐내기",
            "speed": null,
            "damage": 0,
            "keywords": [],
            "rules": [
              "이 공격을 방해하지 않았다면, 사냥꾼의 공격을 방해하고 사냥꾼은 본인 공격의 피해만큼 피해를 받습니다."
            ],
            "whiteBackground": true,
            "code": "cainhurst-knight-parry",
            "timing": "instant"
          }
        }
      ]
    },
    {
      "id": "bloodlicker-starved",
      "name": "피핥기(굶주린)",
      "sideRole": "hunter-count",
      "healthByHunterCount": {
        "1": 8,
        "2": 8,
        "3": 15,
        "4": 15
      },
      "faces": [
        {
          "sideId": "1-2",
          "health": 8,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235858.jpg",
            "filename": "20261011_235858.jpg",
            "position": "right",
            "bytes": 5458195,
            "sha256": "a7af8b7219a016a569583bdad42fcde0224f981860415227b7b093cfe5c7294b"
          },
          "basic": {
            "name": "게걸스러운 맹공",
            "speed": 1,
            "damage": 2,
            "keywords": [],
            "rules": [
              "이번 공격은 전투하는 사냥꾼이 가진 피의 유지마다 +1 속도와 +1 피해를 획득합니다."
            ],
            "code": "bloodlicker-greedy"
          },
          "special": {
            "name": "마구잡이 공격",
            "speed": 2,
            "damage": 3,
            "keywords": [
              "기절"
            ],
            "rules": [
              "이 칸에 있는 모든 사냥꾼을 대상으로 삼습니다."
            ],
            "allHunters": true
          },
          "ability": {
            "name": "회피 도약",
            "speed": 2,
            "damage": 0,
            "keywords": [],
            "rules": [
              "속도 2로 (사냥꾼과 같은 속도라면, 사냥꾼 공격 전에), 피핥기를 1칸 멀리 이동시킵니다.",
              "적 활성화: 모든 공격을 해결한 후, 피핥기를 한 번 더 활성화합니다."
            ],
            "whiteBackground": true,
            "code": "bloodlicker-dodge-leap",
            "timing": "speed"
          }
        },
        {
          "sideId": "3+",
          "health": 15,
          "source": {
            "kind": "user-photo",
            "path": "참고자료/적 카드/20261011_235911.jpg",
            "filename": "20261011_235911.jpg",
            "position": "right",
            "bytes": 5408697,
            "sha256": "d0ab2f2650a554e9e1afa043a14919a0d784b3457948064f65dee68e43166a62"
          },
          "basic": {
            "name": "게걸스러운 맹공",
            "speed": 1,
            "damage": 2,
            "keywords": [],
            "rules": [
              "이번 공격은 전투하는 사냥꾼이 가진 피의 유지마다 +1 속도와 +1 피해를 획득합니다."
            ],
            "code": "bloodlicker-greedy"
          },
          "special": {
            "name": "마구잡이 공격",
            "speed": 2,
            "damage": 3,
            "keywords": [
              "기절"
            ],
            "rules": [
              "이 칸에 있는 모든 사냥꾼을 대상으로 삼습니다."
            ],
            "allHunters": true
          },
          "ability": {
            "name": "회피 도약",
            "speed": 2,
            "damage": 0,
            "keywords": [],
            "rules": [
              "속도 2로 (사냥꾼과 같은 속도라면, 사냥꾼 공격 전에), 피핥기를 1칸 멀리 이동시킵니다.",
              "적 활성화: 모든 공격을 해결한 후, 피핥기를 한 번 더 활성화합니다."
            ],
            "whiteBackground": true,
            "code": "bloodlicker-dodge-leap",
            "timing": "speed"
          }
        }
      ]
    }
  ],
  "sharedEnemyDeck": {
    "basic": 3,
    "special": 2,
    "ability": 1
  },
  "supportedHunterCount": 1,
  "uncertainties": [
    {
      "id": "cainhurst-parry-timing",
      "kind": "rules-interpretation",
      "detail": "흰 배경 전용 능력 쳐내기는 공격에 의해 방해될 수 있다는 문구를 사용하지만 속도 아이콘이 없습니다. 일반 능력 방해 불가 규칙의 본문 예외로 해석하여 선언된 사냥꾼 공격의 방해 유무로 판정합니다. 추가 속도 수치는 만들지 않았습니다."
    },
    {
      "id": "normal-face-selection",
      "kind": "implementation-policy",
      "detail": "일반 3종 A/B는 같은 챕터에서 무작위 선택 면을 유지하고 인원별 전투 카드는 1명용 면으로 사용해야 합니다."
    },
    {
      "id": "other-campaign-sources",
      "kind": "scope",
      "detail": "이 사진에는 신규 적을 어느 임무/캠페인에 배치하는 지시가 없습니다. 기나긴 사냥 기본 적 3종은 기존 자료를 유지해야 합니다."
    }
  ]
};
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.BBExtendedEnemySource = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
