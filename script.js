let pdfDoc = null;
let currentPage = 0;
let siteTimes = [];
let headerIndex = 0;

const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');

const dropArea = document.getElementById('dropArea');
dropArea.addEventListener('dragover', e => {
    e.preventDefault();
    dropArea.style.borderColor = 'green';
});
dropArea.addEventListener('dragleave', () => {
    dropArea.style.borderColor = '#ccc';
});
dropArea.addEventListener('drop', async e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async function () {
            const pdfData = new Uint8Array(reader.result);
            pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            currentPage = 0;
            showPage(currentPage);
        };
        reader.readAsArrayBuffer(file);
    }
});

function showPage(num) {
    if (!pdfDoc) return;

    const activeLaps = siteTimes.filter(e => !e[3]);
    const pageLaps = siteTimes.filter(e => e[4] === num && !e[3]);

    // Get first non-commented lap index with pageIndex === num
    const firstIndex = siteTimes.findIndex(e => e[4] === num && !e[3]);
    if (firstIndex !== -1) {
        currentPage = firstIndex;
    }

    pdfDoc.getPage(num + 1).then(page => {
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        page.render({ canvasContext: ctx, viewport });

        document.getElementById('pageInfo').innerText = `Page ${num + 1} / ${pdfDoc.numPages}`;
        updateInputsFromPage(currentPage);
        renderTimesList();
    });
}



function prevPage() {
    const activeLaps = siteTimes.filter(e => !e[3]);

    const currentPageIndex = activeLaps.findIndex(e => e === siteTimes[currentPage]);
    const currentPageNum = siteTimes[currentPage]?.[4] ?? currentPage;

    for (let i = currentPageIndex - 1; i >= 0; i--) {
        const prevPageNum = activeLaps[i][4];
        if (prevPageNum < currentPageNum) {
            currentPage = siteTimes.indexOf(activeLaps[i]);
            showPage(prevPageNum);
            break;
        }
    }
}



function nextPage() {
    const activeLaps = siteTimes.filter(e => !e[3]);

    const currentPageIndex = activeLaps.findIndex(e => e === siteTimes[currentPage]);
    const currentPageNum = siteTimes[currentPage]?.[4] ?? currentPage;

    const next = activeLaps.find(e => e[4] > currentPageNum);
    if (next) {
        const idx = siteTimes.indexOf(next);
        currentPage = idx;
        showPage(next[4]);
    }
}




function updateInputsFromPage(index) {
    const item = siteTimes[index];
    if (!item) return;
    const [start, end, background, comment] = item;
    document.getElementById('startInput').value = start ?? '';
    document.getElementById('endInput').value = end ?? '';
    document.getElementById('bgInput').value = background ?? '';
    document.getElementById('commentOut').checked = comment === true;
}

function saveLapData() {
    const start = parseInt(document.getElementById('startInput').value);
    const end = parseInt(document.getElementById('endInput').value);
    const bg = parseFloat(document.getElementById('bgInput').value);
    const comment = document.getElementById('commentOut').checked;

    if (!isNaN(start) && !isNaN(end)) {
        const existing = siteTimes[currentPage];
        const pageIndex = existing?.[4] ?? currentPage;
        siteTimes[currentPage] = [start, end, isNaN(bg) ? null : bg, comment, pageIndex];
        renderTimesList();
    }
}


function adjust(type, delta) {
    const input = document.getElementById(type + 'Input');
    const val = parseInt(input.value);
    if (!isNaN(val)) {
        input.value = val + delta;
        saveLapData();
    }
}

