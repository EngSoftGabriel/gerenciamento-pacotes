const residents = [];

const state = { orders: [], ordersError: "", view: "dashboard", filter: "all", search: "", building: "all" };
const content = document.querySelector("#viewContent");
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const dashboardDateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function initials(name = "") {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function formatTime(value) {
  return value ? timeFormatter.format(new Date(value)) : "—";
}

function statusMarkup(status) {
  const picked = status === "picked_up";
  return `<span class="status-badge ${picked ? "status-picked" : "status-pending"}">${picked ? "Retirada" : "Pendente"}</span>`;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function ordersForView() {
  return state.orders.filter((order) => {
    const query = state.search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !query || [order.id, order.resident, order.apartment, order.carrier, order.porter].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query));
    const matchesStatus = state.filter === "all" || order.status === state.filter;
    const matchesBuilding = state.building === "all" || order.building === state.building;
    return matchesSearch && matchesStatus && matchesBuilding;
  });
}

function ordersLast30Days() {
  const cutoff = addDays(new Date(), -30);
  return state.orders.filter((order) => new Date(order.receivedAt) >= cutoff);
}

function updateChrome() {
  const titles = { dashboard: "Visão geral", orders: "Encomendas", reports: "Relatórios", residents: "Moradores", settings: "Configurações" };
  document.querySelector("#breadcrumbCurrent").textContent = titles[state.view];
  document.querySelector("#todayDate").textContent = weekdayFormatter.format(new Date());
  document.querySelector("#pendingNavCount").textContent = state.orders.filter((order) => order.status === "pending").length;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));
}

function metricCard(title, value, note, icon, color, trend = "") {
  return `<article class="metric-card"><div class="metric-heading"><span>${title}</span><span class="metric-icon ${color}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${trend ? `<span class="trend">${trend}</span>` : ""}${note}</div></article>`;
}

function getDailyCounts() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(), index - 6);
    const key = date.toLocaleDateString("en-CA");
    return { label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""), count: state.orders.filter((order) => new Date(order.receivedAt).toLocaleDateString("en-CA") === key).length };
  });
}

function renderChart() {
  if (!state.orders.length) return '<div class="chart-wrap"><div class="empty-state">Sem movimentações nos últimos 7 dias.</div></div>';
  const counts = getDailyCounts();
  const max = Math.max(5, ...counts.map((day) => day.count));
  return `<div class="chart-wrap"><div class="chart"><div class="chart-axis"><span>${max}</span><span>${Math.ceil(max * .66)}</span><span>${Math.ceil(max * .33)}</span><span>0</span></div><div class="chart-grid"><span></span><span></span><span></span><span></span></div><div class="chart-bars">${counts.map((day) => `<div class="bar-group"><div class="bar" data-count="${day.count} encomendas" style="height:${Math.max(4, day.count / max * 100)}%"></div><span class="bar-label">${day.label}</span></div>`).join("")}</div></div></div>`;
}

function recentRow(order) {
  return `<div class="recent-row"><div class="resident-cell"><span class="initials">${escapeHtml(initials(order.resident))}</span><span class="resident-info"><strong>${escapeHtml(order.resident)}</strong><small>Apto ${escapeHtml(order.apartment)} · Bloco ${escapeHtml(order.building)}</small></span></div><span class="carrier-cell">${escapeHtml(order.carrier || "Não informado")}</span>${statusMarkup(order.status)}</div>`;
}

