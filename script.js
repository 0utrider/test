// ---------- Data & helpers ----------

// Internal baseline table as a fallback / canonical source.
// EL, DC, income per day at success.
const internalIncomeTable = [
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

// HHST: Horizon Hunters: Storied Talent.
// Used to adjust effective level for DC and income.
const HHST_EL_OFFSET = 1;

// Result bands adjust modified EL for income lookup.
function modifiedElFromResult(initialEl, resultBand) {
  switch (resultBand) {
    case "crit-success":
      return initialEl + 1;
    case "success":
      return initialEl;
    case "fail":
      return Math.max(0, initialEl - 2);
    case "crit-fail":
      return Math.max(0, initialEl - 4);
    default:
      return initialEl;
  }
}

function getRowForEl(el) {
  const sorted = [...internalIncomeTable].sort((a, b) => a.el - b.el);
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
      return "";
  }
}

// ---------- DOM references ----------

const lightModeToggle = document.getElementById("lightModeToggle");
const downtimeDateInput = document.getElementById("downtimeDate");
const scenarioNumberInput = document.getElementById("scenarioNumber");
const charactersContainer = document.getElementById("charactersContainer");
const summaryText = document.getElementById("summaryText");
const appendixToggle = document.getElementById("appendixToggle");
const appendixContent = document.getElementById("appendixContent");
const incomeTableBody = document.getElementById("incomeTableBody");

// ---------- Light mode ----------

lightModeToggle.addEventListener("change", () => {
  document.body.classList.toggle("light-mode", lightModeToggle.checked);
});

// ---------- Scenario sanitization ----------

scenarioNumberInput.addEventListener("input", () => {
  const allowed = /[A-Za-z0-9\-(): ]/g;
  const matches = scenarioNumberInput.value.match(allowed);
  scenarioNumberInput.value = matches ? matches.join("") : "";
  updateSummary();
});

// ---------- Characters ----------

const MAX_CHARACTERS = 7;
const characters = [];

