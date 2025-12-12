// --- KONFIGŪRACIJA ---
const ADMIN_USER = "treneris";
const ADMIN_PASS = "rokas123";
const LT_DAYS = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"];
const LT_MONTHS = ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis", "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"];

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
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    const yearInput = document.getElementById('pdf-year');
    if(yearInput) yearInput.value = currentYear;
    
    const monthInput = document.getElementById('pdf-month');
    if(monthInput) monthInput.value = currentMonth;
});

// --- DUOMENŲ ĮKĖLIMAS ---
async function loadData() {
    const localData = localStorage.getItem('attendanceData');
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        // Sujungiame duomenis (LocalStorage turi pirmenybę naujiems įrašams, jei jie sutampa)
        attendanceData = { ...jsonData, ...(localData ? JSON.parse(localData) : {}) };
    } catch (e) {
        console.error("Nepavyko užkrauti data.json arba failas tuščias", e);
        // Jei nėra failo, naudojame tik LocalStorage
        if (localData) {
            attendanceData = JSON.parse(localData);
        } else {
            // Jei nėra nei failo, nei localStorage, naudojame tuščią objektą
            attendanceData = {}; 
        }
    }
}

function saveToStorage() {
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    updateUI();
}

function downloadJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(attendanceData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// --- CRUD OPERACIJOS ---

// 1. Išsaugoti (Sukurti arba Atnaujinti)
function handleSave(date, type, status, originalDate) {
    // Jei redaguojame ir pakeitėme datą, ištriname seną įrašą
    if (originalDate && originalDate !== date) {
        delete attendanceData[originalDate];
    }
    
    attendanceData[date] = { type, present: status };
    saveToStorage();
    resetForm();
    alert('Įrašas išsaugotas! (Nepamirškite atsisiųsti JSON, jei norite atnaujinti visiems)');
}

// 2. Ištrinti
function deleteRecord(date) {
    if (confirm(`Ar tikrai norite ištrinti ${date} įrašą?`)) {
        delete attendanceData[date];
        saveToStorage();
    }
}

// 3. Redaguoti (Užpildyti formą)
function startEdit(date) {
    const rec = attendanceData[date];
    if (!rec) return;

    document.getElementById('date-input').value = date;
    document.getElementById('original-date').value = date;
    document.getElementById('type-input').value = rec.type;
    document.getElementById('status-input').value = rec.present;
    
    // UI Pakeitimai
    document.getElementById('form-title').innerText = "Redaguoti įrašą";
    document.getElementById('submit-btn').innerText = "Atnaujinti";
    document.getElementById('cancel-btn').classList.remove('hidden');
    
    // Scroll į viršų
    const adminPanel = document.getElementById('admin-panel');
    if(adminPanel) adminPanel.scrollIntoView({ behavior: 'smooth' });
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
        const originalDate = document.getElementById('original-date').value;
        const type = document.getElementById('type-input').value;
        const status = document.getElementById('status-input').value === 'true';
        
        if(date) handleSave(date, type, status, originalDate);
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
        const dateObj = new Date(date);
        // getDay(): 0 = Sekmadienis, 1 = Pirmadienis...
        // Mums reikia: 0 = Pirmadienis, ..., 6 = Sekmadienis
        const dayIdx = (dateObj.getDay() + 6) % 7; 

        // Statistika
        if (stats[rec.type]) {
            stats[rec.type].total++;
            if (rec.present) stats[rec.type].present++;
        }
        
        // Savaitės dienos statistika
        if (stats.weekday[dayIdx]) {
            stats.weekday[dayIdx].total++;
            if (rec.present) stats.weekday[dayIdx].present++;
        }

        // Lentelė
        const actionsHtml = isLoggedIn ? `
            <td>
                <button onclick="startEdit('${date}')" class="action-btn edit-btn">Redaguoti</button>
                <button onclick="deleteRecord('${date}')" class="action-btn delete-btn">Ištrinti</button>
            </td>
        ` : `<td class="admin-col hidden"></td>`;

        const row = `
            <tr>
                <td>${date}</td>
                <td>${LT_DAYS[dayIdx]}</td>
                <td>${rec.type === 'treniruote' ? 'Treniruotė' : 'Rungtynės'}</td>
                <td class="${rec.present ? 'status-true' : 'status-false'}">
                    ${rec.present ? 'Buvo' : 'Nebuvo'}
                </td>
                ${actionsHtml}
            </tr>
        `;
        if (tableBody) tableBody.innerHTML += row;
    });

    updateStatCard('train', stats.treniruote);
    updateStatCard('match', stats.rungtynes);
    renderCharts(stats);
    
    // Rodyti/Slėpti Admin stulpelį
    const adminCols = document.querySelectorAll('.admin-col');
    adminCols.forEach(col => isLoggedIn ? col.classList.remove('hidden') : col.classList.add('hidden'));
}

function updateStatCard(idPrefix, stat) {
    const elRate = document.getElementById(`${idPrefix}-stat`);
    const elDetail = document.getElementById(`${idPrefix}-detail`);
    
    if (elRate && elDetail) {
        const rate = stat.total ? ((stat.present / stat.total) * 100).toFixed(1) : 0;
        elRate.innerText = `${rate}%`;
        elDetail.innerText = `${stat.present} iš ${stat.total}`;
    }
}

