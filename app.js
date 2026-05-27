const MIN_VISIBLE_PLANK = 0.01;
const STORAGE_KEY = "plank-floor-visualizer-settings";
const DEFAULT_SETTINGS = {
  shapeMode: "rectangle",
  roomLength: "144",
  roomWidth: "120",
  outlineSegments: "E 144\nS 96\nW 36\nS 24\nW 108\nN 120",
  enableDividerWall: false,
  wallOrientation: "vertical",
  wallX: "72",
  wallY: "0",
  wallLength: "120",
  wallThickness: "4.5",
  doorOffset: "42",
  doorWidth: "32",
  plankLength: "48",
  plankWidth: "7",
  minEndCut: "8",
  minRipWidth: "2",
  orientation: "long",
  startCorner: "NW",
  staggerDivisions: "3",
  starterProfile: "tongue"
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const controls = [...document.querySelectorAll("input, select, textarea")];
const resetSettings = document.getElementById("resetSettings");
const fitView = document.getElementById("fitView");
const piecePopover = document.getElementById("piecePopover");
let drawnPieces = [];
let latestValues = null;
let latestRoom = null;
let latestPieces = [];
let view = { scale: 1, x: 0, y: 0, fitted: true };
let isPanning = false;
let panStart = null;

const els = {
  planksNeeded: document.getElementById("planksNeeded"),
  fullPieces: document.getElementById("fullPieces"),
  cutPieces: document.getElementById("cutPieces"),
  rows: document.getElementById("rows"),
  firstRip: document.getElementById("firstRip"),
  lastRip: document.getElementById("lastRip"),
  adjustedRows: document.getElementById("adjustedRows"),
  offcutsReused: document.getElementById("offcutsReused"),
  cutStockPlanks: document.getElementById("cutStockPlanks"),
  ripOnlyPieces: document.getElementById("ripOnlyPieces"),
  wasteRoom: document.getElementById("wasteRoom"),
  wastePurchased: document.getElementById("wastePurchased"),
  installedArea: document.getElementById("installedArea"),
  purchasedArea: document.getElementById("purchasedArea"),
  perimeterLength: document.getElementById("perimeterLength"),
  rectangleRoomFields: document.getElementById("rectangleRoomFields"),
  customRoomFields: document.getElementById("customRoomFields"),
  dividerWallFields: document.getElementById("dividerWallFields"),
  shapeStatus: document.getElementById("shapeStatus"),
  reuseNote: document.getElementById("reuseNote"),
  ripList: document.getElementById("ripList"),
  cutList: document.getElementById("cutList"),
  cutGroups: document.getElementById("cutGroups"),
  directionNote: document.getElementById("directionNote"),
  error: document.getElementById("error")
};

function numberValue(id, label) {
  const value = Number(document.getElementById(id).value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than 0.`);
  }
  return value;
}

function nonNegativeValue(id, label) {
  const value = Number(document.getElementById(id).value);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }
  return value;
}

function currentInputs() {
  return {
    shapeMode: document.querySelector("input[name='shapeMode']:checked").value,
    roomLength: numberValue("roomLength", "Room length"),
    roomWidth: numberValue("roomWidth", "Room width"),
    outlineSegments: document.getElementById("outlineSegments").value,
    enableDividerWall: document.getElementById("enableDividerWall").checked,
    wallOrientation: document.getElementById("wallOrientation").value,
    wallX: nonNegativeValue("wallX", "Wall X"),
    wallY: nonNegativeValue("wallY", "Wall Y"),
    wallLength: nonNegativeValue("wallLength", "Wall length"),
    wallThickness: nonNegativeValue("wallThickness", "Wall thickness"),
    doorOffset: nonNegativeValue("doorOffset", "Doorway offset"),
    doorWidth: nonNegativeValue("doorWidth", "Doorway width"),
    plankLength: numberValue("plankLength", "Plank length"),
    plankWidth: numberValue("plankWidth", "Plank width"),
    minEndCut: nonNegativeValue("minEndCut", "Minimum end cut"),
    minRipWidth: nonNegativeValue("minRipWidth", "Minimum rip width"),
    orientation: document.querySelector("input[name='orientation']:checked").value,
    startCorner: document.getElementById("startCorner").value,
    staggerDivisions: numberValue("staggerDivisions", "Stair step"),
    starterProfile: document.getElementById("starterProfile").value
  };
}

function selectedOrientationControl() {
  return document.querySelector("input[name='orientation']:checked");
}

function selectedShapeModeControl() {
  return document.querySelector("input[name='shapeMode']:checked");
}

function readSettingsFromControls() {
  return {
    shapeMode: selectedShapeModeControl()?.value || DEFAULT_SETTINGS.shapeMode,
    roomLength: document.getElementById("roomLength").value,
    roomWidth: document.getElementById("roomWidth").value,
    outlineSegments: document.getElementById("outlineSegments").value,
    enableDividerWall: document.getElementById("enableDividerWall").checked,
    wallOrientation: document.getElementById("wallOrientation").value,
    wallX: document.getElementById("wallX").value,
    wallY: document.getElementById("wallY").value,
    wallLength: document.getElementById("wallLength").value,
    wallThickness: document.getElementById("wallThickness").value,
    doorOffset: document.getElementById("doorOffset").value,
    doorWidth: document.getElementById("doorWidth").value,
    plankLength: document.getElementById("plankLength").value,
    plankWidth: document.getElementById("plankWidth").value,
    minEndCut: document.getElementById("minEndCut").value,
    minRipWidth: document.getElementById("minRipWidth").value,
    orientation: selectedOrientationControl()?.value || DEFAULT_SETTINGS.orientation,
    startCorner: document.getElementById("startCorner").value,
    staggerDivisions: document.getElementById("staggerDivisions").value,
    starterProfile: document.getElementById("starterProfile").value
  };
}

function applySettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  document.getElementById("outlineSegments").value = merged.outlineSegments;
  document.getElementById("enableDividerWall").checked = merged.enableDividerWall === true || merged.enableDividerWall === "true";
  document.getElementById("wallOrientation").value = merged.wallOrientation;
  document.getElementById("wallX").value = merged.wallX;
  document.getElementById("wallY").value = merged.wallY;
  document.getElementById("wallLength").value = merged.wallLength;
  document.getElementById("wallThickness").value = merged.wallThickness;
  document.getElementById("doorOffset").value = merged.doorOffset;
  document.getElementById("doorWidth").value = merged.doorWidth;
  document.getElementById("roomLength").value = merged.roomLength;
  document.getElementById("roomWidth").value = merged.roomWidth;
  document.getElementById("plankLength").value = merged.plankLength;
  document.getElementById("plankWidth").value = merged.plankWidth;
  document.getElementById("minEndCut").value = merged.minEndCut;
  document.getElementById("minRipWidth").value = merged.minRipWidth;
  document.getElementById("startCorner").value = merged.startCorner;
  document.getElementById("staggerDivisions").value = merged.staggerDivisions;
  document.getElementById("starterProfile").value = merged.starterProfile;

  const orientation = document.querySelector(`input[name='orientation'][value='${merged.orientation}']`);
  if (orientation) {
    orientation.checked = true;
  }

  const shapeMode = document.querySelector(`input[name='shapeMode'][value='${merged.shapeMode}']`);
  if (shapeMode) {
    shapeMode.checked = true;
  }
  syncModeVisibility();
}

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    applySettings(JSON.parse(raw));
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readSettingsFromControls()));
  } catch (_error) {
    // Some browser privacy modes can block localStorage.
  }
}

function resetSavedSettings() {
  localStorage.removeItem(STORAGE_KEY);
  applySettings(DEFAULT_SETTINGS);
  update({ persist: false });
}

function syncModeVisibility() {
  const shapeMode = selectedShapeModeControl()?.value || DEFAULT_SETTINGS.shapeMode;
  els.rectangleRoomFields.classList.toggle("hidden", shapeMode !== "rectangle");
  els.customRoomFields.classList.toggle("hidden", shapeMode !== "custom");
  els.dividerWallFields.classList.toggle("hidden", !document.getElementById("enableDividerWall").checked);
}

function polygonBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}

function normalizePolygon(points) {
  const bounds = polygonBounds(points);
  return points.map((point) => ({
    x: point.x - bounds.minX,
    y: point.y - bounds.minY
  }));
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function polygonPerimeter(points) {
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    perimeter += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return perimeter;
}

function parseOutlineSegments(text) {
  const points = [{ x: 0, y: 0 }];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const match = line.match(/^(north|south|east|west|n|s|e|w)\s+(-?\d+(?:\.\d+)?)$/i);
    if (!match) {
      throw new Error(`Segment ${index + 1} must look like "E 144" or "North 96".`);
    }

    const direction = match[1][0].toUpperCase();
    const length = Number(match[2]);
    if (!Number.isFinite(length) || length <= 0) {
      throw new Error(`Segment ${index + 1} length must be greater than 0.`);
    }

    const previous = points[points.length - 1];
    const next = { x: previous.x, y: previous.y };
    if (direction === "E") next.x += length;
    if (direction === "W") next.x -= length;
    if (direction === "S") next.y += length;
    if (direction === "N") next.y -= length;
    points.push(next);
  });

  const end = points[points.length - 1];
  if (Math.abs(end.x) > 0.001 || Math.abs(end.y) > 0.001) {
    throw new Error(`Custom outline does not close. Current end is ${formatInches(end.x)}, ${formatInches(end.y)}.`);
  }

  points.pop();
  if (points.length < 4) {
    throw new Error("Custom outline needs at least 4 segments.");
  }

  return normalizePolygon(points);
}

function rectanglePolygon(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ];
}

function buildRoom(values) {
  const polygon = values.shapeMode === "custom"
    ? parseOutlineSegments(values.outlineSegments)
    : rectanglePolygon(values.roomLength, values.roomWidth);
  const bounds = polygonBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const area = polygonArea(polygon);
  const perimeter = polygonPerimeter(polygon);

  if (area <= 0) {
    throw new Error("Room area must be greater than 0.");
  }

  return {
    polygon,
    width,
    height,
    area,
    perimeter,
    runAxis: values.orientation === "long"
      ? (width >= height ? "length" : "width")
      : (width >= height ? "width" : "length")
  };
}

function polygonIntervalsAt(polygon, axis, sample) {
  const crossings = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];

    if (axis === "length" && Math.abs(current.x - next.x) < 0.001) {
      const low = Math.min(current.y, next.y);
      const high = Math.max(current.y, next.y);
      if (sample >= low && sample < high) {
        crossings.push(current.x);
      }
    }

    if (axis === "width" && Math.abs(current.y - next.y) < 0.001) {
      const low = Math.min(current.x, next.x);
      const high = Math.max(current.x, next.x);
      if (sample >= low && sample < high) {
        crossings.push(current.y);
      }
    }
  }

  crossings.sort((a, b) => a - b);
  const intervals = [];
  for (let index = 0; index < crossings.length - 1; index += 2) {
    if (crossings[index + 1] - crossings[index] > MIN_VISIBLE_PLANK) {
      intervals.push([crossings[index], crossings[index + 1]]);
    }
  }
  return intervals;
}

function wallBlockedRects(values) {
  if (!values.enableDividerWall || values.wallThickness <= 0 || values.wallLength <= 0) {
    return [];
  }

  const doorStart = Math.max(0, Math.min(values.doorOffset, values.wallLength));
  const doorEnd = Math.max(doorStart, Math.min(values.doorOffset + values.doorWidth, values.wallLength));
  const spans = [
    [0, doorStart],
    [doorEnd, values.wallLength]
  ].filter(([start, end]) => end - start > MIN_VISIBLE_PLANK);

  return spans.map(([start, end]) => {
    if (values.wallOrientation === "vertical") {
      return {
        x1: values.wallX,
        y1: values.wallY + start,
        x2: values.wallX + values.wallThickness,
        y2: values.wallY + end
      };
    }
    return {
      x1: values.wallX + start,
      y1: values.wallY,
      x2: values.wallX + end,
      y2: values.wallY + values.wallThickness
    };
  });
}

function subtractInterval(intervals, cutStart, cutEnd) {
  const result = [];
  intervals.forEach(([start, end]) => {
    if (cutEnd <= start || cutStart >= end) {
      result.push([start, end]);
      return;
    }
    if (cutStart - start > MIN_VISIBLE_PLANK) {
      result.push([start, cutStart]);
    }
    if (end - cutEnd > MIN_VISIBLE_PLANK) {
      result.push([cutEnd, end]);
    }
  });
  return result;
}

function subtractWallsFromIntervals(intervals, axis, sample, blockedRects) {
  let current = intervals;
  blockedRects.forEach((rect) => {
    if (axis === "length" && sample >= rect.y1 && sample < rect.y2) {
      current = subtractInterval(current, rect.x1, rect.x2);
    }
    if (axis === "width" && sample >= rect.x1 && sample < rect.x2) {
      current = subtractInterval(current, rect.y1, rect.y2);
    }
  });
  return current;
}

function pointOnSegment(point, start, end) {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 0.001) return false;
  return (
    point.x >= Math.min(start.x, end.x) - 0.001
    && point.x <= Math.max(start.x, end.x) + 0.001
    && point.y >= Math.min(start.y, end.y) - 0.001
    && point.y <= Math.max(start.y, end.y) + 0.001
  );
}

function pointInPolygon(point, polygon) {
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length])) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const last = polygon[previous];
    const intersects = (
      current.y > point.y
    ) !== (
      last.y > point.y
    ) && point.x < ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function rectFullyInsidePolygon(rect, polygon) {
  const inset = 0.01;
  const points = [
    { x: rect.x + inset, y: rect.y + inset },
    { x: rect.x + rect.width - inset, y: rect.y + inset },
    { x: rect.x + rect.width - inset, y: rect.y + rect.height - inset },
    { x: rect.x + inset, y: rect.y + rect.height - inset }
  ];
  return points.every((point) => pointInPolygon(point, polygon));
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x2 - 0.001
    && a.x + a.width > b.x1 + 0.001
    && a.y < b.y2 - 0.001
    && a.y + a.height > b.y1 + 0.001
  );
}

function runRectToRoomRect(x, y, length, width, runAxis) {
  if (runAxis === "length") {
    return { x, y, width: length, height: width };
  }
  return { x: y, y: x, width, height: length };
}

function pointToLayout(point, room, values) {
  const fromWest = values.startCorner.includes("W");
  const fromNorth = values.startCorner.includes("N");

  if (room.runAxis === "length") {
    return {
      x: fromWest ? point.x : room.width - point.x,
      y: fromNorth ? point.y : room.height - point.y
    };
  }

  return {
    x: fromNorth ? point.y : room.height - point.y,
    y: fromWest ? point.x : room.width - point.x
  };
}

function pointFromLayout(point, room, values) {
  const fromWest = values.startCorner.includes("W");
  const fromNorth = values.startCorner.includes("N");

  if (room.runAxis === "length") {
    return {
      x: fromWest ? point.x : room.width - point.x,
      y: fromNorth ? point.y : room.height - point.y
    };
  }

  return {
    x: fromWest ? point.y : room.width - point.y,
    y: fromNorth ? point.x : room.height - point.x
  };
}

function rectFromTransformedCorners(corners) {
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function roomRectToLayoutRect(rect, room, values) {
  return rectFromTransformedCorners([
    pointToLayout({ x: rect.x, y: rect.y }, room, values),
    pointToLayout({ x: rect.x + rect.width, y: rect.y }, room, values),
    pointToLayout({ x: rect.x + rect.width, y: rect.y + rect.height }, room, values),
    pointToLayout({ x: rect.x, y: rect.y + rect.height }, room, values)
  ]);
}

function layoutRectToRoomRect(rect, room, values) {
  return rectFromTransformedCorners([
    pointFromLayout({ x: rect.x, y: rect.y }, room, values),
    pointFromLayout({ x: rect.x + rect.width, y: rect.y }, room, values),
    pointFromLayout({ x: rect.x + rect.width, y: rect.y + rect.height }, room, values),
    pointFromLayout({ x: rect.x, y: rect.y + rect.height }, room, values)
  ]);
}

function roomWallToLayoutRect(rect, room, values) {
  const layoutRect = roomRectToLayoutRect(
    { x: rect.x1, y: rect.y1, width: rect.x2 - rect.x1, height: rect.y2 - rect.y1 },
    room,
    values
  );
  return {
    x1: layoutRect.x,
    y1: layoutRect.y,
    x2: layoutRect.x + layoutRect.width,
    y2: layoutRect.y + layoutRect.height
  };
}

function layoutRoomForInstall(room, values) {
  const polygon = room.polygon.map((point) => pointToLayout(point, room, values));
  const bounds = polygonBounds(polygon);
  return {
    polygon,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    area: room.area
  };
}

function clippedBoundsForRoomRect(rect, room, blockedRects) {
  const splits = new Set([
    Number(rect.y.toFixed(3)),
    Number((rect.y + rect.height).toFixed(3))
  ]);

  room.polygon.forEach((point) => {
    if (point.y > rect.y + 0.001 && point.y < rect.y + rect.height - 0.001) {
      splits.add(Number(point.y.toFixed(3)));
    }
  });
  blockedRects.forEach((blocked) => {
    if (blocked.y1 > rect.y + 0.001 && blocked.y1 < rect.y + rect.height - 0.001) {
      splits.add(Number(blocked.y1.toFixed(3)));
    }
    if (blocked.y2 > rect.y + 0.001 && blocked.y2 < rect.y + rect.height - 0.001) {
      splits.add(Number(blocked.y2.toFixed(3)));
    }
  });

  const points = [...splits].sort((a, b) => a - b);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visibleBands = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const y1 = points[index];
    const y2 = points[index + 1];
    if (y2 - y1 <= MIN_VISIBLE_PLANK) continue;

    const sample = (y1 + y2) / 2;
    const intervals = subtractWallsFromIntervals(
      polygonIntervalsAt(room.polygon, "length", sample),
      "length",
      sample,
      blockedRects
    );

    intervals.forEach(([start, end]) => {
      const x1 = Math.max(rect.x, start);
      const x2 = Math.min(rect.x + rect.width, end);
      if (x2 - x1 > MIN_VISIBLE_PLANK) {
        minX = Math.min(minX, x1);
        minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2);
        maxY = Math.max(maxY, y2);
        visibleBands.push({ x1, x2, y1, y2 });
      }
    });
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  const firstBand = visibleBands[0];
  const edgeRip = visibleBands.some((band) => {
    return (
      Math.abs(band.x1 - firstBand.x1) > 0.001
      || Math.abs(band.x2 - firstBand.x2) > 0.001
    );
  }) || minY > rect.y + 0.001 || maxY < rect.y + rect.height - 0.001;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    edgeRip
  };
}

function dimensionsFromRoomRect(rect, runAxis) {
  if (runAxis === "length") {
    return { length: rect.width, width: rect.height };
  }
  return { length: rect.height, width: rect.width };
}

function orientedDimensions(roomLength, roomWidth, orientation) {
  const longSide = Math.max(roomLength, roomWidth);
  const shortSide = Math.min(roomLength, roomWidth);
  if (orientation === "long") {
    return {
      runLength: longSide,
      rowDepth: shortSide,
      runAxis: roomLength >= roomWidth ? "length" : "width"
    };
  }
  return {
    runLength: shortSide,
    rowDepth: longSide,
    runAxis: roomLength >= roomWidth ? "width" : "length"
  };
}

function ripPlan(rowDepth, plankWidth, minRipWidth) {
  const rows = Math.ceil(rowDepth / plankWidth);
  if (rows <= 1) {
    return {
      rows,
      widths: [rowDepth],
      firstRip: rowDepth,
      lastRip: rowDepth,
      adjusted: rowDepth < Math.min(minRipWidth, plankWidth)
    };
  }

  const leftover = rowDepth - Math.floor(rowDepth / plankWidth) * plankWidth;
  if (leftover < MIN_VISIBLE_PLANK) {
    return {
      rows,
      widths: Array(rows).fill(plankWidth),
      firstRip: plankWidth,
      lastRip: plankWidth,
      adjusted: false
    };
  }

  let firstRip = plankWidth;
  let lastRip = leftover;
  let adjusted = false;
  const targetRip = Math.min(minRipWidth, plankWidth);

  if (lastRip < plankWidth - 0.001 || lastRip < targetRip) {
    const balancedEdgeRip = (plankWidth + lastRip) / 2;
    firstRip = balancedEdgeRip;
    lastRip = balancedEdgeRip;
    adjusted = true;
  }

  const widths = [firstRip];
  for (let row = 1; row < rows - 1; row += 1) {
    widths.push(plankWidth);
  }
  widths.push(lastRip);
  return { rows, widths, firstRip, lastRip, adjusted };
}

function visibleLengthsForOffset(intervals, plankLength, offset) {
  const lengths = [];

  intervals.forEach(([intervalStart, intervalEnd]) => {
    let x = Math.floor((intervalStart + offset) / plankLength) * plankLength - offset;

    while (x < intervalEnd - MIN_VISIBLE_PLANK) {
      const visibleStart = Math.max(x, intervalStart);
      const visibleEnd = Math.min(x + plankLength, intervalEnd);
      const length = visibleEnd - visibleStart;
      if (length > MIN_VISIBLE_PLANK) {
        lengths.push(length);
      }
      x += plankLength;
    }
  });

  return lengths;
}

function offsetScore(intervals, plankLength, minEndCut, nominalOffset, offset) {
  const lengths = visibleLengthsForOffset(intervals, plankLength, offset);
  const cutLengths = lengths.filter((length) => length < plankLength - 0.001);
  const shortfall = cutLengths.reduce((sum, length) => {
    return sum + Math.max(0, minEndCut - length);
  }, 0);
  const shortestCut = cutLengths.length ? Math.min(...cutLengths) : plankLength;
  return {
    offset,
    shortfall,
    shortestCut,
    distance: Math.abs(offset - nominalOffset)
  };
}

function chooseOffset(intervals, plankLength, minEndCut, nominalOffset) {
  const maxOffset = Math.max(0, plankLength - MIN_VISIBLE_PLANK);
  const step = Math.max(0.25, plankLength / 192);
  const candidates = new Set([
    0,
    maxOffset,
    nominalOffset,
    Math.max(0, nominalOffset - minEndCut),
    Math.min(maxOffset, nominalOffset + minEndCut),
    Math.max(0, plankLength - minEndCut),
    Math.min(maxOffset, minEndCut)
  ]);

  intervals.forEach(([intervalStart]) => {
    candidates.add(Number((positiveModulo(-intervalStart, plankLength)).toFixed(3)));
    candidates.add(Number((positiveModulo(minEndCut - intervalStart, plankLength)).toFixed(3)));
    candidates.add(Number((positiveModulo(plankLength - minEndCut - intervalStart, plankLength)).toFixed(3)));
  });

  for (let offset = 0; offset <= maxOffset; offset += step) {
    candidates.add(Number(offset.toFixed(3)));
  }

  return [...candidates]
    .filter((offset) => offset >= 0 && offset <= maxOffset)
    .map((offset) => offsetScore(intervals, plankLength, minEndCut, nominalOffset, offset))
    .sort((a, b) => {
      if (a.shortfall !== b.shortfall) return a.shortfall - b.shortfall;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.shortestCut - a.shortestCut;
    })[0];
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(([start, end]) => end - start > MIN_VISIBLE_PLANK)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];

  sorted.forEach(([start, end]) => {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1] + 0.001) {
      previous[1] = Math.max(previous[1], end);
      return;
    }
    merged.push([start, end]);
  });

  return merged;
}

function buildLayout(room, values) {
  const { plankLength, plankWidth, minEndCut, minRipWidth, staggerDivisions } = values;
  const layoutRoom = layoutRoomForInstall(room, values);
  const rowDepth = layoutRoom.height;
  const blockedRects = wallBlockedRects(values).map((rect) => roomWallToLayoutRect(rect, room, values));
  const rips = ripPlan(rowDepth, plankWidth, minRipWidth);
  const pieces = [];
  let adjustedStaggers = 0;

  const rowBoundaries = [0];
  rips.widths.reduce((position, width) => {
    const next = position + width;
    rowBoundaries.push(next);
    return next;
  }, 0);

  const layoutSplitPoints = new Set();
  layoutRoom.polygon.forEach((point) => {
    if (point.y > 0.001 && point.y < rowDepth - 0.001) {
      layoutSplitPoints.add(Number(point.y.toFixed(3)));
    }
  });
  blockedRects.forEach((rect) => {
    if (rect.y1 > 0.001 && rect.y1 < rowDepth - 0.001) {
      layoutSplitPoints.add(Number(rect.y1.toFixed(3)));
    }
    if (rect.y2 > 0.001 && rect.y2 < rowDepth - 0.001) {
      layoutSplitPoints.add(Number(rect.y2.toFixed(3)));
    }
  });

  const internalSplitPoints = [...layoutSplitPoints]
    .filter((point) => point >= 0 && point <= rowDepth)
    .sort((a, b) => a - b);

  function intervalsForRow(rowStart, rowEnd) {
    const samples = new Set([Number(((rowStart + rowEnd) / 2).toFixed(3))]);
    internalSplitPoints.forEach((point) => {
      if (point > rowStart + 0.001 && point < rowEnd - 0.001) {
        samples.add(Number(((rowStart + point) / 2).toFixed(3)));
        samples.add(Number(((point + rowEnd) / 2).toFixed(3)));
      }
    });

    const intervals = [];
    samples.forEach((sample) => {
      subtractWallsFromIntervals(
        polygonIntervalsAt(layoutRoom.polygon, "length", sample),
        "length",
        sample,
        blockedRects
      ).forEach((interval) => intervals.push(interval));
    });

    return mergeIntervals(intervals);
  }

  const offsetsByRow = new Map();
  const intervalsByRow = new Map();
  for (let row = 0; row < rowBoundaries.length - 1; row += 1) {
    const rowStart = rowBoundaries[row];
    const rowEnd = rowBoundaries[row + 1];
    const nominalOffset = (row % staggerDivisions) * plankLength / staggerDivisions;
    const rowIntervals = intervalsForRow(rowStart, rowEnd);
    intervalsByRow.set(row, rowIntervals);
    if (!rowIntervals.length) {
      offsetsByRow.set(row, nominalOffset);
      continue;
    }
    const offsetChoice = chooseOffset(rowIntervals, plankLength, minEndCut, nominalOffset);
    offsetsByRow.set(row, offsetChoice.offset);
    if (Math.abs(offsetChoice.offset - nominalOffset) > 0.01) {
      adjustedStaggers += 1;
    }
  }

  for (let row = 0; row < rowBoundaries.length - 1; row += 1) {
    const y = rowBoundaries[row];
    const width = rowBoundaries[row + 1] - rowBoundaries[row];
    if (width <= MIN_VISIBLE_PLANK) continue;
    const floorIntervals = intervalsByRow.get(row) || [];
    const offset = offsetsByRow.get(row) ?? 0;

    floorIntervals.forEach(([intervalStart, intervalEnd]) => {
      let x = Math.floor((intervalStart + offset) / plankLength) * plankLength - offset;

      while (x < intervalEnd - MIN_VISIBLE_PLANK) {
        const visibleStart = Math.max(x, intervalStart);
        const visibleEnd = Math.min(x + plankLength, intervalEnd);
        const length = visibleEnd - visibleStart;
        if (length > MIN_VISIBLE_PLANK) {
          const layoutRect = { x: visibleStart, y, width: length, height: width };
          const outlineCut = !rectFullyInsidePolygon(layoutRect, layoutRoom.polygon);
          const wallCut = blockedRects.some((rect) => rectsOverlap(layoutRect, rect));
          const clippedRect = clippedBoundsForRoomRect(layoutRect, layoutRoom, blockedRects) || layoutRect;
          const cutDimensions = dimensionsFromRoomRect(clippedRect, "length");
          pieces.push({
            x: visibleStart,
            y,
            length,
            width,
            cutLength: cutDimensions.length,
            cutWidth: cutDimensions.width,
            offset,
            touchesStart: visibleStart <= intervalStart + MIN_VISIBLE_PLANK,
            touchesEnd: visibleEnd >= intervalEnd - MIN_VISIBLE_PLANK,
            outlineCut,
            wallCut,
            edgeRip: Boolean(clippedRect.edgeRip),
            row,
            full: (
              Math.abs(length - plankLength) < 0.001
              && Math.abs(width - plankWidth) < 0.001
              && !outlineCut
              && !wallCut
              && !clippedRect.edgeRip
            )
          });
        }
        x += plankLength;
      }
    });
  }

  return { pieces, rips, adjustedStaggers };
}

function sideLabel(piece) {
  if (piece.wallCut) return "wall edge";
  if (piece.outlineCut) return "room outline";
  if (piece.touchesStart && piece.touchesEnd) return "between room edges";
  if (piece.touchesStart && !piece.touchesEnd) return "start side";
  if (piece.touchesEnd && !piece.touchesStart) return "end side";
  return "room edge";
}

function packCompatibleCuts(pieces, values) {
  const bins = [];
  let reusedPieces = 0;
  const cuts = pieces
    .filter((piece) => cutLength(piece) < values.plankLength - 0.001)
    .map((piece) => ({
      length: Math.round(cutLength(piece) * 100) / 100,
      width: Math.round(cutWidth(piece) * 100) / 100,
      kind: cutKind(piece, values),
      profile: keepProfile(piece, values),
      side: sideLabel(piece),
      row: piece.row + 1
    }))
    .sort((a, b) => {
      if (b.width !== a.width) return b.width - a.width;
      return b.length - a.length;
    });

  cuts.forEach((cut) => {
    let placed = false;
    for (let i = 0; i < bins.length; i += 1) {
      if (
        Math.abs(cut.width - bins[i].width) < 0.001
        && cut.length <= bins[i].remaining + 0.001
      ) {
        bins[i].remaining -= cut.length;
        bins[i].cuts.push(cut);
        reusedPieces += 1;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push({
        width: cut.width,
        remaining: values.plankLength - cut.length,
        cuts: [cut]
      });
    }
  });

  const leftoverLength = bins.reduce((sum, bin) => sum + bin.remaining, 0);
  return {
    stockPlanks: bins.length,
    reusedPieces,
    leftoverLength,
    bins
  };
}

function estimateMaterial(pieces, values, floorArea = null) {
  const fullCount = pieces.filter((piece) => piece.full).length;
  const cutCount = pieces.filter((piece) => !piece.full).length;
  const cutPacking = packCompatibleCuts(pieces, values);
  const installedArea = floorArea ?? pieces.reduce((sum, piece) => sum + piece.length * piece.width, 0);
  const plankArea = values.plankLength * values.plankWidth;
  const lengthBasedCount = fullCount + cutPacking.stockPlanks;
  const areaBasedCount = Math.ceil(installedArea / plankArea);
  const plankCount = Math.max(lengthBasedCount, areaBasedCount);
  const purchasedArea = plankCount * plankArea;
  const wasteArea = Math.max(purchasedArea - installedArea, 0);
  return {
    fullCount,
    cutCount,
    rows: Math.max(-1, ...pieces.map((piece) => piece.row)) + 1,
    plankCount,
    cutStockPlanks: cutPacking.stockPlanks,
    offcutsReused: cutPacking.reusedPieces,
    endCutWasteLength: cutPacking.leftoverLength,
    cutPacking,
    installedArea,
    purchasedArea,
    wasteRoom: installedArea ? wasteArea / installedArea * 100 : 0,
    wastePurchased: purchasedArea ? wasteArea / purchasedArea * 100 : 0
  };
}

function formatInches(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
}

function cutLength(piece) {
  return piece.cutLength ?? piece.length;
}

function cutWidth(piece) {
  return piece.cutWidth ?? piece.width;
}

function cutKind(piece, values) {
  const endCut = cutLength(piece) < values.plankLength - 0.001;
  const ripCut = piece.edgeRip || cutWidth(piece) < values.plankWidth - 0.001;
  const edgeCut = piece.outlineCut || piece.wallCut;
  if (edgeCut && endCut && ripCut) return "end + rip + edge";
  if (edgeCut && endCut) return "end + edge";
  if (edgeCut && ripCut) return "rip + edge";
  if (edgeCut) return "edge cut";
  if (endCut && ripCut) return "end + rip";
  if (ripCut) return "rip";
  return "end";
}

function oppositeProfile(profile) {
  return profile === "tongue" ? "groove" : "tongue";
}

function keepProfile(piece, values) {
  const endCut = cutLength(piece) < values.plankLength - 0.001;
  const ripCut = piece.edgeRip || cutWidth(piece) < values.plankWidth - 0.001;
  const edgeCut = piece.outlineCut || piece.wallCut;
  const startProfile = values.starterProfile;
  const endProfile = oppositeProfile(startProfile);

  if (endCut && piece.touchesStart && !piece.touchesEnd) {
    return `keep ${endProfile}`;
  }
  if (endCut && piece.touchesEnd && !piece.touchesStart) {
    return `keep ${startProfile}`;
  }
  if (endCut && piece.touchesStart && piece.touchesEnd) {
    return "cut both ends";
  }
  if (endCut) {
    return "cut at room edge";
  }
  if (edgeCut) {
    return "template to edge";
  }
  if (ripCut) {
    return "keep both ends";
  }
  return "";
}

function kindRank(kind) {
  if (kind === "rip") return 0;
  if (kind === "end + rip") return 1;
  return 2;
}

function buildCutList(pieces, values) {
  const grouped = new Map();
  pieces
    .filter((piece) => !piece.full)
    .forEach((piece) => {
      const length = Math.round(cutLength(piece) * 100) / 100;
      const width = Math.round(cutWidth(piece) * 100) / 100;
      const kind = cutKind(piece, values);
      const profile = keepProfile(piece, values);
      const key = `${length}|${width}|${kind}|${profile}`;
      const existing = grouped.get(key) || { length, width, kind, profile, qty: 0 };
      existing.qty += 1;
      grouped.set(key, existing);
    });

  return [...grouped.values()].sort((a, b) => {
    if (a.kind !== b.kind) return kindRank(a.kind) - kindRank(b.kind);
    if (b.length !== a.length) return b.length - a.length;
    return b.width - a.width;
  });
}

function buildRipList(pieces, values) {
  const grouped = new Map();
  pieces
    .filter((piece) => {
      const ripCut = piece.edgeRip || cutWidth(piece) < values.plankWidth - 0.001;
      return ripCut;
    })
    .forEach((piece) => {
      const length = Math.round(cutLength(piece) * 100) / 100;
      const width = Math.round(cutWidth(piece) * 100) / 100;
      const kind = cutKind(piece, values);
      const profile = keepProfile(piece, values);
      const key = `${length}|${width}|${kind}|${profile}`;
      const existing = grouped.get(key) || { length, width, kind, profile, qty: 0 };
      existing.qty += 1;
      grouped.set(key, existing);
    });

  return [...grouped.values()].sort((a, b) => {
    if (b.width !== a.width) return b.width - a.width;
    if (b.length !== a.length) return b.length - a.length;
    return kindRank(a.kind) - kindRank(b.kind);
  });
}

function renderCutList(target, cuts, emptyText) {
  target.innerHTML = "";
  if (!cuts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = emptyText;
    target.appendChild(empty);
    return;
  }

  cuts.forEach((cut) => {
    const row = document.createElement("div");
    row.className = "cut-row";
    const qty = document.createElement("strong");
    qty.textContent = `${cut.qty}x`;
    const dimensions = document.createElement("div");
    dimensions.textContent = `${formatInches(cut.length)}" L x ${formatInches(cut.width)}" W`;
    const kind = document.createElement("span");
    kind.textContent = cut.profile ? `${cut.kind}, ${cut.profile}` : cut.kind;
    row.append(qty, dimensions, kind);
    target.appendChild(row);
  });
}

function cutDescription(cut) {
  const profile = cut.profile ? `, ${cut.profile}` : "";
  return `${formatInches(cut.length)}" x ${formatInches(cut.width)}" ${cut.kind}${profile}, row ${cut.row} ${cut.side}`;
}

function renderCutGroups(packing, values) {
  els.cutGroups.innerHTML = "";
  if (!packing.bins.length) {
    const empty = document.createElement("div");
    empty.className = "empty-list";
    empty.textContent = "No end-cut stock groups.";
    els.cutGroups.appendChild(empty);
    return;
  }

  packing.bins.forEach((bin, index) => {
    const row = document.createElement("div");
    row.className = "pack-row";

    const title = document.createElement("strong");
    const cutCount = bin.cuts.length;
    const widthNote = Math.abs(bin.width - values.plankWidth) < 0.001
      ? "full-width plank"
      : `${formatInches(bin.width)}" ripped-width plank`;
    title.textContent = `Cut plank ${index + 1}: ${cutCount} piece${cutCount === 1 ? "" : "s"} from one ${formatInches(values.plankLength)}" ${widthNote}`;

    const details = document.createElement("span");
    details.textContent = bin.cuts.map(cutDescription).join(" | ");

    const waste = document.createElement("span");
    waste.textContent = `${formatInches(bin.remaining)}" length left over after these cuts`;

    row.append(title, details, waste);
    els.cutGroups.appendChild(row);
  });
}

