// ---------- Data & helpers ----------

// Internal baseline table as a fallback if no CSV is loaded.
// This is intentionally simple and easy to swap out.
const internalIncomeTable = [
  // EL, DC, income per day at success (baseline)
  { el: 0, dc: 14, income: 0.5 },
  { el: 1, dc: 15, income: 1 },
  { el: 2, dc: 16, income: 2 },
  { el: 3, dc: 18, income: 3 },
  { el: 4, dc: 19, income: 5 },
  { el: 5, dc: 20, income: 7 },
  { el: 6, dc: 22, income: 10 },
  { el: 7, dc: 23, income: 15 },
  { el: 8, dc: 24, income: 20 },
  { el: 9, dc: 26, income: 30 }
];

// Proficiency modifiers to DC and payout scaling.
// These are intentionally generic; tweak to match your table.
const proficiencyAdjustments = {
  trained: { dcOffset: 0, payoutMult: 1.0 },
  expert: { dcOffset: 2, payoutMult: 1.25 },
  master: { dcOffset: 4, payoutMult: 1.5 },
  legendary: { dcOffset: 6, payoutMult: 1.75 }
};

// HHST boon adjustments: modifies both DC and payout.
const hhstAdjustments = {
  dcOffset: -2,
  payoutMult: 1.1
};

let activeIncomeTable = [...internalIncomeTable];
let rows = [];
const ROW_COUNT = 6;

// ---------- DOM references ----------

const lightModeToggle = document.getElementById("lightModeToggle");
const hhstToggle = document.getElementById("hhstToggle");
const effectiveLevelInput = document.getElementById("effectiveLevel");
const proficiencySelect = document.getElementById("proficiencyTier");
const daysInput = document.getElementById("daysEarnIncome");
const targetDcDisplay = document.getElementById("targetDcDisplay");
const dcSubLabel = document.getElementById("dcSubLabel");

const csvInput = document.getElementById("csvInput");
const csvError = document.getElementById("csvError");
const csvPreviewEmpty = document.getElementById("csvPreviewEmpty");
const csvPreviewTable = document.getElementById("csvPreviewTable");
const csvPreviewBody = document.getElementById("csvPreviewBody");

const rowsContainer = document.getElementById("rowsContainer");

const summaryDays = document.getElementById("summaryDays");
const summaryTotalGp = document.getElementById("summaryTotalGp");
const summaryAvgGp = document.getElementById("summaryAvgGp");
const summaryText = document.getElementById("summaryText");
const copySummaryBtn = document.getElementById("copySummaryBtn");
const copyBanner = document.getElementById("copyBanner");

const scenarioNameInput = document.getElementById("scenarioName");
const characterNameInput = document.getElementById("characterName");

// ---------- Light mode ----------

lightModeToggle.addEventListener("change", () => {
  document.body.classList.toggle("light-mode", lightModeToggle.checked);
});

// ---------- CSV parsing ----------

csvInput.addEventListener("change", handleCsvUpload);

function handleCsvUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const parsed = parseCsvFlexible(text);
      if (!parsed || parsed.length === 0) {
        throw new Error("No usable rows found in CSV.");
      }
      activeIncomeTable = parsed;
      csvError.textContent = "";
      renderCsvPreview(parsed);
      updateTargetDc();
      recalcAllRows();
    } catch (err) {
      console.error(err);
      csvError.textContent = err.message || "Could not parse CSV.";
      activeIncomeTable = [...internalIncomeTable];
      renderCsvPreview([]);
      updateTargetDc();
      recalcAllRows();
    }
  };
  reader.readAsText(file);
}

