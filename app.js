// ==========================================
// 1. REGISTRO DE SERVICE WORKER (PWA OFFLINE)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker v6 activo'))
            .catch(err => console.log('SW error:', err));
    });
}

// ==========================================
// 2. UTILIDADES DE SEGURIDAD Y UI (TOASTS & XSS)
// ==========================================
// Sanitización para prevenir inyección HTML / XSS
function escaparHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Componente elegante de Notificaciones Toast
function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;

    let icon = '✓';
    if (tipo === 'error') icon = '✕';
    else if (tipo === 'warning') icon = '⚠️';
    else if (tipo === 'info') icon = 'ℹ️';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-msg">${escaparHTML(mensaje)}</span>
    `;

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto-eliminar a los 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3000);
}

// ==========================================
// 3. ESTADO GLOBAL Y PERSISTENCIA SEGURA
// ==========================================
let movimientos = JSON.parse(localStorage.getItem('mis_movimientos')) || [];
let presupuestos = JSON.parse(localStorage.getItem('mis_presupuestos')) || {}; // { 'YYYY-MM': monto }
let metasAhorro = JSON.parse(localStorage.getItem('mis_metas')) || []; // [{ id, nombre, objetivo, actual }]
let deudasAmigos = JSON.parse(localStorage.getItem('mis_deudas_amigos')) || []; // [{ id, amigo, monto, pagado, concepto, fecha }]
let splitParticipantes = JSON.parse(localStorage.getItem('split_participantes')) || []; // [{ id, nombre, puso }]
let gastosFijos = JSON.parse(localStorage.getItem('mis_gastos_fijos')) || []; // [{ id, desc, monto, cat, metodo }]
let gastosFijosCargados = JSON.parse(localStorage.getItem('fijos_cargados_meses')) || {}; // { 'YYYY-MM': true }
let userPin = localStorage.getItem('app_pin') || null;
let usarSaldoAcumulado = JSON.parse(localStorage.getItem('usar_saldo_acumulado')) || false;

// Categorías por defecto editables
let categorias = JSON.parse(localStorage.getItem('mis_categorias')) || [
    { id: 'Comida', nombre: 'Comida', emoji: '🍔' },
    { id: 'Transporte', nombre: 'Transporte / Nafta', emoji: '🏍️' },
    { id: 'Servicios', nombre: 'Servicios / Cuentas', emoji: '💡' },
    { id: 'Salidas', nombre: 'Salidas / Ocio', emoji: '🍻' },
    { id: 'Sueldo', nombre: 'Sueldo / Ingreso', emoji: '💼' },
    { id: 'Salud', nombre: 'Salud / Farmacia', emoji: '💊' },
    { id: 'Compras', nombre: 'Compras / Ropa', emoji: '🛍️' },
    { id: 'Otros', nombre: 'Otros', emoji: '📦' }
];

const iconosMetodo = {
    'Efectivo': '💵',
    'Mercado Pago': '📱',
    'Débito': '💳',
    'Crédito': '💳',
    'Transferencia': '🏦'
};

function guardarEnMemoria() {
    try {
        localStorage.setItem('mis_movimientos', JSON.stringify(movimientos));
        localStorage.setItem('mis_presupuestos', JSON.stringify(presupuestos));
        localStorage.setItem('mis_metas', JSON.stringify(metasAhorro));
        localStorage.setItem('mis_deudas_amigos', JSON.stringify(deudasAmigos));
        localStorage.setItem('split_participantes', JSON.stringify(splitParticipantes));
        localStorage.setItem('mis_gastos_fijos', JSON.stringify(gastosFijos));
        localStorage.setItem('fijos_cargados_meses', JSON.stringify(gastosFijosCargados));
        localStorage.setItem('mis_categorias', JSON.stringify(categorias));
        localStorage.setItem('usar_saldo_acumulado', JSON.stringify(usarSaldoAcumulado));
        actualizarIndicadorAlmacenamiento();
    } catch (e) {
        console.error('Error al guardar en memoria:', e);
        mostrarToast('¡Límite de memoria alcanzado! Intenta borrar fotos viejas.', 'error');
    }
}

// Medidor visual de almacenamiento local (5MB aprox de límite)
function actualizarIndicadorAlmacenamiento() {
    const storagePercentText = document.getElementById('storage-percent-text');
    const storageProgressBar = document.getElementById('storage-progress-bar');
    const storageDetailText = document.getElementById('storage-detail-text');
    if (!storagePercentText || !storageProgressBar || !storageDetailText) return;

    try {
        let totalBytes = 0;
        for (let x in localStorage) {
            if (localStorage.hasOwnProperty(x)) {
                totalBytes += (localStorage[x].length + x.length) * 2;
            }
        }
        const totalKB = (totalBytes / 1024).toFixed(1);
        const maxBytes = 5 * 1024 * 1024; // 5 MB estándar
        const porcentaje = Math.min(100, Math.round((totalBytes / maxBytes) * 100));

        storagePercentText.textContent = `${porcentaje}% usado`;
        storageProgressBar.style.width = `${porcentaje}%`;
        storageProgressBar.className = 'progress-bar-fill';
        if (porcentaje >= 90) storageProgressBar.classList.add('danger');
        else if (porcentaje >= 70) storageProgressBar.classList.add('warning');

        storageDetailText.textContent = `${totalKB} KB de 5 MB aprox. utilizados`;
    } catch (err) {
        storageDetailText.textContent = 'Espacio de almacenamiento disponible';
    }
}

function formatearDinero(cantidad) {
    return '$' + Number(cantidad).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Variables de Período y Filtro
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();
let selectedType = 'gasto';
let currentTicketBase64 = null;

function getPeriodKey(d) {
    const y = d ? d.getFullYear() : currentYear;
    const m = d ? d.getMonth() + 1 : currentMonth + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
}

const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ==========================================
// 4. SEGURIDAD: PANTALLA DE BLOQUEO POR PIN
// ==========================================
const pinLockscreen = document.getElementById('pin-lockscreen');
const pinDots = document.querySelectorAll('.pin-dot');
const pinErrorMsg = document.getElementById('pin-error-msg');
const btnPinDel = document.getElementById('btn-pin-del');
const btnPinCancel = document.getElementById('btn-pin-cancel');
const btnTogglePin = document.getElementById('btn-toggle-pin');
const pinStatusText = document.getElementById('pin-status-text');

let enteredPin = '';

function checkPinLock() {
    if (userPin && userPin.length === 4) {
        pinLockscreen.style.display = 'flex';
        enteredPin = '';
        updatePinDots();
        pinStatusText.textContent = 'Protegido con código PIN de 4 dígitos.';
        btnTogglePin.textContent = 'Cambiar / Quitar PIN';
    } else {
        pinLockscreen.style.display = 'none';
        pinStatusText.textContent = 'Sin protección de acceso.';
        btnTogglePin.textContent = 'Activar PIN';
    }
}

function updatePinDots() {
    pinDots.forEach((dot, index) => {
        if (index < enteredPin.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

document.querySelectorAll('.pin-key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => {
        if (enteredPin.length < 4) {
            enteredPin += btn.dataset.digit;
            updatePinDots();
            if (enteredPin.length === 4) {
                setTimeout(() => {
                    if (enteredPin === userPin) {
                        pinLockscreen.style.display = 'none';
                        pinErrorMsg.style.display = 'none';
                    } else {
                        pinErrorMsg.style.display = 'block';
                        enteredPin = '';
                        updatePinDots();
                    }
                }, 100);
            }
        }
    });
});

btnPinDel.addEventListener('click', () => {
    if (enteredPin.length > 0) {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDots();
    }
});

btnPinCancel.addEventListener('click', () => {
    enteredPin = '';
    updatePinDots();
});

btnTogglePin.addEventListener('click', () => {
    if (userPin) {
        const opcion = confirm('¿Querés QUITAR el PIN de seguridad? (Aceptar para quitar, Cancelar para cambiarlo)');
        if (opcion) {
            userPin = null;
            localStorage.removeItem('app_pin');
            mostrarToast('PIN desactivado con éxito.', 'info');
            checkPinLock();
            return;
        }
    }
    const nuevo = prompt('Ingresá un PIN de 4 números:');
    if (nuevo) {
        if (/^\d{4}$/.test(nuevo.trim())) {
            userPin = nuevo.trim();
            localStorage.setItem('app_pin', userPin);
            mostrarToast('¡PIN configurado correctamente!', 'success');
            checkPinLock();
        } else {
            mostrarToast('El PIN debe tener exactamente 4 números.', 'error');
        }
    }
});

// ==========================================
// 5. REFERENCIAS A ELEMENTOS DEL DOM
// ==========================================
// Balance
const balanceTotalEl = document.getElementById('balance-total');
const totalIngresosEl = document.getElementById('total-ingresos');
const totalGastosEl = document.getElementById('total-gastos');
const labelBalanceTitle = document.getElementById('label-balance-title');
const switchSaldoAcumulado = document.getElementById('switch-saldo-acumulado');

// Períodos
const labelPeriodo = document.getElementById('label-periodo');
const labelSubperiodo = document.getElementById('label-subperiodo');
const btnPrevMonth = document.getElementById('btn-prev-month');
const btnNextMonth = document.getElementById('btn-next-month');

// Presupuesto
const budgetProgressText = document.getElementById('budget-progress-text');
const budgetBar = document.getElementById('budget-bar');
const budgetMsg = document.getElementById('budget-msg');
const btnSetBudget = document.getElementById('btn-set-budget');

// Banner Gastos Fijos
const recurringReminderBanner = document.getElementById('recurring-reminder-banner');
const recurringPendingCount = document.getElementById('recurring-pending-count');
const btnApplyRecurring = document.getElementById('btn-apply-recurring');

// Tabs
const tabBtnHistory = document.getElementById('tab-btn-history');
const tabBtnCharts = document.getElementById('tab-btn-charts');
const tabBtnGoals = document.getElementById('tab-btn-goals');
const tabBtnFriends = document.getElementById('tab-btn-friends');
const viewHistory = document.getElementById('view-history');
const viewCharts = document.getElementById('view-charts');
const viewGoals = document.getElementById('view-goals');
const viewFriends = document.getElementById('view-friends');

// Sub-pestañas Amigos
const subtabDebts = document.getElementById('subtab-debts');
const subtabSplit = document.getElementById('subtab-split');
const subviewDebts = document.getElementById('subview-debts');
const subviewSplit = document.getElementById('subview-split');

// Deudas (Me Deben)
const debtsTotalPending = document.getElementById('debts-total-pending');
const debtsList = document.getElementById('debts-list');
const btnNewDebt = document.getElementById('btn-new-debt');
const debtModal = document.getElementById('debt-modal');
const btnCloseDebt = document.getElementById('btn-close-debt');
const debtForm = document.getElementById('debt-form');
const debtFriendName = document.getElementById('debt-friend-name');
const debtAmount = document.getElementById('debt-amount');
const debtConcept = document.getElementById('debt-concept');

// Cobro de Deuda
const debtPaymentModal = document.getElementById('debt-payment-modal');
const btnClosePayment = document.getElementById('btn-close-payment');
const debtPaymentForm = document.getElementById('debt-payment-form');
const paymentDebtId = document.getElementById('payment-debt-id');
const paymentDebtSummary = document.getElementById('payment-debt-summary');
const paymentAmount = document.getElementById('payment-amount');
const paymentAddToBalance = document.getElementById('payment-add-to-balance');

// División de Salida Grupal
const splitNameInput = document.getElementById('split-name-input');
const splitPaidInput = document.getElementById('split-paid-input');
const btnAddSplitPerson = document.getElementById('btn-add-split-person');
const splitPeopleList = document.getElementById('split-people-list');
const splitTotalsBox = document.getElementById('split-totals-box');
const splitTotalSum = document.getElementById('split-total-sum');
const splitFairShare = document.getElementById('split-fair-share');
const splitSettlementBox = document.getElementById('split-settlement-box');
const splitSettlementList = document.getElementById('split-settlement-list');
const btnCopySplit = document.getElementById('btn-copy-split');
const btnResetSplit = document.getElementById('btn-reset-split');

// Filtros y Búsqueda
const busquedaInput = document.getElementById('busqueda-input');
const filtroCategoria = document.getElementById('filtro-categoria');
const filtroMetodo = document.getElementById('filtro-metodo');
const listaMovimientos = document.getElementById('lista-movimientos');

// Modal Movimiento (Alta y Edición)
const modalBackdrop = document.getElementById('modal-backdrop');
const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const form = document.getElementById('transaction-form');
const modalTitle = document.getElementById('modal-title');
const editIdInput = document.getElementById('edit-id');
const switchGasto = document.getElementById('switch-gasto');
const switchIngreso = document.getElementById('switch-ingreso');
const montoInput = document.getElementById('monto');
const descripcionInput = document.getElementById('descripcion');
const categoriaInput = document.getElementById('categoria');
const metodoInput = document.getElementById('metodo');
const cuotasSelect = document.getElementById('cuotas-select');
const cuotaEstimada = document.getElementById('cuota-estimada');
const installmentsRow = document.getElementById('installments-row');
const fechaInput = document.getElementById('fecha');
const ticketInput = document.getElementById('ticket-input');
const labelTicketStatus = document.getElementById('label-ticket-status');
const ticketPreviewBox = document.getElementById('ticket-preview-box');
const ticketPreviewImg = document.getElementById('ticket-preview-img');
const btnRemoveTicket = document.getElementById('btn-remove-ticket');
const btnSaveMovement = document.getElementById('btn-save-movement');

// Modal Ticket Viewer
const ticketModal = document.getElementById('ticket-modal');
const ticketFullImg = document.getElementById('ticket-full-img');
const btnCloseTicketViewer = document.getElementById('btn-close-ticket-viewer');

// Modal Gastos Fijos
const btnRecurringOpen = document.getElementById('btn-recurring-open');
const recurringModal = document.getElementById('recurring-modal');
const btnCloseRecurring = document.getElementById('btn-close-recurring');
const recurringForm = document.getElementById('recurring-form');
const recDescInput = document.getElementById('rec-desc');
const recMontoInput = document.getElementById('rec-monto');
const recCatSelect = document.getElementById('rec-cat');
const recMetodoSelect = document.getElementById('rec-metodo');
const recurringList = document.getElementById('recurring-list');

// Modal Categorías
const btnOpenCategories = document.getElementById('btn-open-categories');
const categoriesModal = document.getElementById('categories-modal');
const btnCloseCategories = document.getElementById('btn-close-categories');
const categoryForm = document.getElementById('category-form');
const catEmojiInput = document.getElementById('cat-emoji');
const catNameInput = document.getElementById('cat-name');
const categoriesList = document.getElementById('categories-list');

// Metas de Ahorro
const goalsList = document.getElementById('goals-list');
const btnNewGoal = document.getElementById('btn-new-goal');
const goalModal = document.getElementById('goal-modal');
const btnCloseGoal = document.getElementById('btn-close-goal');
const goalForm = document.getElementById('goal-form');
const goalNameInput = document.getElementById('goal-name');
const goalTargetInput = document.getElementById('goal-target');
const goalCurrentInput = document.getElementById('goal-current');

// Depósito en Meta
const goalDepositModal = document.getElementById('goal-deposit-modal');
const btnCloseDeposit = document.getElementById('btn-close-deposit');
const goalDepositForm = document.getElementById('goal-deposit-form');
const depositGoalId = document.getElementById('deposit-goal-id');
const depositAmount = document.getElementById('deposit-amount');
const depositGoalTitle = document.getElementById('deposit-goal-title');

// Respaldo
const btnExportCsv = document.getElementById('btn-export-csv');
const btnBackup = document.getElementById('btn-backup');
const backupModal = document.getElementById('backup-modal');
const btnCloseBackup = document.getElementById('btn-close-backup');
const btnDownloadBackup = document.getElementById('btn-download-backup');
const fileRestore = document.getElementById('file-restore');
const btnClearAll = document.getElementById('btn-clear-all');

// Gráficos
const chartCanvas = document.getElementById('chart-categorias');
const chartEmptyMsg = document.getElementById('chart-empty-msg');
const chartEvolucionCanvas = document.getElementById('chart-evolucion');
const chartEvolucionEmptyMsg = document.getElementById('chart-evolucion-empty-msg');
let chartInstance = null;
let chartEvolucionInstance = null;

// ==========================================
// 6. POBLAR SELECTORES DE CATEGORÍAS
// ==========================================
function actualizarSelectoresCategorias() {
    categoriaInput.innerHTML = '';
    filtroCategoria.innerHTML = '<option value="Todas">Todas las categorías</option>';
    recCatSelect.innerHTML = '';

    categorias.forEach(cat => {
        const opt1 = document.createElement('option');
        opt1.value = cat.id;
        opt1.textContent = `${cat.emoji} ${cat.nombre}`;
        categoriaInput.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = cat.id;
        opt2.textContent = `${cat.emoji} ${cat.nombre}`;
        filtroCategoria.appendChild(opt2);

        const opt3 = document.createElement('option');
        opt3.value = cat.id;
        opt3.textContent = `${cat.emoji} ${cat.nombre}`;
        recCatSelect.appendChild(opt3);
    });

    renderCategoriasList();
}

function renderCategoriasList() {
    categoriesList.innerHTML = '';
    categorias.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'category-item';
        li.innerHTML = `
            <span>${cat.emoji} <strong>${escaparHTML(cat.nombre)}</strong></span>
            <button class="btn-delete" onclick="eliminarCategoria('${cat.id}')">✕</button>
        `;
        categoriesList.appendChild(li);
    });
}

categoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const emoji = catEmojiInput.value.trim() || '🏷️';
    const nombre = catNameInput.value.trim();
    if (!nombre) return;

    const id = 'cat_' + Date.now();
    categorias.push({ id, nombre, emoji });
    guardarEnMemoria();
    actualizarSelectoresCategorias();
    categoryForm.reset();
    mostrarToast('Categoría creada exitosamente.');
});

function eliminarCategoria(catId) {
    if (categorias.length <= 1) {
        mostrarToast('Tenés que mantener al menos una categoría.', 'warning');
        return;
    }
    if (confirm('¿Eliminar esta categoría?')) {
        categorias = categorias.filter(c => c.id !== catId);
        guardarEnMemoria();
        actualizarSelectoresCategorias();
        actualizarPantalla();
        mostrarToast('Categoría eliminada.', 'info');
    }
}

// ==========================================
// 7. CALCULADORA RÁPIDA EN EL MONTO
// ==========================================
function evaluarMontoMatematico(str) {
    if (!str) return NaN;
    const limpio = String(str).replace(/,/g, '.').replace(/[^0-9+\-*/.]/g, '');
    try {
        const res = new Function(`return (${limpio})`)();
        return typeof res === 'number' && !isNaN(res) ? Math.round(res * 100) / 100 : NaN;
    } catch {
        return NaN;
    }
}

document.querySelectorAll('.btn-quick-add').forEach(btn => {
    btn.addEventListener('click', () => {
        const valorSumar = parseFloat(btn.dataset.add);
        const actual = evaluarMontoMatematico(montoInput.value) || 0;
        montoInput.value = (actual + valorSumar).toString();
        actualizarPreviewCuotas();
    });
});

montoInput.addEventListener('input', actualizarPreviewCuotas);

// ==========================================
// 8. COMPRAS EN CUOTAS CON TARJETA DE CRÉDITO
// ==========================================
metodoInput.addEventListener('change', () => {
    if (metodoInput.value === 'Crédito' && selectedType === 'gasto' && !editIdInput.value) {
        installmentsRow.style.display = 'block';
    } else {
        installmentsRow.style.display = 'none';
        cuotasSelect.value = '1';
    }
    actualizarPreviewCuotas();
});

cuotasSelect.addEventListener('change', actualizarPreviewCuotas);

function actualizarPreviewCuotas() {
    const numCuotas = parseInt(cuotasSelect.value, 10);
    const montoTotal = evaluarMontoMatematico(montoInput.value);

    if (numCuotas > 1 && !isNaN(montoTotal) && montoTotal > 0) {
        const valorCuota = montoTotal / numCuotas;
        cuotaEstimada.textContent = `(${numCuotas}x ${formatearDinero(valorCuota)})`;
    } else {
        cuotaEstimada.textContent = '';
    }
}

// ==========================================
// 9. FOTO / COMPROBANTE DE TICKET (CÁMARA/GALERÍA)
// ==========================================
ticketInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 700; // Optimización de tamaño para localStorage
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
            canvas.height = (img.width > MAX_WIDTH) ? (img.height * scaleSize) : img.height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentTicketBase64 = canvas.toDataURL('image/jpeg', 0.65);

            ticketPreviewImg.src = currentTicketBase64;
            ticketPreviewBox.style.display = 'flex';
            labelTicketStatus.textContent = 'Ticket cargado ✓';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

btnRemoveTicket.addEventListener('click', () => {
    currentTicketBase64 = null;
    ticketInput.value = '';
    ticketPreviewBox.style.display = 'none';
    labelTicketStatus.textContent = 'Subir foto';
});

function verTicketEnGrande(base64) {
    ticketFullImg.src = base64;
    ticketModal.classList.add('open');
}

btnCloseTicketViewer.addEventListener('click', () => {
    ticketModal.classList.remove('open');
});

// ==========================================
// 10. GASTOS FIJOS / RECURRENTES
// ==========================================
btnRecurringOpen.addEventListener('click', () => {
    renderGastosFijos();
    recurringModal.classList.add('open');
});
btnCloseRecurring.addEventListener('click', () => recurringModal.classList.remove('open'));
recurringModal.addEventListener('click', (e) => {
    if (e.target === recurringModal) recurringModal.classList.remove('open');
});

recurringForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = recDescInput.value.trim();
    const monto = parseFloat(recMontoInput.value);
    if (!desc || isNaN(monto) || monto <= 0) return;

    gastosFijos.push({
        id: Date.now(),
        desc,
        monto,
        cat: recCatSelect.value,
        metodo: recMetodoSelect.value
    });

    guardarEnMemoria();
    renderGastosFijos();
    verificarGastosFijosDelMes();
    recurringForm.reset();
    mostrarToast('Gasto fijo agregado.');
});

function renderGastosFijos() {
    recurringList.innerHTML = '';
    if (gastosFijos.length === 0) {
        recurringList.innerHTML = `<li style="text-align:center; color:#71717a; padding: 12px 0;">No agregaste gastos fijos todavía.</li>`;
        return;
    }
    gastosFijos.forEach(item => {
        const catObj = categorias.find(c => c.id === item.cat);
        const catEmoji = catObj ? catObj.emoji : '📦';
        const li = document.createElement('li');
        li.className = 'recurring-item';
        li.innerHTML = `
            <div>
                <strong>${catEmoji} ${escaparHTML(item.desc)}</strong>
                <span style="color:#a1a1aa; font-size:0.75rem; display:block;">${escaparHTML(item.metodo)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#ef4444; font-weight:700;">-${formatearDinero(item.monto)}</span>
                <button class="btn-delete" onclick="eliminarGastoFijo(${item.id})">✕</button>
            </div>
        `;
        recurringList.appendChild(li);
    });
}

function eliminarGastoFijo(id) {
    gastosFijos = gastosFijos.filter(g => g.id !== id);
    guardarEnMemoria();
    renderGastosFijos();
    verificarGastosFijosDelMes();
    mostrarToast('Gasto fijo eliminado.', 'info');
}

function verificarGastosFijosDelMes() {
    const periodKey = getPeriodKey();
    if (gastosFijos.length > 0 && !gastosFijosCargados[periodKey]) {
        recurringReminderBanner.style.display = 'flex';
        recurringPendingCount.textContent = `Tenés ${gastosFijos.length} fijos para ${nombresMeses[currentMonth]}`;
    } else {
        recurringReminderBanner.style.display = 'none';
    }
}

btnApplyRecurring.addEventListener('click', () => {
    const periodKey = getPeriodKey();
    if (confirm(`¿Querés registrar los ${gastosFijos.length} gastos fijos en ${nombresMeses[currentMonth]} ${currentYear}?`)) {
        const yyyy = currentYear;
        const mm = String(currentMonth + 1).padStart(2, '0');
        const fecha = `${yyyy}-${mm}-01`;

        gastosFijos.forEach(item => {
            movimientos.push({
                id: Date.now() + Math.floor(Math.random() * 1000),
                descripcion: `[Fijo] ${item.desc}`,
                monto: item.monto,
                tipo: 'gasto',
                categoria: item.cat,
                metodo: item.metodo,
                fecha: fecha,
                cuotaActual: 1,
                cuotasTotales: 1,
                ticket: null
            });
        });

        gastosFijosCargados[periodKey] = true;
        guardarEnMemoria();
        actualizarPantalla();
        mostrarToast('¡Gastos fijos aplicados exitosamente!', 'success');
    }
});

// ==========================================
// 11. METAS DE AHORRO (CHANCITO VIRTUAL)
// ==========================================
btnNewGoal.addEventListener('click', () => {
    goalForm.reset();
    goalModal.classList.add('open');
});
btnCloseGoal.addEventListener('click', () => goalModal.classList.remove('open'));
goalModal.addEventListener('click', (e) => {
    if (e.target === goalModal) goalModal.classList.remove('open');
});

goalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = goalNameInput.value.trim();
    const objetivo = parseFloat(goalTargetInput.value);
    const actual = parseFloat(goalCurrentInput.value) || 0;

    if (!nombre || isNaN(objetivo) || objetivo <= 0) return;

    metasAhorro.push({
        id: Date.now(),
        nombre,
        objetivo,
        actual
    });

    guardarEnMemoria();
    goalModal.classList.remove('open');
    renderMetas();
    mostrarToast('Meta de ahorro creada con éxito.');
});

function renderMetas() {
    goalsList.innerHTML = '';
    if (metasAhorro.length === 0) {
        goalsList.innerHTML = `<p style="text-align:center; color:#71717a; padding:30px 0;">No creaste metas aún. ¡Tocá "+ Nueva Meta" para empezar a ahorrar!</p>`;
        return;
    }

    metasAhorro.forEach(meta => {
        const porc = Math.min(100, Math.round((meta.actual / meta.objetivo) * 100));
        const div = document.createElement('div');
        div.className = 'goal-card';
        div.innerHTML = `
            <div class="goal-card-top">
                <strong>🐷 ${escaparHTML(meta.nombre)}</strong>
                <button class="btn-delete" onclick="eliminarMeta(${meta.id})">✕</button>
            </div>
            <div class="goal-amounts">
                <span>${formatearDinero(meta.actual)}</span> ahorrados de ${formatearDinero(meta.objetivo)}
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${porc}%; background: ${porc >= 100 ? '#10b981' : '#6366f1'};"></div>
            </div>
            <div class="goal-card-actions">
                <span class="goal-percent">${porc}% completado</span>
                <div class="goal-btns">
                    <button class="btn-sm-primary" onclick="abrirAporteMeta(${meta.id}, '${escaparHTML(meta.nombre)}')">+ Sumar Ahorro</button>
                </div>
            </div>
        `;
        goalsList.appendChild(div);
    });
}

function abrirAporteMeta(id, nombre) {
    depositGoalId.value = id;
    depositGoalTitle.textContent = `Sumar a: ${nombre}`;
    depositAmount.value = '';
    goalDepositModal.classList.add('open');
    setTimeout(() => depositAmount.focus(), 150);
}

btnCloseDeposit.addEventListener('click', () => goalDepositModal.classList.remove('open'));
goalDepositModal.addEventListener('click', (e) => {
    if (e.target === goalDepositModal) goalDepositModal.classList.remove('open');
});

goalDepositForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(depositGoalId.value, 10);
    const monto = parseFloat(depositAmount.value);
    if (isNaN(monto) || monto <= 0) return;

    const meta = metasAhorro.find(m => m.id === id);
    if (meta) {
        meta.actual += monto;
        guardarEnMemoria();
        renderMetas();
        goalDepositModal.classList.remove('open');
        mostrarToast(`¡Sumaste ${formatearDinero(monto)} a tu meta! 🐷`, 'success');
    }
});

function eliminarMeta(id) {
    if (confirm('¿Eliminar esta meta de ahorro?')) {
        metasAhorro = metasAhorro.filter(m => m.id !== id);
        guardarEnMemoria();
        renderMetas();
        mostrarToast('Meta eliminada.', 'info');
    }
}

// ==========================================
// 12. ACTUALIZAR PANTALLA PRINCIPAL Y SALDO
// ==========================================
function actualizarHeaderPeriodo() {
    labelPeriodo.textContent = `${nombresMeses[currentMonth]} ${currentYear}`;
    const hoy = new Date();
    if (currentYear === hoy.getFullYear() && currentMonth === hoy.getMonth()) {
        labelSubperiodo.textContent = 'Mes en curso';
    } else {
        labelSubperiodo.textContent = 'Histórico mensual';
    }
}

btnPrevMonth.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    actualizarPantalla();
});

btnNextMonth.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    actualizarPantalla();
});

// Control del switch de Saldo Acumulado
if (switchSaldoAcumulado) {
    switchSaldoAcumulado.checked = usarSaldoAcumulado;
    switchSaldoAcumulado.addEventListener('change', () => {
        usarSaldoAcumulado = switchSaldoAcumulado.checked;
        guardarEnMemoria();
        actualizarPantalla();
        mostrarToast(usarSaldoAcumulado ? 'Modo Saldo Acumulado activado.' : 'Modo Balance Neto del Mes activado.', 'info');
    });
}

function actualizarPantalla() {
    actualizarHeaderPeriodo();
    verificarGastosFijosDelMes();

    const periodKey = getPeriodKey();
    const textoBusqueda = busquedaInput.value.toLowerCase().trim();
    const catFiltro = filtroCategoria.value;
    const metodoFiltro = filtroMetodo.value;

    // Movimientos específicos de este mes
    const movimientosDelMes = movimientos.filter(mov => {
        if (!mov.fecha) return true;
        return mov.fecha.startsWith(periodKey);
    });

    let sumaIngresos = 0;
    let sumaGastos = 0;

    movimientosDelMes.forEach(mov => {
        if (mov.tipo === 'ingreso') {
            sumaIngresos += mov.monto;
        } else {
            sumaGastos += mov.monto;
        }
    });

    const balanceMes = sumaIngresos - sumaGastos;

    // Cálculo con o sin saldo acumulado anterior
    if (usarSaldoAcumulado) {
        labelBalanceTitle.textContent = 'Saldo Total Acumulado';
        let saldoHistoricoTotal = 0;
        // Se calcula hasta el final del mes seleccionado
        movimientos.forEach(mov => {
            const fechaMov = mov.fecha || '0000-00-00';
            if (fechaMov.substring(0, 7) <= periodKey) {
                if (mov.tipo === 'ingreso') saldoHistoricoTotal += mov.monto;
                else saldoHistoricoTotal -= mov.monto;
            }
        });
        balanceTotalEl.textContent = formatearDinero(saldoHistoricoTotal);
    } else {
        labelBalanceTitle.textContent = 'Saldo Disponible del Mes';
        balanceTotalEl.textContent = formatearDinero(balanceMes);
    }

    totalIngresosEl.textContent = '+' + formatearDinero(sumaIngresos);
    totalGastosEl.textContent = '-' + formatearDinero(sumaGastos);

    actualizarWidgetPresupuesto(sumaGastos, periodKey);

    // Filtrar lista para renderizar
    const movimientosFiltrados = movimientosDelMes.filter(mov => {
        const coincideCat = (catFiltro === 'Todas' || mov.categoria === catFiltro);
        const coincideMetodo = (metodoFiltro === 'Todos' || mov.metodo === metodoFiltro);
        const coincideBusqueda = mov.descripcion.toLowerCase().includes(textoBusqueda);
        return coincideCat && coincideMetodo && coincideBusqueda;
    });

    // Renderizar Lista con botón editar y sanitización
    listaMovimientos.innerHTML = '';
    if (movimientosFiltrados.length === 0) {
        listaMovimientos.innerHTML = `<li style="text-align:center; color:#71717a; padding: 28px 0; font-size: 0.9rem;">No hay movimientos para este período.</li>`;
    } else {
        movimientosFiltrados.slice().reverse().forEach(mov => {
            const li = document.createElement('li');
            li.classList.add('transaction-item', mov.tipo);

            const signo = mov.tipo === 'ingreso' ? '+' : '-';
            const catObj = categorias.find(c => c.id === mov.categoria);
            const catLabel = catObj ? `${catObj.emoji} ${catObj.nombre}` : (mov.categoria || 'Otros');
            const metodoIcon = iconosMetodo[mov.metodo] || '💳';
            const metodoTexto = mov.metodo ? `${metodoIcon} ${mov.metodo}` : '';
            const fechaCorta = mov.fecha ? `${mov.fecha.split('-')[2]}/${mov.fecha.split('-')[1]}` : '';

            const cuotasHtml = (mov.cuotasTotales && mov.cuotasTotales > 1) 
                ? `<span class="badge-cuota">Cuota ${mov.cuotaActual}/${mov.cuotasTotales}</span>` 
                : '';

            const ticketBtn = mov.ticket
                ? `<button class="badge-ticket-btn" onclick="verTicketEnGrande('${mov.ticket}')" title="Ver foto ticket">📸 Ticket</button>`
                : '';

            li.innerHTML = `
                <div class="item-info">
                    <strong>${escaparHTML(mov.descripcion)}</strong>
                    <div class="item-badges">
                        <span class="badge">${catLabel}</span>
                        ${metodoTexto ? `<span class="badge">${escaparHTML(metodoTexto)}</span>` : ''}
                        ${cuotasHtml}
                        ${ticketBtn}
                        ${fechaCorta ? `<span class="badge-date">📅 ${fechaCorta}</span>` : ''}
                    </div>
                </div>
                <div class="item-amount">
                    <span>${signo}${formatearDinero(mov.monto)}</span>
                    <div class="item-actions">
                        <button class="btn-edit" onclick="editarMovimiento(${mov.id})" title="Editar movimiento">✏️</button>
                        <button class="btn-delete" onclick="eliminarMovimiento(${mov.id})" title="Eliminar">✕</button>
                    </div>
                </div>
            `;
            listaMovimientos.appendChild(li);
        });
    }

    actualizarGrafico(movimientosDelMes);
    actualizarGraficoEvolucion();
    actualizarIndicadorAlmacenamiento();
}

// Widget Presupuesto
function actualizarWidgetPresupuesto(totalGastosMes, periodKey) {
    const limite = presupuestos[periodKey] || 0;

    if (limite > 0) {
        budgetProgressText.textContent = `${formatearDinero(totalGastosMes)} / ${formatearDinero(limite)}`;
        const porcentaje = Math.min(100, Math.round((totalGastosMes / limite) * 100));
        budgetBar.style.width = `${porcentaje}%`;

        budgetBar.className = 'progress-bar-fill';
        if (porcentaje >= 100) {
            budgetBar.classList.add('danger');
            budgetMsg.textContent = `⚠️ ¡Superaste tu presupuesto por ${formatearDinero(totalGastosMes - limite)}!`;
            budgetMsg.style.color = '#ef4444';
        } else if (porcentaje >= 80) {
            budgetBar.classList.add('warning');
            budgetMsg.textContent = `Aviso: Ya usaste el ${porcentaje}% de tu presupuesto.`;
            budgetMsg.style.color = '#f59e0b';
        } else {
            const disponible = limite - totalGastosMes;
            budgetMsg.textContent = `Te quedan ${formatearDinero(disponible)} disponibles este mes.`;
            budgetMsg.style.color = '#a1a1aa';
        }
    } else {
        budgetProgressText.textContent = `${formatearDinero(totalGastosMes)} gastados`;
        budgetBar.style.width = '0%';
        budgetMsg.textContent = 'Tocá "Definir Límite" para controlar tus gastos este mes.';
        budgetMsg.style.color = '#a1a1aa';
    }
}

btnSetBudget.addEventListener('click', () => {
    const periodKey = getPeriodKey();
    const actual = presupuestos[periodKey] || '';
    const nuevo = prompt(`Presupuesto límite de gastos para ${nombresMeses[currentMonth]} ${currentYear} ($):`, actual);

    if (nuevo !== null) {
        const val = parseFloat(nuevo);
        if (!isNaN(val) && val > 0) {
            presupuestos[periodKey] = val;
            mostrarToast('Presupuesto fijado.');
        } else if (nuevo.trim() === '' || val === 0) {
            delete presupuestos[periodKey];
            mostrarToast('Presupuesto eliminado.', 'info');
        }
        guardarEnMemoria();
        actualizarPantalla();
    }
});

// ==========================================
// 13. GRÁFICOS (DONUT Y EVOLUCIÓN COMPARATIVA)
// ==========================================
function actualizarGrafico(movimientosMes) {
    if (typeof Chart === 'undefined') return;

    const gastosPorCat = {};
    movimientosMes.forEach(mov => {
        if (mov.tipo === 'gasto') {
            const catObj = categorias.find(c => c.id === mov.categoria);
            const nombre = catObj ? `${catObj.emoji} ${catObj.nombre}` : (mov.categoria || 'Otros');
            gastosPorCat[nombre] = (gastosPorCat[nombre] || 0) + mov.monto;
        }
    });

    const labels = Object.keys(gastosPorCat);
    const data = Object.values(gastosPorCat);

    if (labels.length === 0) {
        if (chartInstance) chartInstance.destroy();
        chartCanvas.style.display = 'none';
        chartEmptyMsg.style.display = 'block';
        return;
    }

    chartCanvas.style.display = 'block';
    chartEmptyMsg.style.display = 'none';

    const colores = [
        '#6366f1', '#ec4899', '#f59e0b', '#10b981',
        '#06b6d4', '#8b5cf6', '#f97316', '#a855f7', '#64748b'
    ];

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(chartCanvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colores.slice(0, labels.length),
                borderColor: '#18181b',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#f4f4f5',
                        boxWidth: 12,
                        padding: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: $${context.raw.toLocaleString('es-AR')}`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// Gráfico de barras: Evolución de los últimos 6 meses
function actualizarGraficoEvolucion() {
    if (typeof Chart === 'undefined' || !chartEvolucionCanvas) return;

    // Calcular los últimos 6 meses finalizando en el mes actual seleccionado
    const mesesKeys = [];
    const mesesLabels = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const key = `${y}-${String(m).padStart(2, '0')}`;
        mesesKeys.push(key);
        mesesLabels.push(`${nombresMeses[d.getMonth()].substring(0, 3)} ${String(y).slice(-2)}`);
    }

    const ingresosData = [0, 0, 0, 0, 0, 0];
    const gastosData = [0, 0, 0, 0, 0, 0];
    let hayDatos = false;

    movimientos.forEach(mov => {
        if (!mov.fecha) return;
        const mesKey = mov.fecha.substring(0, 7);
        const idx = mesesKeys.indexOf(mesKey);
        if (idx !== -1) {
            hayDatos = true;
            if (mov.tipo === 'ingreso') {
                ingresosData[idx] += mov.monto;
            } else {
                gastosData[idx] += mov.monto;
            }
        }
    });

    if (!hayDatos) {
        if (chartEvolucionInstance) chartEvolucionInstance.destroy();
        chartEvolucionCanvas.style.display = 'none';
        if (chartEvolucionEmptyMsg) chartEvolucionEmptyMsg.style.display = 'block';
        return;
    }

    chartEvolucionCanvas.style.display = 'block';
    if (chartEvolucionEmptyMsg) chartEvolucionEmptyMsg.style.display = 'none';

    if (chartEvolucionInstance) chartEvolucionInstance.destroy();

    chartEvolucionInstance = new Chart(chartEvolucionCanvas, {
        type: 'bar',
        data: {
            labels: mesesLabels,
            datasets: [
                {
                    label: 'Ingresos',
                    data: ingresosData,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Gastos',
                    data: gastosData,
                    backgroundColor: '#ef4444',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#a1a1aa', font: { size: 10 } }
                },
                y: {
                    grid: { color: '#27272a' },
                    ticks: {
                        color: '#a1a1aa',
                        font: { size: 10 },
                        callback: function(value) {
                            return '$' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#f4f4f5', font: { size: 11 }, boxWidth: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatearDinero(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// 14. MODAL MOVIMIENTO (ALTA Y EDICIÓN)
// ==========================================
function setModalType(tipo) {
    selectedType = tipo;
    if (tipo === 'gasto') {
        switchGasto.classList.add('active');
        switchIngreso.classList.remove('active');
        if (metodoInput.value === 'Crédito' && !editIdInput.value) {
            installmentsRow.style.display = 'block';
        }
    } else {
        switchIngreso.classList.add('active');
        switchGasto.classList.remove('active');
        installmentsRow.style.display = 'none';
    }
}

switchGasto.addEventListener('click', () => setModalType('gasto'));
switchIngreso.addEventListener('click', () => setModalType('ingreso'));

function setDefaultDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    fechaInput.value = `${yyyy}-${mm}-${dd}`;
}

btnOpenModal.addEventListener('click', () => {
    form.reset();
    setDefaultDate();
    setModalType('gasto');
    editIdInput.value = '';
    modalTitle.textContent = 'Nuevo Movimiento';
    btnSaveMovement.textContent = 'Guardar Movimiento';
    installmentsRow.style.display = 'none';
    currentTicketBase64 = null;
    ticketPreviewBox.style.display = 'none';
    labelTicketStatus.textContent = 'Subir foto';
    cuotaEstimada.textContent = '';
    modalBackdrop.classList.add('open');
    setTimeout(() => montoInput.focus(), 150);
});

// Función para abrir modal en Modo Edición
function editarMovimiento(id) {
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;

    form.reset();
    editIdInput.value = mov.id;
    modalTitle.textContent = 'Editar Movimiento';
    btnSaveMovement.textContent = 'Guardar Cambios';

    setModalType(mov.tipo);
    montoInput.value = mov.monto;
    descripcionInput.value = mov.descripcion;
    categoriaInput.value = mov.categoria;
    metodoInput.value = mov.metodo || 'Efectivo';
    fechaInput.value = mov.fecha || '';

    // En edición no permitimos alterar el número de cuotas (para no corromper la proyección)
    installmentsRow.style.display = 'none';

    if (mov.ticket) {
        currentTicketBase64 = mov.ticket;
        ticketPreviewImg.src = mov.ticket;
        ticketPreviewBox.style.display = 'flex';
        labelTicketStatus.textContent = 'Ticket cargado ✓';
    } else {
        currentTicketBase64 = null;
        ticketPreviewBox.style.display = 'none';
        labelTicketStatus.textContent = 'Subir foto';
    }

    modalBackdrop.classList.add('open');
    setTimeout(() => montoInput.focus(), 150);
}

btnCloseModal.addEventListener('click', () => modalBackdrop.classList.remove('open'));
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
});

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const montoCalculado = evaluarMontoMatematico(montoInput.value);
    if (isNaN(montoCalculado) || montoCalculado <= 0) {
        mostrarToast('Ingresá un monto válido (ej: 2500 o 1500+1000).', 'error');
        return;
    }

    const fechaSeleccionada = fechaInput.value;
    const esEdicion = Boolean(editIdInput.value);

    if (esEdicion) {
        // ACTUALIZAR MOVIMIENTO EXISTENTE
        const idAEditar = parseInt(editIdInput.value, 10);
        const index = movimientos.findIndex(m => m.id === idAEditar);

        if (index !== -1) {
            movimientos[index].monto = montoCalculado;
            movimientos[index].descripcion = descripcionInput.value.trim();
            movimientos[index].tipo = selectedType;
            movimientos[index].categoria = categoriaInput.value;
            movimientos[index].metodo = metodoInput.value;
            movimientos[index].fecha = fechaSeleccionada;
            movimientos[index].ticket = currentTicketBase64;

            guardarEnMemoria();
            mostrarToast('Movimiento actualizado con éxito.', 'success');
        }
    } else {
        // CREAR NUEVO MOVIMIENTO
        const numCuotas = (selectedType === 'gasto' && metodoInput.value === 'Crédito') 
            ? parseInt(cuotasSelect.value, 10) 
            : 1;

        if (numCuotas > 1) {
            const grupoCuotaId = Date.now();
            const montoPorCuota = Math.round((montoCalculado / numCuotas) * 100) / 100;
            const [baseY, baseM, baseD] = fechaSeleccionada.split('-').map(Number);

            for (let i = 0; i < numCuotas; i++) {
                const cuotaDate = new Date(baseY, (baseM - 1) + i, baseD);
                const cY = cuotaDate.getFullYear();
                const cM = String(cuotaDate.getMonth() + 1).padStart(2, '0');
                const cD = String(cuotaDate.getDate()).padStart(2, '0');
                const cuotaFechaStr = `${cY}-${cM}-${cD}`;

                movimientos.push({
                    id: Date.now() + i,
                    grupoCuotaId: grupoCuotaId,
                    descripcion: descripcionInput.value.trim(),
                    monto: montoPorCuota,
                    tipo: 'gasto',
                    categoria: categoriaInput.value,
                    metodo: 'Crédito',
                    fecha: cuotaFechaStr,
                    cuotaActual: i + 1,
                    cuotasTotales: numCuotas,
                    ticket: (i === 0) ? currentTicketBase64 : null
                });
            }
            mostrarToast(`Compra en ${numCuotas} cuotas agendada con éxito.`, 'success');
        } else {
            movimientos.push({
                id: Date.now(),
                descripcion: descripcionInput.value.trim(),
                monto: montoCalculado,
                tipo: selectedType,
                categoria: categoriaInput.value,
                metodo: metodoInput.value,
                fecha: fechaSeleccionada,
                cuotaActual: 1,
                cuotasTotales: 1,
                ticket: currentTicketBase64
            });
            mostrarToast('Movimiento agregado con éxito.', 'success');
        }

        guardarEnMemoria();
    }

    if (fechaSeleccionada) {
        const [y, m] = fechaSeleccionada.split('-');
        currentYear = parseInt(y, 10);
        currentMonth = parseInt(m, 10) - 1;
    }

    modalBackdrop.classList.remove('open');
    actualizarPantalla();
});

// Eliminación inteligente con soporte para grupo de cuotas
function eliminarMovimiento(id) {
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;

    if (mov.cuotasTotales > 1 && mov.grupoCuotaId) {
        const borrarTodas = confirm(`Este gasto forma parte de una compra en ${mov.cuotasTotales} cuotas.\n\n¿Querés eliminar TODAS las cuotas de esta compra?\n(Aceptar = Borrar todas las cuotas | Cancelar = Borrar únicamente la de este mes)`);

        if (borrarTodas) {
            movimientos = movimientos.filter(m => m.grupoCuotaId !== mov.grupoCuotaId);
            mostrarToast('Todas las cuotas de la compra fueron eliminadas.', 'info');
        } else {
            movimientos = movimientos.filter(m => m.id !== id);
            mostrarToast('Se eliminó la cuota de este mes.', 'info');
        }
    } else {
        if (confirm('¿Eliminar este movimiento?')) {
            movimientos = movimientos.filter(m => m.id !== id);
            mostrarToast('Movimiento eliminado.', 'info');
        } else {
            return;
        }
    }

    guardarEnMemoria();
    actualizarPantalla();
}

// ==========================================
// 15. GESTIÓN DE PESTAÑAS
// ==========================================
function switchTab(activeBtn, activePanel) {
    [tabBtnHistory, tabBtnCharts, tabBtnGoals, tabBtnFriends].forEach(b => b.classList.remove('active'));
    [viewHistory, viewCharts, viewGoals, viewFriends].forEach(p => p.classList.remove('active'));
    activeBtn.classList.add('active');
    activePanel.classList.add('active');
}

tabBtnHistory.addEventListener('click', () => switchTab(tabBtnHistory, viewHistory));
tabBtnCharts.addEventListener('click', () => {
    switchTab(tabBtnCharts, viewCharts);
    if (chartInstance) chartInstance.resize();
    if (chartEvolucionInstance) chartEvolucionInstance.resize();
});
tabBtnGoals.addEventListener('click', () => {
    switchTab(tabBtnGoals, viewGoals);
    renderMetas();
});
tabBtnFriends.addEventListener('click', () => {
    switchTab(tabBtnFriends, viewFriends);
    renderDeudas();
    renderSplitView();
});

// Sub-pestañas Amigos
subtabDebts.addEventListener('click', () => {
    subtabDebts.classList.add('active');
    subtabSplit.classList.remove('active');
    subviewDebts.classList.add('active');
    subviewSplit.classList.remove('active');
});

subtabSplit.addEventListener('click', () => {
    subtabSplit.classList.add('active');
    subtabDebts.classList.remove('active');
    subviewSplit.classList.add('active');
    subviewDebts.classList.remove('active');
});

// ==========================================
// 16. CONTROL DE DEUDAS (ME DEBEN)
// ==========================================
btnNewDebt.addEventListener('click', () => {
    debtForm.reset();
    debtModal.classList.add('open');
    setTimeout(() => debtFriendName.focus(), 150);
});

btnCloseDebt.addEventListener('click', () => debtModal.classList.remove('open'));
debtModal.addEventListener('click', (e) => {
    if (e.target === debtModal) debtModal.classList.remove('open');
});

debtForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amigo = debtFriendName.value.trim();
    const monto = parseFloat(debtAmount.value);
    const concepto = debtConcept.value.trim();

    if (!amigo || isNaN(monto) || monto <= 0) return;

    const fechaHoy = new Date().toISOString().split('T')[0];

    deudasAmigos.push({
        id: Date.now(),
        amigo,
        monto,
        pagado: 0,
        concepto,
        fecha: fechaHoy
    });

    guardarEnMemoria();
    debtModal.classList.remove('open');
    renderDeudas();
    mostrarToast(`Deuda de ${amigo} anotada correctamente.`);
});

function renderDeudas() {
    debtsList.innerHTML = '';
    let totalPendiente = 0;

    if (deudasAmigos.length === 0) {
        debtsList.innerHTML = `<p style="text-align:center; color:#71717a; padding: 24px 0; font-size: 0.88rem;">No tenés deudas registradas. ¡Tocá "+ Anotar Deuda" cuando le prestes a un amigo!</p>`;
        debtsTotalPending.textContent = formatearDinero(0);
        return;
    }

    deudasAmigos.slice().reverse().forEach(debt => {
        const falta = Math.max(0, debt.monto - (debt.pagado || 0));
        totalPendiente += falta;
        const estaSaldado = falta === 0;

        const div = document.createElement('div');
        div.className = `debt-card ${estaSaldado ? 'paid' : ''}`;
        div.innerHTML = `
            <div class="debt-card-top">
                <div>
                    <span class="debt-friend-name">👤 ${escaparHTML(debt.amigo)}</span>
                    <span class="debt-concept"> • ${escaparHTML(debt.concepto)}</span>
                </div>
                <button class="btn-delete" onclick="eliminarDeuda(${debt.id})" title="Eliminar deuda">✕</button>
            </div>
            <div class="debt-amounts-row">
                <span>Total: <strong>${formatearDinero(debt.monto)}</strong></span>
                <span>Pagó: <strong style="color:var(--green);">${formatearDinero(debt.pagado || 0)}</strong></span>
                <span class="debt-pending">${estaSaldado ? '✓ SALDADO' : 'Falta: ' + formatearDinero(falta)}</span>
            </div>
            ${!estaSaldado ? `
            <div class="debt-actions">
                <button class="btn-sm-primary" onclick="abrirRegistrarPago(${debt.id})">💰 Registrar Cobro / Pago</button>
            </div>
            ` : ''}
        `;
        debtsList.appendChild(div);
    });

    debtsTotalPending.textContent = formatearDinero(totalPendiente);
}

function abrirRegistrarPago(id) {
    const debt = deudasAmigos.find(d => d.id === id);
    if (!debt) return;

    const falta = Math.max(0, debt.monto - (debt.pagado || 0));
    paymentDebtId.value = id;
    paymentDebtSummary.textContent = `${debt.amigo} te debe ${formatearDinero(falta)} por "${debt.concepto}".`;
    paymentAmount.value = falta;
    paymentAmount.max = falta;
    debtPaymentModal.classList.add('open');
    setTimeout(() => paymentAmount.focus(), 150);
}

btnClosePayment.addEventListener('click', () => debtPaymentModal.classList.remove('open'));
debtPaymentModal.addEventListener('click', (e) => {
    if (e.target === debtPaymentModal) debtPaymentModal.classList.remove('open');
});

debtPaymentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(paymentDebtId.value, 10);
    const abono = parseFloat(paymentAmount.value);
    if (isNaN(abono) || abono <= 0) return;

    const debt = deudasAmigos.find(d => d.id === id);
    if (debt) {
        debt.pagado = (debt.pagado || 0) + abono;

        if (paymentAddToBalance.checked) {
            const hoy = new Date();
            const yyyy = hoy.getFullYear();
            const mm = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd = String(hoy.getDate()).padStart(2, '0');

            movimientos.push({
                id: Date.now(),
                descripcion: `Cobro deuda: ${debt.amigo} (${debt.concepto})`,
                monto: abono,
                tipo: 'ingreso',
                categoria: 'Otros',
                metodo: 'Transferencia',
                fecha: `${yyyy}-${mm}-${dd}`,
                cuotaActual: 1,
                cuotasTotales: 1,
                ticket: null
            });
            actualizarPantalla();
        }

        guardarEnMemoria();
        renderDeudas();
        debtPaymentModal.classList.remove('open');
        mostrarToast(`¡Se registró el cobro de ${formatearDinero(abono)} de ${debt.amigo}!`, 'success');
    }
});

