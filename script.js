const SUPABASE_URL = 'https://gvxysxktqexuhrfkikjv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_COVBM_Uc-UaQsywiDVtc9g_46fqORa1';
const SUPABASE_API_URL = `${SUPABASE_URL}/functions/v1/julieta-api`;
const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const state = { view: 'dashboard', data: null, search: '', filter: 'all', adminName: getSavedAdminName() };
const page = document.querySelector('#page-content');
const modalLayer = document.querySelector('#modal-layer');
const names = { dashboard: 'Ringkasan', receivables: 'Piutang', deposits: 'Smart deposit', events: 'Event', clients: 'Klien' };

function useData() { return state.data; }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function getSavedAdminName() { try { return localStorage.getItem('julieta-admin-name')?.trim() || 'Julieta'; } catch { return 'Julieta'; } }
function greetingByTime(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}
function money(value) { return IDR.format(Number(value) || 0).replace(/\u00a0/g, ' '); }
function parseDate(value) { return new Date(`${String(value).slice(0, 10)}T12:00:00`); }
function dateShort(value) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(parseDate(value)); }
function dateLong(value) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(value)); }
function clientFor(event) { return useData().clients.find(client => client.id === event?.client_id); }
function eventFor(receivable) { return useData().events.find(event => event.id === receivable?.event_id); }
function receivableFor(deposit) { return useData().receivables.find(receivable => receivable.id === deposit?.receivable_id); }
function statusClass(status) { return ({ Lunas: 'paid', Dibayar: 'paid', 'Dibayar sebagian': 'paid', Aktif: 'paid', Selesai: 'paid', Terlambat: 'overdue', Terjadwal: 'scheduled', 'Menunggu bayaran': 'scheduled', Persiapan: 'scheduled', Nonaktif: 'neutral', Dibatalkan: 'neutral', Draft: 'neutral' })[status] || ''; }
function badge(status) { return `<span class="status ${statusClass(status)}">${escapeHtml(status)}</span>`; }
function statusSelect(table, id, status, values) { return `<select class="inline-status" data-table="${table}" data-id="${escapeHtml(id)}" data-current="${escapeHtml(status)}">${values.map(value => `<option value="${value}" ${status === value ? 'selected' : ''}>${value}</option>`).join('')}</select>`; }
function deleteButton(table, id) { return `<button class="button small danger" data-action="delete-row" data-table="${table}" data-id="${escapeHtml(id)}" title="Hapus data">Hapus</button>`; }
function initials(name = '') { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function publicId(prefix, id) { return `${prefix}-${String(id || '').replaceAll('-', '').slice(0, 8).toUpperCase()}`; }
function sortByDate(items, key) { return [...items].sort((a, b) => parseDate(a[key]) - parseDate(b[key])); }
function depositPaid(item) { return item.status === 'Dibayar'; }
function paidTotal() { return useData().deposits.filter(depositPaid).reduce((sum, item) => sum + Number(item.amount), 0); }
function openCount() { return useData().receivables.filter(item => item.status !== 'Lunas' && item.status !== 'Draft'); }
function outstandingTotal() { return openCount().reduce((sum, item) => sum + Number(item.remaining_amount ?? item.total_amount), 0); }
function setView(view) { state.view = view; state.search = ''; state.filter = 'all'; document.querySelector('#current-section').textContent = names[view]; document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === view)); document.querySelector('#sidebar').classList.remove('open'); render(); }
function heading(eyebrow, title, description, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`; }
function actionButton(label, action, primary = false, icon = '+') { return `<button class="button ${primary ? 'primary' : ''}" data-action="${action}"><span>${icon}</span>${label}</button>`; }
function statCard(title, value, note, icon, tone = '') { return `<article class="stat-card"><div class="stat-top"><span>${title}</span><span class="stat-icon ${tone}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-meta">${note}</div></article>`; }
function eventRow(event, showStatus = false) { const client = clientFor(event); const date = parseDate(event.event_date); const month = new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(date).replace('.', ''); return `<div class="event-row"><div class="event-date"><strong>${date.getDate()}</strong><small>${month}</small></div><div class="event-info"><strong>${escapeHtml(event.name)}</strong><small>${escapeHtml(publicId('EVT', event.id))} · ${escapeHtml(client?.name || 'Klien')}${event.venue ? ` · ${escapeHtml(event.venue)}` : ''}</small></div>${showStatus ? badge(event.status) : `<span class="event-value">${money(event.budget)}</span>`}</div>`; }
function depositRow(deposit) { const event = eventFor(receivableFor(deposit)); return `<div class="deposit-row"><div><strong>${escapeHtml(deposit.installment_type || deposit.label)}</strong><small>${escapeHtml(publicId('DEP', deposit.id))} · ${escapeHtml(event?.name || 'Event')} · ${dateShort(deposit.due_date)}</small></div><div class="row-amount"><strong>${money(deposit.amount)}</strong><small>${badge(deposit.status)}</small></div></div>`; }
function chartMarkup() {
  const totals = Array.from({ length: 6 }, (_, monthIndex) => {
    const month = 4 + monthIndex;
    const year = 2026;
    return useData().deposits.filter(deposit => depositPaid(deposit) && deposit.paid_at && new Date(deposit.paid_at).getMonth() === month && new Date(deposit.paid_at).getFullYear() === year).reduce((sum, deposit) => sum + Number(deposit.amount), 0) / 1000000;
  });
  const max = Math.max(45, ...totals) * 1.2;
  const points = totals.map((value, index) => `${54 + index * 66},${150 - value / max * 118}`).join(' ');
  const polygon = `54,150 ${points} 384,150`;
  const labels = ['Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt'];
  return `<svg viewBox="0 0 415 190" role="img" aria-label="Grafik deposit lunas Mei hingga Oktober 2026"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#cdb9df" stop-opacity=".55"/><stop offset="100%" stop-color="#cdb9df" stop-opacity=".02"/></linearGradient></defs><line class="chart-grid-line" x1="48" y1="30" x2="400" y2="30"/><line class="chart-grid-line" x1="48" y1="70" x2="400" y2="70"/><line class="chart-grid-line" x1="48" y1="110" x2="400" y2="110"/><line class="chart-grid-line" x1="48" y1="150" x2="400" y2="150"/><text class="chart-label" x="4" y="33">45 jt</text><text class="chart-label" x="4" y="73">30 jt</text><text class="chart-label" x="4" y="113">15 jt</text><text class="chart-label" x="24" y="153">0</text><polygon class="chart-fill" points="${polygon}"/><polyline class="chart-line" points="${points}"/>${points.split(' ').map(point => { const [x, y] = point.split(','); return `<circle class="chart-dot" cx="${x}" cy="${y}" r="3.5"/>`; }).join('')}${labels.map((label, index) => `<text class="chart-label" x="${48 + index * 66}" y="174">${label}</text>`).join('')}</svg>`;
}
function dashboard() {
  const data = useData();
  const deposits = data.deposits;
  const paid = paidTotal();
  const open = outstandingTotal();
  const late = deposits.filter(item => item.status === 'Terlambat');
  const events = sortByDate(data.events.filter(item => item.status !== 'Selesai' && item.status !== 'Dibatalkan' && parseDate(item.event_date) >= new Date(new Date().toDateString())), 'event_date').slice(0, 4);
  const recentReceivables = [...data.receivables].sort((a, b) => parseDate(b.issued_at) - parseDate(a.issued_at)).slice(0, 4);
  const maxOutstanding = Math.max(open + paid, 1);
  const reminders = [...late, ...sortByDate(deposits.filter(item => item.status === 'Terjadwal' || item.status === 'Menunggu bayaran'), 'due_date')].slice(0, 3);
  const today = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toLocaleUpperCase('id-ID');
  return `${heading(today, `${greetingByTime()}, ${escapeHtml(state.adminName)}! ✿`, 'Ruang kendali kecil untuk arus kas dan momen-momen besar.', `${actionButton('Catat pembayaran', 'payment', false, '↗')}${actionButton('Buat invoice', 'receivable', true)}`)}
    <div class="stats-grid">${statCard('Total piutang', money(open), `${openCount().length} invoice belum lunas`, '▤')}${statCard('Sudah diterima', money(paid), '<span class="positive">Terverifikasi</span> · semua event', '↗', 'green')}${statCard('Deposit menunggu', `${deposits.filter(item => !depositPaid(item) && item.status !== 'Dibatalkan').length} termin`, `${late.length} membutuhkan tindak lanjut`, '◷', 'rose')}${statCard('Event mendatang', `${data.events.filter(event => event.status !== 'Selesai' && event.status !== 'Dibatalkan').length} event`, 'Dalam kalender studio', '✳', 'gold')}</div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>Arus deposit</h2><p>Pembayaran yang sudah diterima · enam bulan terakhir</p></div><button class="text-link" data-view="deposits">Lihat detail →</button></div><div class="chart-wrap">${chartMarkup()}</div><div class="chart-legend"><span><i class="legend-mark"></i>Deposit diterima</span><span><i class="legend-mark light"></i>Periode berjalan</span></div></section>
    <section class="panel deposit-panel"><div class="panel-header"><div><h2>Komposisi piutang</h2><p>Posisi seluruh termin pembayaran</p></div><span class="stat-icon">◌</span></div><div class="deposit-amount">${money(open)}</div><div class="deposit-sub">${money(paid)} sudah dibayarkan dari total invoice</div><div class="progress-track"><span style="width:${Math.min(100, paid / maxOutstanding * 100)}%"></span></div><div class="deposit-foot"><span>${Math.round(paid / maxOutstanding * 100)}% diterima</span><span>${Math.round(open / maxOutstanding * 100)}% tersisa</span></div><div class="deposit-list">${reminders.map(depositRow).join('') || '<div class="table-empty">Belum ada termin pembayaran.</div>'}</div></section></div>
    <div class="lower-grid"><section class="panel"><div class="panel-header"><div><h2>Invoice terbaru</h2><p>Piutang yang baru dicatat</p></div><button class="text-link" data-view="receivables">Semua invoice →</button></div>${recentReceivables.length ? `<div class="table-wrap"><table><thead><tr><th>NO. INVOICE</th><th>EVENT & KLIEN</th><th>SISA</th><th>STATUS</th></tr></thead><tbody>${recentReceivables.map(item => { const event = eventFor(item); return `<tr><td><strong>${escapeHtml(item.invoice_number)}</strong></td><td>${escapeHtml(event?.name || 'Event')}<br><span style="color:#97919d">${escapeHtml(clientFor(event)?.name || '')}</span></td><td>${money(item.remaining_amount ?? item.total_amount)}</td><td>${badge(item.status)}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="table-empty">Belum ada invoice.</div>'}</section>
    <section class="panel"><div class="panel-header"><div><h2>Agenda mendatang</h2><p>Event di kalender Julieta Suite</p></div><button class="text-link" data-view="events">Kalender →</button></div><div class="event-list">${events.map(event => eventRow(event, true)).join('') || '<div class="table-empty">Belum ada event mendatang.</div>'}</div></section></div>`;
}
function toolbar(filters = []) { return `<div class="toolbar"><label class="search-box"><span>⌕</span><input id="table-search" type="search" placeholder="Cari data..." value="${escapeHtml(state.search)}"></label>${filters.length ? `<select id="table-filter" class="filter-select"><option value="all">Semua status</option>${filters.map(filter => `<option ${state.filter === filter ? 'selected' : ''} value="${filter}">${filter}</option>`).join('')}</select>` : ''}</div>`; }
function tablePanel(headers, rows) { return `<section class="panel"><div class="table-wrap"><table><thead><tr>${headers.map(item => `<th>${item}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td class="table-empty" colspan="${headers.length}">Tidak ada data yang cocok.</td></tr>`}</tbody></table></div></section>`; }
function filtered(items, fields, statusField) { let result = items; if (state.search) { const search = state.search.toLocaleLowerCase('id'); result = result.filter(item => fields(item).some(value => String(value || '').toLocaleLowerCase('id').includes(search))); } if (state.filter !== 'all' && statusField) result = result.filter(item => statusField(item) === state.filter); return result; }
function clientsPage() {
  const data = useData();
  const clients = filtered(data.clients, client => [client.name, client.company_name, client.email, client.phone, client.bank_name, ...data.events.filter(event => event.client_id === client.id).map(event => event.name)], client => client.status);
  const rows = clients.map(client => {
    const history = sortByDate(data.events.filter(event => event.client_id === client.id), 'event_date');
    const bankDetails = [client.bank_name, client.bank_account_name, client.bank_account_number].filter(Boolean).join(' · ');
    return `<tr><td><strong>${escapeHtml(publicId('KLI', client.id))}</strong></td><td><div class="client-cell"><span class="client-avatar">${initials(client.name)}</span><strong>${escapeHtml(client.name)}</strong></div><small class="cell-sub">Ditambahkan ${dateLong(client.created_at)}</small></td><td>${escapeHtml(client.company_name || 'Individu')}<br><span class="cell-sub">${escapeHtml(client.email || '—')} · ${escapeHtml(client.phone || '—')}</span></td><td>${history.map(event => `<div class="history-item"><strong>${escapeHtml(event.name)}</strong> ${badge(event.status)}<small>${dateShort(event.event_date)}${event.end_date ? ` – ${dateShort(event.end_date)}` : ''}</small></div>`).join('') || '<span class="cell-sub">Belum ada event</span>'}</td><td>${statusSelect('clients', client.id, client.status, ['Aktif', 'Nonaktif', 'Selesai'])}</td><td>${escapeHtml(bankDetails || '—')}</td><td>${deleteButton('clients', client.id)}</td></tr>`;
  }).join('');
  return `${heading('DATABASE STUDIO', 'Klien', 'Profil, status, rekening pengembalian, dan riwayat event.', actionButton('Tambah klien', 'client', true))}<div class="stats-grid" style="margin-bottom:15px">${statCard('Total klien', data.clients.length, 'Kontak terdaftar', '♧')}${statCard('Aktif', data.clients.filter(client => client.status === 'Aktif').length, 'Masih memiliki kegiatan', '✳', 'green')}${statCard('Selesai', data.clients.filter(client => client.status === 'Selesai').length, 'Seluruh event selesai', '✓', 'gold')}${statCard('Nonaktif', data.clients.filter(client => client.status === 'Nonaktif').length, 'Tidak aktif saat ini', '◌', 'rose')}</div>${toolbar(['Aktif', 'Nonaktif', 'Selesai'])}${tablePanel(['ID KLIEN', 'KLIEN & DITAMBAHKAN', 'KONTAK', 'RIWAYAT EVENT', 'STATUS', 'REKENING REFUND', 'AKSI'], rows)}`;
}
function eventsPage() {
  const data = useData();
  const events = filtered(data.events, event => [event.name, event.event_type, event.venue, event.pic_name, clientFor(event)?.name, ...(event.special_needs || [])], event => event.status);
  const rows = events.map(event => `<tr><td><strong>${escapeHtml(publicId('EVT', event.id))}</strong><br><span class="cell-sub">${escapeHtml(event.name)}</span></td><td>${escapeHtml(clientFor(event)?.name || '—')}</td><td>${dateLong(event.event_date)}${event.end_date ? `<br><span class="cell-sub">s/d ${dateLong(event.end_date)}</span>` : ''}</td><td>${escapeHtml(event.venue || '—')}</td><td>${event.special_needs?.map(escapeHtml).join(', ') || '—'}</td><td>${escapeHtml(event.pic_name || '—')}</td><td>${money(event.budget)}</td><td>${statusSelect('events', event.id, event.status, ['Persiapan', 'Berlangsung', 'Selesai', 'Dibatalkan'])}</td><td>${deleteButton('events', event.id)}</td></tr>`).join('');
  return `${heading('KALENDER STUDIO', 'Event', 'Tanggal, PIC, kebutuhan khusus, dan status setiap acara.', actionButton('Tambah event', 'event', true))}<div class="stats-grid" style="margin-bottom:15px">${statCard('Seluruh event', data.events.length, 'Kontrak terdaftar', '✳')}${statCard('Persiapan', data.events.filter(event => event.status === 'Persiapan').length, 'Sedang disiapkan', '◷', 'gold')}${statCard('Berlangsung', data.events.filter(event => event.status === 'Berlangsung').length, 'Sedang berjalan', '⌕', 'rose')}${statCard('Selesai', data.events.filter(event => event.status === 'Selesai').length, 'Event terlaksana', '✓', 'green')}</div>${toolbar(['Persiapan', 'Berlangsung', 'Selesai', 'Dibatalkan'])}${tablePanel(['ID EVENT', 'NAMA EVENT', 'KLIEN', 'TANGGAL ACARA', 'VENUE', 'KEBUTUHAN KHUSUS', 'PIC', 'NILAI', 'STATUS', 'AKSI'], rows)}`;
}
function receivablesPage() {
  const data = useData();
  const items = filtered(data.receivables, item => [item.invoice_number, item.status, eventFor(item)?.name, clientFor(eventFor(item))?.name], item => item.status);
  const rows = items.map(item => { const event = eventFor(item); return `<tr><td><strong>${escapeHtml(item.invoice_number)}</strong><br><span class="cell-sub">${dateShort(item.issued_at)}</span></td><td>${escapeHtml(event?.name || '—')}<br><span class="cell-sub">${escapeHtml(clientFor(event)?.name || '')}</span></td><td>${money(item.total_amount)}</td><td>${money(item.amount_paid)}</td><td><strong>${money(item.remaining_amount)}</strong></td><td>${badge(item.status)}${item.status === 'Draft' ? `<br><button class="button small" data-action="publish-invoice" data-id="${item.id}">Terbitkan</button>` : ''}</td><td>${deleteButton('receivables', item.id)}</td></tr>`; }).join('');
  return `${heading('ARUS KAS MASUK', 'Piutang', 'Saldo tersisa dan status invoice diperbarui dari pembayaran deposit.', actionButton('Buat invoice', 'receivable', true))}<div class="stats-grid" style="margin-bottom:15px">${statCard('Total invoice', data.receivables.length, 'Semua invoice dibuat', '▤')}${statCard('Nilai invoice', money(data.receivables.reduce((sum, item) => sum + Number(item.total_amount), 0)), 'Nilai kontrak terbit', '◌', 'gold')}${statCard('Sudah diterima', money(paidTotal()), 'Dari pembayaran tercatat', '↗', 'green')}${statCard('Sisa piutang', money(outstandingTotal()), `${openCount().length} invoice belum lunas`, '◷', 'rose')}</div>${toolbar(['Draft', 'Belum dibayar', 'Dibayar sebagian', 'Lunas', 'Terlambat'])}${tablePanel(['NO. INVOICE', 'EVENT & KLIEN', 'TOTAL', 'DIBAYAR', 'SISA PIUTANG', 'STATUS', 'AKSI'], rows)}`;
}
function depositsPage() {
  const data = useData();
  const items = filtered(data.deposits, deposit => [publicId('DEP', deposit.id), deposit.installment_type, eventFor(receivableFor(deposit))?.name, receivableFor(deposit)?.invoice_number, deposit.payment_method], deposit => deposit.status);
  const rows = items.map(deposit => { const receivable = receivableFor(deposit); const event = eventFor(receivable); return `<tr><td><strong>${escapeHtml(publicId('DEP', deposit.id))}</strong><br><span class="cell-sub">${escapeHtml(deposit.installment_type)}</span></td><td>${escapeHtml(event?.name || '—')}<br><span class="cell-sub">${escapeHtml(clientFor(event)?.name || '')}</span></td><td>${dateLong(deposit.due_date)}</td><td>${money(deposit.amount)}</td><td>${escapeHtml(deposit.payment_method || '—')}</td><td>${depositPaid(deposit) ? dateLong(deposit.paid_at) : '—'}</td><td>${badge(deposit.status)}</td><td>${depositPaid(deposit) ? '—' : `<button class="button small" data-action="mark-paid" data-id="${deposit.id}">Catat pembayaran</button>`} ${deleteButton('deposits', deposit.id)}</td></tr>`; }).join('');
  const overdue = data.deposits.filter(deposit => deposit.status === 'Terlambat').length;
  const upcoming = data.deposits.filter(item => ['Terjadwal', 'Menunggu bayaran'].includes(item.status) && parseDate(item.due_date) >= parseDate(new Date().toISOString().slice(0, 10)) && parseDate(item.due_date) <= new Date(Date.now() + 7 * 86400000));
  const reminders = [...data.deposits.filter(item => item.status === 'Terlambat'), ...sortByDate(upcoming, 'due_date')].slice(0, 6);
  return `${heading('JADWAL PEMBAYARAN', 'Smart deposit', 'Pantau ID termin, metode pembayaran, dan pengingat jatuh tempo.', `${actionButton('Tambah termin', 'deposit', false)}${actionButton('Catat pembayaran', 'payment', true)}`)}<div class="stats-grid" style="margin-bottom:15px">${statCard('Deposit diterima', money(paidTotal()), 'Pembayaran tervalidasi', '↗', 'green')}${statCard('Terjadwal', data.deposits.filter(deposit => deposit.status === 'Terjadwal').length, 'Jatuh tempo lebih dari 7 hari', '◷', 'gold')}${statCard('Menunggu bayaran', data.deposits.filter(deposit => deposit.status === 'Menunggu bayaran').length, 'Jatuh tempo dalam 7 hari', '⌕', 'rose')}${statCard('Terlambat', overdue, 'Butuh tindak lanjut', '!', 'rose')}</div>${toolbar(['Terjadwal', 'Menunggu bayaran', 'Terlambat', 'Dibayar', 'Dibatalkan'])}${tablePanel(['ID DEPOSIT', 'EVENT & KLIEN', 'JATUH TEMPO', 'NILAI', 'METODE BAYAR', 'TANGGAL DIBAYAR', 'STATUS', 'AKSI'], rows)}<section class="panel" style="margin-top:15px"><div class="panel-header"><div><h2>Pengingat pembayaran</h2><p>Termin terlambat dan jatuh tempo dalam 7 hari</p></div><span class="status scheduled">${upcoming.length} segera jatuh tempo</span></div><div class="reminder-list">${reminders.map(item => { const event = eventFor(receivableFor(item)); return `<div class="reminder-item"><span class="reminder-mark">◷</span><div><strong>${escapeHtml(item.installment_type)} · ${escapeHtml(event?.name || '')}</strong><small>${item.status === 'Terlambat' ? 'Terlambat' : 'Jatuh tempo'} ${dateLong(item.due_date)} · ${money(item.amount)}</small></div></div>`; }).join('') || '<div class="table-empty">Belum ada pengingat jatuh tempo.</div>'}</div></section>`;
}
function render() {
  const views = { dashboard, receivables: receivablesPage, deposits: depositsPage, events: eventsPage, clients: clientsPage };
  page.innerHTML = views[state.view]();
  document.querySelector('#admin-name').textContent = state.adminName;
  document.querySelector('#nav-receivables').textContent = openCount().length;
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  const search = document.querySelector('#table-search');
  if (search) search.addEventListener('input', event => { state.search = event.target.value; const position = event.target.selectionStart; render(); const nextInput = document.querySelector('#table-search'); nextInput.focus(); nextInput.setSelectionRange(position, position); });
  const filter = document.querySelector('#table-filter');
  if (filter) filter.addEventListener('change', event => { state.filter = event.target.value; render(); });
  page.querySelectorAll('.inline-status').forEach(control => control.addEventListener('change', async event => {
    const select = event.currentTarget;
    select.disabled = true;
    try {
      await supabaseRequest(select.dataset.table, `id=eq.${encodeURIComponent(select.dataset.id)}`, { method: 'PATCH', body: { status: select.value } });
      state.data = await loadData();
      showToast('Status berhasil diperbarui.');
      render();
    } catch (error) {
      select.value = select.dataset.current;
      select.disabled = false;
      showToast(error.message || 'Status gagal diperbarui.');
    }
  }));
}
function options(items, valueKey, labelFn, placeholder) { return `<option value="">${placeholder}</option>${items.map(item => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(labelFn(item))}</option>`).join('')}`; }
function field(label, name, type = 'text', required = true, full = false, extra = '') { return `<div class="form-field ${full ? 'full' : ''}"><label for="field-${name}">${label}${required ? ' *' : ''}</label><input id="field-${name}" name="${name}" type="${type}" ${required ? 'required' : ''} ${extra}></div>`; }
function showModal(title, subtitle, form, submitLabel) {
  modalLayer.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-button" data-action="close-modal" aria-label="Tutup">×</button></div><form id="data-form">${form}<div class="modal-actions"><button type="button" class="button" data-action="close-modal">Batal</button><button type="submit" class="button primary">${submitLabel}</button></div></form></section>`;
  modalLayer.hidden = false;
  document.querySelector('#field-name, #field-client_id, #field-receivable_id, #field-amount')?.focus();
}
function editAdminName() {
  modalLayer.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Nama admin</h2><p>Nama ini digunakan pada profil dan sapaan dashboard di browser ini.</p></div><button class="icon-button" data-action="close-modal" aria-label="Tutup">×</button></div><form id="admin-name-form"><div class="form-grid"><div class="form-field full"><label for="field-admin-name">Nama yang ditampilkan *</label><input id="field-admin-name" name="admin_name" type="text" maxlength="60" value="${escapeHtml(state.adminName)}" required></div></div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">Batal</button><button type="submit" class="button primary">Simpan nama</button></div></form></section>`;
  modalLayer.hidden = false;
  document.querySelector('#field-admin-name').focus();
  document.querySelector('#field-admin-name').select();
}
function saveAdminName(event) {
  event.preventDefault();
  const name = new FormData(event.target).get('admin_name').trim();
  if (!name) return;
  state.adminName = name;
  let saved = true;
  try { localStorage.setItem('julieta-admin-name', name); } catch { saved = false; }
  modalLayer.hidden = true;
  render();
  showToast(saved ? 'Nama admin disimpan di browser ini.' : 'Nama admin diperbarui untuk sesi ini.');
}
function newClientForm() {
  showModal('Tambah klien', 'ID dan tanggal ditambahkan akan dibuat otomatis.', `<div class="form-grid">${field('Nama lengkap', 'name', 'text', true, true)}${field('Nama perusahaan', 'company_name', 'text', false)}${field('Email', 'email', 'email', false)}${field('Nomor telepon', 'phone', 'tel', false)}<div class="form-field"><label for="field-status">Status klien</label><select id="field-status" name="status"><option>Aktif</option><option>Nonaktif</option><option>Selesai</option></select></div><div class="form-field full"><span class="field-heading">Rekening untuk pengembalian deposit</span></div>${field('Nama bank', 'bank_name', 'text', false)}${field('Nama pemilik rekening', 'bank_account_name', 'text', false)}${field('Nomor rekening', 'bank_account_number', 'text', false)}</div>`, 'Simpan klien');
}
function newEventForm() {
  const needs = ['MC', 'Dekorasi', 'Penampilan sanggar', 'Wardrobe', 'Catering'];
  showModal('Buat event', 'ID event dibuat otomatis setelah acara disimpan.', `<div class="form-grid"><div class="form-field full"><label for="field-client_id">Klien *</label><select id="field-client_id" name="client_id" required>${options(useData().clients, 'id', client => `${publicId('KLI', client.id)} · ${client.name}`, 'Pilih klien')}</select></div>${field('Nama event', 'name', 'text', true, true)}<div class="form-field"><label for="field-event_type">Jenis event *</label><select id="field-event_type" name="event_type" required><option>Pernikahan</option><option>Korporat</option><option>Peluncuran produk</option><option>Private event</option><option>Lainnya</option></select></div>${field('Tanggal mulai', 'event_date', 'date')}${field('Tanggal berakhir', 'end_date', 'date', false)}${field('Venue', 'venue', 'text', false)}${field('Nilai kontrak (Rp)', 'budget', 'number', true, false, 'min="0" step="1000"')}${field('PIC event', 'pic_name', 'text', true, false)}<div class="form-field"><label for="field-status">Status event</label><select id="field-status" name="status"><option>Persiapan</option><option>Berlangsung</option><option>Selesai</option><option>Dibatalkan</option></select></div><div class="form-field full"><span class="field-heading">Kebutuhan khusus acara</span><div class="check-grid">${needs.map(need => `<label><input type="checkbox" name="special_needs" value="${need}">${need}</label>`).join('')}</div></div></div>`, 'Simpan event');
}
function newReceivableForm() {
  showModal('Buat invoice', 'Sisa piutang dan status akan dihitung otomatis.', `<div class="form-grid"><div class="form-field full"><label for="field-event_id">Event *</label><select id="field-event_id" name="event_id" required>${options(useData().events, 'id', event => `${publicId('EVT', event.id)} · ${event.name}`, 'Pilih event')}</select></div>${field('Nomor invoice', 'invoice_number', 'text', true, false, `value="JS-INV-${String(29 + useData().receivables.length).padStart(3, '0')}"`)}${field('Total invoice (Rp)', 'total_amount', 'number', true, false, 'min="1000" step="1000"')}${field('Tanggal diterbitkan', 'issued_at', 'date', true, false, `value="${new Date().toISOString().slice(0, 10)}"`)}<div class="form-field"><label for="field-status">Status invoice</label><select id="field-status" name="status"><option>Belum dibayar</option><option>Draft</option></select></div><div class="form-field full"><label for="field-notes">Catatan</label><textarea id="field-notes" name="notes" placeholder="Catatan tambahan untuk invoice"></textarea></div><div class="form-field full"><label for="field-first_deposit">DP pertama (Rp, opsional)</label><input id="field-first_deposit" name="first_deposit" type="number" min="0" step="1000" placeholder="Kosongkan jika belum dijadwalkan"></div><div class="form-field full"><label for="field-due_date">Jatuh tempo DP pertama</label><input id="field-due_date" name="due_date" type="date"></div></div>`, 'Simpan invoice');
}
function newPaymentForm() {
  const deposits = useData().deposits.filter(item => !depositPaid(item) && item.status !== 'Dibatalkan');
  showModal('Catat pembayaran', 'Simpan metode dan tanggal pembayaran aktual.', `<div class="form-grid"><div class="form-field full"><label for="field-deposit_id">Termin pembayaran *</label><select id="field-deposit_id" name="deposit_id" required>${options(deposits, 'id', deposit => { const event = eventFor(receivableFor(deposit)); return `${publicId('DEP', deposit.id)} · ${deposit.installment_type || deposit.label} · ${event?.name || ''} · ${money(deposit.amount)}`; }, 'Pilih termin')}</select></div><div class="form-field"><label for="field-payment_method">Metode pembayaran *</label><select id="field-payment_method" name="payment_method" required><option>Transfer bank</option><option>Tunai</option><option>QRIS</option><option>Kartu</option><option>Lainnya</option></select></div>${field('Tanggal pembayaran aktual', 'paid_date', 'date', true, false, `value="${new Date().toISOString().slice(0, 10)}"`)}</div>`, 'Konfirmasi dibayar');
}
function newDepositForm() {
  const receivables = useData().receivables.filter(item => item.status !== 'Draft');
  showModal('Tambah termin', 'Jadwalkan DP, termin lanjutan, atau pelunasan invoice.', `<div class="form-grid"><div class="form-field full"><label for="field-receivable_id">Invoice *</label><select id="field-receivable_id" name="receivable_id" required>${options(receivables, 'id', receivable => `${receivable.invoice_number} · ${eventFor(receivable)?.name || ''} · sisa ${money(receivable.remaining_amount)}`, 'Pilih invoice')}</select></div><div class="form-field"><label for="field-installment_type">Jenis termin *</label><select id="field-installment_type" name="installment_type" required><option>DP</option><option>Termin 2</option><option>Termin 3</option><option>Pelunasan</option></select></div>${field('Nilai deposit (Rp)', 'amount', 'number', true, false, 'min="1000" step="1000"')}${field('Tanggal jatuh tempo', 'due_date', 'date', true, false, 'min="2020-01-01"')}</div>`, 'Jadwalkan termin');
}
async function submitForm(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  if (form.querySelector('[name="special_needs"]')) payload.special_needs = formData.getAll('special_needs');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Menyimpan...';
  try {
    await saveFormData(payload);
    state.data = await loadData();
    showToast('Data berhasil disimpan ke Supabase.');
    modalLayer.hidden = true;
    render();
  } catch (error) {
    showToast(error.message || 'Tidak dapat menyimpan data.');
    button.disabled = false;
    button.textContent = 'Coba lagi';
  }
}
async function supabaseRequest(table, query = '', options = {}) {
  const { body, ...requestOptions } = options;
  const response = await fetch(`${SUPABASE_API_URL}/${table}${query ? `?${query}` : ''}`, {
    ...requestOptions,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let result = null;
  if (text) { try { result = JSON.parse(text); } catch { result = { message: text }; } }
  if (!response.ok) throw new Error(result?.message || result?.details || result?.hint || `Supabase mengembalikan status ${response.status}.`);
  return result;
}
async function deleteRecord(table, id) {
  const record = state.data[table].find(item => item.id === id);
  if (!record) return;
  const title = record.name || record.invoice_number || record.installment_type || record.label || 'data ini';
  const extra = table === 'receivables' ? '\nSemua termin deposit yang terhubung juga akan dihapus.' : '';
  if (!window.confirm(`Hapus ${title}? Tindakan ini tidak dapat dibatalkan.${extra}`)) return;
  try {
    await supabaseRequest(table, `id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', prefer: 'return=representation' });
    state.data = await loadData();
    render();
    showToast('Data berhasil dihapus.');
  } catch (error) {
    const message = error.message.includes('foreign key') || error.message.includes('violates')
      ? 'Data ini masih dipakai oleh entitas lain. Hapus relasi terkait terlebih dahulu.'
      : error.message || 'Data gagal dihapus.';
    showToast(message);
  }
}
async function saveFormData(payload) {
  if (payload.deposit_id) {
    const paidAt = new Date(`${payload.paid_date}T12:00:00`).toISOString();
    await supabaseRequest('deposits', `id=eq.${encodeURIComponent(payload.deposit_id)}`, { method: 'PATCH', body: { status: 'Dibayar', payment_method: payload.payment_method, paid_at: paidAt } });
    return;
  }
  if (payload.receivable_id) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nilai deposit harus lebih besar dari nol.');
    const [receivable] = await supabaseRequest('receivables', `id=eq.${encodeURIComponent(payload.receivable_id)}&select=id,total_amount`);
    if (!receivable) throw new Error('Invoice tidak ditemukan.');
    const deposits = await supabaseRequest('deposits', `receivable_id=eq.${encodeURIComponent(payload.receivable_id)}&select=amount&status=neq.Dibatalkan`);
    const scheduled = deposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0);
    if (scheduled + amount > Number(receivable.total_amount)) throw new Error('Total termin melebihi nilai invoice.');
    await supabaseRequest('deposits', '', { method: 'POST', body: { receivable_id: payload.receivable_id, installment_type: payload.installment_type, label: payload.installment_type, amount, due_date: payload.due_date } });
    return;
  }
  if (payload.event_id && payload.total_amount) {
    const total = Number(payload.total_amount);
    const firstDeposit = Number(payload.first_deposit || 0);
    if (!Number.isFinite(total) || total <= 0) throw new Error('Nilai invoice harus lebih besar dari nol.');
    if (firstDeposit > total) throw new Error('Termin pertama tidak boleh melebihi nilai invoice.');
    if (firstDeposit > 0 && !payload.due_date) throw new Error('Tanggal jatuh tempo termin pertama wajib diisi.');
    if (payload.status === 'Draft' && firstDeposit > 0) throw new Error('Invoice draft belum dapat memiliki termin pembayaran.');
    const [receivable] = await supabaseRequest('receivables', '', { method: 'POST', body: { event_id: payload.event_id, invoice_number: payload.invoice_number, total_amount: total, issued_at: payload.issued_at, notes: payload.notes || null, status: payload.status || 'Belum dibayar' } });
    if (firstDeposit > 0) await supabaseRequest('deposits', '', { method: 'POST', body: { receivable_id: receivable.id, installment_type: 'DP', label: 'DP', amount: firstDeposit, due_date: payload.due_date } });
    return;
  }
  if (payload.client_id) {
    if (payload.end_date && payload.end_date < payload.event_date) throw new Error('Tanggal akhir tidak boleh sebelum tanggal mulai.');
    await supabaseRequest('events', '', { method: 'POST', body: { client_id: payload.client_id, name: payload.name, event_type: payload.event_type, event_date: payload.event_date, end_date: payload.end_date || null, venue: payload.venue || null, special_needs: payload.special_needs || [], pic_name: payload.pic_name, budget: Number(payload.budget || 0), status: payload.status || 'Persiapan' } });
    return;
  }
  if (payload.name) {
    await supabaseRequest('clients', '', { method: 'POST', body: { name: payload.name, company_name: payload.company_name || null, email: payload.email || null, phone: payload.phone || null, status: payload.status || 'Aktif', bank_name: payload.bank_name || null, bank_account_name: payload.bank_account_name || null, bank_account_number: payload.bank_account_number || null } });
    return;
  }
  throw new Error('Jenis data tidak dikenali.');
}
async function loadData() {
  const today = new Date().toISOString().slice(0, 10);
  const reminderEnd = new Date();
  reminderEnd.setDate(reminderEnd.getDate() + 7);
  const reminderEndDate = reminderEnd.toISOString().slice(0, 10);
  await supabaseRequest('events', `status=in.(Persiapan,Berlangsung)&end_date=lt.${today}`, { method: 'PATCH', body: { status: 'Selesai' }, prefer: 'return=minimal' });
  await supabaseRequest('deposits', `status=in.(Terjadwal,Menunggu%20bayaran)&due_date=lt.${today}`, { method: 'PATCH', body: { status: 'Terlambat' }, prefer: 'return=minimal' });
  await supabaseRequest('deposits', `status=eq.Terjadwal&and=(due_date.gte.${today},due_date.lte.${reminderEndDate})`, { method: 'PATCH', body: { status: 'Menunggu bayaran' }, prefer: 'return=minimal' });
  const [clients, events, receivables, deposits] = await Promise.all([
    supabaseRequest('clients', 'select=*&order=created_at.desc'),
    supabaseRequest('events', 'select=*&order=event_date.asc'),
    supabaseRequest('receivables', 'select=*&order=issued_at.desc'),
    supabaseRequest('deposits', 'select=*&order=due_date.asc')
  ]);
  return { clients, events, receivables, deposits };
}
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 3800); }
async function publishInvoice(id) {
  try {
    await supabaseRequest('receivables', `id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'Belum dibayar' } });
    state.data = await loadData();
    render();
    showToast('Invoice berhasil diterbitkan.');
  } catch (error) { showToast(error.message || 'Invoice gagal diterbitkan.'); }
}
function renderConnectionError(message) {
  page.innerHTML = `<section class="connection-state"><span class="brand-mark" aria-hidden="true">✿</span><div class="eyebrow">KONEKSI SUPABASE</div><h1>Dashboard belum terhubung</h1><p>${escapeHtml(message)}</p><button class="button primary" data-action="retry-connection">Coba lagi</button></section>`;
}
async function connectDashboard() {
  try { state.data = await loadData(); render(); }
  catch (error) { renderConnectionError(error instanceof TypeError ? 'Tidak dapat menghubungi Supabase. Periksa koneksi internet dan pengaturan project.' : error.message); }
}
function actionClick(action, id, table) {
  if (action === 'client') newClientForm();
  if (action === 'event') newEventForm();
  if (action === 'receivable') newReceivableForm();
  if (action === 'payment') newPaymentForm();
  if (action === 'deposit') newDepositForm();
  if (action === 'edit-admin-name') editAdminName();
  if (action === 'retry-connection') connectDashboard();
  if (action === 'publish-invoice') publishInvoice(id);
  if (action === 'delete-row') deleteRecord(table, id);
  if (action === 'close-modal') modalLayer.hidden = true;
  if (action === 'mark-paid') { const deposit = useData().deposits.find(item => item.id === id); if (deposit) { state.view = 'deposits'; newPaymentForm(); document.querySelector('#field-deposit_id').value = deposit.id; } }
}
document.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view]');
  const action = event.target.closest('[data-action]');
  if (viewButton) { setView(viewButton.dataset.view); return; }
  if (action) { actionClick(action.dataset.action, action.dataset.id, action.dataset.table); return; }
  if (event.target === modalLayer) modalLayer.hidden = true;
});
document.addEventListener('submit', event => { if (event.target.id === 'data-form') submitForm(event); if (event.target.id === 'admin-name-form') saveAdminName(event); });
document.querySelector('#mobile-menu').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.addEventListener('keydown', event => { if (event.key === 'Escape') modalLayer.hidden = true; });
(async function init() {
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  await connectDashboard();
})();
