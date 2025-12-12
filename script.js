// --- KONFIGŪRACIJA ---
const ADMIN_USER = "treneris";
const ADMIN_PASS = "rokas123";
const LT_DAYS = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"];
const LT_MONTHS = ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis", "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"];

const FONT_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf";

let attendanceData = {};
let charts = {};

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    // Nustatome filtrus į šiandieną
    const today = new Date();
    setupDateInputs('filter-year', 'filter-month', today);
    setupDateInputs('pdf-year', 'pdf-month', today);
    
    toggleMainFilters(); // Sutvarkom filtrų matomumą pradžioje

    await loadData();
    updateUI(); // Čia jau suveiks filtravimas
    setupForm();
    checkSession();
});

// Pagalbinė funkcija datoms nustatyti
function setupDateInputs(yearId, monthId, dateObj) {
    const yInp = document.getElementById(yearId);
    const mInp = document.getElementById(monthId);
    if(yInp) yInp.value = dateObj.getFullYear();
    if(mInp) mInp.value = dateObj.getMonth() + 1;
}

// --- FILTRŲ LOGIKA (NAUJA) ---
function toggleMainFilters() {
    const type = document.getElementById('filter-type').value;
    const yGroup = document.getElementById('filter-year-group');
    const mGroup = document.getElementById('filter-month-group');
    
    // Visada paslepiame pradžioje, tada rodom pagal tipą
    if (yGroup) yGroup.classList.add('hidden');
    if (mGroup) mGroup.classList.add('hidden');

    if (type === 'year') {
        if (yGroup) yGroup.classList.remove('hidden');
    } else if (type === 'month') {
        if (yGroup) yGroup.classList.remove('hidden');
        if (mGroup) mGroup.classList.remove('hidden');
    }
    // Jei 'all', abu lieka paslėpti
}

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
        console.log("Naudojamas tik vietinis įrašymas");
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
    alert('Įrašas išsaugotas!');
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

// --- UI ATNAUJINIMAS (SU FILTRAIS) ---
function updateUI() {
    const dates = Object.keys(attendanceData).sort().reverse(); // Rikiuojame nuo naujausio
    const tableBody = document.querySelector('#attendance-table tbody');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    // 1. Gauname filtrų reikšmes
    const filterType = document.getElementById('filter-type') ? document.getElementById('filter-type').value : 'all';
    const filterYear = document.getElementById('filter-year') ? parseInt(document.getElementById('filter-year').value) : 0;
    const filterMonth = document.getElementById('filter-month') ? parseInt(document.getElementById('filter-month').value) : 0;

    if (tableBody) tableBody.innerHTML = '';

    let stats = {
        treniruote: { total: 0, present: 0 },
        rungtynes: { total: 0, present: 0 },
        weekday: Array(7).fill(0).map(() => ({ total: 0, present: 0 }))
    };

    let visibleCount = 0;

    dates.forEach(date => {
        const rec = attendanceData[date];
        const d = new Date(date);
        
        // --- FILTRAVIMO LOGIKA ---
        let include = false;
        if (filterType === 'all') {
            include = true;
        } else if (filterType === 'year') {
            if (d.getFullYear() === filterYear) include = true;
        } else if (filterType === 'month') {
            if (d.getFullYear() === filterYear && (d.getMonth() + 1) === filterMonth) include = true;
        }

        if (include) {
            visibleCount++;
            const dayIdx = (d.getDay() + 6) % 7; 

            // Skaičiuojame statistiką tik filtravimą praėjusiems įrašams
            if (stats[rec.type]) {
                stats[rec.type].total++;
                if (rec.present) stats[rec.type].present++;
            }
            if (stats.weekday[dayIdx]) {
                stats.weekday[dayIdx].total++;
                if (rec.present) stats.weekday[dayIdx].present++;
            }

            // Piešiame lentelę
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
        }
    });

    // Jei nėra duomenų pagal filtrą
    if (visibleCount === 0 && tableBody) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">Pagal pasirinktus filtrus duomenų nerasta.</td></tr>`;
    }

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
    
    // Sunaikiname senus grafikus, kad nepersidengtų animacijos atnaujinant
    if (charts.pie) charts.pie.destroy();
    if (charts.bar) charts.bar.destroy();

    if (ctx1) {
        charts.pie = new Chart(ctx1.getContext('2d'), {
            type: 'doughnut',
            data: { 
                labels: ['Treniruotės', 'Rungtynės'], 
                datasets: [{ 
                    data: [
                        (stats.treniruote.present / (stats.treniruote.total || 1)) * 100,
                        (stats.rungtynes.present / (stats.rungtynes.total || 1)) * 100
                    ], 
                    backgroundColor: ['#36a2eb', '#ff6384'] 
                }] 
            },
            options: { plugins: { title: { display: true, text: 'Lankomumo % (Pasirinktas laikas)' } } }
        });
    }

    if (ctx2) {
        charts.bar = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: { 
                labels: LT_DAYS.map(d => d.substring(0,3)), 
                datasets: [{ 
                    label: '%', 
                    data: stats.weekday.map(d => d.total ? (d.present / d.total * 100) : 0), 
                    backgroundColor: '#ffce56' 
                }] 
            },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { title: { display: true, text: 'Pagal dienas' } } }
        });
    }
}