function eliminarDeuda(id) {
    if (confirm('¿Eliminar este registro de deuda?')) {
        deudasAmigos = deudasAmigos.filter(d => d.id !== id);
        guardarEnMemoria();
        renderDeudas();
        mostrarToast('Deuda eliminada.', 'info');
    }
}

// ==========================================
// 17. DIVIDIR SALIDA GRUPAL Y ENLACE A DEUDAS
// ==========================================
btnAddSplitPerson.addEventListener('click', () => {
    const nombre = splitNameInput.value.trim();
    const puso = parseFloat(splitPaidInput.value) || 0;

    if (!nombre) {
        mostrarToast('Ingresá el nombre de tu amigo/a.', 'warning');
        return;
    }

    splitParticipantes.push({
        id: Date.now(),
        nombre,
        puso: Math.max(0, puso)
    });

    splitNameInput.value = '';
    splitPaidInput.value = '';
    splitNameInput.focus();

    guardarEnMemoria();
    renderSplitView();
    mostrarToast(`${nombre} agregado a la salida.`);
});

btnResetSplit.addEventListener('click', () => {
    if (splitParticipantes.length === 0) return;
    if (confirm('¿Reiniciar la calculadora de la salida grupal?')) {
        splitParticipantes = [];
        guardarEnMemoria();
        renderSplitView();
        mostrarToast('Calculadora de salida reiniciada.', 'info');
    }
});

