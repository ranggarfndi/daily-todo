import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, push, remove, update, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// ==========================================
// 1. KONFIGURASI FIREBASE (Ganti dengan milikmu)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCwCqo73f9R6Bxl23EbiXIBhGlXx1r4RhE", 
    authDomain: "my-daily-todo-40565.firebaseapp.com",
    projectId: "my-daily-todo-40565",
    databaseURL: "https://my-daily-todo-40565-default-rtdb.asia-southeast1.firebasedatabase.app", 
    storageBucket: "my-daily-todo-40565.firebasestorage.app",
    messagingSenderId: "140272983252",
    appId: "1:140272983252:web:d1b42ed05e23a70341ef41"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State Global
let currentUser = 'rangga';
let selectedDateKey = "";
let currentMonthKey = "";

// Pengecekan Halaman (Deteksi elemen untuk mengetahui kita di halaman mana)
const isDailyPage = document.getElementById('calendar-input') !== null;
const isHistoryPage = document.getElementById('history-month-input') !== null;
const isRankingPage = document.getElementById('rank-month-input') !== null;


// ==========================================
// 2. LOGIKA HALAMAN DAILY TASK
// ==========================================
if (isDailyPage) {
    const calInput = document.getElementById('calendar-input');
    const taskListEl = document.getElementById('task-list');
    
    const now = new Date();
    calInput.valueAsDate = now;

    function updateDateKeys() {
        const d = new Date(calInput.value);
        selectedDateKey = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
        currentMonthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
        document.getElementById('current-month').innerText = d.toLocaleDateString('id-ID', {month: 'long'}).toUpperCase();
        loadData();
        loadRanking();
    }

    calInput.addEventListener('change', updateDateKeys);

    function loadRanking() {
        const rankRef = ref(db, `monthly_stats/${currentMonthKey}`);
        onValue(rankRef, (snapshot) => {
            const data = snapshot.val() || { rangga: 0, malika: 0 };
            document.getElementById('score-rangga').innerText = data.rangga;
            document.getElementById('score-malika').innerText = data.malika;
            
            const total = data.rangga + data.malika || 1;
            document.getElementById('bar-rangga').style.width = ((data.rangga / total) * 100) + "%";
            document.getElementById('bar-malika').style.width = ((data.malika / total) * 100) + "%";
        });
    }

    function loadData() {
        const tasksRef = ref(db, `tasks/${selectedDateKey}/${currentUser}`);
        onValue(tasksRef, (snapshot) => {
            taskListEl.innerHTML = "";
            const data = snapshot.val();
            if (!data) return;

            const sortedItems = Object.entries(data).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));

            sortedItems.forEach(([id, task]) => {
                const li = document.createElement('li');
                li.dataset.id = id;
                if(task.completed) li.classList.add('completed');
                li.innerHTML = `
                    <span class="handle">⠿</span>
                    <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="window.toggleTask('${id}', ${task.completed})">
                    <span class="task-text">${task.text}</span>
                    <button class="btn-action" onclick="window.showEditModal('${id}', '${task.text.replace(/'/g, "\\'")}')">✎</button>
                    <button class="btn-action" onclick="window.showDeleteModal('${id}')">✖</button>
                `;
                taskListEl.appendChild(li);
            });
        });
    }

    if (typeof Sortable !== 'undefined') {
        new Sortable(taskListEl, {
            handle: '.handle',
            animation: 150,
            onEnd: function() {
                const items = taskListEl.querySelectorAll('li');
                items.forEach((item, index) => {
                    update(ref(db, `tasks/${selectedDateKey}/${currentUser}/${item.dataset.id}`), { order: index });
                });
            }
        });
    }

    window.switchUser = (user) => {
        currentUser = user;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-'+user).classList.add('active');
        loadData();
    };

    window.showAddModal = () => {
        const txt = document.getElementById('task-input').value;
        if(!txt) return;
        window.openModal("Tambah Task?", `Tambahkan "${txt}" ke list hari ini?`, () => {
            push(ref(db, `tasks/${selectedDateKey}/${currentUser}`), {
                text: txt, completed: false, order: taskListEl.children.length
            });
            document.getElementById('task-input').value = "";
        });
    };

    window.showEditModal = (id, oldTxt) => {
        window.openModal("Edit Task", "", () => {
            const newTxt = document.getElementById('modal-input-field').value;
            update(ref(db, `tasks/${selectedDateKey}/${currentUser}/${id}`), { text: newTxt });
        }, true, oldTxt);
    };

    window.showDeleteModal = (id) => {
        window.openModal("Hapus Task?", "Tindakan ini tidak bisa dibatalkan.", async () => {
            const taskRef = ref(db, `tasks/${selectedDateKey}/${currentUser}/${id}`);
            const snapshot = await get(taskRef);
            const taskData = snapshot.val();

            if (taskData) {
                if (taskData.completed) {
                    const rankRef = ref(db, `monthly_stats/${currentMonthKey}/${currentUser}`);
                    const rankSnapshot = await get(rankRef);
                    let currentScore = rankSnapshot.val() || 0;
                    await set(rankRef, Math.max(0, currentScore - 1));
                }
                await remove(taskRef);
            }
        });
    };

    window.toggleTask = async (id, currentStatus) => {
        const nextStatus = !currentStatus;
        update(ref(db, `tasks/${selectedDateKey}/${currentUser}/${id}`), { completed: nextStatus });
        
        const rankRef = ref(db, `monthly_stats/${currentMonthKey}/${currentUser}`);
        const snapshot = await get(rankRef);
        let score = snapshot.val() || 0;
        set(rankRef, nextStatus ? score + 1 : Math.max(0, score - 1));
    };

    updateDateKeys();
}


