const navigationButtons = document.querySelectorAll(".nav-link[data-view]");
const viewPanels = document.querySelectorAll(".view-panel");
const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");
const globalSearch = document.getElementById("globalSearch");
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const toast = document.getElementById("toast");
const productDialog = document.getElementById("productDialog");
const productForm = document.getElementById("productForm");
let toastTimeout;

const dateLabel = document.getElementById("currentDate");
document.getElementById("currentYear").textContent = String(new Date().getFullYear());
if (dateLabel) {
    const now = new Date();
    dateLabel.textContent = `${new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(now).toUpperCase()} · FARMHOUSE AT A GLANCE`;
}

const greeting = document.querySelector("#view-overview h1");
if (greeting) {
    const hour = new Date().getHours();
    greeting.firstChild.textContent = `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, Admin `;
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function setView(viewName) {
    const panel = document.getElementById(`view-${viewName}`);
    if (!panel) return;

    viewPanels.forEach((view) => {
        const isCurrent = view === panel;
        view.hidden = !isCurrent;
        view.classList.toggle("active", isCurrent);
    });
    navigationButtons.forEach((button) => {
        const isCurrent = button.dataset.view === viewName;
        button.classList.toggle("active", isCurrent);
        if (isCurrent) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });
    breadcrumbCurrent.textContent = panel.dataset.title;
    globalSearch.value = "";
    applySearch("");
    if (sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    }
}

navigationButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.go));
});

menuToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
});

function applySearch(query) {
    const activePanel = document.querySelector(".view-panel.active");
    if (!activePanel) return;
    const rows = activePanel.querySelectorAll(".searchable-rows tr");
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const selectedStatus = activePanel.id === "view-orders" ? orderFilter.value : "all";

    rows.forEach((row) => {
        const rowStatus = row.querySelector(".status")?.textContent.trim().toLocaleLowerCase();
        const matchesStatus = selectedStatus === "all" || rowStatus === selectedStatus;
        const matchesQuery = row.textContent.toLocaleLowerCase().includes(normalizedQuery);
        row.hidden = !matchesStatus || !matchesQuery;
    });

    activePanel.querySelectorAll(".table-empty").forEach((emptyRow) => emptyRow.remove());
    if (normalizedQuery && rows.length && !Array.from(rows).some((row) => !row.hidden)) {
        const tableBody = rows[0].parentElement;
        const emptyRow = document.createElement("tr");
        emptyRow.className = "table-empty";
        const cell = document.createElement("td");
        cell.colSpan = rows[0].parentElement.closest("table").querySelectorAll("thead th").length;
        cell.textContent = "No matching results.";
        emptyRow.append(cell);
        tableBody.append(emptyRow);
    }
}

globalSearch.addEventListener("input", () => applySearch(globalSearch.value));

document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        globalSearch.focus();
    }
    if (event.key === "Escape" && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    }
});

const orderFilter = document.getElementById("orderFilter");
orderFilter.addEventListener("change", () => {
    applySearch(globalSearch.value);
});

function closeProductDialog() {
    productDialog.close();
    productForm.reset();
}

document.getElementById("openProductDialog").addEventListener("click", () => productDialog.showModal());
document.getElementById("closeProductDialog").addEventListener("click", closeProductDialog);
document.getElementById("cancelProductDialog").addEventListener("click", closeProductDialog);
productDialog.addEventListener("click", (event) => {
    if (event.target === productDialog) closeProductDialog();
});

function appendProductCell(row, text, className) {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    row.append(cell);
}

productForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!productForm.reportValidity()) return;

    const formData = new FormData(productForm);
    const name = formData.get("name").trim();
    const category = formData.get("category");
    const price = Number(formData.get("price"));
    if (!name || !Number.isSafeInteger(price) || price < 1) return;

    const productRows = document.getElementById("productRows");
    const row = document.createElement("tr");
    const productCell = document.createElement("td");
    const productInfo = document.createElement("span");
    const productName = document.createElement("strong");
    const productMeta = document.createElement("small");
    productInfo.className = "product-cell";
    productName.textContent = name;
    productMeta.textContent = "Preview item · Added just now";
    productInfo.append(productName, productMeta);
    productCell.append(productInfo);
    row.append(productCell);
    appendProductCell(row, category);
    appendProductCell(row, `KSh ${price.toLocaleString("en-KE")}`, "amount");
    appendProductCell(row, "—");
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "status status-delivered";
    status.textContent = "Preview";
    statusCell.append(status);
    row.append(statusCell);
    productRows.prepend(row);
    document.getElementById("productCount").textContent = String(productRows.querySelectorAll("tr:not(.table-empty)").length);

    closeProductDialog();
    applySearch(globalSearch.value);
    showToast("Product added to this preview.");
});

function csvEscape(value) {
    return `"${value.replaceAll('"', '""')}"`;
}

function exportTable(tableType) {
    const panelId = tableType === "products" ? "view-products" : "view-orders";
    const table = document.querySelector(`#${panelId} table`);
    if (!table) {
        showToast("There is no table available to export.");
        return;
    }

    const rows = Array.from(table.querySelectorAll("tr"))
        .filter((row) => !row.hidden && !row.classList.contains("table-empty"))
        .map((row) => Array.from(row.querySelectorAll("th, td"), (cell) => csvEscape(cell.innerText.trim())));
    if (rows.length < 2) {
        showToast("No rows are available to export.");
        return;
    }

    const file = new Blob([`\uFEFF${rows.map((row) => row.join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `farmhouse-${tableType}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`${tableType === "products" ? "Products" : "Orders"} CSV downloaded.`);
}

document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportTable(button.dataset.export));
});