function createCharacterCard(index) {
  const card = document.createElement("div");
  card.className = "character-card";
  if (index > 0) card.classList.add("hidden");

  const header = document.createElement("div");
  header.className = "character-header";
  header.innerHTML = `<div class="character-title">Character ${index + 1}</div>`;
  card.appendChild(header);

  const gridTop = document.createElement("div");
  gridTop.className = "character-grid";

  // Name
  const nameGroup = document.createElement("div");
  nameGroup.className = "field-group";
  nameGroup.innerHTML = `
    <label>Name</label>
    <input type="text" class="char-name" placeholder="Character name" />
  `;
  gridTop.appendChild(nameGroup);

  // Character level
  const levelGroup = document.createElement("div");
  levelGroup.className = "field-group";
  levelGroup.innerHTML = `
    <label>Character Level</label>
    <input type="number" class="char-level" min="1" max="20" value="1" />
  `;
  gridTop.appendChild(levelGroup);

  // Proficiency radios
  const profGroup = document.createElement("div");
  profGroup.className = "field-group prof-group";
  profGroup.innerHTML = `<label>Proficiency</label>`;
  const profOptions = document.createElement("div");
  profOptions.className = "prof-options";

  const profs = [
    { key: "trained", label: "T" },
    { key: "expert", label: "E" },
    { key: "master", label: "M" },
    { key: "legendary", label: "L" }
  ];

  const profInputs = {};

  profs.forEach((p) => {
    const id = `char${index}_prof_${p.key}`;
    const pill = document.createElement("label");
    pill.className = "prof-pill";
    pill.innerHTML = `
      <input type="radio" name="char${index}_prof" id="${id}" value="${p.key}" />
      ${p.label}
    `;
    profOptions.appendChild(pill);
    profInputs[p.key] = { pill, input: pill.querySelector("input") };
  });

  // default to trained
  profInputs.trained.input.checked = true;
  profInputs.trained.pill.classList.add("active");

  profGroup.appendChild(profOptions);
  gridTop.appendChild(profGroup);

  // HHST
  const hhstGroup = document.createElement("div");
  hhstGroup.className = "field-group";
  hhstGroup.innerHTML = `
    <label class="toggle">
      <input type="checkbox" class="char-hhst" />
      <span class="toggle-indicator"></span>
      <span class="toggle-label">Horizon Hunters: Storied Talent</span>
    </label>
  `;
  gridTop.appendChild(hhstGroup);

  card.appendChild(gridTop);

  // DC badge
  const dcWrapper = document.createElement("div");
  dcWrapper.className = "dc-badge-wrapper";
  dcWrapper.innerHTML = `
    <div class="dc-badge">
      <div class="dc-label">Target DC</div>
      <div class="dc-value char-dc">—</div>
    </div>
  `;
  card.appendChild(dcWrapper);

  // Bottom grid: Result, Days, Income
  const gridBottom = document.createElement("div");
  gridBottom.className = "character-grid-bottom";

  const resultGroup = document.createElement("div");
  resultGroup.className = "field-group";
  resultGroup.innerHTML = `
    <label>Result</label>
    <select class="result-select char-result">
      <option value="">—</option>
      <option value="crit-success">Critical success</option>
      <option value="success">Success</option>
      <option value="fail">Failure</option>
      <option value="crit-fail">Critical failure</option>
    </select>
  `;
  gridBottom.appendChild(resultGroup);

  const daysGroup = document.createElement("div");
  daysGroup.className = "field-group";
  daysGroup.innerHTML = `
    <label>Downtime Days</label>
    <input type="number" class="char-days" min="1" max="24" />
  `;
  gridBottom.appendChild(daysGroup);

  const incomeGroup = document.createElement("div");
  incomeGroup.className = "field-group";
  incomeGroup.innerHTML = `
    <label>Earned Income</label>
    <div class="income-display char-income">—</div>
  `;
  gridBottom.appendChild(incomeGroup);

  card.appendChild(gridBottom);

  charactersContainer.appendChild(card);

  const nameInput = card.querySelector(".char-name");
  const levelInput = card.querySelector(".char-level");
  const hhstInput = card.querySelector(".char-hhst");
  const dcDisplay = card.querySelector(".char-dc");
  const resultSelect = card.querySelector(".char-result");
  const daysInput = card.querySelector(".char-days");
  const incomeDisplay = card.querySelector(".char-income");

  // Proficiency pill behavior
  Object.values(profInputs).forEach(({ pill, input }) => {
    pill.addEventListener("click", () => {
      Object.values(profInputs).forEach(({ pill: p }) => p.classList.remove("active"));
      pill.classList.add("active");
      input.checked = true;
      // Proficiency is currently informational; DC is based on EL only.
      updateCharacterDc(index);
      updateCharacterIncome(index);
      updateSummary();
    });
  });

  nameInput.addEventListener("input", () => {
    handleCharacterVisibility();
    updateSummary();
  });

  [levelInput, hhstInput].forEach((el) => {
    el.addEventListener("change", () => {
      updateCharacterDc(index);
      updateCharacterIncome(index);
      updateSummary();
    });
  });

  [resultSelect, daysInput].forEach((el) => {
    el.addEventListener("change", () => {
      updateCharacterIncome(index);
      updateSummary();
    });
  });

  characters.push({
    index,
    card,
    nameInput,
    levelInput,
    hhstInput,
    dcDisplay,
    resultSelect,
    daysInput,
    incomeDisplay,
    profInputs
  });

  // Initial DC
  updateCharacterDc(index);
}

function handleCharacterVisibility() {
  for (let i = 0; i < characters.length; i++) {
    const current = characters[i];
    const next = characters[i + 1];
    if (!next) break;

    const hasName = current.nameInput.value.trim().length > 0;
    if (hasName) {
      next.card.classList.remove("hidden");
    } else {
      next.card.classList.add("hidden");
      clearCharacter(next.index);
    }
  }
}

