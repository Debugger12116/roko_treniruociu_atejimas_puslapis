// --- KONFIGŪRACIJA ---
const ADMIN_USER = "treneris";
const ADMIN_PASS = "rokas123";
const LT_DAYS = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"];
const LT_MONTHS = ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis", "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"];

// Nuoroda į šriftą internete (Roboto), kuris palaiko lietuviškas raides
const FONT_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf";

let attendanceData = {};
let charts = {};

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    updateUI();
    setupForm();
    checkSession();
    
    // Nustatyti PDF modalą į esamą datą
    const today = new Date();
    const yearInput = document.getElementById('pdf-year');
    if(yearInput) yearInput.value = today.getFullYear();
    const monthInput = document.getElementById('pdf-month');
    if(monthInput) monthInput.value = today.getMonth() + 1;
});

// --- DUOMENŲ ĮKĖLIMAS ---
async function loadData() {
    const localData = localStorage.getItem('attendanceData');
    try {
        const response = await fetch('data.json');
        if (response.ok) {
            const jsonData = await response.json();
            attendanceData = { ...jsonData, ...(localData ? JSON.parse(localData) : {}) };
        } else {
            throw new Error("Failas nerastas");
        }
    } catch (e) {
        console.log("Naudojamas tik vietinis įrašymas (data.json nerastas arba tuščias)");
        attendanceData = localData ? JSON.parse(localData) : {};
    }
}

function saveToStorage() {
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    updateUI();
}

function downloadJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(attendanceData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "data.json");
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
}

// --- CRUD OPERACIJOS ---
function handleSave(date, type, status, originalDate) {
    if (originalDate && originalDate !== date) delete attendanceData[originalDate];
    attendanceData[date] = { type, present: status };
    saveToStorage();
    resetForm();
    alert('Įrašas išsaugotas! (Nepamirškite atsisiųsti JSON)');
}

function deleteRecord(date) {
    if (confirm(`Ištrinti ${date}?`)) {
        delete attendanceData[date];
        saveToStorage();
    }
}

function startEdit(date) {
    const rec = attendanceData[date];
    if (!rec) return;
    document.getElementById('date-input').value = date;
    document.getElementById('original-date').value = date;
    document.getElementById('type-input').value = rec.type;
    document.getElementById('status-input').value = rec.present;
    
    document.getElementById('form-title').innerText = "Redaguoti įrašą";
    document.getElementById('submit-btn').innerText = "Atnaujinti";
    document.getElementById('cancel-btn').classList.remove('hidden');
    document.getElementById('admin-panel').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('add-form').reset();
    document.getElementById('original-date').value = "";
    document.getElementById('form-title').innerText = "Pridėti įrašą";
    document.getElementById('submit-btn').innerText = "Išsaugoti";
    document.getElementById('cancel-btn').classList.add('hidden');
}

function setupForm() {
    const form = document.getElementById('add-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('date-input').value;
        const oDate = document.getElementById('original-date').value;
        const type = document.getElementById('type-input').value;
        const status = document.getElementById('status-input').value === 'true';
        if(date) handleSave(date, type, status, oDate);
    });
}

// --- UI ATNAUJINIMAS ---
function updateUI() {
    const dates = Object.keys(attendanceData).sort();
    const tableBody = document.querySelector('#attendance-table tbody');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    if (tableBody) tableBody.innerHTML = '';

    let stats = {
        treniruote: { total: 0, present: 0 },
        rungtynes: { total: 0, present: 0 },
        weekday: Array(7).fill(0).map(() => ({ total: 0, present: 0 }))
    };

    dates.forEach(date => {
        const rec = attendanceData[date];
        const d = new Date(date);
        const dayIdx = (d.getDay() + 6) % 7; 

        if (stats[rec.type]) {
            stats[rec.type].total++;
            if (rec.present) stats[rec.type].present++;
        }
        if (stats.weekday[dayIdx]) {
            stats.weekday[dayIdx].total++;
            if (rec.present) stats.weekday[dayIdx].present++;
        }

        const actionsHtml = isLoggedIn ? `
            <td>
                <button onclick="startEdit('${date}')" class="action-btn edit-btn">Redaguoti</button>
                <button onclick="deleteRecord('${date}')" class="action-btn delete-btn">Ištrinti</button>
            </td>` : `<td class="admin-col hidden"></td>`;

        const typeLabel = rec.type === 'treniruote' ? 'Treniruotė' : 'Rungtynės';
        const statusLabel = rec.present ? 'Buvo' : 'Nebuvo';
        const statusClass = rec.present ? 'status-true' : 'status-false';

        const row = `
            <tr>
                <td>${date}</td>
                <td>${LT_DAYS[dayIdx]}</td>
                <td>${typeLabel}</td>
                <td class="${statusClass}">${statusLabel}</td>
                ${actionsHtml}
            </tr>`;
        if (tableBody) tableBody.innerHTML += row;
    });

    updateStatCard('train', stats.treniruote);
    updateStatCard('match', stats.rungtynes);
    renderCharts(stats);
    
    document.querySelectorAll('.admin-col').forEach(col => 
        isLoggedIn ? col.classList.remove('hidden') : col.classList.add('hidden')
    );
}