// ==========================================
// 3. LOGIKA HALAMAN HISTORY
// ==========================================
if (isHistoryPage) {
    const histMonthInput = document.getElementById('history-month-input');
    const histDateInput = document.getElementById('history-date-filter');
    
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    histMonthInput.value = ym;

    window.loadHistoryData = async () => {
        const monthVal = histMonthInput.value; 
        const dateFilterVal = histDateInput ? histDateInput.value : ""; 
        
        if (!monthVal) return;
        
        const [year, monthStr] = monthVal.split('-');
        const monthNum = parseInt(monthStr, 10);
        const suffixToMatch = `-${monthNum}-${year}`;
    
        let specificDateKey = "";
        if (dateFilterVal) {
            const d = new Date(dateFilterVal);
            specificDateKey = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
        }
    
        const tasksRef = ref(db, 'tasks');
        const snapshot = await get(tasksRef);
        const allData = snapshot.val();
    
        let totalRangga = 0;
        let totalMalika = 0;
        let historyListHtml = '';
    
        if (allData) {
            let datesToProcess = [];
    
            if (specificDateKey) {
                if (allData[specificDateKey]) datesToProcess = [specificDateKey];
            } else {
                datesToProcess = Object.keys(allData)
                    .filter(key => key.endsWith(suffixToMatch))
                    .sort((a,b) => {
                        const [dateA] = a.split('-');
                        const [dateB] = b.split('-');
                        return parseInt(dateB) - parseInt(dateA);
                    });
            }
    
            datesToProcess.forEach(dateKey => {
                const dateData = allData[dateKey];
                let hasTasks = false;
                let dateHtml = `
                <div class="history-date-group">
                    <h4>📅 Tanggal: ${dateKey.replace(/-/g, '/')}</h4>
                    <div class="history-columns">
                `;
    
                ['rangga', 'malika'].forEach(user => {
                    dateHtml += `<div class="user-column"><h5>${user === 'rangga' ? '🧑🏻 Rangga' : '👩🏻 Malika'}</h5><ul>`;
                    if (dateData[user] && Object.keys(dateData[user]).length > 0) {
                        hasTasks = true;
                        Object.values(dateData[user]).forEach(task => {
                            if (task.completed) {
                                if (user === 'rangga') totalRangga++;
                                if (user === 'malika') totalMalika++;
                            }
                            dateHtml += `<li class="${task.completed ? 'completed' : ''}"><span class="task-text">${task.text}</span><span class="status-icon">${task.completed ? '✅' : '❌'}</span></li>`;
                        });
                    } else {
                        dateHtml += `<li class="empty-task">- Kosong -</li>`;
                    }
                    dateHtml += `</ul></div>`;
                });
    
                dateHtml += `</div></div>`;
                if (hasTasks) historyListHtml += dateHtml;
            });
        }
    
        document.getElementById('hist-total-rangga').innerText = totalRangga;
        document.getElementById('hist-total-malika').innerText = totalMalika;
        
        if (!historyListHtml) {
            historyListHtml = `<div class="empty-state">Data tidak ditemukan untuk filter ini.</div>`;
        }
        document.getElementById('history-list-container').innerHTML = historyListHtml;
    };

    window.resetFilters = () => {
        histMonthInput.value = ym;
        if(histDateInput) histDateInput.value = "";
        window.loadHistoryData();
    };

    window.loadHistoryData();
}

