(function (root) {
  "use strict";
  // Original, code-drawn diagrams. Coordinates are percentages on a square tile.
  // The photographed board was reviewed one tile at a time; perspective/skew and
  // decorative background were removed. Space membership, dividers, exits and
  // printed marker counts/locations are retained. No photo pixels are embedded.
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const space = (polygon, point, labelPoint = point) => ({ polygon, point, labelPoint });
  const mark = (spaceId, kind, point, markerId) => ({ spaceId, kind, point, count: 1, ...(markerId ? { markerId } : {}) });
  const gate = (edge, spaceId) => ({ edge, spaceId, point: { N: [50, 0], E: [100, 50], S: [50, 100], W: [0, 50] }[edge] });
  const tiles = {
    "tile-01": {
      spaces: { top: space(rect(0, 0, 100, 44), [50, 24], [70, 30]), bottom: space(rect(0, 44, 100, 100), [50, 73], [33, 81]) },
      boundaries: [[[0, 44], [100, 44]]],
      exits: [gate("N", "top"), gate("S", "bottom")],
      markers: [mark("top", "spawn", [42, 24], "gold"), mark("bottom", "spawn", [61, 69], "red")],
    },
    "tile-02": {
      spaces: { "upper-left": space(rect(0, 0, 60, 55), [30, 29], [30, 15]), "lower-left": space(rect(0, 55, 60, 100), [30, 78], [29, 89]), right: space(rect(60, 0, 100, 100), [80, 50], [80, 69]) },
      boundaries: [[[60, 0], [60, 100]], [[0, 55], [60, 55]]],
      exits: [gate("E", "right"), gate("S", "lower-left")],
      markers: [mark("lower-left", "spawn", [33, 73], "red"), mark("right", "consumable", [76, 50])],
    },
    "tile-03": {
      spaces: { room: space(rect(0, 0, 100, 44), [50, 24], [50, 13]), entry: space(rect(0, 44, 100, 100), [50, 73], [50, 73]) },
      boundaries: [[[0, 44], [100, 44]]],
      exits: [gate("S", "entry")],
      markers: [mark("room", "spawn", [20, 23], "gold"), mark("room", "spawn", [79, 23], "purple"), mark("room", "consumable", [37, 37]), mark("room", "consumable", [61, 37])],
    },
    "tile-04": {
      spaces: { left: space(rect(0, 0, 30, 100), [15, 50], [15, 65]), center: space(rect(30, 0, 70, 100), [50, 50], [50, 63]), right: space(rect(70, 0, 100, 100), [85, 50], [85, 65]) },
      boundaries: [[[30, 0], [30, 100]], [[70, 0], [70, 100]]],
      exits: [gate("W", "left"), gate("E", "right"), gate("S", "center")],
      markers: [mark("center", "lamp", [50, 50])],
    },
    "tile-05": {
      spaces: { "upper-left": space(rect(0, 0, 50, 61), [25, 31], [25, 20]), "upper-right": space(rect(50, 0, 100, 61), [75, 31], [75, 20]), bottom: space(rect(0, 61, 100, 100), [50, 81], [50, 81]) },
      boundaries: [[[50, 0], [50, 61]], [[0, 61], [100, 61]]],
      exits: [gate("W", "upper-left"), gate("E", "upper-right"), gate("S", "bottom")],
      markers: [mark("upper-left", "spawn", [27, 35], "gold"), mark("upper-right", "spawn", [73, 35], "purple")],
    },
    "tile-06": {
      spaces: { top: space(rect(0, 0, 100, 56), [50, 28], [50, 18]), bottom: space(rect(0, 56, 100, 100), [50, 77], [50, 86]) },
      boundaries: [[[0, 56], [100, 56]]],
      exits: [gate("W", "top"), gate("E", "top"), gate("S", "bottom")],
      markers: [mark("top", "consumable", [50, 42]), mark("bottom", "spawn", [50, 74], "purple")],
    },
    "tile-07": {
      spaces: { top: space(rect(0, 0, 100, 39), [50, 24], [50, 16]), middle: space(rect(0, 39, 100, 69), [50, 54], [50, 64]), bottom: space(rect(0, 69, 100, 100), [50, 85], [50, 84]) },
      boundaries: [[[0, 39], [100, 39]], [[0, 69], [100, 69]]],
      exits: [gate("S", "bottom")],
      markers: [mark("top", "consumable", [31, 31]), mark("top", "consumable", [70, 31]), mark("middle", "lamp", [50, 54])],
    },
    "tile-08": {
      spaces: { top: space(rect(0, 0, 100, 49), [50, 25], [50, 27]), bottom: space(rect(0, 49, 100, 100), [50, 75], [76, 80]) },
      boundaries: [[[0, 49], [100, 49]]],
      exits: [gate("N", "top"), gate("S", "bottom")],
      markers: [mark("bottom", "consumable", [18, 60]), mark("bottom", "spawn", [50, 72], "purple")],
    },
    "tile-09": {
      spaces: { "upper-left": space(rect(0, 0, 51, 59), [25, 30], [25, 37]), "upper-right": space(rect(51, 0, 100, 59), [76, 30], [76, 29]), bottom: space(rect(0, 59, 100, 100), [50, 80], [50, 88]) },
      boundaries: [[[51, 0], [51, 59]], [[0, 59], [100, 59]]],
      exits: [gate("E", "upper-right"), gate("S", "bottom")],
      markers: [mark("upper-left", "consumable", [26, 16]), mark("bottom", "spawn", [50, 74], "gold")],
    },
    "tile-10": {
      spaces: {
        left: space([[0, 0], [58, 0], [58, 37], [42, 37], [42, 68], [44, 68], [44, 100], [0, 100]], [23, 62], [23, 62]),
        right: space([[58, 0], [100, 0], [100, 100], [44, 100], [44, 68], [65, 68], [65, 37], [58, 37]], [81, 54], [81, 54]),
      },
      boundaries: [[[58, 0], [58, 37]], [[44, 68], [44, 100]]],
      blocked: [rect(42, 37, 65, 68)],
      exits: [gate("N", "left"), gate("W", "left"), gate("E", "right"), gate("S", "right")],
      markers: [mark("left", "spawn", [25, 73], "red"), mark("right", "consumable", [77, 27])],
    },
    "tile-11": {
      spaces: { street: space(rect(0, 0, 100, 57), [50, 30], [50, 19]), house: space(rect(0, 57, 100, 100), [50, 81], [50, 81]) },
      boundaries: [[[0, 57], [100, 57]]],
      exits: [gate("N", "street"), gate("W", "street"), gate("E", "street")],
      markers: [mark("street", "spawn", [51, 34], "gold")],
    },
    "tile-12": {
      spaces: { top: space(rect(0, 0, 100, 35), [50, 21], [50, 19]), "middle-left": space(rect(0, 35, 50, 69), [25, 53], [26, 63]), "middle-right": space(rect(50, 35, 100, 69), [75, 53], [75, 63]), bottom: space(rect(0, 69, 100, 100), [50, 85], [50, 85]) },
      boundaries: [[[0, 35], [100, 35]], [[50, 35], [50, 69]], [[0, 69], [100, 69]]],
      exits: [gate("S", "bottom")],
      markers: [mark("middle-left", "lamp", [32, 51]), mark("middle-right", "consumable", [70, 51])],
    },
    "tile-13": {
      spaces: { top: space(rect(0, 0, 100, 32), [50, 18], [50, 20]), middle: space(rect(0, 32, 100, 69), [50, 51], [50, 60]), bottom: space(rect(0, 69, 100, 100), [50, 85], [50, 85]) },
      boundaries: [[[0, 32], [100, 32]], [[0, 69], [100, 69]]],
      exits: [gate("N", "top"), gate("W", "middle"), gate("E", "middle"), gate("S", "bottom")],
      markers: [mark("middle", "consumable", [24, 50]), mark("middle", "spawn", [78, 50], "red")],
    },
    "tile-14": {
      spaces: { left: space(rect(0, 0, 33, 100), [17, 50], [17, 65]), center: space(rect(33, 0, 69, 100), [51, 50], [51, 62]), right: space(rect(69, 0, 100, 100), [84, 50], [84, 65]) },
      boundaries: [[[33, 0], [33, 100]], [[69, 0], [69, 100]]],
      exits: [gate("N", "center"), gate("W", "left"), gate("E", "right"), gate("S", "center")],
      markers: [mark("center", "lamp", [51, 51])],
    },
    "tile-15": {
      spaces: { left: space(rect(0, 0, 33, 100), [17, 50], [17, 65]), center: space(rect(33, 0, 70, 100), [51, 50], [51, 17]), right: space(rect(70, 0, 100, 100), [85, 50], [85, 65]) },
      boundaries: [[[33, 0], [33, 100]], [[70, 0], [70, 100]]],
      exits: [gate("W", "left"), gate("E", "right")],
      markers: [mark("center", "spawn", [51, 50], "purple")],
    },
    "tile-16": {
      spaces: { top: space(rect(0, 0, 100, 33), [50, 18], [72, 19]), middle: space(rect(0, 33, 100, 68), [50, 50], [73, 51]), bottom: space(rect(0, 68, 100, 100), [50, 84], [72, 84]) },
      boundaries: [[[0, 33], [100, 33]], [[0, 68], [100, 68]]],
      exits: [gate("W", "middle"), gate("E", "middle"), gate("S", "bottom")],
      markers: [mark("top", "consumable", [51, 21]), mark("middle", "spawn", [50, 51], "red"), mark("bottom", "spawn", [50, 81], "gold")],
    },
    "tile-17": {
      spaces: { top: space(rect(0, 0, 100, 43), [50, 25], [50, 37]), "lower-left": space(rect(0, 43, 50, 100), [25, 71], [25, 71]), "lower-right": space(rect(50, 43, 100, 100), [75, 71], [75, 71]) },
      boundaries: [[[0, 43], [100, 43]], [[50, 43], [50, 100]]],
      exits: [gate("N", "top"), gate("W", "lower-left"), gate("E", "lower-right")],
      markers: [mark("top", "lamp", [50, 28])],
    },
    "tile-18": {
      spaces: { top: space(rect(0, 0, 100, 50), [50, 26], [50, 43]), bottom: space(rect(0, 50, 100, 100), [50, 75], [50, 75]) },
      boundaries: [[[0, 50], [100, 50]]],
      exits: [gate("N", "top"), gate("S", "bottom")],
      markers: [mark("top", "consumable", [67, 21]), mark("top", "spawn", [50, 35], "purple")],
    },
    "tile-19": {
      spaces: { top: space(rect(0, 0, 100, 59), [50, 31], [50, 52]), bottom: space(rect(0, 59, 100, 100), [50, 80], [50, 91]) },
      boundaries: [[[0, 59], [100, 59]]],
      exits: [gate("S", "bottom")],
      markers: [mark("top", "consumable", [79, 31]), mark("bottom", "lamp", [50, 80])],
    },
    "tile-20": {
      spaces: { room: space(rect(0, 0, 100, 67), [50, 34], [50, 20]), entry: space(rect(0, 67, 100, 100), [50, 83], [50, 83]) },
      boundaries: [[[0, 67], [100, 67]]],
      exits: [gate("S", "entry")],
      markers: [mark("room", "lamp", [50, 44])],
    },
  };
  const rotatePoint = ([x, y], rotation = 0) => {
    if (!Number.isInteger(rotation)) throw new Error("타일 회전은 90도 단위의 정수여야 합니다.");
    for (let n = ((rotation % 4) + 4) % 4; n; n--) [x, y] = [100 - y, x];
    return [x, y];
  };
  const definition = (tileId) => {
    const t = tiles[tileId];
    if (!t) throw new Error(`타일 도식이 없습니다: ${tileId}`);
    return t;
  };
  const point = (tileId, spaceId, rotation = 0) => {
    const s = definition(tileId).spaces[spaceId];
    if (!s) throw new Error(`타일 칸 도식이 없습니다: ${tileId}:${spaceId}`);
    return rotatePoint(s.point, rotation);
  };
  const polygon = (tileId, spaceId, rotation = 0) => {
    const s = definition(tileId).spaces[spaceId];
    if (!s) throw new Error(`타일 칸 도식이 없습니다: ${tileId}:${spaceId}`);
    return s.polygon.map((p) => rotatePoint(p, rotation));
  };
  function spaceLabel(tile, space) {
    if (tile.id === "tile-10") return space.id === "left" ? "왼쪽 칸" : "오른쪽 칸";
    if (space.id === "center" && tile.id === "tile-15" || space.id === "top" &&
        ["tile-07", "tile-12", "tile-18", "tile-19"].includes(tile.id)) return tile.name;
    return space.placeName || space.label;
  }
  const api = { tiles, definition, point, polygon, rotatePoint, spaceLabel, image: (tileId) => { definition(tileId); return `assets/tiles/${tileId}.svg`; } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BBTileGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