function renderTimesList() {
    const list = document.getElementById('timesList');
    list.innerHTML = '';

    // Header
    const header = document.createElement('li');
    header.textContent = `all_times${headerIndex} = [`;
    header.style.fontWeight = 'bold';
    header.style.cursor = 'pointer';
    header.onclick = () => {
        currentPage = 0;
        showPage(currentPage);
    };
    list.appendChild(header);

    // Separate indices but keep original order for PDF mapping
    const indexed = siteTimes.map((entry, idx) => ({ entry, idx }));

    const active = indexed.filter(i => !i.entry[3]);
    const commented = indexed.filter(i => i.entry[3]);

    // Render active laps
    active.forEach(({ entry, idx }) => {
        const [start, end, bg] = entry;
        const li = document.createElement('li');
        li.textContent = `    [${start}, ${end}${bg != null ? `, ${bg}` : ''}],`;
        li.style.cursor = 'pointer';

        if (idx === currentPage) {
            li.classList.add('active');

            // Auto scroll into view
            setTimeout(() => {
                li.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 0);
        }

        li.onclick = () => {
            currentPage = idx;
            showPage(currentPage);
        };

        list.appendChild(li);
    });

    // Render commented laps
    commented.forEach(({ entry }) => {
        const [start, end, bg] = entry;
        const li = document.createElement('li');
        li.textContent = `    #[${start}, ${end}${bg != null ? `, ${bg}` : ''}],`;
        li.style.opacity = '0.6';
        li.style.fontStyle = 'italic';
        list.appendChild(li);
    });

    // Footer
    const footer = document.createElement('li');
    footer.textContent = ']';
    list.appendChild(footer);
}




function parsePastedTimes() {
    const raw = document.getElementById('pasteBox').value;
    const lines = raw
        .replace(/all_times\d*\s*=\s*\[/g, '')  // remove header if present
        .replace(/\]/g, ']')                    // normalize brackets
        .replace(/\t/g, '')                     // remove tabs
        .split('\n')                            // split into lines
        .map(line => line.trim())               // trim each line
        .filter(line => line && line !== ']');  // remove empty/closing lines

    const active = [];
    const commented = [];

    for (let line of lines) {
        // If line doesn't start with [, wrap it
        if (!line.startsWith('[') && line.includes(',')) {
            line = `[${line}]`;
        }

        const match = line.match(/^(#)?\[(\d+),\s*(\d+)(?:,\s*([\d.]+))?\],?$/);
        if (match) {
            const comment = match[1] === '#';
            const start = parseInt(match[2]);
            const end = parseInt(match[3]);
            const bg = match[4] ? parseFloat(match[4]) : null;
            const entry = [start, end, bg, comment];
            if (comment) {
                commented.push(entry);
            } else {
                active.push(entry);
            }
        }
    }

    // Apply pageIndex as the fifth value
    const numberedActive = active.map((entry, i) => [...entry, i]);
    const numberedCommented = commented.map((entry, i) => [...entry, active.length + i]);

    siteTimes = numberedActive.concat(numberedCommented);
    currentPage = 0;
    renderTimesList();
    showPage(currentPage);

    const parseControls = document.getElementById('parseControls');
    if (parseControls) parseControls.style.display = 'none';
}





function autoSaveLap() {
    const start = parseInt(document.getElementById('startInput').value);
    const end = parseInt(document.getElementById('endInput').value);
    const bg = parseFloat(document.getElementById('bgInput').value);
    const comment = document.getElementById('commentOut').checked;

    if (!isNaN(start) && !isNaN(end)) {
        const oldEntry = siteTimes[currentPage];
        const pageIndex = oldEntry?.[4] ?? currentPage;
        siteTimes[currentPage] = [start, end, isNaN(bg) ? null : bg, comment, pageIndex];
        renderTimesList();
    }
}


function showSplitLapPopup() {
    const lap = siteTimes[currentPage];
    const [start, end, bg] = lap;
    const container = document.getElementById('splitInputs');
    container.innerHTML = '';  // clear previous

    addSplitPoint(start, end, bg);
    addSplitPoint(start, end, bg);
    document.getElementById('splitPanel').style.display = 'block';
}

function closeSplitLapPopup() {
    document.getElementById('splitPanel').style.display = 'none';
    document.getElementById('splitInputs').innerHTML = '';
}

function addSplitPoint(start = '', end = '', bg = '') {
    const container = document.getElementById('splitInputs');

    const row = document.createElement('div');
    row.className = 'splitRow';

    const s = document.createElement('input');
    s.type = 'number';
    s.placeholder = 'Start';
    s.value = start;

    const e = document.createElement('input');
    e.type = 'number';
    e.placeholder = 'End';
    e.value = end;

    const b = document.createElement('input');
    b.type = 'number';
    b.placeholder = 'Background';
    b.step = 'any';
    b.value = bg;

    row.appendChild(s);
    row.appendChild(e);
    row.appendChild(b);

    container.appendChild(row);
}

function confirmSplitLap() {
    const rows = document.querySelectorAll('#splitInputs .splitRow');
    const newLaps = [];

    const original = siteTimes[currentPage];
    const originalPageIndex = original?.[4] ?? currentPage;

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const start = parseInt(inputs[0].value);
        const end = parseInt(inputs[1].value);
        const bg = parseFloat(inputs[2].value);
        const comment = original[3];

        if (!isNaN(start) && !isNaN(end)) {
            newLaps.push([start, end, !isNaN(bg) ? bg : null, comment, originalPageIndex]);
        }
    });

    if (newLaps.length > 0) {
        siteTimes.splice(currentPage, 1, ...newLaps);
        currentPage = siteTimes.findIndex(e => e[4] === originalPageIndex && !e[3]);
        renderTimesList();
        showPage(currentPage);
    }

    closeSplitLapPopup();
}






function copyToClipboard() {
    let text = `all_times${headerIndex} = [\n`;
    siteTimes.forEach(([s, e, b, c]) => {
        text += `    ${c ? '#' : ''}[${s}, ${e}${b != null ? `, ${b}` : ''}],\n`;
    });
    text += ']';
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
}

function downloadTimes() {
    const text = `all_times${headerIndex} = [\n` +
        siteTimes.map(([s, e, b, c]) => `    ${c ? '#' : ''}[${s}, ${e}${b != null ? `, ${b}` : ''}],\n`).join('') +
        `]`;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'times.txt';
    a.click();
}


function restart() {
    siteTimes = [];
    headerIndex = 0;
    currentPage = 0;
    document.getElementById('pasteBox').value = '';
    renderTimesList();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pdfDoc = null;
    document.getElementById('pageInfo').innerText = '';

    // ✅ Show the parse box again
    const parseControls = document.getElementById('parseControls');
    if (parseControls) parseControls.style.display = 'block';
}



function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
}