function renderDashboard() {
  const pending = state.orders.filter((order) => order.status === "pending").length;
  const pickedUp = state.orders.filter((order) => order.status === "picked_up").length;
  const today = new Date().toDateString();
  const todayReceived = state.orders.filter((order) => new Date(order.receivedAt).toDateString() === today).length;
  const recent = [...state.orders].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)).slice(0, 5);
  const byBlock = state.orders.filter((order) => order.building === "A").length;
  const share = state.orders.length ? Math.round(byBlock / state.orders.length * 100) : 0;
  return `<section class="page-heading"><div><span class="eyebrow">${dashboardDateFormatter.format(new Date()).toLocaleUpperCase("pt-BR")}</span><h1>Visão geral</h1><p class="page-subtitle">Acompanhe a movimentação de encomendas do condomínio.</p></div><button class="button button-primary" data-action="new-order"><span>＋</span> Nova encomenda</button></section>
    <section class="dashboard-grid" aria-label="Indicadores principais">
      ${metricCard("Total de encomendas", state.orders.length, "registros no sistema", "▤", "blue")}
      ${metricCard("Aguardando retirada", pending, "precisam de atenção", "◷", "orange", "")}
      ${metricCard("Retiradas hoje", state.orders.filter((order) => order.status === "picked_up" && order.pickedUpAt && new Date(order.pickedUpAt).toDateString() === today).length, "confirmadas na portaria", "✓", "green")}
      ${metricCard("Recebidas hoje", todayReceived, "novas encomendas", "↓", "blue", "")}
    </section>
    <section class="dashboard-columns">
      <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Movimentação de encomendas</h2><p class="panel-caption">Volume recebido nos últimos 7 dias</p></div><button class="text-button" data-view="reports">Ver relatório →</button></div>${renderChart()}</div>
      <div class="side-stack">
        <div class="panel status-panel"><div class="panel-header"><div><h2 class="panel-title">Status das encomendas</h2><p class="panel-caption">Resumo do período atual</p></div><span class="metric-icon orange">◉</span></div><div class="status-stats"><div class="status-stat"><span>Pendentes</span><strong>${pending}</strong></div><div class="status-stat"><span>Retiradas</span><strong>${pickedUp}</strong></div></div><div class="status-bar"><span style="width:${state.orders.length ? pending / state.orders.length * 100 : 0}%"></span><span style="width:${state.orders.length ? pickedUp / state.orders.length * 100 : 0}%"></span></div><div class="status-legend"><span class="legend-key"><i class="legend-orange"></i>Pendente</span><span class="legend-key"><i class="legend-green"></i>Retirada</span></div></div>
        <div class="panel insight-panel"><div class="insight-heading"><span>✦</span> INSIGHT DA SEMANA</div><p>${state.orders.length ? `<strong>Bloco A</strong> concentra ${share}% das encomendas registradas no período. A portaria pode priorizar as notificações deste bloco.` : "Os dados de movimentação aparecerão aqui após o primeiro registro."}</p><small class="insight-bottom">Baseado em ${state.orders.length} encomendas registradas</small></div>
      </div>
    </section>
    <section class="panel" style="margin-top:17px"><div class="panel-header"><div><h2 class="panel-title">Atividade recente</h2><p class="panel-caption">Últimas encomendas registradas na portaria</p></div><button class="text-button" data-view="orders">Ver todas →</button></div><div class="recent-list">${recent.length ? recent.map(recentRow).join("") : '<div class="empty-state">Nenhuma encomenda registrada ainda.</div>'}</div></section>`;
}

function tableRows(orders) {
  if (!orders.length) return `<tr><td colspan="7"><div class="empty-state">Nenhuma encomenda encontrada com esses filtros.</div></td></tr>`;
  return orders.map((order) => `<tr><td>#${escapeHtml(order.id)}</td><td><div class="table-resident"><span class="initials">${escapeHtml(initials(order.resident))}</span><strong>${escapeHtml(order.resident)}</strong></div></td><td>Bloco ${escapeHtml(order.building)}</td><td class="table-apartment">${escapeHtml(order.apartment)}</td><td>${escapeHtml(order.porter || "—")}</td><td>${statusMarkup(order.status)}</td><td><div class="row-actions"><button class="row-action" data-action="view-order" data-id="${escapeHtml(order.id)}" aria-label="Ver encomenda #${escapeHtml(order.id)}" title="Ver detalhes">⌕</button>${order.status === "pending" ? `<button class="row-action" data-action="pickup" data-id="${escapeHtml(order.id)}" aria-label="Confirmar retirada da encomenda #${escapeHtml(order.id)}" title="Confirmar retirada">✓</button>` : ""}</div></td></tr>`).join("");
}

