const MAX_ROWS = 7;
let csvData = [];
let backgroundLoaded = false;

// Load CSV and then init
fetch("downtime-income.csv")
    .then(r => r.text())
    .then(text => {
        csvData = parseCSV(text);
        buildTable(csvData);
        initUI();
        initRows();
        applyBackground();
        updateAll();
    });

function parseCSV(text) {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",");
    return lines.slice(1).map(line => {
        const parts = line.split(",");
        let obj = {};
        headers.forEach((h, i) => obj[h] = parts[i]);
        return obj;
    });
}

function buildTable(data) {
    const container = document.getElementById("csv-table");
    if (!data || !data.length) {
        container.textContent = "No CSV data loaded.";
        return;
    }

    const headers = Object.keys(data[0]);
    let html = "<table><thead><tr>";
    headers.forEach(h => html += `<th>${h}</th>`);
    html += "</tr></thead><tbody>";

    data.forEach(row => {
        html += "<tr>";
        headers.forEach(h => {
            html += `<td>${row[h]}</td>`;
        });
        html += "</tr>";
    });

    html += "</tbody></table>";
    container.innerHTML = html;
}

function initUI() {
    const themeToggle = document.getElementById("theme-toggle");
    const mobileSwitch = document.getElementById("mobileSwitch");
    const appendixToggle = document.getElementById("appendix-toggle");
    const copySummary = document.getElementById("copy-summary");

    themeToggle.addEventListener("click", toggleTheme);
    mobileSwitch.addEventListener("change", e => {
        document.body.classList.toggle("mobile", e.target.checked);
    });

    appendixToggle.addEventListener("click", () => {
        const app = document.getElementById("appendix");
        const hidden = app.classList.toggle("hidden");
        appendixToggle.textContent = hidden ? "Show Appendix" : "Hide Appendix";
    });

    copySummary.addEventListener("click", () => {
        const text = document.getElementById("summary-output").textContent;
        if (!text.trim()) return;
        navigator.clipboard.writeText(text).catch(() => {});
    });
}

function initRows() {
    const container = document.getElementById("character-rows");
    container.innerHTML = "";

    for (let i = 0; i < MAX_ROWS; i++) {
        const row = document.createElement("div");
        row.className = "character-row";
        row.dataset.index = i;

        row.innerHTML = `
            <div class="field-group">
                <label>Name</label>
                <input type="text" class="name" maxlength="30" placeholder="Character name">
            </div>

            <div class="field-group">
                <label>Level</label>
                <input type="number" class="level" min="1" max="20" placeholder="1–20">
            </div>

            <div class="field-group">
                <label>Training (TEML)</label>
                <div class="radio-group training">
                    <label class="radio-pill"><input type="radio" name="t${i}" value="T">T</label>
                    <label class="radio-pill"><input type="radio" name="t${i}" value="E">E</label>
                    <label class="radio-pill"><input type="radio" name="t${i}" value="M">M</label>
                    <label class="radio-pill"><input type="radio" name="t${i}" value="L">L</label>
                </div>
            </div>

            <div class="field-group">
                <label title="Horizon Hunters - Storied Talent">
                    <input type="checkbox" class="hhst"> HHST Boon?
                </label>
            </div>

            <div class="field-group">
                <label title="Quests, Scenarios, and Adventures grant 2 days per 1 XP; Bounties grant 0.">
                    Downtime Days
                </label>
                <input type="number" class="days" value="8" min="1" max="24">
            </div>

            <div class="field-group">
                <label>DC</label>
                <input type="text" class="dc" readonly>
            </div>

            <div class="field-group">
                <label>Result</label>
                <div class="result-group">
                    <label class="radio-pill"><input type="radio" name="r${i}" value="critfail">Crit Fail</label>
                    <label class="radio-pill"><input type="radio" name="r${i}" value="fail">Fail</label>
                    <label class="radio-pill"><input type="radio" name="r${i}" value="success">Success</label>
                    <label class="radio-pill"><input type="radio" name="r${i}" value="critsuccess">Crit Success</label>
                </div>
            </div>

            <div class="field-group">
                <label>EL</label>
                <input type="text" class="el" readonly>
            </div>

            <div class="field-group">
                <label title="Income in gp (gold pieces)">Income</label>
                <input type="text" class="income" readonly>
            </div>
        `;

        container.appendChild(row);
    }

    document.querySelectorAll(".character-row").forEach(row => {
        row.addEventListener("input", updateAll);
        row.addEventListener("change", updateAll);
    });
}

