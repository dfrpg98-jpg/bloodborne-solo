"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), Help = require("../src/game-help");
const movement = Help.sections.find(section => section.title.startsWith("2. 이동과 탐험"));
const shortcutItems = movement.items.filter(([title]) => title.startsWith("단축키"));
const shortcutText = shortcutItems.map(([, text]) => text).join(" ");

test("detailed help separates top-row hand selection, Space refill and the right number pad", () => {
  assert.match(shortcutText, /키보드 윗줄 숫자 1–9.*손패.*윗줄 왼쪽부터/);
  assert.match(shortcutText, /같은 숫자를 다시 누르면 선택을 해제/);
  assert.match(shortcutText, /오른쪽 숫자패드는 손패 선택에 쓰지 않습니다/);
  assert.match(shortcutText, /Space.*활성화된 ‘손패 보충’ 버튼/);
  assert.match(shortcutText, /M은 이동 선언·이동 마치기/);
  assert.match(shortcutText, /방향키는 십자 방향 선택/);
  assert.match(shortcutText, /숫자패드 5는 이동 선언에만.*이동을 마치지 않습니다/);
  assert.doesNotMatch(Help.renderHTML(), /WASD/);
  assert.match(shortcutText, /Space는 ‘행동하기’·차례 마치기·이동 마치기·타일 배치/);
  assert.match(shortcutText, /Esc 또는 Backspace는 ‘행동취소’나 ‘이동 선언 취소’/);
  assert.match(shortcutText, /여러 대응이 있거나 선택이 미정이면 임의로 넘기지 않습니다/);
});

test("help maps all eight NumLock directions and explains actual button availability and input guards", () => {
  assert.match(shortcutText, /NumLock을 켠 오른쪽 숫자패드/);
  assert.match(shortcutText, /7·8·9는 ↖·↑·↗, 4·6은 ←·→, 1·2·3은 ↙·↓·↘/);
  assert.match(shortcutText, /활성화된 방향 버튼만 단축키로/);
  assert.match(shortcutText, /대각선 버튼이 활성화되면 십자 버튼과 그 단축키는 사용할 수 없습니다/);
  assert.match(shortcutText, /NumLock을 끄면 숫자패드로 이동하거나 손패를 선택하지 않습니다/);
  assert.match(shortcutText, /입력란이나 열린 창이 있으면 게임 단축키가 동작하지 않습니다/);
  assert.match(shortcutText, /목적지가 여러 곳이면 버튼으로 고릅니다/);
});

test("shortcut detail stays in the expandable movement help rather than the short first lesson", () => {
  const html = Help.renderHTML(), firstLesson = html.match(/<section class="game-help-first">([\s\S]*?)<\/section>/)?.[1];
  assert(firstLesson);
  assert.doesNotMatch(firstLesson, /NumLock|Space|숫자패드|단축키/);
  for (const [title] of shortcutItems) assert(html.includes(`<strong>${title}</strong>`));
  assert(html.indexOf("2. 이동과 탐험") < html.indexOf("단축키 · 손패와 보충"));
  assert(html.indexOf("단축키 · 입력 제한") < html.indexOf("3. 공격"));
});