function updateStatCard(id, stat) {
    const elRate = document.getElementById(`${id}-stat`);
    const elDetail = document.getElementById(`${id}-detail`);
    if (elRate && elDetail) {
        const rate = stat.total ? ((stat.present / stat.total) * 100).toFixed(1) : 0;
        elRate.innerText = `${rate}%`;
        elDetail.innerText = `${stat.present} iš ${stat.total}`;
    }
}

function renderCharts(stats) {
    const ctx1 = document.getElementById('attendanceChart');
    const ctx2 = document.getElementById('weekdayChart');
    
    if (ctx1 && !charts.pie) {
        charts.pie = new Chart(ctx1.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Treniruotės', 'Rungtynės'], datasets: [{ data: [], backgroundColor: ['#36a2eb', '#ff6384'] }] },
            options: { plugins: { title: { display: true, text: 'Lankomumo %' } } }
        });
    }
    if (ctx2 && !charts.bar) {
        charts.bar = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: { labels: LT_DAYS.map(d => d.substring(0,3)), datasets: [{ label: '%', data: [], backgroundColor: '#ffce56' }] },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { title: { display: true, text: 'Pagal dienas' } } }
        });
    }

    if (charts.pie) {
        charts.pie.data.datasets[0].data = [
            (stats.treniruote.present / (stats.treniruote.total || 1)) * 100,
            (stats.rungtynes.present / (stats.rungtynes.total || 1)) * 100
        ];
        charts.pie.update();
    }
    if (charts.bar) {
        charts.bar.data.datasets[0].data = stats.weekday.map(d => d.total ? (d.present / d.total * 100) : 0);
        charts.bar.update();
    }
}

// --- PDF GENERAVIMAS ---
function showPDFModal() { 
    document.getElementById('pdf-modal').classList.remove('hidden'); 
}

function togglePdfInputs() {
    const type = document.getElementById('pdf-type').value;
    const yGroup = document.getElementById('pdf-year-group');
    const mGroup = document.getElementById('pdf-month-group');
    
    yGroup.classList.remove('hidden');
    mGroup.classList.remove('hidden');
    if (type === 'all') { yGroup.classList.add('hidden'); mGroup.classList.add('hidden'); }
    else if (type === 'year') { mGroup.classList.add('hidden'); }
}

// Funkcija lietuviškų raidžių šalinimui (jei nepavyksta įkelti šrifto)
function sanitizeText(str) {
    const map = {
        'ą':'a', 'č':'c', 'ę':'e', 'ė':'e', 'į':'i', 'š':'s', 'ų':'u', 'ū':'u', 'ž':'z',
        'Ą':'A', 'Č':'C', 'Ę':'E', 'Ė':'E', 'Į':'I', 'Š':'S', 'Ų':'U', 'Ū':'U', 'Ž':'Z'
    };
    return str.replace(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, match => map[match]);
}

// Funkcija šrifto atsisiuntimui
async function loadFont(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Šriftas nepasiekiamas");
    const blob = await resp.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });
}