// Flexible CSV parser: tries to detect EL, DC, result band, and income columns.
function parseCsvFlexible(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const headerParts = headerLine.split(",").map((h) => h.trim().toLowerCase());

  const elIndex = headerParts.findIndex((h) => ["el", "effective level", "level"].includes(h));
  const dcIndex = headerParts.findIndex((h) => h === "dc" || h === "target dc");
  const resultIndex = headerParts.findIndex((h) =>
    ["result", "band", "result band", "outcome"].includes(h)
  );
  const incomeIndex = headerParts.findIndex((h) =>
    ["income", "gp", "gold", "earn income"].includes(h)
  );

  // We only require EL, DC, and income; result band is optional.
  if (elIndex === -1 || dcIndex === -1 || incomeIndex === -1) {
    throw new Error(
      "CSV must contain columns for EL, DC, and Income (per day). Result band is optional."
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length === 0 || parts.every((p) => p === "")) continue;

    const el = Number(parts[elIndex]);
    const dc = Number(parts[dcIndex]);
    const income = Number(parts[incomeIndex]);
    const band = resultIndex !== -1 ? parts[resultIndex] : "";

    if (Number.isNaN(el) || Number.isNaN(dc) || Number.isNaN(income)) {
      // Skip malformed rows but don't kill the whole file.
      continue;
    }

    rows.push({
      el,
      dc,
      income,
      band
    });
  }

  // Sort by EL ascending for sanity.
  rows.sort((a, b) => a.el - b.el);
  return rows;
}