// --- PDF GENERAVIMAS ---
function showPDFModal() { document.getElementById('pdf-modal').classList.remove('hidden'); }

// Šita funkcija valdo PDF modalą (atskira nuo pagrindinių filtrų)
function togglePdfInputs() {
    const type = document.getElementById('pdf-type').value;
    const yGroup = document.getElementById('pdf-year-group');
    const mGroup = document.getElementById('pdf-month-group');
    
    yGroup.classList.remove('hidden');
    mGroup.classList.remove('hidden');
    if (type === 'all') { yGroup.classList.add('hidden'); mGroup.classList.add('hidden'); }
    else if (type === 'year') { mGroup.classList.add('hidden'); }
}

function sanitizeText(str) {
    const map = {
        'ą':'a', 'č':'c', 'ę':'e', 'ė':'e', 'į':'i', 'š':'s', 'ų':'u', 'ū':'u', 'ž':'z',
        'Ą':'A', 'Č':'C', 'Ę':'E', 'Ė':'E', 'Į':'I', 'Š':'S', 'Ų':'U', 'Ū':'U', 'Ž':'Z'
    };
    return str.replace(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, match => map[match]);
}

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

    try {
        const fontBase64 = await loadFont(FONT_URL);
        doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.setFont("Roboto");
        fontLoaded = true;
    } catch (e) {
        console.warn("Šriftas nerastas, naudojamas atsarginis.");
    }

    const type = document.getElementById('pdf-type').value;
    const year = parseInt(document.getElementById('pdf-year').value);
    const month = parseInt(document.getElementById('pdf-month').value);
    const txt = (t) => fontLoaded ? t : sanitizeText(t);

    let pdfStats = {
        treniruote: { total: 0, present: 0, days: Array(7).fill(0).map(()=>({t:0, p:0})) },
        rungtynes: { total: 0, present: 0, days: Array(7).fill(0).map(()=>({t:0, p:0})) }
    };

    const rows = [];
    Object.keys(attendanceData).sort().forEach(date => {
        const d = new Date(date);
        let include = false;
        if (type === 'all') include = true;
        else if (type === 'year' && d.getFullYear() === year) include = true;
        else if (type === 'month' && d.getFullYear() === year && d.getMonth()+1 === month) include = true;

        if (include) {
            const rec = attendanceData[date];
            const dayIdx = (d.getDay() + 6) % 7;
            const tType = rec.type === 'treniruote' ? 'treniruote' : 'rungtynes';

            pdfStats[tType].total++;
            pdfStats[tType].days[dayIdx].t++;
            if(rec.present) {
                pdfStats[tType].present++;
                pdfStats[tType].days[dayIdx].p++;
            }

            rows.push([
                date, 
                txt(LT_DAYS[dayIdx]), 
                txt(rec.type === 'treniruote' ? 'Treniruotė' : 'Rungtynės'), 
                txt(rec.present ? "Taip" : "Ne")
            ]);
        }
    });

    let subtitle = "";
    if (type === 'all') subtitle = "Viso laiko statistika";
    else if (type === 'year') subtitle = `${year} metų statistika`;
    else subtitle = `${year} m. ${LT_MONTHS[month-1]} statistika`;

    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.text(txt("Lankomumo Ataskaita"), pageWidth/2, 15, { align: 'center' });
    doc.setFontSize(14); doc.text(txt(subtitle), pageWidth/2, 22, { align: 'center' });
    doc.setFontSize(11); doc.text(txt("Rokas Šipkauskas"), pageWidth/2, 29, { align: 'center' });

    let currentY = 35;
    
    // Suvestinė
    const drawSummaryTable = (title, dataKey) => {
        const s = pdfStats[dataKey];
        const missed = s.total - s.present;
        const pct = s.total ? ((s.present/s.total)*100).toFixed(1) : "0.0";
        
        doc.setFontSize(12);
        doc.text(title, 14, currentY); 
        currentY += 4; 

        doc.autoTable({
            startY: currentY,
            head: [[txt('Rodiklis'), txt('Duomenys')]],
            body: [
                [txt('Įvykių skaičius'), s.total],
                [txt('Dalyvauta'), s.present],
                [txt('Praleista'), missed],
                [txt('Lankomumo procentas'), pct + " %"]
            ],
            theme: 'grid',
            headStyles: { fillColor: [100, 255, 255], textColor: [0,0,0], halign: 'left' },
            bodyStyles: { font: fontLoaded ? "Roboto" : "helvetica" },
            margin: { left: 14, right: 14 },
            didDrawPage: (d) => { currentY = d.cursor.y + 10; }
        });
    };

    // Dienų statistika
    const drawWeekdayTable = (title, dataKey) => {
        const s = pdfStats[dataKey];
        const dayRows = s.days.map((d, i) => {
            const dpct = d.t ? ((d.p/d.t)*100).toFixed(0) : "0";
            return [txt(LT_DAYS[i]), d.p, d.t, dpct + " %"];
        });

        doc.setFontSize(12);
        doc.text(title, 14, currentY);
        currentY += 4;

        doc.autoTable({
            startY: currentY,
            head: [[txt('Diena'), txt('Dalyvauta'), txt('Iš viso'), txt('Procentas')]],
            body: dayRows,
            theme: 'grid',
            headStyles: { fillColor: [255, 200, 100], textColor: [0,0,0], halign: 'left' },
            bodyStyles: { font: fontLoaded ? "Roboto" : "helvetica" },
            margin: { left: 14, right: 14 },
            didDrawPage: (d) => { currentY = d.cursor.y + 10; }
        });
    };

    drawSummaryTable(txt("Treniruotės"), 'treniruote');
    drawSummaryTable(txt("Rungtynės"), 'rungtynes');
    drawWeekdayTable(txt("Lankomumas pagal savaitės dienas – Treniruotės"), 'treniruote');
    drawWeekdayTable(txt("Lankomumas pagal savaitės dienas – Rungtynės"), 'rungtynes');

    // Detali lentelė
    doc.setFontSize(14);
    doc.text(txt("Išsami istorija"), pageWidth/2, currentY, { align: 'center' });
    currentY += 6;

    if (rows.length === 0) {
        doc.setFontSize(10);
        doc.text(txt("Įrašų nerasta."), pageWidth/2, currentY, { align: 'center' });
    } else {
        doc.autoTable({
            startY: currentY,
            head: [[txt('Data'), txt('Diena'), txt('Tipas'), txt('Buvo')]],
            body: rows,
            theme: 'striped',
            styles: { font: fontLoaded ? "Roboto" : "helvetica", halign: 'center' },
            headStyles: { fillColor: [44, 62, 80], textColor: [255,255,255] },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 3) {
                    if (data.cell.raw === 'Ne' || data.cell.raw === 'ne' || data.cell.raw === txt('Ne')) {
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