function eliminarPersonaSplit(id) {
    splitParticipantes = splitParticipantes.filter(p => p.id !== id);
    guardarEnMemoria();
    renderSplitView();
}

// Función directa para pasar una liquidación de la salida a "Me Deben"
function anotarDeudaDesdeSalida(amigo, monto) {
    deudasAmigos.push({
        id: Date.now(),
        amigo: amigo,
        monto: monto,
        pagado: 0,
        concepto: 'Salida grupal',
        fecha: new Date().toISOString().split('T')[0]
    });

    guardarEnMemoria();
    renderDeudas();

    // Llevar automáticamente al usuario a la subpestaña "Me Deben"
    subtabDebts.click();
    mostrarToast(`¡Deuda de ${amigo} por ${formatearDinero(monto)} anotada en "Me Deben"!`, 'success');
}

function renderSplitView() {
    splitPeopleList.innerHTML = '';

    if (splitParticipantes.length === 0) {
        splitPeopleList.innerHTML = `<li style="text-align:center; color:#71717a; padding:16px 0; font-size:0.85rem;">Agregá quiénes salieron y cuánto puso cada uno para repartir parejo.</li>`;
        splitTotalsBox.style.display = 'none';
        splitSettlementBox.style.display = 'none';
        return;
    }

    let sumaTotal = 0;
    splitParticipantes.forEach(p => {
        sumaTotal += p.puso;
        const li = document.createElement('li');
        li.className = 'split-person-item';
        li.innerHTML = `
            <span>👤 <strong>${escaparHTML(p.nombre)}</strong></span>
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#22c55e; font-weight:700;">puso ${formatearDinero(p.puso)}</span>
                <button class="btn-delete" onclick="eliminarPersonaSplit(${p.id})">✕</button>
            </div>
        `;
        splitPeopleList.appendChild(li);
    });

    const cantidadPersonas = splitParticipantes.length;
    const cuotaPorPersona = sumaTotal / cantidadPersonas;

    splitTotalsBox.style.display = 'flex';
    splitTotalSum.textContent = formatearDinero(sumaTotal);
    splitFairShare.textContent = `${formatearDinero(cuotaPorPersona)} por persona`;

    const acreedores = [];
    const deudores = [];

    splitParticipantes.forEach(p => {
        const balance = Math.round((p.puso - cuotaPorPersona) * 100) / 100;
        if (balance > 0.01) {
            acreedores.push({ nombre: p.nombre, monto: balance });
        } else if (balance < -0.01) {
            deudores.push({ nombre: p.nombre, monto: -balance });
        }
    });

    splitSettlementList.innerHTML = '';
    const transferencias = [];

    let i = 0;
    let j = 0;
    while (i < deudores.length && j < acreedores.length) {
        const montoTransferir = Math.min(deudores[i].monto, acreedores[j].monto);
        transferencias.push({
            de: deudores[i].nombre,
            para: acreedores[j].nombre,
            monto: montoTransferir
        });

        deudores[i].monto -= montoTransferir;
        acreedores[j].monto -= montoTransferir;

        if (deudores[i].monto < 0.01) i++;
        if (acreedores[j].monto < 0.01) j++;
    }

    if (transferencias.length === 0) {
        splitSettlementBox.style.display = 'block';
        splitSettlementList.innerHTML = `<li class="split-settlement-item" style="color:#22c55e;">🎉 ¡Todos pusieron exactamente lo mismo! Las cuentas están saldadas.</li>`;
        btnCopySplit.style.display = 'none';
    } else {
        splitSettlementBox.style.display = 'block';
        btnCopySplit.style.display = 'block';

        transferencias.forEach(t => {
            const li = document.createElement('li');
            li.className = 'split-settlement-item';
            li.innerHTML = `
                <div>
                    <strong>${escaparHTML(t.de)}</strong> le pasa a <strong>${escaparHTML(t.para)}</strong>
                </div>
                <div class="split-settlement-actions">
                    <span style="color:var(--yellow); font-weight:700;">${formatearDinero(t.monto)}</span>
                    <button type="button" class="btn-add-debt-from-split" onclick="anotarDeudaDesdeSalida('${escaparHTML(t.de)}', ${t.monto})" title="Anotar esta deuda en 'Me Deben'">
                        ➕ Anotar deuda
                    </button>
                </div>
            `;
            splitSettlementList.appendChild(li);
        });

        btnCopySplit.onclick = () => {
            let msg = `🍻 *CUENTAS DE LA SALIDA*\n`;
            msg += `• Gasto Total: ${formatearDinero(sumaTotal)}\n`;
            msg += `• Por persona (${cantidadPersonas}): ${formatearDinero(cuotaPorPersona)}\n\n`;
            msg += `*¿Quién le paga a quién?*\n`;
            transferencias.forEach(t => {
                msg += `👉 ${t.de} le pasa a ${t.para}: ${formatearDinero(t.monto)}\n`;
            });
            msg += `\n_Calculado con Edgar Finanzas PRO 💎_`;

            navigator.clipboard.writeText(msg).then(() => {
                mostrarToast('¡Liquidación copiada al portapapeles para WhatsApp!', 'success');
            }).catch(() => {
                prompt('Copiá el texto para WhatsApp:', msg);
            });
        };
    }
}