function initialElForCharacter(char) {
  const level = Number(char.levelInput.value);
  if (Number.isNaN(level) || level <= 0) return null;
  let el = level;
  if (char.hhstInput.checked) {
    el += HHST_EL_OFFSET;
  }
  return el;
}

function updateCharacterDc(index) {
  const char = characters[index];
  const initialEl = initialElForCharacter(char);
  if (initialEl === null) {
    char.dcDisplay.textContent = "—";
    return;
  }
  const row = getRowForEl(initialEl);
  char.dcDisplay.textContent = row.dc;
}

function updateCharacterIncome(index) {
  const char = characters[index];
  const name = char.nameInput.value.trim();
  const days = Number(char.daysInput.value);
  const resultBand = char.resultSelect.value;

  if (!name || !resultBand || Number.isNaN(days) || days < 1 || days > 24) {
    char.incomeDisplay.textContent = "—";
    return;
  }

  const initialEl = initialElForCharacter(char);
  if (initialEl === null) {
    char.incomeDisplay.textContent = "—";
    return;
  }

  const modEl = modifiedElFromResult(initialEl, resultBand);
  const row = getRowForEl(modEl);
  const perDay = row.income;
  const total = perDay * days;
  char.incomeDisplay.textContent = `${total.toFixed(2)} gp`;
}

function clearCharacter(index) {
  const char = characters[index];
  char.resultSelect.value = "";
  char.daysInput.value = "";
  char.incomeDisplay.textContent = "—";
}

// ---------- Summary ----------

function buildSummary() {
  const dateVal = downtimeDateInput.value || "";
  const scenarioVal = scenarioNumberInput.value || "";
  const headerLine = `${dateVal || "Date not set"} - ${scenarioVal || "Scenario not set"}`;

  const lines = [headerLine];

  characters.forEach((char) => {
    const name = char.nameInput.value.trim();
    const days = Number(char.daysInput.value);
    const resultBand = char.resultSelect.value;
    const incomeText = char.incomeDisplay.textContent || "";
    if (!name || !resultBand || Number.isNaN(days) || days < 1 || days > 24) return;
    if (!incomeText || incomeText === "—") return;

    const initialEl = initialElForCharacter(char);
    if (initialEl === null) return;
    const modEl = modifiedElFromResult(initialEl, resultBand);

    const band = bandLabel(resultBand);
    const hhstTag = char.hhstInput.checked ? " (HHST)" : "";
    const numericIncome = incomeText.replace(" gp", "");

    // "Name: Success, EL = Y (HHST)     Z gp"
    const line = `${name}: ${band}, EL = ${modEl}${hhstTag}     ${numericIncome} gp`;
    lines.push(line);
  });

  return lines.join("\n");
}

function updateSummary() {
  summaryText.textContent = buildSummary();
}

// ---------- Appendix ----------

appendixToggle.addEventListener("click", () => {
  const isOpen = appendixContent.classList.toggle("open");
  appendixToggle.textContent = isOpen ? "Hide appendix" : "Show appendix";
});

function renderIncomeTable() {
  incomeTableBody.innerHTML = "";
  internalIncomeTable.forEach((row) => {
    const critSuccess = (row.income * 2).toFixed(2);
    const success = row.income.toFixed(2);
    const fail = (row.income * 0.5).toFixed(2);
    const critFail = "0.00";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.el}</td>
      <td>${row.dc}</td>
      <td>${success}</td>
      <td>${critSuccess}</td>
      <td>${fail}</td>
      <td>${critFail}</td>
    `;
    incomeTableBody.appendChild(tr);
  });
}

// ---------- Wiring & initial state ----------

function initDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  downtimeDateInput.value = `${yyyy}-${mm}-${dd}`;
}

function wireGlobalListeners() {
  downtimeDateInput.addEventListener("change", updateSummary);
}

function initCharacters() {
  for (let i = 0; i < MAX_CHARACTERS; i++) {
    createCharacterCard(i);
  }
}

function init() {
  initDate();
  wireGlobalListeners();
  initCharacters();
  renderIncomeTable();
  updateSummary();
}

document.addEventListener("DOMContentLoaded", init);