function sanitizeName(name) {
    // Allow letters, numbers, spaces, hyphens, apostrophes
    return name.replace(/[^A-Za-z0-9 '\-]/g, "");
}

function updateAll() {
    const rows = document.querySelectorAll(".character-row");
    let summaryLines = [];

    rows.forEach(row => {
        const nameInput = row.querySelector(".name");
        nameInput.value = sanitizeName(nameInput.value);

        const name = nameInput.value.trim();
        const levelVal = row.querySelector(".level").value;
        const daysVal = row.querySelector(".days").value;
        const hhst = row.querySelector(".hhst").checked;
        const training = row.querySelector(".training input:checked")?.value;
        const result = row.querySelector(".result-group input:checked")?.value;

        const level = parseInt(levelVal, 10);
        const days = parseInt(daysVal, 10);

        // Ignore rows without enough info
        if (!name || !level || !training || !result || isNaN(days)) {
            row.querySelector(".dc").value = "";
            row.querySelector(".el").value = "";
            row.querySelector(".income").value = "";
            return;
        }

        // Clamp level and days
        const clampedLevel = Math.min(20, Math.max(1, level));
        const clampedDays = Math.min(24, Math.max(1, days));

        if (clampedLevel !== level) row.querySelector(".level").value = clampedLevel;
        if (clampedDays !== days) row.querySelector(".days").value = clampedDays;

        let initialEL = hhst ? clampedLevel : Math.max(0, clampedLevel - 2);
        let modifiedEL = initialEL;

        const initialRow = csvData.find(r => parseInt(r.EL, 10) === initialEL);
        row.querySelector(".dc").value = initialRow?.DC ?? "-";

        if (result === "critfail") {
            row.querySelector(".el").value = "-";
            row.querySelector(".income").value = "-";
            summaryLines.push(`${name}: Crit Fail     +0 gp`);
            return;
        }

        if (result === "critsuccess") {
            modifiedEL = Math.min(21, initialEL + 1);
        }

        row.querySelector(".el").value = modifiedEL;

        const dataRow = csvData.find(r => parseInt(r.EL, 10) === modifiedEL);
        if (!dataRow) {
            row.querySelector(".income").value = "-";
            return;
        }

        let gpPerDay = 0;
        if (result === "fail") {
            gpPerDay = parseFloat(dataRow.Fail);
        } else {
            gpPerDay = parseFloat(dataRow[training]);
        }

        if (isNaN(gpPerDay)) gpPerDay = 0;

        const total = gpPerDay * clampedDays;
        const formatted = formatGP(total);
        row.querySelector(".income").value = formatted;

        const hhstTag = hhst ? " (HHST)" : "";
        const resultText = formatResult(result);
        summaryLines.push(`${name}: ${resultText}, EL = ${modifiedEL}${hhstTag}     +${formatted}`);
    });

    document.getElementById("summary-output").textContent = summaryLines.join("\n");
}

function formatResult(r) {
    return {
        critfail: "Crit Fail",
        fail: "Fail",
        success: "Success",
        critsuccess: "Crit Success"
    }[r] || "";
}

function formatGP(v) {
    if (Number.isInteger(v)) return `${v} gp`;
    const fixed = parseFloat(v.toFixed(2)); // trim floating noise
    const str = fixed.toString(); // no trailing zeros beyond needed
    return `${str} gp`;
}

/* Theme + background */

function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains("theme-dark");
    body.classList.toggle("theme-dark", !isDark);
    body.classList.toggle("theme-light", isDark);
    applyShader();
}

function applyBackground() {
    const bg = document.getElementById("background-image");
    const portrait = window.matchMedia("(orientation: portrait)").matches;

    const imgPath = portrait ? "img/background-portrait.png" : "img/background-landscape.png";
    const testImg = new Image();
    testImg.onload = () => {
        backgroundLoaded = true;
        bg.style.backgroundImage = `url("${imgPath}")`;
        applyShader();
    };
    testImg.onerror = () => {
        backgroundLoaded = false;
        bg.style.backgroundImage = "none";
        document.getElementById("background-shader").style.background = "transparent";
    };
    testImg.src = imgPath;
}

function applyShader() {
    const shader = document.getElementById("background-shader");
    if (!backgroundLoaded) {
        shader.style.background = "transparent";
        return;
    }
    const isDark = document.body.classList.contains("theme-dark");
    shader.style.background = isDark ? "var(--shader-dark)" : "var(--shader-light)";
}

window.addEventListener("resize", () => {
    applyBackground();
});