// ==========================================
// 4. LOGIKA HALAMAN RANKING (BARU)
// ==========================================
if (isRankingPage) {
    const rankMonthInput = document.getElementById('rank-month-input');
    
    // Default ke bulan ini
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    rankMonthInput.value = ym;

    window.loadRankingPageData = () => {
        const monthVal = rankMonthInput.value;
        const [year, monthStr] = monthVal.split('-');
        const monthKey = `${year}-${parseInt(monthStr, 10)}`;
        
        // Update Label
        const monthName = new Date(monthVal).toLocaleDateString('id-ID', {month: 'long'}).toUpperCase();
        document.getElementById('rank-title-label').innerText = `PERINGKAT ${monthName} ${year}`;

        // 1. Ambil Skor Live (Bulan Terpilih)
        const rankRef = ref(db, `monthly_stats/${monthKey}`);
        onValue(rankRef, (snapshot) => {
            const data = snapshot.val() || { rangga: 0, malika: 0 };
            const r = data.rangga || 0;
            const m = data.malika || 0;

            document.getElementById('live-score-rangga').innerText = r;
            document.getElementById('live-score-malika').innerText = m;

            // Update Progress Bar
            const total = r + m || 1;
            document.getElementById('bar-rangga').style.width = ((r/total)*100) + "%";
            document.getElementById('bar-malika').style.width = ((m/total)*100) + "%";

            // Update Winner Badge Visibility & Grayscale
            document.getElementById('badge-rangga').style.opacity = (r > m) ? "1" : "0";
            document.getElementById('badge-malika').style.opacity = (m > r) ? "1" : "0";
            document.getElementById('podium-rangga').style.filter = (m > r) ? "grayscale(1)" : "none";
            document.getElementById('podium-malika').style.filter = (r > m) ? "grayscale(1)" : "none";
        });

        // 2. Ambil Pemenang Bulan Sebelumnya
        loadLastMonthWinner(year, monthStr);
    };

    async function loadLastMonthWinner(year, month) {
        let prevMonth = parseInt(month, 10) - 1;
        let prevYear = parseInt(year, 10);
        if (prevMonth === 0) { prevMonth = 12; prevYear--; }
        
        const prevKey = `${prevYear}-${prevMonth}`;
        const prevRef = ref(db, `monthly_stats/${prevKey}`);
        const snap = await get(prevRef);
        const data = snap.val();
        const container = document.getElementById('last-month-winner-card');

        if (data && (data.rangga || data.malika)) {
            const r = data.rangga || 0;
            const m = data.malika || 0;
            const winner = (r > m) ? {name: 'Rangga', emoji: '🧑🏻', score: r, class: 'rangga-win'} 
                         : (m > r) ? {name: 'Malika', emoji: '👩🏻', score: m, class: 'malika-win'}
                         : {name: 'Seri!', emoji: '🤝', score: r, class: 'draw'};

            container.innerHTML = `
                <div class="winner-announcement ${winner.class}">
                    <span class="win-emoji">${winner.emoji}</span>
                    <div class="win-info">
                        <strong>${winner.name}</strong>
                        <span>Menang dengan ${winner.score} Task</span>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="empty-state">Belum ada catatan pemenang bulan lalu.</div>`;
        }
    }

    window.resetRankFilter = () => {
        rankMonthInput.value = ym;
        window.loadRankingPageData();
    };

    window.loadRankingPageData();
}

// ==========================================
// 5. MODAL HELPER (Global)
// ==========================================
window.openModal = function(title, desc, callback, showInput = false, inputVal = "") {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return; 
    
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-desc').innerText = desc;
    const inputCont = document.getElementById('modal-input-container');
    const inputField = document.getElementById('modal-input-field');
    
    if(showInput) {
        inputCont.style.display = "block";
        inputField.value = inputVal;
    } else {
        inputCont.style.display = "none";
    }

    overlay.style.display = "flex";
    document.getElementById('modal-ok-btn').onclick = () => {
        callback();
        window.closeModal();
    };
}

window.closeModal = function() { 
    const overlay = document.getElementById('modal-overlay');
    if(overlay) overlay.style.display = "none"; 
};