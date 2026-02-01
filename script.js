// ============================================================
//  CONFIG
// ============================================================

const PF2 = "pf2";
const SF2 = "sf2";

let currentSystem = PF2;
let pf2Table = null;
let sf2Table = null;

document.addEventListener("DOMContentLoaded", () => {
  initBackground();
  initThemeToggle();
  initSystemToggle();
  initDateInput();
  initCharacters();
  initSummaryCopy();
  initAppendixToggle();
  loadCSVs();
});

// ============================================================
//  BACKGROUND HANDLING
// ============================================================

function initBackground() {
  const bgLayer = document.getElementById("background-layer");
  const img = new Image();
  img.src = "img/background.webp";
  img.onload = () => bgLayer.classList.add("loaded");
  img.onerror = () => document.body.classList.add("no-background");
}

// ============================================================
//  THEME TOGGLE
// ============================================================

function initThemeToggle() {
  const toggle = document.getElementById("lightModeToggle");
  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      document.body.classList.remove("theme-dark");
      document.body.classList.add("theme-light");
    } else {
      document.body.classList.remove("theme-light");
      document.body.classList.add("theme-dark");
    }
  });
}

// ============================================================
//  SYSTEM TOGGLE (PF2 / SF2)
// ============================================================

function initSystemToggle() {
  const radios = document.querySelectorAll('input[name="system"]');
  radios.forEach((r) => {
    r.addEventListener("change", () => {
      if (r.checked) {
        currentSystem = r.value;
        handleSystemChange();
      }
    });
  });
}

function handleSystemChange() {
  const rows = document.querySelectorAll(".character-card");

  rows.forEach((row) => {
    const hhstRow = row.querySelector(".hhst-row");
    if (hhstRow) {
      hhstRow.style.display = currentSystem === PF2 ? "flex" : "none";
    }

    const profPills = row.querySelectorAll(".prof-pill");
    profPills.forEach((pill) => {
      const value = pill.dataset.value;
      const input = pill.querySelector("input[type=radio]");
      if (currentSystem === SF2 && value === "L") {
        pill.classList.add("disabled");
        input.checked = false;
      } else {
        pill.classList.remove("disabled");
      }
    });

    recalcRow(row);
  });

  renderDowntimeTable();
  updateSummary();
}

// ============================================================
//  DATE INPUT (ISO + FALLBACK PICKER)
// ============================================================

function initDateInput() {
  const dateInput = document.getElementById("dateInput");

  // Set placeholder to today's date
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const isoToday = `${yyyy}-${mm}-${dd}`;

  dateInput.placeholder = isoToday;

  // Set default value
  dateInput.value = isoToday;

  // Detect native date picker support
  const test = document.createElement("input");
  test.type = "date";
  const nativeSupported = test.type === "date";

  if (!nativeSupported) {
    attachFallbackDatePicker(dateInput);
  }
}

// ------------------------------------------------------------
//  Fallback Date Picker (Option 2: themed popup calendar)
// ------------------------------------------------------------

function attachFallbackDatePicker(input) {
  input.readOnly = true;

  input.addEventListener("click", () => {
    showCalendarPopup(input);
  });
}

function showCalendarPopup(input) {
  closeExistingCalendar();

  const rect = input.getBoundingClientRect();
  const popup = document.createElement("div");
  popup.className = "calendar-popup";

  const selected = input.value ? new Date(input.value) : new Date();
  let currentMonth = selected.getMonth();
  let currentYear = selected.getFullYear();

  function renderCalendar() {
    popup.innerHTML = "";

    const header = document.createElement("div");
    header.className = "calendar-header";

    const prev = document.createElement("button");
    prev.textContent = "‹";
    prev.className = "cal-nav";
    prev.onclick = () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    };

    const next = document.createElement("button");
    next.textContent = "›";
    next.className = "cal-nav";
    next.onclick = () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    };

    const title = document.createElement("div");
    title.className = "calendar-title";
    title.textContent = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

    header.append(prev, title, next);

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    days.forEach((d) => {
      const cell = document.createElement("div");
      cell.className = "calendar-day-header";
      cell.textContent = d;
      grid.appendChild(cell);
    });

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-empty";
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement("div");
      cell.className = "calendar-date";
      cell.textContent = d;

      cell.onclick = () => {
        const iso = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        input.value = iso;
        closeExistingCalendar();
      };

      grid.appendChild(cell);
    }

    popup.append(header, grid);
  }

  renderCalendar();

  popup.style.position = "absolute";
  popup.style.top = rect.bottom + window.scrollY + "px";
  popup.style.left = rect.left + window.scrollX + "px";

  document.body.appendChild(popup);

  document.addEventListener("click", (e) => {
    if (!popup.contains(e.target) && e.target !== input) {
      closeExistingCalendar();
    }
  }, { once: true });
}