function renderOrders() {
  const orders = ordersForView();
  const pending = state.orders.filter((order) => order.status === "pending").length;
  return `<section class="page-heading"><div><span class="eyebrow">PORTARIA · CONTROLE DE RECEBIMENTOS</span><h1>Encomendas</h1><p class="page-subtitle">Consulte, registre e acompanhe as entregas do condomínio.</p></div><button class="button button-primary" data-action="new-order"><span>＋</span> Nova encomenda</button></section>
    <section class="dashboard-grid" style="margin-bottom:17px">${metricCard("Todas as encomendas", state.orders.length, "em todos os blocos", "▤", "blue")}${metricCard("Aguardando retirada", pending, "na portaria", "◷", "orange")}${metricCard("Retiradas", state.orders.length - pending, "entregues ao morador", "✓", "green")}${metricCard("Moradores atendidos", new Set(state.orders.map((order) => order.resident)).size, "com encomendas", "♙", "blue")}</section>
    <section class="panel table-panel"><div class="table-toolbar"><div class="table-filters"><button class="filter-chip ${state.filter === "all" ? "active" : ""}" data-filter="all">Todas <span>${state.orders.length}</span></button><button class="filter-chip ${state.filter === "pending" ? "active" : ""}" data-filter="pending">Pendentes <span>${pending}</span></button><button class="filter-chip ${state.filter === "picked_up" ? "active" : ""}" data-filter="picked_up">Retiradas</button></div><div class="table-tools"><label class="table-search"><span>⌕</span><input id="orderSearch" type="search" value="${escapeHtml(state.search)}" placeholder="Morador, apartamento..."></label><select class="select-filter" id="buildingFilter" aria-label="Filtrar por bloco"><option value="all" ${state.building === "all" ? "selected" : ""}>Todos os blocos</option><option value="A" ${state.building === "A" ? "selected" : ""}>Bloco A</option><option value="B" ${state.building === "B" ? "selected" : ""}>Bloco B</option><option value="C" ${state.building === "C" ? "selected" : ""}>Bloco C</option></select><button class="button button-quiet" data-action="export">↓ Exportar</button></div></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>MORADOR</th><th>BLOCO</th><th>APARTAMENTO</th><th>RECEBIDO POR</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>${tableRows(orders)}</tbody></table></div><div class="table-footer"><span>Mostrando ${orders.length ? 1 : 0}–${orders.length} de ${orders.length} encomendas</span><div class="pagination"><button class="page-button" aria-label="Página anterior" disabled>‹</button><button class="page-button active">1</button><button class="page-button" aria-label="Próxima página" disabled>›</button></div></div></section>`;
}

