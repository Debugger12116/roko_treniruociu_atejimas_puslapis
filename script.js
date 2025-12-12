// --- 1. IMPORTUOJAME FIREBASE BIBLIOTEKAS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 2. FIREBASE KONFIGŪRACIJA ---
const firebaseConfig = {
  apiKey: "AIzaSyBbIEIp6WEdItFvRccLQU-1lSMlxc76Ef8",
  authDomain: "roko-sipkausko-tren-lankymas.firebaseapp.com",
  projectId: "roko-sipkausko-tren-lankymas",
  storageBucket: "roko-sipkausko-tren-lankymas.firebasestorage.app",
  messagingSenderId: "631642381240",
  appId: "1:631642381240:web:c22aab27fe2c1681ba8d4d",
  measurementId: "G-6BQFEEP9X8"
};

// --- 3. INICIJUOJAME SISTEMAS ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const DB_COLLECTION = "lankomumas";

// --- 4. KONFIGŪRACIJA ---
const LT_DAYS = ["Pirmadienis", "Antradienis", "Trečiadienis", "Ketvirtadienis", "Penktadienis", "Šeštadienis", "Sekmadienis"];
const LT_MONTHS = ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis", "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"];
const FONT_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf";

let attendanceData = {};
let charts = {};
let currentUser = null;

// --- 5. GLOBALIOS FUNKCIJOS ---
window.toggleMainFilters = toggleMainFilters;
window.updateUI = updateUI;
window.startEdit = startEdit;
window.deleteRecord = deleteRecord;
window.downloadJSON = downloadJSON;
window.showPDFModal = showPDFModal;
window.togglePdfInputs = togglePdfInputs;
window.generatePDF = generatePDF;
window.showLoginModal = showLoginModal;
window.closeModal = closeModal;
window.attemptLogin = attemptLogin;
window.logout = logout;
window.resetForm = resetForm;

// --- INIT (ČIA ATLIKTAS PAKEITIMAS) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Nustatome datą į praėjusį mėnesį
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() - 1); // Atimame 1 mėnesį (automatiškai tvarko metus)

    // 2. Priverstinai nustatome filtrą į "month" (Mėnesinė)
    const filterTypeElement = document.getElementById('filter-type');
    if (filterTypeElement) {
        filterTypeElement.value = 'month';
    }

    // 3. Užpildome laukus su apskaičiuota data
    setupDateInputs('filter-year', 'filter-month', targetDate);
    setupDateInputs('pdf-year', 'pdf-month', targetDate);
    
    // 4. Pritaikome UI (kad atsirastų mėnesio pasirinkimas)
    toggleMainFilters();

    // Klausomės, ar vartotojas prisijungęs
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        checkSession();
        updateUI();
    });

    await loadData();
    updateUI();
    setupForm();
});

// ... Toliau visos funkcijos lieka tokios pačios ...

function setupDateInputs(yearId, monthId, dateObj) {
    const yInp = document.getElementById(yearId);
    const mInp = document.getElementById(monthId);
    if(yInp) yInp.value = dateObj.getFullYear();
    if(mInp) mInp.value = dateObj.getMonth() + 1; // +1 nes getMonth() grąžina 0-11
}

function toggleMainFilters() {
    const type = document.getElementById('filter-type').value;
    const yGroup = document.getElementById('filter-year-group');
    const mGroup = document.getElementById('filter-month-group');
    if (yGroup) yGroup.classList.add('hidden');
    if (mGroup) mGroup.classList.add('hidden');
    if (type === 'year') {
        if (yGroup) yGroup.classList.remove('hidden');
    } else if (type === 'month') {
        if (yGroup) yGroup.classList.remove('hidden'); 
        if (mGroup) mGroup.classList.remove('hidden'); 
    }
}

// --- DUOMENŲ UŽKROVIMAS ---
async function loadData() {
    attendanceData = {};
    try {
        const querySnapshot = await getDocs(collection(db, DB_COLLECTION));
        querySnapshot.forEach((doc) => {
            attendanceData[doc.id] = doc.data();
        });
        console.log("Duomenys atsiųsti.");
    } catch (e) {
        console.error("Klaida:", e);
    }
}

// --- FIREBASE RAŠYMAS ---
async function saveDataToFirebase(date, data) {
    if (!currentUser) return alert("Neturite teisių! Prisijunkite.");
    try {
        await setDoc(doc(db, DB_COLLECTION, date), data);
        attendanceData[date] = data;
        updateUI();
    } catch (e) {
        console.error("Klaida saugant:", e);
        alert("Nepavyko išsaugoti. Ar esate prisijungęs?");
    }
}

async function deleteFromFirebase(date) {
    if (!currentUser) return alert("Neturite teisių! Prisijunkite.");
    try {
        await deleteDoc(doc(db, DB_COLLECTION, date));
        delete attendanceData[date];
        updateUI();
    } catch (e) {
        console.error("Klaida trinant:", e);
        alert("Nepavyko ištrinti.");
    }
}

function downloadJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(attendanceData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "backup_data.json");
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
}

// --- CRUD ---
async function handleSave(date, type, status, originalDate) {
    if (originalDate && originalDate !== date) {
        await deleteFromFirebase(originalDate);
    }
    await saveDataToFirebase(date, { type, present: status });
    resetForm();
    alert('Įrašas išsaugotas!');
}

async function deleteRecord(date) {
    if (confirm(`Ištrinti ${date}?`)) {
        await deleteFromFirebase(date);
    }
}

function startEdit(date) {
    if (!currentUser) return;
    const rec = attendanceData[date];
    if (!rec) return;
    document.getElementById('date-input').value = date;
    document.getElementById('original-date').value = date;
    document.getElementById('type-input').value = rec.type;
    document.getElementById('status-input').value = String(rec.present);
    
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
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('date-input').value;
        const oDate = document.getElementById('original-date').value;
        const type = document.getElementById('type-input').value;
        const status = document.getElementById('status-input').value === 'true';
        if(date) await handleSave(date, type, status, oDate);
    });
}

// --- UI ATNAUJINIMAS ---
function updateUI() {
    const dates = Object.keys(attendanceData).sort().reverse();
    const tableBody = document.querySelector('#attendance-table tbody');
    const isLoggedIn = !!currentUser; 
    
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
        let include = false;
        if (filterType === 'all') include = true;
        else if (filterType === 'year' && d.getFullYear() === filterYear) include = true;
        else if (filterType === 'month' && d.getFullYear() === filterYear && d.getMonth()+1 === filterMonth) include = true;

        if (include) {
            visibleCount++;
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
        }
    });

    if (visibleCount === 0 && tableBody) tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">Pagal pasirinktus filtrus duomenų nerasta.</td></tr>`;

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
    if (charts.pie) charts.pie.destroy();
    if (charts.bar) charts.bar.destroy();
    if (ctx1) {
        charts.pie = new Chart(ctx1.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Treniruotės', 'Rungtynės'], datasets: [{ data: [(stats.treniruote.present / (stats.treniruote.total || 1)) * 100, (stats.rungtynes.present / (stats.rungtynes.total || 1)) * 100], backgroundColor: ['#36a2eb', '#ff6384'] }] },
            options: { plugins: { title: { display: true, text: 'Lankomumo % (Pasirinktas laikas)' } } }
        });
    }
    if (ctx2) {
        charts.bar = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: { labels: LT_DAYS.map(d => d.substring(0,3)), datasets: [{ label: '%', data: stats.weekday.map(d => d.total ? (d.present / d.total * 100) : 0), backgroundColor: '#ffce56' }] },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { title: { display: true, text: 'Pagal dienas' } } }
        });
    }
}

function showPDFModal() { document.getElementById('pdf-modal').classList.remove('hidden'); }

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
    const map = { 'ą':'a', 'č':'c', 'ę':'e', 'ė':'e', 'į':'i', 'š':'s', 'ų':'u', 'ū':'u', 'ž':'z', 'Ą':'A', 'Č':'C', 'Ę':'E', 'Ė':'E', 'Į':'I', 'Š':'S', 'Ų':'U', 'Ū':'U', 'Ž':'Z' };
    return str.replace(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, match => map[match]);
}

async function loadFont(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Šriftas nepasiekiamas");
    const blob = await resp.blob();
    return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
}