// Filtros de búsqueda en tiempo real
busquedaInput.addEventListener('input', actualizarPantalla);
filtroCategoria.addEventListener('change', actualizarPantalla);
filtroMetodo.addEventListener('change', actualizarPantalla);

// ==========================================
// 18. EXPORTAR A EXCEL (CSV) Y RESPALDO
// ==========================================
btnExportCsv.addEventListener('click', () => {
    if (movimientos.length === 0) {
        mostrarToast('No tenés movimientos para exportar.', 'warning');
        return;
    }

    let csv = '\uFEFFFecha;Tipo;Descripcion;Categoria;Metodo;Cuotas;Monto\n';
    movimientos.forEach(m => {
        const catObj = categorias.find(c => c.id === m.categoria);
        const catName = catObj ? catObj.nombre : (m.categoria || '');
        const cuotaStr = (m.cuotasTotales > 1) ? `${m.cuotaActual}/${m.cuotasTotales}` : '1';
        csv += `"${m.fecha || ''}";"${m.tipo}";"${escaparHTML(m.descripcion)}";"${catName}";"${m.metodo || ''}";"${cuotaStr}";"${m.monto}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas_backup_${getPeriodKey()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    mostrarToast('Reporte CSV descargado con éxito.');
});

// Modal Ajustes y Respaldo
btnBackup.addEventListener('click', () => {
    checkPinLock();
    actualizarIndicadorAlmacenamiento();
    backupModal.classList.add('open');
});
btnCloseBackup.addEventListener('click', () => backupModal.classList.remove('open'));
backupModal.addEventListener('click', (e) => {
    if (e.target === backupModal) backupModal.classList.remove('open');
});

btnOpenCategories.addEventListener('click', () => {
    backupModal.classList.remove('open');
    categoriesModal.classList.add('open');
});
btnCloseCategories.addEventListener('click', () => categoriesModal.classList.remove('open'));
categoriesModal.addEventListener('click', (e) => {
    if (e.target === categoriesModal) categoriesModal.classList.remove('open');
});

// Descargar Copia JSON
btnDownloadBackup.addEventListener('click', () => {
    const data = {
        movimientos,
        presupuestos,
        metasAhorro,
        deudasAmigos,
        splitParticipantes,
        gastosFijos,
        categorias,
        usarSaldoAcumulado,
        fechaExportacion: new Date().toISOString(),
        version: '6.0'
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `respaldo_finanzas_v6_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    mostrarToast('Copia de respaldo JSON descargada.');
});

// Restaurar Copia JSON
fileRestore.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const parsed = JSON.parse(event.target.result);
            if (Array.isArray(parsed.movimientos)) {
                movimientos = parsed.movimientos;
                presupuestos = parsed.presupuestos || {};
                metasAhorro = parsed.metasAhorro || [];
                deudasAmigos = parsed.deudasAmigos || [];
                splitParticipantes = parsed.splitParticipantes || [];
                gastosFijos = parsed.gastosFijos || [];
                if (Array.isArray(parsed.categorias)) categorias = parsed.categorias;
                if (typeof parsed.usarSaldoAcumulado === 'boolean') {
                    usarSaldoAcumulado = parsed.usarSaldoAcumulado;
                    if (switchSaldoAcumulado) switchSaldoAcumulado.checked = usarSaldoAcumulado;
                }
                guardarEnMemoria();
                actualizarSelectoresCategorias();
                actualizarPantalla();
                renderDeudas();
                renderSplitView();
                backupModal.classList.remove('open');
                mostrarToast('¡Copia de respaldo restaurada con éxito!', 'success');
            } else {
                mostrarToast('El archivo no tiene un formato válido.', 'error');
            }
        } catch {
            mostrarToast('Error al leer el archivo de respaldo.', 'error');
        }
    };
    reader.readAsText(file);
});