function renderReports() {
  const reportOrders = ordersLast30Days();
  const porterCounts = new Map();
  const residentCounts = new Map();
  reportOrders.forEach((order) => {
    porterCounts.set(order.porter || "Não informado", (porterCounts.get(order.porter || "Não informado") || 0) + 1);
    const residentKey = `${order.resident} · Apto ${order.apartment}`;
    residentCounts.set(residentKey, (residentCounts.get(residentKey) || 0) + 1);
  });
  const porters = [...porterCounts].sort((a, b) => b[1] - a[1]);
  const frequentResidents = [...residentCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxPorter = Math.max(1, ...porters.map((item) => item[1]));
  const total = reportOrders.length;
  const pickupDurations = reportOrders
    .filter((order) => order.status === "picked_up" && order.pickedUpAt)
    .map((order) => new Date(order.pickedUpAt) - new Date(order.receivedAt))
    .filter((duration) => Number.isFinite(duration) && duration >= 0);
  const averagePickupMinutes = pickupDurations.length
    ? Math.round(pickupDurations.reduce((sum, duration) => sum + duration, 0) / pickupDurations.length / 60000)
    : null;
  const blockCounts = reportOrders.reduce((counts, order) => {
    counts[order.building] = (counts[order.building] || 0) + 1;
    return counts;
  }, {});
  const topBlock = Object.entries(blockCounts).sort((a, b) => b[1] - a[1])[0];
  const averagePickupLabel = averagePickupMinutes === null ? "—" : `${Math.floor(averagePickupMinutes / 60)}h ${averagePickupMinutes % 60}m`;
  return `<section class="page-heading"><div><span class="eyebrow">ANÁLISE DE MOVIMENTAÇÃO</span><h1>Relatórios</h1><p class="page-subtitle">Acompanhe o volume de entregas e a atividade da portaria.</p></div><button class="button button-primary" data-action="export"><span>↓</span> Exportar CSV</button></section>
    <div class="table-toolbar panel" style="margin-bottom:17px"><div class="table-filters"><span class="period-control">▦ &nbsp; Últimos 30 dias &nbsp;⌄</span><span style="color:#87939e;font-size:9px">${dateFormatter.format(addDays(new Date(), -30))} – ${dateFormatter.format(new Date())}</span></div><button class="button button-quiet" data-action="export">↓ Baixar relatório</button></div>
    <section class="dashboard-grid" style="margin-bottom:17px">${metricCard("Total no período", total, "encomendas registradas", "▤", "blue")}${metricCard("Taxa de retirada", `${total ? Math.round(state.orders.filter((order) => order.status === "picked_up").length / total * 100) : 0}%`, "encomendas retiradas", "✓", "green")}${metricCard("Tempo médio", averagePickupLabel, averagePickupMinutes === null ? "sem dados de retirada" : "entre entrega e retirada", "◷", "orange")}${metricCard("Bloco mais ativo", topBlock ? `Bloco ${topBlock[0]}` : "—", topBlock ? `${topBlock[1]} encomendas` : "sem dados no período", "⌂", "blue")}</section>
    <section class="report-grid"><div class="panel"><div class="panel-header"><div><h2 class="panel-title">Encomendas por porteiro</h2><p class="panel-caption">Volume registrado por colaborador</p></div></div>${porters.map(([name, count]) => `<div class="report-line"><span>${escapeHtml(name)}</span><div class="report-progress"><i style="width:${count / maxPorter * 100}%"></i></div><strong>${count} registros</strong></div>`).join("")}<div class="report-summary"><span>✦</span><div><strong>Destaque do período</strong><p>${porters[0] ? `${escapeHtml(porters[0][0])} registrou ${porters[0][1]} encomendas, liderando os recebimentos.` : "Sem dados de recebimento neste período."}</p></div></div></div>
    <div class="panel"><div class="panel-header"><div><h2 class="panel-title">Moradores com mais entregas</h2><p class="panel-caption">Quem mais recebeu encomendas</p></div></div>${frequentResidents.map(([name, count], index) => `<div class="report-line"><span><b style="color:#a0aab3;margin-right:9px">0${index + 1}</b>${escapeHtml(name)}</span><strong>${count} ${count === 1 ? "encomenda" : "encomendas"}</strong></div>`).join("")}${!frequentResidents.length ? '<div class="empty-state">Sem dados para este período.</div>' : ""}</div></section>`;
}

function renderResidents() {
  const query = state.search.trim().toLocaleLowerCase("pt-BR");
  const visibleResidents = residents.filter((resident) => !query || [resident.name, resident.apartment, resident.building].some((value) => value.toLocaleLowerCase("pt-BR").includes(query)));
  return `<section class="page-heading"><div><span class="eyebrow">CADASTRO CONDOMINIAL</span><h1>Moradores</h1><p class="page-subtitle">Consulte os moradores e seus apartamentos cadastrados.</p></div><button class="button button-primary" data-action="resident-info"><span>＋</span> Novo morador</button></section><div class="table-toolbar panel" style="margin-bottom:16px"><div class="table-filters"><strong style="color:#34495b;font-size:10px">${residents.length} moradores cadastrados</strong></div><label class="table-search"><span>⌕</span><input id="residentSearch" type="search" value="${escapeHtml(state.search)}" placeholder="Buscar morador ou apartamento..."></label></div><section class="residents-grid">${visibleResidents.map((resident) => { const packageCount = state.orders.filter((order) => order.resident === resident.name).length; return `<article class="resident-card"><span class="initials">${escapeHtml(initials(resident.name))}</span><div><strong>${escapeHtml(resident.name)}</strong><small>Bloco ${resident.building} · Apto ${escapeHtml(resident.apartment)}</small><em>${packageCount} ${packageCount === 1 ? "encomenda" : "encomendas"} registradas</em></div></article>`; }).join("") || '<div class="empty-state">Nenhum morador encontrado.</div>'}</section>`;
}

function renderSettings() {
  return `<section class="page-heading"><div><span class="eyebrow">PREFERÊNCIAS DO SISTEMA</span><h1>Configurações</h1><p class="page-subtitle">Ajuste como as encomendas são registradas e comunicadas.</p></div></section><section class="panel settings-panel"><h2 class="panel-title">Notificações e operação</h2><p class="panel-caption">Preferências aplicadas ao Condomínio Vitória Régia</p><div class="setting-row"><span><strong>Notificar morador ao registrar encomenda</strong><small>Enviar aviso assim que a portaria finalizar o registro.</small></span><input class="toggle" type="checkbox" checked aria-label="Notificar ao registrar encomenda"></div><div class="setting-row"><span><strong>Lembrete de encomenda pendente</strong><small>Alertar sobre volumes que aguardam retirada há mais de 24 horas.</small></span><input class="toggle" type="checkbox" checked aria-label="Lembrete de pendências"></div><div class="setting-row"><span><strong>Confirmação de retirada</strong><small>Exigir confirmação do morador antes de concluir a entrega.</small></span><input class="toggle" type="checkbox" checked aria-label="Confirmação de retirada"></div><div class="setting-row"><span><strong>Identificação do condomínio</strong><small>Condomínio Vitória Régia · 3 blocos · 168 apartamentos</small></span><button class="button button-quiet" data-action="settings-info">Editar dados</button></div></section>`;
}

function render() {
  updateChrome();
  const pages = { dashboard: renderDashboard, orders: renderOrders, reports: renderReports, residents: renderResidents, settings: renderSettings };
  const errorBanner = state.ordersError ? `<div class="login-error" role="alert">${escapeHtml(state.ordersError)} <button class="text-button" data-action="reload-orders">Tentar novamente</button></div>` : "";
  content.innerHTML = `${errorBanner}${pages[state.view]()}`;
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function exportOrders() {
  const exportOrders = state.view === "reports" ? ordersLast30Days() : ordersForView();
  const rows = [["ID", "Morador", "Bloco", "Apartamento", "Transportadora", "Porteiro", "Recebida em", "Status"], ...exportOrders.map((order) => [order.id, order.resident, order.building, order.apartment, order.carrier || "", order.porter || "", formatDate(order.receivedAt), order.status === "pending" ? "Pendente" : "Retirada"])];
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value);
    const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "relatorio-encomendas.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Relatório CSV exportado.");
}