async function generatePDF() {
    if (!window.jspdf) return alert("Klaida: biblioteka neužsikrovė.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let fontLoaded = false;
    try { const fontBase64 = await loadFont(FONT_URL); doc.addFileToVFS("Roboto-Regular.ttf", fontBase64); doc.addFont("Roboto-Regular.ttf", "Roboto", "normal"); doc.setFont("Roboto"); fontLoaded = true; } catch (e) { console.warn("Šriftas nerastas."); }
    const type = document.getElementById('pdf-type').value;
    const year = parseInt(document.getElementById('pdf-year').value);
    const month = parseInt(document.getElementById('pdf-month').value);
    const txt = (t) => fontLoaded ? t : sanitizeText(t);
    let pdfStats = { treniruote: { total: 0, present: 0, days: Array(7).fill(0).map(()=>({t:0, p:0})) }, rungtynes: { total: 0, present: 0, days: Array(7).fill(0).map(()=>({t:0, p:0})) } };
    const rows = [];
    Object.keys(attendanceData).sort().forEach(date => {
        const d = new Date(date);
        let include = false;
        if (type === 'all') include = true; else if (type === 'year' && d.getFullYear() === year) include = true; else if (type === 'month' && d.getFullYear() === year && d.getMonth()+1 === month) include = true;
        if (include) {
            const rec = attendanceData[date];
            const dayIdx = (d.getDay() + 6) % 7;
            const tType = rec.type === 'treniruote' ? 'treniruote' : 'rungtynes';
            pdfStats[tType].total++; pdfStats[tType].days[dayIdx].t++;
            if(rec.present) { pdfStats[tType].present++; pdfStats[tType].days[dayIdx].p++; }
            rows.push([date, txt(LT_DAYS[dayIdx]), txt(rec.type === 'treniruote' ? 'Treniruotė' : 'Rungtynės'), txt(rec.present ? "Taip" : "Ne")]);
        }
    });
    let subtitle = "";
    if (type === 'all') subtitle = "Viso laiko statistika"; else if (type === 'year') subtitle = `${year} metų statistika`; else subtitle = `${year} m. ${LT_MONTHS[month-1]} statistika`;
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.text(txt("Roko Šipkausko atėjimas į treniruotes"), pageWidth/2, 15, { align: 'center' });
    doc.setFontSize(14); doc.text(txt(subtitle), pageWidth/2, 22, { align: 'center' });
    let currentY = 35;
    const drawSummaryTable = (title, dataKey) => {
        const s = pdfStats[dataKey]; const missed = s.total - s.present; const pct = s.total ? ((s.present/s.total)*100).toFixed(1) : "0.0";
        doc.setFontSize(12); doc.text(title, 14, currentY); currentY += 4;
        doc.autoTable({ startY: currentY, head: [[txt('Rodiklis'), txt('Duomenys')]], body: [[txt('Įvykių skaičius'), s.total], [txt('Dalyvauta'), s.present], [txt('Praleista'), missed], [txt('Lankomumo procentas'), pct + " %"]], theme: 'grid', headStyles: { fillColor: [100, 255, 255], textColor: [0,0,0] }, bodyStyles: { font: fontLoaded ? "Roboto" : "helvetica" }, didDrawPage: (d) => { currentY = d.cursor.y + 10; } });
    };
    const drawWeekdayTable = (title, dataKey) => {
        const s = pdfStats[dataKey]; const dayRows = s.days.map((d, i) => { const dpct = d.t ? ((d.p/d.t)*100).toFixed(0) : "0"; return [txt(LT_DAYS[i]), d.p, d.t, dpct + " %"]; });
        doc.setFontSize(12); doc.text(title, 14, currentY); currentY += 4;
        doc.autoTable({ startY: currentY, head: [[txt('Diena'), txt('Dalyvauta'), txt('Iš viso'), txt('Procentas')]], body: dayRows, theme: 'grid', headStyles: { fillColor: [255, 200, 100], textColor: [0,0,0] }, bodyStyles: { font: fontLoaded ? "Roboto" : "helvetica" }, didDrawPage: (d) => { currentY = d.cursor.y + 10; } });
    };
    drawSummaryTable(txt("Treniruotės"), 'treniruote'); drawSummaryTable(txt("Rungtynės"), 'rungtynes'); drawWeekdayTable(txt("Lankomumas pagal savaitės dienas – Treniruotės"), 'treniruote'); drawWeekdayTable(txt("Lankomumas pagal savaitės dienas – Rungtynės"), 'rungtynes');
    doc.setFontSize(14); doc.text(txt("Išsami istorija"), pageWidth/2, currentY, { align: 'center' }); currentY += 6;
    if (rows.length === 0) { doc.setFontSize(10); doc.text(txt("Įrašų nerasta."), pageWidth/2, currentY, { align: 'center' }); } else {
        doc.autoTable({ startY: currentY, head: [[txt('Data'), txt('Diena'), txt('Tipas'), txt('Buvo')]], body: rows, theme: 'striped', styles: { font: fontLoaded ? "Roboto" : "helvetica", halign: 'center' }, headStyles: { fillColor: [44, 62, 80], textColor: [255,255,255] }, didParseCell: function(data) { if (data.section === 'body' && data.column.index === 3) { if (data.cell.raw === 'Ne' || data.cell.raw === 'ne' || data.cell.raw === txt('Ne')) { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; } else { data.cell.styles.textColor = [0, 100, 0]; } } } });
    }
    doc.save(`lankomumas_${type}.pdf`); closeModal('pdf-modal');
}

// --- 6. AUTENTIFIKACIJA ---
function showLoginModal() { document.getElementById('login-modal').classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

async function attemptLogin() {
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        closeModal('login-modal');
    } catch (error) {
        console.error(error);
        document.getElementById('login-error').innerText = "Klaida: " + error.message;
    }
}

async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error(error);
    }
}

function checkSession() {
    const isLoggedIn = !!currentUser;
    if(document.getElementById('admin-panel')) {
        document.getElementById('admin-panel').classList.toggle('hidden', !isLoggedIn);
        document.getElementById('login-btn').classList.toggle('hidden', isLoggedIn);
        document.getElementById('logout-btn').classList.toggle('hidden', !isLoggedIn);
    }
}
