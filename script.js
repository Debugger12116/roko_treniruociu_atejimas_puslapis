// --- KONFIGŪRACIJA ---
const ADMIN_USER = "treneris"; // Pakeisk į norimą vartotojo vardą
const ADMIN_PASS = "rokas123"; // Pakeisk į norimą slaptažodį
const LT_DAYS = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"];
let attendanceData = {};
let charts = {};

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    updateUI();
    setupForm();
    checkSession();
});

// --- DUOMENŲ ĮKĖLIMAS ---
async function loadData() {
    // 1. Bandome imti iš LocalStorage (nauji įrašai)
    const localData = localStorage.getItem('attendanceData');
    
    // 2. Bandome imti iš failo (GitHub)
    try {
        const response = await fetch('data.json');
        const jsonData = await response.json();
        
        // Sujungiame duomenis (LocalStorage turi pirmenybę naujiems įrašams)
        attendanceData = { ...jsonData, ...(localData ? JSON.parse(localData) : {}) };
    } catch (e) {
        console.error("Nepavyko užkrauti data.json", e);
        // Jei nėra failo, naudojame tik LocalStorage
        if (localData) attendanceData = JSON.parse(localData);
    }
}

function saveData(date, type, status) {
    attendanceData[date] = { type, present: status };
    // Saugome į naršyklės atmintį
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
    updateUI();
    alert('Įrašas pridėtas! (Pastaba: išsaugota tik jūsų naršyklėje)');
}

// --- UI ATNAUJINIMAS ---
function updateUI() {
    const dates = Object.keys(attendanceData).sort();
    const tableBody = document.querySelector('#attendance-table tbody');
    tableBody.innerHTML = '';

    let stats = {
        treniruote: { total: 0, present: 0 },
        rungtynes: { total: 0, present: 0 },
        weekday: Array(7).fill(0).map(() => ({ total: 0, present: 0 }))
    };

    dates.forEach(date => {
        const rec = attendanceData[date];
        const dateObj = new Date(date);
        const dayIdx = (dateObj.getDay() + 6) % 7; // 0 = Pirmadienis

        // Statistika
        if (stats[rec.type]) {
            stats[rec.type].total++;
            if (rec.present) stats[rec.type].present++;
        }
        
        // Savaitės dienų statistika
        stats.weekday[dayIdx].total++;
        if (rec.present) stats.weekday[dayIdx].present++;

        // Lentelė
        const row = `
            <tr>
                <td>${date}</td>
                <td>${LT_DAYS[dayIdx]}</td>
                <td>${rec.type === 'treniruote' ? 'Treniruotė' : 'Rungtynės'}</td>
                <td class="${rec.present ? 'status-true' : 'status-false'}">
                    ${rec.present ? 'Buvo' : 'Nebuvo'}
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });

    // Kortelių atnaujinimas
    updateStatCard('train', stats.treniruote);
    updateStatCard('match', stats.rungtynes);

    // Diagramų atnaujinimas
    renderCharts(stats);
}

function updateStatCard(idPrefix, stat) {
    const rate = stat.total ? ((stat.present / stat.total) * 100).toFixed(1) : 0;
    document.getElementById(`${idPrefix}-stat`).innerText = `${rate}%`;
    document.getElementById(`${idPrefix}-detail`).innerText = `${stat.present} iš ${stat.total}`;
}

// --- DIAGRAMOS (Chart.js) ---
function renderCharts(stats) {
    // 1. Lankomumo tipai (Pie Chart)
    const ctx1 = document.getElementById('attendanceChart').getContext('2d');
    if (charts.pie) charts.pie.destroy();
    
    charts.pie = new Chart(ctx1, {
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
        options: {
            plugins: { title: { display: true, text: 'Lankomumo % pagal tipą' } }
        }
    });

    // 2. Pagal savaitės dienas (Bar Chart)
    const ctx2 = document.getElementById('weekdayChart').getContext('2d');
    if (charts.bar) charts.bar.destroy();

    const weekdayData = stats.weekday.map(d => d.total ? (d.present / d.total * 100) : 0);
    
    charts.bar = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: LT_DAYS.map(d => d.substring(0, 3)), // Sutrumpinimai
            datasets: [{
                label: 'Lankomumas %',
                data: weekdayData,
                backgroundColor: '#ffce56'
            }]
        },
        options: {
            scales: { y: { beginAtZero: true, max: 100 } },
            plugins: { title: { display: true, text: 'Lankomumas pagal dienas' } }
        }
    });
}

// --- FORMA IR DATA ---
function setupForm() {
    document.getElementById('add-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('date-input').value;
        const type = document.getElementById('type-input').value;
        const status = document.getElementById('status-input').value === 'true';
        
        if(date) saveData(date, type, status);
    });
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

// --- PDF GENERAVIMAS (jsPDF) ---
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Antraštė
    doc.setFontSize(18);
    doc.text("Lankomumo Ataskaita", 105, 15, null, null, "center");
    doc.setFontSize(12);
    doc.text("Rokas Šipkauskas", 105, 22, null, null, "center");
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 105, 28, null, null, "center");

    // Statistika
    let yPos = 40;
    const tStat = document.getElementById('train-stat').innerText;
    const mStat = document.getElementById('match-stat').innerText;
    doc.text(`Treniruotės: ${tStat}`, 20, yPos);
    doc.text(`Rungtynės: ${mStat}`, 120, yPos);

    // Lentelė
    const rows = [];
    const dates = Object.keys(attendanceData).sort();
    dates.forEach(date => {
        const rec = attendanceData[date];
        const dateObj = new Date(date);
        const day = LT_DAYS[(dateObj.getDay() + 6) % 7];
        rows.push([date, day, rec.type, rec.present ? "Taip" : "Ne"]);
    });

    doc.autoTable({
        head: [['Data', 'Diena', 'Tipas', 'Buvo']],
        body: rows,
        startY: yPos + 10,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] },
    });

    doc.save("lankomumas.pdf");
}

// --- AUTENTIFIKACIJA ---
function showLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeLoginModal() { document.getElementById('login-modal').classList.add('hidden'); }

function attemptLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    if (u === ADMIN_USER && p === ADMIN_PASS) {
        localStorage.setItem('isLoggedIn', 'true');
        checkSession();
        closeLoginModal();
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
        adminPanel.classList.remove('hidden');
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
    } else {
        adminPanel.classList.add('hidden');
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
    }
}