// --- DIAGRAMOS ---
function renderCharts(stats) {
    const ctx1 = document.getElementById('attendanceChart');
    if (ctx1) {
        if (charts.pie) charts.pie.destroy();
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
            options: { plugins: { title: { display: true, text: 'Lankomumo % pagal tipą' } } }
        });
    }

    const ctx2 = document.getElementById('weekdayChart');
    if (ctx2) {
        if (charts.bar) charts.bar.destroy();
        const weekdayData = stats.weekday.map(d => d.total ? (d.present / d.total * 100) : 0);
        charts.bar = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: LT_DAYS.map(d => d.substring(0, 3)),
                datasets: [{ label: 'Lankomumas %', data: weekdayData, backgroundColor: '#ffce56' }]
            },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { title: { display: true, text: 'Lankomumas pagal dienas' } } }
        });
    }
}

// --- PDF GENERAVIMAS ---
function showPDFModal() { 
    const modal = document.getElementById('pdf-modal');
    if(modal) modal.classList.remove('hidden'); 
}

function togglePdfInputs() {
    const type = document.getElementById('pdf-type').value;
    const yearGroup = document.getElementById('pdf-year-group');
    const monthGroup = document.getElementById('pdf-month-group');
    
    if (type === 'all') {
        if(yearGroup) yearGroup.classList.add('hidden');
        if(monthGroup) monthGroup.classList.add('hidden');
    } else if (type === 'year') {
        if(yearGroup) yearGroup.classList.remove('hidden');
        if(monthGroup) monthGroup.classList.add('hidden');
    } else {
        if(yearGroup) yearGroup.classList.remove('hidden');
        if(monthGroup) monthGroup.classList.remove('hidden');
    }
}

function generatePDF() {
    if (!window.jspdf) {
        alert("Nepavyko užkrauti PDF bibliotekos. Patikrinkite interneto ryšį.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const type = document.getElementById('pdf-type').value;
    const year = parseInt(document.getElementById('pdf-year').value);
    const month = parseInt(document.getElementById('pdf-month').value);
    
    let titleText = "Lankomumo Ataskaita";
    let subtitle = "";
    let showNote = false;

    // Filtravimo logika
    const filteredData = [];
    const dates = Object.keys(attendanceData).sort();

    // Patikrinimas dėl pastabos rodymo
    if (type === 'all') {
        showNote = true;
        subtitle = "Viso laiko statistika";
    } else if (type === 'year') {
        subtitle = `${year} metų statistika`;
        if (year === 2025) showNote = true;
    } else {
        subtitle = `${year} m. ${LT_MONTHS[month-1]} statistika`;
        if (year === 2025 && month === 10) showNote = true;
    }

    dates.forEach(date => {
        const d = new Date(date);
        let include = false;

        if (type === 'all') include = true;
        else if (type === 'year' && d.getFullYear() === year) include = true;
        else if (type === 'month' && d.getFullYear() === year && (d.getMonth() + 1) === month) include = true;

        if (include) {
            const rec = attendanceData[date];
            const dayIdx = (d.getDay() + 6) % 7;
            const day = LT_DAYS[dayIdx];
            filteredData.push([date, day, rec.type === 'treniruote' ? 'Treniruotė' : 'Rungtynės', rec.present ? "Taip" : "Ne"]);
        }
    });

    // PDF Turinys
    doc.setFontSize(18);
    doc.text(titleText, 105, 15, null, null, "center");
    
    doc.setFontSize(14);
    doc.text(subtitle, 105, 22, null, null, "center");
    
    doc.setFontSize(11);
    doc.text("Rokas Šipkauskas", 105, 29, null, null, "center");

    let startY = 35;

    // Pridėti specialią pastabą
    if (showNote) {
        doc.setFontSize(10);
        doc.setTextColor(200, 0, 0); // Raudona
        doc.text("* Duomenys pradėti skaičiuoti nuo 2025-10-06", 105, startY, null, null, "center");
        doc.setTextColor(0, 0, 0); // Juoda
        startY += 10;
    } else {
        startY += 5;
    }

    if (filteredData.length === 0) {
        doc.text("Pasirinktu laikotarpiu įrašų nerasta.", 105, startY + 10, null, null, "center");
    } else {
        doc.autoTable({
            head: [['Data', 'Diena', 'Tipas', 'Buvo']],
            body: filteredData,
            startY: startY,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 3) {
                    if (data.cell.raw === 'Ne') {
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
function showLoginModal() { 
    const modal = document.getElementById('login-modal');
    if(modal) modal.classList.remove('hidden'); 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('hidden'); 
}

function attemptLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    if (u === ADMIN_USER && p === ADMIN_PASS) {
        localStorage.setItem('isLoggedIn', 'true');
        checkSession();
        closeModal('login-modal');
    } else {
        document.getElementById('login-error').innerText = "Neteisingi duomenys";
    }
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    checkSession();
}

function checkSession() {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loggedIn) {
        if(adminPanel) adminPanel.classList.remove('hidden');
        if(loginBtn) loginBtn.classList.add('hidden');
        if(logoutBtn) logoutBtn.classList.remove('hidden');
        updateUI(); 
    } else {
        if(adminPanel) adminPanel.classList.add('hidden');
        if(loginBtn) loginBtn.classList.remove('hidden');
        if(logoutBtn) logoutBtn.classList.add('hidden');
        updateUI();
    }
}