function renderCsvPreview(table) {
  csvPreviewBody.innerHTML = "";
  if (!table || table.length === 0) {
    csvPreviewEmpty.style.display = "block";
    csvPreviewTable.style.display = "none";
    return;
  }

  csvPreviewEmpty.style.display = "none";
  csvPreviewTable.style.display = "table";

  const maxRows = 8;
  table.slice(0, maxRows).forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.el}</td>
      <td>${row.dc}</td>
      <td>${row.band || "—"}</td>
      <td>${row.income}</td>
    `;
    csvPreviewBody.appendChild(tr);
  });
}

// ---------- DC & income lookup ----------

function getBaseRowForEl(el) {
  // Find exact EL match; if not found, use nearest lower, then nearest higher.
  const sorted = [...activeIncomeTable].sort((a, b) => a.el - b.el);
  let exact = sorted.find((r) => r.el === el);
  if (exact) return exact;

  let lower = null;
  let higher = null;
  for (const r of sorted) {
    if (r.el < el) lower = r;
    if (r.el > el && !higher) higher = r;
  }
  return lower || higher || sorted[0];
}

function computeTargetDc() {
  const el = Number(effectiveLevelInput.value);
  if (Number.isNaN(el)) return null;

  const baseRow = getBaseRowForEl(el);
  if (!baseRow) return null;

  const proficiencyKey = proficiencySelect.value || "trained";
  const profAdj = proficiencyAdjustments[proficiencyKey] || proficiencyAdjustments.trained;

  let dc = baseRow.dc + profAdj.dcOffset;

  if (hhstToggle.checked) {
    dc += hhstAdjustments.dcOffset;
  }

  return {
    dc,
    baseRow,
    proficiencyKey
  };
}

function updateTargetDc() {
  const result = computeTargetDc();
  if (!result) {
    targetDcDisplay.textContent = "—";
    dcSubLabel.textContent = "Awaiting inputs…";
    return;
  }

  targetDcDisplay.textContent = result.dc;
  const el = Number(effectiveLevelInput.value);
  const profLabel = result.proficiencyKey.charAt(0).toUpperCase() + result.proficiencyKey.slice(1);
  const hhstLabel = hhstToggle.checked ? "HHST boon applied" : "no boon";
  dcSubLabel.textContent = `EL ${el}, ${profLabel}, ${hhstLabel}`;
}

// ---------- Rows & progressive reveal ----------

function initRows() {
  rowsContainer.innerHTML = "";
  rows = [];

  const totalDays = Number(daysInput.value) || 1;
  const daysPerRow = Math.max(1, Math.floor(totalDays / ROW_COUNT));
  let remaining = totalDays;

  for (let i = 0; i < ROW_COUNT; i++) {
    const rowDays = i === ROW_COUNT - 1 ? remaining : Math.min(daysPerRow, remaining);
    remaining -= rowDays;

    const rowEl = document.createElement("div");
    rowEl.className = "row";
    if (i > 0) rowEl.classList.add("hidden-row");
    if (i === 0) rowEl.classList.add("active-row");

    const dayLabel =
      rowDays === 1
        ? `Day ${computeRowDayRangeStart(i, daysPerRow) + 1}`
        : `Days ${computeRowDayRangeStart(i, daysPerRow) + 1}–${
            computeRowDayRangeStart(i, daysPerRow) + rowDays
          }`;

    rowEl.innerHTML = `
      <div class="row-label">${dayLabel}</div>
      <div>
        <input type="number" class="row-check-input" placeholder="Check total" />
      </div>
      <div class="row-result-band"></div>
      <div class="row-income">—</div>
    `;

    const checkInput = rowEl.querySelector(".row-check-input");
    const bandEl = rowEl.querySelector(".row-result-band");
    const incomeEl = rowEl.querySelector(".row-income");

    const rowObj = {
      index: i,
      element: rowEl,
      checkInput,
      bandEl,
      incomeEl,
      days: rowDays
    };

    checkInput.addEventListener("input", () => handleRowInput(rowObj));

    rows.push(rowObj);
    rowsContainer.appendChild(rowEl);
  }

  recalcAllRows();
}

function computeRowDayRangeStart(rowIndex, daysPerRow) {
  return rowIndex * daysPerRow;
}

function handleRowInput(row) {
  const value = Number(row.checkInput.value);
  if (Number.isNaN(value)) {
    clearRow(row);
    lockRowsAfter(row.index);
    updateSummary();
    return;
  }

  const dcInfo = computeTargetDc();
  if (!dcInfo) {
    clearRow(row);
    lockRowsAfter(row.index);
    updateSummary();
    return;
  }

  const band = classifyResultBand(value, dcInfo.dc);
  const income = computeRowIncome(dcInfo, band, row.days);

  applyRowDisplay(row, band, income);
  unlockNextRowIfNeeded(row.index);
  updateSummary();
}

function classifyResultBand(checkTotal, dc) {
  const diff = checkTotal - dc;
  if (diff >= 10) return "crit-success";
  if (diff >= 0) return "success";
  if (diff <= -10) return "crit-fail";
  return "fail";
}

function computeRowIncome(dcInfo, band, days) {
  const baseRow = dcInfo.baseRow;
  const proficiencyKey = dcInfo.proficiencyKey;
  const profAdj = proficiencyAdjustments[proficiencyKey] || proficiencyAdjustments.trained;

  let perDay = baseRow.income * profAdj.payoutMult;

  if (hhstToggle.checked) {
    perDay *= hhstAdjustments.payoutMult;
  }

  // Adjust by band.
  switch (band) {
    case "crit-success":
      perDay *= 2;
      break;
    case "success":
      perDay *= 1;
      break;
    case "fail":
      perDay *= 0.5;
      break;
    case "crit-fail":
      perDay = 0;
      break;
  }

  const total = perDay * days;
  return Math.round(total * 100) / 100;
}

function applyRowDisplay(row, band, income) {
  row.bandEl.textContent = bandLabel(band);
  row.bandEl.className = "row-result-band " + bandClass(band);
  row.incomeEl.textContent = income.toFixed(2);
}

function bandLabel(band) {
  switch (band) {
    case "crit-success":
      return "Critical success";
    case "success":
      return "Success";
    case "fail":
      return "Failure";
    case "crit-fail":
      return "Critical failure";
    default:
      return "—";
  }
}

function bandClass(band) {
  switch (band) {
    case "crit-success":
      return "row-result-band--crit-success";
    case "success":
      return "row-result-band--success";
    case "fail":
      return "row-result-band--fail";
    case "crit-fail":
      return "row-result-band--crit-fail";
    default:
      return "";
  }
}

function clearRow(row) {
  row.bandEl.textContent = "";
  row.bandEl.className = "row-result-band";
  row.incomeEl.textContent = "—";
}

function unlockNextRowIfNeeded(index) {
  if (index >= rows.length - 1) return;
  const current = rows[index];
  if (!current.checkInput.value) return;

  const next = rows[index + 1];
  next.element.classList.remove("hidden-row");
  next.element.classList.add("active-row");
}

function lockRowsAfter(index) {
  for (let i = index + 1; i < rows.length; i++) {
    rows[i].element.classList.add("hidden-row");
    rows[i].element.classList.remove("active-row");
    rows[i].checkInput.value = "";
    clearRow(rows[i]);
  }
}

// Recalculate all rows (e.g., when DC or table changes).
function recalcAllRows() {
  rows.forEach((row, idx) => {
    const value = Number(row.checkInput.value);
    if (Number.isNaN(value)) {
      clearRow(row);
      if (idx > 0) {
        row.element.classList.add("hidden-row");
        row.element.classList.remove("active-row");
      }
      return;
    }
    handleRowInput(row);
  });

  // Ensure first row is visible.
  if (rows[0]) {
    rows[0].element.classList.remove("hidden-row");
    rows[0].element.classList.add("active-row");
  }
}

// ---------- Summary & copy ----------

function updateSummary() {
  const totalDays = rows.reduce((sum, r) => sum + (r.days || 0), 0);
  let usedDays = 0;
  let totalIncome = 0;

  rows.forEach((row) => {
    const income = Number(row.incomeEl.textContent);
    if (!Number.isNaN(income) && income > 0) {
      usedDays += row.days;
      totalIncome += income;
    }
  });

  summaryDays.textContent = usedDays || "—";
  summaryTotalGp.textContent = totalIncome ? totalIncome.toFixed(2) : "—";
  summaryAvgGp.textContent =
    usedDays && totalIncome ? (totalIncome / usedDays).toFixed(2) : "—";

  summaryText.textContent = buildSummaryText(usedDays, totalIncome);
}

function buildSummaryText(usedDays, totalIncome) {
  const scenario = scenarioNameInput.value || "(scenario not specified)";
  const character = characterNameInput.value || "(character not specified)";
  const el = effectiveLevelInput.value || "—";
  const prof = proficiencySelect.value || "trained";
  const boon = hhstToggle.checked ? "HHST boon active" : "no boon";

  let lines = [];
  lines.push(`Downtime recap for ${character}`);
  lines.push(`Scenario: ${scenario}`);
  lines.push(`Effective level: ${el}, proficiency: ${prof}, ${boon}`);
  lines.push("");

  rows.forEach((row) => {
    const income = Number(row.incomeEl.textContent);
    if (Number.isNaN(income) || income <= 0) return;
    const label = row.element.querySelector(".row-label").textContent;
    const band = row.bandEl.textContent || "—";
    lines.push(`${label}: ${band}, ${income.toFixed(2)} gp total`);
  });

  lines.push("");
  lines.push(
    `Total: ${usedDays || 0} day(s) of Earn Income for ${totalIncome.toFixed(
      2
    )} gp (${usedDays ? (totalIncome / usedDays).toFixed(2) : "0.00"} gp/day)`
  );

  return lines.join("\n");
}

copySummaryBtn.addEventListener("click", async () => {
  const text = summaryText.textContent || "";
  if (!text.trim()) return;

  try {
    await navigator.clipboard.writeText(text);
    showCopyBanner();
  } catch (err) {
    console.error("Clipboard error:", err);
  }
});

function showCopyBanner() {
  copyBanner.style.display = "inline-flex";
  setTimeout(() => {
    copyBanner.style.display = "none";
  }, 2200);
}

// ---------- Wiring & initial state ----------

function wireConfigListeners() {
  [effectiveLevelInput, proficiencySelect, hhstToggle].forEach((el) => {
    el.addEventListener("change", () => {
      updateTargetDc();
      recalcAllRows();
      updateSummary();
    });
  });

  daysInput.addEventListener("change", () => {
    initRows();
    updateSummary();
  });

  [scenarioNameInput, characterNameInput].forEach((el) => {
    el.addEventListener("input", () => updateSummary());
  });
}

function init() {
  wireConfigListeners();
  updateTargetDc();
  initRows();
  updateSummary();
}

document.addEventListener("DOMContentLoaded", init);