async function generatePDF() {
    if (!window.jspdf) return alert("Klaida: biblioteka neužsikrovė.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let fontLoaded = false;

    // 1. Bandome įkelti šriftą iš interneto (CDN)
    try {
        const fontBase64 = await loadFont(FONT_URL);
        doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.setFont("Roboto");
        fontLoaded = true;
    } catch (e) {
        console.warn("Nepavyko įkelti šrifto. Naudojamas standartinis (be LT raidžių).");
    }

    const type = document.getElementById('pdf-type').value;
    const year = parseInt(document.getElementById('pdf-year').value);
    const month = parseInt(document.getElementById('pdf-month').value);
    
    // Antraštės
    const title = fontLoaded ? "Lankomumo Ataskaita" : sanitizeText("Lankomumo Ataskaita");
    let subtitle = "";
    let showNote = false;

    if (type === 'all') {
        subtitle = "Viso laiko statistika";
        showNote = true;
    } else if (type === 'year') {
        subtitle = `${year} metų statistika`;
        if (year === 2025) showNote = true;
    } else {
        subtitle = `${year} m. ${LT_MONTHS[month-1]} statistika`;
        if (year === 2025 && month === 10) showNote = true;
    }
    if (!fontLoaded) subtitle = sanitizeText(subtitle);

    // Duomenų filtravimas
    const rows = [];
    Object.keys(attendanceData).sort().forEach(date => {
        const d = new Date(date);
        let include = false;
        if (type === 'all') include = true;
        else if (type === 'year' && d.getFullYear() === year) include = true;
        else if (type === 'month' && d.getFullYear() === year && d.getMonth()+1 === month) include = true;

        if (include) {
            const rec = attendanceData[date];
            let tDay = LT_DAYS[(d.getDay() + 6) % 7];
            let tType = rec.type === 'treniruote' ? 'Treniruotė' : 'Rungtynės';
            let tStatus = rec.present ? "Taip" : "Ne";

            // Jei šriftas neįsikrovė, nuimame lietuviškas raides, kad nenukirstų teksto
            if (!fontLoaded) {
                tDay = sanitizeText(tDay);
                tType = sanitizeText(tType); // Treniruotė -> Treniruote
                tStatus = sanitizeText(tStatus);
            }
            rows.push([date, tDay, tType, tStatus]);
        }
    });

    // PDF generavimas
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18);
    doc.text(title, pageWidth/2, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(subtitle, pageWidth/2, 22, { align: 'center' });
    doc.setFontSize(11);
    const name = fontLoaded ? "Rokas Šipkauskas" : "Rokas Sipkauskas";
    doc.text(name, pageWidth/2, 29, { align: 'center' });

    let startY = 35;
    if (showNote) {
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(10);
        const note = fontLoaded ? "* Duomenys pradėti skaičiuoti nuo 2025-10-06" : "* Duomenys pradeti skaiciuoti nuo 2025-10-06";
        doc.text(note, pageWidth/2, startY, { align: 'center' });
        doc.setTextColor(0,0,0);
        startY += 10;
    }

    if (rows.length === 0) {
        doc.text("Įrašų nerasta.", pageWidth/2, startY + 10, { align: 'center' });
    } else {
        doc.autoTable({
            head: [['Data', fontLoaded?'Diena':'Diena', 'Tipas', 'Buvo']],
            body: rows,
            startY: startY,
            theme: 'grid',
            styles: { 
                font: fontLoaded ? "Roboto" : "helvetica", 
                halign: 'center' 
            },
            headStyles: { fillColor: [44, 62, 80], halign: 'center' },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 3) {
                    if (data.cell.raw === 'Ne' || data.cell.raw === 'ne') {
                        data.cell.styles.textColor = [200, 0, 0];
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.textColor = [0, 100, 0];
                    }
                }
            }
        });
    }

    doc.save(`lankomumas_${type}.pdf`);
    closeModal('pdf-modal');
}

// --- AUTENTIFIKACIJA ---
function showLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function attemptLogin() {
    if (document.getElementById('username').value === ADMIN_USER && document.getElementById('password').value === ADMIN_PASS) {
        localStorage.setItem('isLoggedIn', 'true');
        checkSession();
        closeModal('login-modal');
    } else {
        document.getElementById('login-error').innerText = "Neteisingi duomenys";
    }
}
function logout() { localStorage.removeItem('isLoggedIn'); checkSession(); }
function checkSession() {
    const logged = localStorage.getItem('isLoggedIn') === 'true';
    if(document.getElementById('admin-panel')) {
        document.getElementById('admin-panel').classList.toggle('hidden', !logged);
        document.getElementById('login-btn').classList.toggle('hidden', logged);
        document.getElementById('logout-btn').classList.toggle('hidden', !logged);
        updateUI();
    }
}