function closeExistingCalendar() {
  const existing = document.querySelector(".calendar-popup");
  if (existing) existing.remove();
}

// ============================================================
//  CHARACTER ROWS
// ============================================================

function initCharacters() {
  const container = document.getElementById("character-rows");
  for (let i = 0; i < 7; i++) {
    const row = createCharacterRow(i);
    if (i > 0) row.style.display = "none";
    container.appendChild(row);
  }
}

function createCharacterRow(index) {
  const card = document.createElement("div");
  card.className = "character-card";
  card.dataset.index = index;

  // ------------------------------------------------------------
  // HEADER
  // ------------------------------------------------------------

  const header = document.createElement("div");
  header.className = "character-header";

  // Name
  const nameRow = document.createElement("div");
  nameRow.className = "form-row";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.maxLength = 50;
  nameInput.id = `char-name-${index}`;
  nameInput.addEventListener("input", () => {
    sanitizeTextInput(nameInput);
    handleRowVisibility(index);
    recalcRow(card);
    updateSummary();
  });
  const nameError = document.createElement("div");
  nameError.className = "field-error";
  nameError.dataset.errorFor = nameInput.id;
  nameRow.append(nameLabel, nameInput, nameError);

  // Level
  const levelRow = document.createElement("div");
  levelRow.className = "form-row";
  const levelLabel = document.createElement("label");
  levelLabel.textContent = "Level";
  const levelInput = document.createElement("input");
  levelInput.type = "number";
  levelInput.min = 1;
  levelInput.max = 20;
  levelInput.classList.add("level-input");
  levelInput.id = `char-level-${index}`;
  levelInput.addEventListener("input", () => {
    sanitizeNumericInput(levelInput);
    validateLevel(levelInput);
    recalcRow(card);
    updateSummary();
  });
  const levelError = document.createElement("div");
  levelError.className = "field-error";
  levelError.dataset.errorFor = levelInput.id;
  levelRow.append(levelLabel, levelInput, levelError);

  // Proficiency
  const profRow = document.createElement("div");
  profRow.className = "form-row";
  const profLabel = document.createElement("label");
  profLabel.textContent = "Proficiency";
  const profGroup = document.createElement("div");
  profGroup.className = "radio-group";
  ["T", "E", "M", "L"].forEach((p) => {
    const pill = document.createElement("label");
    pill.className = "radio-pill prof-pill";
    pill.dataset.value = p;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `char-prof-${index}`;
    input.value = p;
    input.addEventListener("change", () => {
      recalcRow(card);
      updateSummary();
    });

    const x = document.createElement("span");
    x.className = "x-mark";

    const text = document.createElement("span");
    text.className = "label-text";
    text.textContent = p;

    pill.append(input, x, text);
    profGroup.appendChild(pill);
  });
  const profError = document.createElement("div");
  profError.className = "field-error";
  profError.dataset.errorFor = `char-prof-${index}`;
  profRow.append(profLabel, profGroup, profError);

  // HHST (PF2 only)
  const hhstRow = document.createElement("div");
  hhstRow.className = "form-row hhst-row";
  const hhstLabel = document.createElement("label");
  hhstLabel.textContent = "HHST Boon?";
  const hhstWrap = document.createElement("div");
  hhstWrap.className = "checkbox-row";
  const hhstInput = document.createElement("input");
  hhstInput.type = "checkbox";
  hhstInput.id = `char-hhst-${index}`;
  const hhstBox = document.createElement("span");
  hhstBox.className = "checkbox-custom";
  hhstWrap.title = "Horizon Hunters: Storied Talent";
  hhstWrap.append(hhstInput, hhstBox);
  hhstInput.addEventListener("change", () => {
    recalcRow(card);
    updateSummary();
  });
  hhstRow.append(hhstLabel, hhstWrap);

  header.append(nameRow, levelRow, profRow, hhstRow);

  // ------------------------------------------------------------
  // DC DISPLAY
  // ------------------------------------------------------------

  const middle = document.createElement("div");
  middle.className = "character-middle";
  const dcSpan = document.createElement("span");
  dcSpan.textContent = "DC: —";
  dcSpan.id = `char-dc-${index}`;
  middle.appendChild(dcSpan);

  // ------------------------------------------------------------
  // FOOTER (Result + Days + Income)
  // ------------------------------------------------------------

  const footer = document.createElement("div");
  footer.className = "character-footer";

  // Result
  const resultRow = document.createElement("div");
  resultRow.className = "form-row";
  const resultLabel = document.createElement("label");
  resultLabel.textContent = "Result";
  const resultGroup = document.createElement("div");
  resultGroup.className = "radio-group";
  const resultOptions = [
    { value: "crit-fail", label: "Crit Fail" },
    { value: "fail", label: "Fail" },
    { value: "success", label: "Success" },
    { value: "crit-success", label: "Crit Success" }
  ];
  resultOptions.forEach((opt) => {
    const pill = document.createElement("label");
    pill.className = "radio-pill";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `char-result-${index}`;
    input.value = opt.value;
    input.addEventListener("change", () => {
      recalcRow(card);
      updateSummary();
    });
    const x = document.createElement("span");
    x.className = "x-mark";
    const text = document.createElement("span");
    text.className = "label-text";
    text.textContent = opt.label;
    pill.append(input, x, text);
    resultGroup.appendChild(pill);
  });
  const resultError = document.createElement("div");
  resultError.className = "field-error";
  resultError.dataset.errorFor = `char-result-${index}`;
  resultRow.append(resultLabel, resultGroup, resultError);

  // Days
  const daysRow = document.createElement("div");
  daysRow.className = "form-row";
  const daysLabel = document.createElement("label");
  daysLabel.textContent = "Days";
  const daysInput = document.createElement("input");
  daysInput.type = "number";
  daysInput.min = 1;
  daysInput.max = 24;
  daysInput.value = 8;
  daysInput.classList.add("days-input");
  daysInput.id = `char-days-${index}`;
  daysInput.title = "Quests, Scenarios, and Adventures grant 2 days per 1 XP; Bounties grant 0 days.";
  daysInput.addEventListener("input", () => {
    sanitizeNumericInput(daysInput);
    validateDays(daysInput);
    recalcRow(card);
    updateSummary();
  });
  const daysError = document.createElement("div");
  daysError.className = "field-error";
  daysError.dataset.errorFor = daysInput.id;
  daysRow.append(daysLabel, daysInput, daysError);

  // Income
  const incomeRow = document.createElement("div");
  incomeRow.className = "form-row";
  const incomeLabel = document.createElement("label");
  incomeLabel.textContent = "Income";
  const incomeDisplay = document.createElement("input");
  incomeDisplay.type = "text";
  incomeDisplay.readOnly = true;
  incomeDisplay.classList.add("income-display");
  incomeDisplay.id = `char-income-${index}`;
  incomeDisplay.title = "Income per downtime in gp/cr based on system.";
  incomeRow.append(incomeLabel, incomeDisplay);

  footer.append(resultRow, daysRow, incomeRow);

  // ------------------------------------------------------------
  // Assemble card
  // ------------------------------------------------------------

  card.append(header, middle, footer);
  return card;
}