async function persistOrder(order) {
  const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
  if (response.status === 401) { window.location.replace("/login"); return null; }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Não foi possível salvar. Verifique a conexão com o servidor e o banco de dados.");
  }
  return response.json();
}

async function updateOrderStatus(id) {
  const order = state.orders.find((item) => String(item.id) === String(id));
  if (!order || order.status !== "pending") return;
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}/pickup`, { method: "PATCH" });
    if (response.status === 401) { window.location.replace("/login"); return; }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Não foi possível confirmar a retirada.");
    }
    const updated = await response.json();
    state.orders = state.orders.map((item) => String(item.id) === String(id) ? updated : item);
  } catch (error) {
    showToast(error.message || "Falha de conexão. A retirada não foi confirmada.");
    return;
  }
  render();
  showToast(`Retirada da encomenda #${id} confirmada.`);
}

const dialog = document.querySelector("#orderDialog");
function openOrderDialog() {
  dialog.showModal();
}

document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => {
  state.view = item.dataset.view;
  state.search = "";
  render();
}));

content.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { state.view = viewButton.dataset.view; state.search = ""; render(); return; }
  const filter = event.target.closest("[data-filter]");
  if (filter) { state.filter = filter.dataset.filter; render(); return; }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "new-order") openOrderDialog();
  if (action.dataset.action === "reload-orders") loadOrders();
  if (action.dataset.action === "export") exportOrders();
  if (action.dataset.action === "pickup") updateOrderStatus(action.dataset.id);
  if (action.dataset.action === "view-order") {
    const order = state.orders.find((item) => String(item.id) === action.dataset.id);
    if (order) showToast(`Encomenda #${order.id} · ${order.resident} · ${order.status === "pending" ? "Pendente" : "Retirada"}`);
  }
  if (action.dataset.action === "resident-info") showToast("Cadastro de moradores estará disponível em breve.");
  if (action.dataset.action === "settings-info") showToast("Configurações do condomínio atualizadas.");
});