// Borrar Todo
btnClearAll.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que querés borrar TODOS tus datos?')) {
        movimientos = [];
        presupuestos = {};
        metasAhorro = [];
        deudasAmigos = [];
        splitParticipantes = [];
        gastosFijos = [];
        gastosFijosCargados = {};
        guardarEnMemoria();
        actualizarPantalla();
        renderMetas();
        renderDeudas();
        renderSplitView();
        backupModal.classList.remove('open');
        mostrarToast('Se borraron todos los datos.', 'info');
    }
});

// ==========================================
// 19. ACERCA DE LA APP Y ACTUALIZACIONES
// ==========================================
const btnOpenAbout = document.getElementById('btn-open-about');
const aboutModal = document.getElementById('about-modal');
const btnCloseAbout = document.getElementById('btn-close-about');
const btnForceUpdate = document.getElementById('btn-force-update');
const btnCheckUpdates = document.getElementById('btn-check-updates');

btnOpenAbout.addEventListener('click', () => {
    backupModal.classList.remove('open');
    aboutModal.classList.add('open');
});

btnCloseAbout.addEventListener('click', () => aboutModal.classList.remove('open'));
aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.remove('open');
});

async function forzarActualizacion() {
    if (confirm('Se limpiará la memoria caché de la app para descargar la última versión de GitHub. ¿Continuar?')) {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let reg of registrations) {
                await reg.unregister();
            }
        }
        window.location.reload(true);
    }
}

btnForceUpdate.addEventListener('click', forzarActualizacion);
btnCheckUpdates.addEventListener('click', forzarActualizacion);

// ==========================================
// 20. INICIALIZACIÓN
// ==========================================
actualizarSelectoresCategorias();
actualizarPantalla();
checkPinLock();
actualizarIndicadorAlmacenamiento();