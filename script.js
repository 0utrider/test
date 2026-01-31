// Constants for training levels
const TRAINING_LEVELS = ['T', 'E', 'M', 'L'];

// Result options
const RESULTS = ['Crit Fail', 'Fail', 'Success', 'Crit Success'];

// Max characters
const MAX_CHARACTERS = 7;

// CSV data storage
let incomeData = [];

// DOM elements
const charactersTableBody = document.querySelector('#characters-table tbody');
const addCharacterBtn = document.getElementById('add-character');
const summaryOutput = document.getElementById('summary-output');
const copyAllBtn = document.getElementById('copy-all');
const themeToggleBtn = document.getElementById('theme-toggle');

// Current theme state
let isLightMode = false;

// Load CSV data
async function loadCSV() {
  const response = await fetch('downtime-income.csv');
  const text = await response.text();
  incomeData = parseCSV(text);
}

// Parse CSV into array of objects
function parseCSV(text) {
  const lines = text.trim().split('
');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    let obj = {};
    headers.forEach((header, i) => {
      obj[header.trim()] = values[i].trim();
    });
    return obj;
  });
}

// Add a new character row
function addCharacterRow() {
  if (charactersTableBody.children.length >= MAX_CHARACTERS) return;

  const row = document.createElement('tr');

  // Name input
  const nameTd = document.createElement('td');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Name';
  nameTd.appendChild(nameInput);
  row.appendChild(nameTd);

  // Level input
  const levelTd = document.createElement('td');
  const levelInput = document.createElement('input');
  levelInput.type = 'number';
  levelInput.min = 1;
  levelInput.max = 20;
  levelInput.value = 1;
  levelTd.appendChild(levelInput);
  row.appendChild(levelTd);

  // Training select
  const trainingTd = document.createElement('td');
  const trainingSelect = document.createElement('select');
  TRAINING_LEVELS.forEach(level => {
    const option = document.createElement('option');
    option.value = level;
    option.textContent = level;
    trainingSelect.appendChild(option);
  });
  trainingTd.appendChild(trainingSelect);
  row.appendChild(trainingTd);

  // HHST boon checkbox
  const hhstTd = document.createElement('td');
  const hhstCheckbox = document.createElement('input');
  hhstCheckbox.type = 'checkbox';
  hhstTd.appendChild(hhstCheckbox);
  row.appendChild(hhstTd);

  // Downtime days input
  const daysTd = document.createElement('td');
  const daysInput = document.createElement('input');
  daysInput.type = 'number';
  daysInput.min = 1;
  daysInput.value = 1;
  daysTd.appendChild(daysInput);
  row.appendChild(daysTd);

  // Result select
  const resultTd = document.createElement('td');
  const resultSelect = document.createElement('select');
  RESULTS.forEach(result => {
    const option = document.createElement('option');
    option.value = result;
    option.textContent = result;
    resultSelect.appendChild(option);
  });
  resultTd.appendChild(resultSelect);
  row.appendChild(resultTd);

  // Event listeners to recalc on input change
  [nameInput, levelInput, trainingSelect, hhstCheckbox, daysInput, resultSelect].forEach(el => {
    el.addEventListener('input', updateSummary);
  });

  charactersTableBody.appendChild(row);
  updateSummary();
}

// Calculate EL based on level and training
function calculateEL(level, training) {
  const base = parseInt(level, 10);
  const trainingIndex = TRAINING_LEVELS.indexOf(training);
  return base + trainingIndex;
}

// Calculate DC based on EL and HHST boon
function calculateDC(el, hhst) {
  let dc = el + 15; // Base DC formula
  if (hhst) dc += 2;
  return dc;
}

// Find income from CSV data
function findIncome(dc, result, training) {
  const row = incomeData.find(r => parseInt(r.DC, 10) === dc);
  if (!row) return 0;

  switch (result) {
    case 'Crit Fail': return parseInt(row.Fail, 10) || 0;
    case 'Fail': return 0;
    case 'Success': return parseInt(row[training], 10) || 0;
    case 'Crit Success': return parseInt(row[training], 10) * 2 || 0;
    default: return 0;
  }
}

// Update summary output
function updateSummary() {
  let summaryLines = [];

  Array.from(charactersTableBody.children).forEach(row => {
    const inputs = row.querySelectorAll('input, select');
    const name = inputs[0].value.trim();
    const level = inputs[1].value;
    const training = inputs[2].value;
    const hhst = inputs[3].checked;
    const days = inputs[4].value;
    const result = inputs[5].value;

    if (!name || !level || !training || !days) return;

    const el = calculateEL(level, training);
    const dc = calculateDC(el, hhst);
    const incomePerDay = findIncome(dc, result, training);
    const totalIncome = incomePerDay * days;

    const hhstTag = hhst ? ' (HHST)' : '';
    const line = `${name}: ${result}, EL = ${el}${hhstTag}     +${totalIncome} gp`;
    summaryLines.push(line);
  });

  summaryOutput.textContent = summaryLines.join('
');
}

// Copy summary to clipboard
copyAllBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(summaryOutput.textContent).then(() => {
    alert('Summary copied to clipboard!');
  });
});

// Add character button
addCharacterBtn.addEventListener('click', () => {
  addCharacterRow();
});

// Theme toggle
function applyTheme() {
  if (isLightMode) {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode-shader');
    document.body.classList.add('light-mode-shader');
  } else {
    document.body.classList.remove('light-mode');
    document.body.classList.remove('light-mode-shader');
    document.body.classList.add('dark-mode-shader');
  }
}

themeToggleBtn.addEventListener('click', () => {
  isLightMode = !isLightMode;
  applyTheme();
});

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  await loadCSV();
  addCharacterRow();
  applyTheme();
});