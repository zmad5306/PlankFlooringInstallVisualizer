const MIN_VISIBLE_PLANK = 0.01;
const STORAGE_KEY = "plank-floor-visualizer-settings";
const DEFAULT_SETTINGS = {
  roomLength: "144",
  roomWidth: "120",
  plankLength: "48",
  plankWidth: "7",
  minEndCut: "8",
  minRipWidth: "2",
  orientation: "long",
  starterProfile: "tongue"
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const controls = [...document.querySelectorAll("input, select")];
const resetSettings = document.getElementById("resetSettings");
const piecePopover = document.getElementById("piecePopover");
let drawnPieces = [];
let latestValues = null;

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
    roomLength: numberValue("roomLength", "Room length"),
    roomWidth: numberValue("roomWidth", "Room width"),
    plankLength: numberValue("plankLength", "Plank length"),
    plankWidth: numberValue("plankWidth", "Plank width"),
    minEndCut: nonNegativeValue("minEndCut", "Minimum end cut"),
    minRipWidth: nonNegativeValue("minRipWidth", "Minimum rip width"),
    orientation: document.querySelector("input[name='orientation']:checked").value,
    starterProfile: document.getElementById("starterProfile").value
  };
}

function selectedOrientationControl() {
  return document.querySelector("input[name='orientation']:checked");
}

function readSettingsFromControls() {
  return {
    roomLength: document.getElementById("roomLength").value,
    roomWidth: document.getElementById("roomWidth").value,
    plankLength: document.getElementById("plankLength").value,
    plankWidth: document.getElementById("plankWidth").value,
    minEndCut: document.getElementById("minEndCut").value,
    minRipWidth: document.getElementById("minRipWidth").value,
    orientation: selectedOrientationControl()?.value || DEFAULT_SETTINGS.orientation,
    starterProfile: document.getElementById("starterProfile").value
  };
}

function applySettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  document.getElementById("roomLength").value = merged.roomLength;
  document.getElementById("roomWidth").value = merged.roomWidth;
  document.getElementById("plankLength").value = merged.plankLength;
  document.getElementById("plankWidth").value = merged.plankWidth;
  document.getElementById("minEndCut").value = merged.minEndCut;
  document.getElementById("minRipWidth").value = merged.minRipWidth;
  document.getElementById("starterProfile").value = merged.starterProfile;

  const orientation = document.querySelector(`input[name='orientation'][value='${merged.orientation}']`);
  if (orientation) {
    orientation.checked = true;
  }
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

  if (lastRip < targetRip) {
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

function visibleLengthsForOffset(runLength, plankLength, offset) {
  const lengths = [];
  let x = -offset;
  while (x < runLength - MIN_VISIBLE_PLANK) {
    const visibleStart = Math.max(x, 0);
    const visibleEnd = Math.min(x + plankLength, runLength);
    const length = visibleEnd - visibleStart;
    if (length > MIN_VISIBLE_PLANK) {
      lengths.push(length);
    }
    x += plankLength;
  }
  return lengths;
}

function offsetScore(runLength, plankLength, minEndCut, nominalOffset, offset) {
  const lengths = visibleLengthsForOffset(runLength, plankLength, offset);
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

function chooseOffset(runLength, plankLength, minEndCut, nominalOffset) {
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

  for (let offset = 0; offset <= maxOffset; offset += step) {
    candidates.add(Number(offset.toFixed(3)));
  }

  return [...candidates]
    .filter((offset) => offset >= 0 && offset <= maxOffset)
    .map((offset) => offsetScore(runLength, plankLength, minEndCut, nominalOffset, offset))
    .sort((a, b) => {
      if (a.shortfall !== b.shortfall) return a.shortfall - b.shortfall;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.shortestCut - a.shortestCut;
    })[0];
}

function buildLayout(runLength, rowDepth, values) {
  const { plankLength, plankWidth, minEndCut, minRipWidth } = values;
  const rips = ripPlan(rowDepth, plankWidth, minRipWidth);
  const pieces = [];
  let adjustedStaggers = 0;
  let y = 0;

  for (let row = 0; row < rips.rows; row += 1) {
    const width = rips.widths[row];
    const nominalOffset = (row % 3) * plankLength / 3;
    const offsetChoice = chooseOffset(runLength, plankLength, minEndCut, nominalOffset);
    const offset = offsetChoice.offset;
    if (Math.abs(offset - nominalOffset) > 0.01) {
      adjustedStaggers += 1;
    }
    let x = -offset;

    while (x < runLength - MIN_VISIBLE_PLANK) {
      const visibleStart = Math.max(x, 0);
      const visibleEnd = Math.min(x + plankLength, runLength);
      const length = visibleEnd - visibleStart;
      if (length > MIN_VISIBLE_PLANK) {
        pieces.push({
          x: visibleStart,
          y,
          length,
          width,
          offset,
          touchesStart: visibleStart <= MIN_VISIBLE_PLANK,
          touchesEnd: visibleEnd >= runLength - MIN_VISIBLE_PLANK,
          row,
          full: Math.abs(length - plankLength) < 0.001 && Math.abs(width - plankWidth) < 0.001
        });
      }
      x += plankLength;
    }

    y += width;
  }

  return { pieces, rips, adjustedStaggers };
}

function sideLabel(piece) {
  if (piece.touchesStart && !piece.touchesEnd) return "start side";
  if (piece.touchesEnd && !piece.touchesStart) return "end side";
  return "field cut";
}

function packCompatibleCuts(pieces, values) {
  const bins = [];
  let reusedPieces = 0;
  const cuts = pieces
    .filter((piece) => piece.length < values.plankLength - 0.001)
    .map((piece) => ({
      length: Math.round(piece.length * 100) / 100,
      width: Math.round(piece.width * 100) / 100,
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

function estimateMaterial(pieces, values) {
  const fullCount = pieces.filter((piece) => piece.full).length;
  const cutCount = pieces.filter((piece) => !piece.full).length;
  const cutPacking = packCompatibleCuts(pieces, values);
  const installedArea = values.roomLength * values.roomWidth;
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

function cutKind(piece, values) {
  const endCut = piece.length < values.plankLength - 0.001;
  const ripCut = piece.width < values.plankWidth - 0.001;
  if (endCut && ripCut) return "end + rip";
  if (ripCut) return "rip";
  return "end";
}

function oppositeProfile(profile) {
  return profile === "tongue" ? "groove" : "tongue";
}

function keepProfile(piece, values) {
  const endCut = piece.length < values.plankLength - 0.001;
  const ripCut = piece.width < values.plankWidth - 0.001;
  const startProfile = values.starterProfile;
  const endProfile = oppositeProfile(startProfile);

  if (endCut && piece.touchesStart && !piece.touchesEnd) {
    return `keep ${endProfile}`;
  }
  if (endCut && piece.touchesEnd && !piece.touchesStart) {
    return `keep ${startProfile}`;
  }
  if (endCut) {
    return "check end profile";
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
      const length = Math.round(piece.length * 100) / 100;
      const width = Math.round(piece.width * 100) / 100;
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

function buildRipOnlyList(pieces, values) {
  const grouped = new Map();
  pieces
    .filter((piece) => {
      const endCut = piece.length < values.plankLength - 0.001;
      const ripCut = piece.width < values.plankWidth - 0.001;
      return ripCut && !endCut;
    })
    .forEach((piece) => {
      const length = Math.round(piece.length * 100) / 100;
      const width = Math.round(piece.width * 100) / 100;
      const key = `${length}|${width}`;
      const existing = grouped.get(key) || { length, width, kind: "rip", profile: "keep both ends", qty: 0 };
      existing.qty += 1;
      grouped.set(key, existing);
    });

  return [...grouped.values()].sort((a, b) => {
    if (b.width !== a.width) return b.width - a.width;
    return b.length - a.length;
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

function pieceToRoomRect(piece, runAxis) {
  if (runAxis === "length") {
    return { x: piece.x, y: piece.y, width: piece.length, height: piece.width };
  }
  return { x: piece.y, y: piece.x, width: piece.width, height: piece.length };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return rect;
}

function drawGrain(x, y, width, height, full) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.strokeStyle = full ? "#8b5b24" : "#255b72";
  ctx.globalAlpha = full ? 0.45 : 0.55;
  ctx.lineWidth = 1;
  if (full) {
    const lines = height > 16 ? [0.28, 0.52, 0.74] : [0.5];
    lines.forEach((part) => {
      ctx.beginPath();
      ctx.moveTo(x + 5, y + height * part);
      ctx.lineTo(x + width - 5, y + height * part);
      ctx.stroke();
    });
  } else {
    for (let lineX = x - height; lineX < x + width + height; lineX += 10) {
      ctx.beginPath();
      ctx.moveTo(lineX, y + height);
      ctx.lineTo(lineX + height, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function draw(values, pieces, runAxis) {
  const rect = resizeCanvas();
  drawnPieces = [];
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#f8fafb";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const padding = 42;
  const availableW = Math.max(120, rect.width - padding * 2);
  const availableH = Math.max(120, rect.height - padding * 2);
  const scale = Math.min(availableW / values.roomLength, availableH / values.roomWidth);
  const drawW = values.roomLength * scale;
  const drawH = values.roomWidth * scale;
  const originX = (rect.width - drawW) / 2;
  const originY = (rect.height - drawH) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#27323c";
  ctx.lineWidth = 2;
  ctx.fillRect(originX, originY, drawW, drawH);
  ctx.strokeRect(originX, originY, drawW, drawH);

  pieces.forEach((piece) => {
    const roomPiece = pieceToRoomRect(piece, runAxis);
    const x = originX + roomPiece.x * scale;
    const y = originY + roomPiece.y * scale;
    const width = roomPiece.width * scale;
    const height = roomPiece.height * scale;
    drawnPieces.push({ piece, x, y, width, height });
    ctx.fillStyle = piece.full ? "#d59a51" : "#6ca6c8";
    ctx.strokeStyle = piece.full ? "#704c25" : "#255b72";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    if (width > 8 && height > 5) {
      drawGrain(x, y, width, height, piece.full);
    }
  });

  ctx.fillStyle = "#20262d";
  ctx.font = "700 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  ctx.fillText(`${values.roomLength}" x ${values.roomWidth}" room`, originX, Math.max(18, originY - 14));
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
  title.textContent = `${formatInches(piece.length)}" L x ${formatInches(piece.width)}" W`;

  const cut = document.createElement("span");
  cut.textContent = pieceLabel(piece, values);

  const row = document.createElement("span");
  row.textContent = `Row ${piece.row + 1}, ${sideLabel(piece)}`;

  piecePopover.append(title, cut, row);
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
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const drawn = pieceAtPoint(x, y);
  canvas.style.cursor = drawn ? "help" : "default";
  showPiecePopover(event, drawn);
}

function fmtArea(area) {
  return `${(area / 144).toFixed(2)} sq ft`;
}

function update(options = {}) {
  try {
    if (options.persist !== false) {
      saveSettings();
    }
    const values = currentInputs();
    const oriented = orientedDimensions(values.roomLength, values.roomWidth, values.orientation);
    const layout = buildLayout(oriented.runLength, oriented.rowDepth, values);
    const pieces = layout.pieces;
    const estimate = estimateMaterial(pieces, values);
    latestValues = values;
    els.planksNeeded.textContent = estimate.plankCount;
    els.fullPieces.textContent = estimate.fullCount;
    els.cutPieces.textContent = estimate.cutCount;
    els.rows.textContent = estimate.rows;
    els.firstRip.textContent = `${layout.rips.firstRip.toFixed(2)}"`;
    els.lastRip.textContent = `${layout.rips.lastRip.toFixed(2)}"`;
    els.adjustedRows.textContent = layout.adjustedStaggers;
    els.offcutsReused.textContent = estimate.offcutsReused;
    els.cutStockPlanks.textContent = estimate.cutStockPlanks;
    const ripOnlyCuts = buildRipOnlyList(pieces, values);
    els.ripOnlyPieces.textContent = ripOnlyCuts.reduce((sum, cut) => sum + cut.qty, 0);
    els.wasteRoom.textContent = `${estimate.wasteRoom.toFixed(1)}%`;
    els.wastePurchased.textContent = `${estimate.wastePurchased.toFixed(1)}%`;
    els.installedArea.textContent = fmtArea(estimate.installedArea);
    els.purchasedArea.textContent = fmtArea(estimate.purchasedArea);
    els.reuseNote.textContent = (
      `Waste estimate reuses compatible cut ends for opposite-side gaps before counting leftover material. ` +
      `Estimated leftover end-cut length: ${formatInches(estimate.endCutWasteLength)}".`
    );
    renderCutList(els.ripList, ripOnlyCuts, "No rip-only pieces.");
    renderCutList(els.cutList, buildCutList(pieces, values), "No cut pieces.");
    renderCutGroups(estimate.cutPacking, values);
    els.directionNote.textContent = `Planks run along the room ${oriented.runAxis}.`;
    els.error.textContent = "";
    hidePiecePopover();
    draw(values, pieces, oriented.runAxis);
  } catch (error) {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    els.error.textContent = error.message;
  }
}

controls.forEach((control) => {
  control.addEventListener("input", update);
  control.addEventListener("change", update);
});
resetSettings.addEventListener("click", resetSavedSettings);
canvas.addEventListener("pointermove", handleCanvasPointer);
canvas.addEventListener("pointerdown", handleCanvasPointer);
canvas.addEventListener("pointerleave", hidePiecePopover);
window.addEventListener("resize", update);
loadSavedSettings();
update();