content.addEventListener("input", (event) => {
  if (event.target.id === "orderSearch" || event.target.id === "residentSearch") {
    const cursor = event.target.selectionStart;
    state.search = event.target.value;
    render();
    const replacement = content.querySelector(`#${event.target.id}`);
    replacement?.focus();
    replacement?.setSelectionRange(cursor, cursor);
  }
});

content.addEventListener("change", (event) => {
  if (event.target.id === "buildingFilter") { state.building = event.target.value; render(); }
});

document.querySelector("#globalSearch").addEventListener("input", (event) => {
  state.search = event.target.value;
  if (state.view !== "orders" && state.view !== "residents") state.view = "orders";
  render();
  document.querySelector("#globalSearch").focus();
  document.querySelector("#globalSearch").setSelectionRange(event.target.selectionStart, event.target.selectionStart);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#globalSearch").focus(); }
});

document.querySelector("#orderForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = new FormData(form);
  const order = { resident: fields.get("resident").trim(), building: fields.get("building"), apartment: fields.get("apartment").trim(), carrier: fields.get("carrier").trim() || "Não informado", porter: fields.get("porter").trim(), notes: fields.get("notes").trim() };
  let saved;
  try {
    saved = await persistOrder(order);
  } catch (error) {
    showToast(error.message || "Não foi possível salvar a encomenda.");
    return;
  }
  if (!saved) return;
  state.orders.unshift(saved);
  state.view = "orders";
  state.filter = "all";
  form.reset();
  dialog.close();
  render();
  showToast(`Encomenda #${saved.id} registrada com sucesso.`);
});

document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancelDialog").addEventListener("click", () => dialog.close());
document.querySelector("#supportButton").addEventListener("click", () => showToast("Central de suporte: suporte@vitoriaregia.com.br"));
document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  window.location.replace("/login");
});

async function loadOrders() {
  state.ordersError = "";
  render();
  try {
    const response = await fetch("/api/orders");
    if (response.status === 401) { window.location.replace("/login"); return; }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Não foi possível carregar as encomendas.");
    }
    state.orders = await response.json();
  } catch (error) {
    state.orders = [];
    state.ordersError = `${error.message || "Falha de conexão."} Os dados podem não estar sincronizados entre dispositivos.`;
  }
  render();
}

loadOrders();