function pieceLabel(piece, values) {
  const kind = cutKind(piece, values);
  const profile = keepProfile(piece, values);
  const profileText = profile ? `, ${profile}` : "";
  return `${kind}${profileText}`;
}

function pieceToRoomRect(piece, room, values) {
  return layoutRectToRoomRect(
    { x: piece.x, y: piece.y, width: piece.length, height: piece.width },
    room,
    values
  );
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.ceil(rect.width * ratio));
  canvas.height = Math.max(1, Math.ceil(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return rect;
}

function crisp(value) {
  return Math.round(value) + 0.5;
}

function crispRect(x, y, width, height) {
  const left = Math.round(x);
  const top = Math.round(y);
  const right = Math.round(x + width);
  const bottom = Math.round(y + height);
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function fillAndStrokeRect(x, y, width, height, fill, stroke, lineWidth = 1) {
  const rect = crispRect(x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(
    crisp(rect.x),
    crisp(rect.y),
    Math.max(1, rect.width - 1),
    Math.max(1, rect.height - 1)
  );
  return rect;
}

function traceRoomPath(room, pointToCanvas) {
  ctx.beginPath();
  room.polygon.forEach((point, index) => {
    const canvasPoint = pointToCanvas(point);
    if (index === 0) {
      ctx.moveTo(crisp(canvasPoint.x), crisp(canvasPoint.y));
    } else {
      ctx.lineTo(crisp(canvasPoint.x), crisp(canvasPoint.y));
    }
  });
  ctx.closePath();
}

function drawGrain(x, y, width, height, full) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.strokeStyle = full ? "#8b5b24" : "#255b72";
  ctx.globalAlpha = full ? 0.16 : 0.18;
  ctx.lineWidth = 1;
  if (full) {
    const lines = height > 20 ? [0.5] : [];
    lines.forEach((part) => {
      ctx.beginPath();
      ctx.moveTo(crisp(x + 6), crisp(y + height * part));
      ctx.lineTo(crisp(x + width - 6), crisp(y + height * part));
      ctx.stroke();
    });
  } else {
    for (let lineX = x - height; lineX < x + width + height; lineX += 18) {
      ctx.beginPath();
      ctx.moveTo(crisp(lineX), crisp(y + height));
      ctx.lineTo(crisp(lineX + height), crisp(y));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function fitViewToCanvas(rect, room) {
  const padding = 42;
  const availableW = Math.max(120, rect.width - padding * 2);
  const availableH = Math.max(120, rect.height - padding * 2);
  const scale = Math.min(availableW / room.width, availableH / room.height);
  return {
    scale,
    x: (rect.width - room.width * scale) / 2,
    y: (rect.height - room.height * scale) / 2,
    fitted: true
  };
}

function draw(values = latestValues, room = latestRoom, pieces = latestPieces) {
  if (!values || !room) {
    return;
  }

  const rect = resizeCanvas();
  drawnPieces = [];
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#f8fafb";
  ctx.fillRect(0, 0, rect.width, rect.height);

  if (view.fitted) {
    view = fitViewToCanvas(rect, room);
  }

  const scale = view.scale;
  const originX = view.x;
  const originY = view.y;

  const pointToCanvas = (point) => ({
    x: originX + point.x * scale,
    y: originY + point.y * scale
  });

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#27323c";
  ctx.lineWidth = 2;
  traceRoomPath(room, pointToCanvas);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  traceRoomPath(room, pointToCanvas);
  ctx.clip();

  pieces.forEach((piece) => {
    const roomPiece = pieceToRoomRect(piece, room, values);
    const x = originX + roomPiece.x * scale;
    const y = originY + roomPiece.y * scale;
    const width = roomPiece.width * scale;
    const height = roomPiece.height * scale;
    const rect = fillAndStrokeRect(
      x,
      y,
      width,
      height,
      piece.full ? "#d9a260" : "#78acc9",
      piece.full ? "#9a6a33" : "#3e7188"
    );
    drawnPieces.push({ piece, x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    if (rect.width > 18 && rect.height > 8) {
      drawGrain(rect.x, rect.y, rect.width, rect.height, piece.full);
    }
  });
  ctx.restore();

  wallBlockedRects(values).forEach((wall) => {
    fillAndStrokeRect(
      originX + wall.x1 * scale,
      originY + wall.y1 * scale,
      (wall.x2 - wall.x1) * scale,
      (wall.y2 - wall.y1) * scale,
      "rgba(67, 76, 86, 0.72)",
      "#2d3640"
    );
  });

  ctx.strokeStyle = "#27323c";
  ctx.lineWidth = 2;
  traceRoomPath(room, pointToCanvas);
  ctx.stroke();

  ctx.fillStyle = "#20262d";
  ctx.font = "700 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(`${formatInches(room.width)}" x ${formatInches(room.height)}" bounds`, originX, Math.max(18, originY - 14));
}

function pieceAtPoint(x, y) {
  for (let index = drawnPieces.length - 1; index >= 0; index -= 1) {
    const drawn = drawnPieces[index];
    if (
      x >= drawn.x
      && x <= drawn.x + drawn.width
      && y >= drawn.y
      && y <= drawn.y + drawn.height
    ) {
      return drawn.piece.full ? null : drawn;
    }
  }
  return null;
}

function setPopoverContent(piece, values) {
  piecePopover.replaceChildren();

  const title = document.createElement("strong");
  title.textContent = `${formatInches(cutLength(piece))}" L x ${formatInches(cutWidth(piece))}" W`;

  const cut = document.createElement("span");
  cut.textContent = pieceLabel(piece, values);

  const row = document.createElement("span");
  row.textContent = `Row ${piece.row + 1}, ${sideLabel(piece)}`;

  piecePopover.append(title, cut);
  if (piece.edgeRip && Math.abs(cutWidth(piece) - values.plankWidth) < 0.001) {
    const note = document.createElement("span");
    note.textContent = "notched edge rip, template to outline";
    piecePopover.appendChild(note);
  }
  piecePopover.appendChild(row);
}

function showPiecePopover(event, drawn) {
  if (!latestValues || !drawn) {
    hidePiecePopover();
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const previewRect = canvas.parentElement.getBoundingClientRect();
  const localX = event.clientX - canvasRect.left;
  const localY = event.clientY - canvasRect.top;

  setPopoverContent(drawn.piece, latestValues);
  piecePopover.hidden = false;

  const popoverRect = piecePopover.getBoundingClientRect();
  let left = canvasRect.left - previewRect.left + localX + 12;
  let top = canvasRect.top - previewRect.top + localY + 12;
  const maxLeft = previewRect.width - popoverRect.width - 8;
  const maxTop = previewRect.height - popoverRect.height - 8;

  left = Math.max(8, Math.min(left, maxLeft));
  top = Math.max(8, Math.min(top, maxTop));
  piecePopover.style.left = `${left}px`;
  piecePopover.style.top = `${top}px`;
}

function hidePiecePopover() {
  piecePopover.hidden = true;
}

function handleCanvasPointer(event) {
  if (isPanning) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const drawn = pieceAtPoint(x, y);
  canvas.style.cursor = drawn ? "help" : "grab";
  showPiecePopover(event, drawn);
}

function handleWheel(event) {
  if (!latestRoom) {
    return;
  }

  event.preventDefault();
  hidePiecePopover();
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const worldX = (pointerX - view.x) / view.scale;
  const worldY = (pointerY - view.y) / view.scale;
  const factor = Math.exp(-event.deltaY * 0.001);
  const nextScale = Math.max(0.08, Math.min(view.scale * factor, 20));

  view = {
    scale: nextScale,
    x: pointerX - worldX * nextScale,
    y: pointerY - worldY * nextScale,
    fitted: false
  };
  draw();
}

function startPan(event) {
  if (event.button !== 0 || !latestRoom) {
    return;
  }

  isPanning = true;
  panStart = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    x: view.x,
    y: view.y
  };
  canvas.classList.add("is-panning");
  canvas.setPointerCapture(event.pointerId);
  hidePiecePopover();
}

function movePan(event) {
  if (!isPanning || !panStart || event.pointerId !== panStart.pointerId) {
    handleCanvasPointer(event);
    return;
  }

  view = {
    ...view,
    x: panStart.x + event.clientX - panStart.clientX,
    y: panStart.y + event.clientY - panStart.clientY,
    fitted: false
  };
  draw();
}

function endPan(event) {
  if (!isPanning || !panStart || event.pointerId !== panStart.pointerId) {
    return;
  }

  isPanning = false;
  panStart = null;
  canvas.classList.remove("is-panning");
  canvas.releasePointerCapture(event.pointerId);
}

function resetView() {
  view.fitted = true;
  hidePiecePopover();
  draw();
}

function fmtArea(area) {
  return `${(area / 144).toFixed(2)} sq ft`;
}

function fmtLength(inches) {
  return `${(inches / 12).toFixed(2)} ft (${formatInches(inches)}")`;
}

function floorAreaForEstimate(room, values) {
  const blockedArea = wallBlockedRects(values).reduce((sum, rect) => {
    return sum + Math.max(0, rect.x2 - rect.x1) * Math.max(0, rect.y2 - rect.y1);
  }, 0);
  return Math.max(0, room.area - blockedArea);
}

function pointInsideBlockedRects(point, blockedRects) {
  return blockedRects.some((rect) => (
    point.x > rect.x1 + 0.001
    && point.x < rect.x2 - 0.001
    && point.y > rect.y1 + 0.001
    && point.y < rect.y2 - 0.001
  ));
}

function exposedBlockedPerimeter(room, blockedRects) {
  const sampleOffset = 0.05;
  return blockedRects.reduce((sum, rect) => {
    const edges = [
      {
        length: Math.max(0, rect.y2 - rect.y1),
        sample: { x: rect.x1 - sampleOffset, y: (rect.y1 + rect.y2) / 2 }
      },
      {
        length: Math.max(0, rect.y2 - rect.y1),
        sample: { x: rect.x2 + sampleOffset, y: (rect.y1 + rect.y2) / 2 }
      },
      {
        length: Math.max(0, rect.x2 - rect.x1),
        sample: { x: (rect.x1 + rect.x2) / 2, y: rect.y1 - sampleOffset }
      },
      {
        length: Math.max(0, rect.x2 - rect.x1),
        sample: { x: (rect.x1 + rect.x2) / 2, y: rect.y2 + sampleOffset }
      }
    ];

    const exposed = edges.reduce((edgeSum, edge) => {
      if (pointInPolygon(edge.sample, room.polygon) && !pointInsideBlockedRects(edge.sample, blockedRects)) {
        return edgeSum + edge.length;
      }
      return edgeSum;
    }, 0);

    return sum + exposed;
  }, 0);
}

function perimeterForEstimate(room, values) {
  const blockedRects = wallBlockedRects(values);
  return room.perimeter + exposedBlockedPerimeter(room, blockedRects);
}

function update(options = {}) {
  try {
    if (options.persist !== false) {
      saveSettings();
    }
    syncModeVisibility();
    const values = currentInputs();
    const room = buildRoom(values);
    const layout = buildLayout(room, values);
    const pieces = layout.pieces;
    const estimate = estimateMaterial(pieces, values, floorAreaForEstimate(room, values));
    latestValues = values;
    latestRoom = room;
    latestPieces = pieces;
    view.fitted = true;
    els.shapeStatus.textContent = values.shapeMode === "custom"
      ? `Closed outline. Bounds ${formatInches(room.width)}" x ${formatInches(room.height)}", area ${fmtArea(room.area)}.`
      : "";
    els.planksNeeded.textContent = estimate.plankCount;
    els.fullPieces.textContent = estimate.fullCount;
    els.cutPieces.textContent = estimate.cutCount;
    els.rows.textContent = estimate.rows;
    els.firstRip.textContent = `${layout.rips.firstRip.toFixed(2)}"`;
    els.lastRip.textContent = `${layout.rips.lastRip.toFixed(2)}"`;
    els.adjustedRows.textContent = layout.adjustedStaggers;
    els.offcutsReused.textContent = estimate.offcutsReused;
    els.cutStockPlanks.textContent = estimate.cutStockPlanks;
    const ripCuts = buildRipList(pieces, values);
    els.ripOnlyPieces.textContent = ripCuts.reduce((sum, cut) => sum + cut.qty, 0);
    els.wasteRoom.textContent = `${estimate.wasteRoom.toFixed(1)}%`;
    els.wastePurchased.textContent = `${estimate.wastePurchased.toFixed(1)}%`;
    els.installedArea.textContent = fmtArea(estimate.installedArea);
    els.purchasedArea.textContent = fmtArea(estimate.purchasedArea);
    els.perimeterLength.textContent = fmtLength(perimeterForEstimate(room, values));
    els.reuseNote.textContent = (
      `Waste estimate reuses compatible cut ends for opposite-side gaps before counting leftover material. ` +
      `Estimated leftover end-cut length: ${formatInches(estimate.endCutWasteLength)}".`
    );
    renderCutList(els.ripList, ripCuts, "No ripped pieces.");
    renderCutList(els.cutList, buildCutList(pieces, values), "No cut pieces.");
    renderCutGroups(estimate.cutPacking, values);
    els.directionNote.textContent = `Planks run along the room ${room.runAxis}, starting ${values.startCorner}.`;
    els.error.textContent = "";
    hidePiecePopover();
    draw();
  } catch (error) {
    latestRoom = null;
    latestPieces = [];
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    els.shapeStatus.textContent = error.message;
    els.error.textContent = error.message;
  }
}

controls.forEach((control) => {
  control.addEventListener("input", update);
  control.addEventListener("change", update);
});
resetSettings.addEventListener("click", resetSavedSettings);
fitView.addEventListener("click", resetView);
canvas.addEventListener("wheel", handleWheel, { passive: false });
canvas.addEventListener("pointerdown", startPan);
canvas.addEventListener("pointermove", movePan);
canvas.addEventListener("pointerup", endPan);
canvas.addEventListener("pointercancel", endPan);
canvas.addEventListener("pointerleave", hidePiecePopover);
window.addEventListener("resize", () => {
  view.fitted = true;
  draw();
});
loadSavedSettings();
update();