function handleRowVisibility(index) {
  const container = document.getElementById("character-rows");
  const currentRow = container.querySelector(`.character-card[data-index="${index}"]`);
  const nameInput = currentRow.querySelector(`#char-name-${index}`);
  if (nameInput.value.trim() !== "" && index < 6) {
    const nextRow = container.querySelector(`.character-card[data-index="${index + 1}"]`);
    if (nextRow && nextRow.style.display === "none") {
      nextRow.style.display = "";
    }
  }
}

// ============================================================
//  SANITIZATION
// ============================================================

function sanitizeTextInput(input) {
  const allowed = /[a-zA-Z0-9 \-:(),]/g;
  const value = input.value;
  const matches = value.match(allowed);
  input.value = matches ? matches.join("") : "";
}

function sanitizeNumericInput(input) {
  input.value = input.value.replace(/[^0-9]/g, "");
}

// ============================================================
//  VALIDATION
// ============================================================

function setFieldError(id, message) {
  const err = document.querySelector(`.field-error[data-error-for="${id}"]`);
  if (err) err.textContent = message || "";
}

function validateLevel(input) {
  const id = input.id;
  if (!input.value) {
    setFieldError(id, "");
    return;
  }
  const val = parseInt(input.value, 10);
  if (currentSystem === PF2) {
    if (val < 1 || val > 20) setFieldError(id, "Level must be between 1 and 20.");
    else setFieldError(id, "");
  } else {
    if (val < 1 || val > 10) setFieldError(id, "Level must be between 1 and 10.");
    else setFieldError(id, "");
  }
}

function validateDays(input) {
  const id = input.id;
  if (!input.value) {
    setFieldError(id, "");
    return;
  }
  const val = parseInt(input.value, 10);
  if (val < 1 || val > 24) setFieldError(id, "Days must be between 1 and 24.");
  else setFieldError(id, "");
}

// ============================================================
//  CSV LOADING
// ============================================================

function loadCSVs() {
  Promise.all([
    fetch("pf2-downtime.csv").then((r) => r.ok ? r.text() : Promise.reject()),
    fetch("sf2-downtime.csv").then((r) => r.ok ? r.text() : Promise.reject())
  ])
    .then(([pf2Text, sf2Text]) => {
      pf2Table = parseCSV(pf2Text);
      sf2Table = parseCSV(sf2Text);
      renderDowntimeTable();
    })
