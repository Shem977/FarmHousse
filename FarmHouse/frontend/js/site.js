document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
});

document.querySelectorAll(".nav-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
        const nav = toggle.parentElement.querySelector(".site-nav");
        const isOpen = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
        toggle.innerHTML = `<i class="fa-solid ${isOpen ? "fa-xmark" : "fa-bars"}"></i>`;
    });
});

let activeToastTimeout;
function showFarmHouseToast(message) {
    const toast = document.querySelector("[data-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(activeToastTimeout);
    activeToastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

window.FarmHouseUI = { showToast: showFarmHouseToast };

document.querySelectorAll("[data-demo-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const message = form.querySelector(".form-message");
        message.textContent = form.dataset.success;
        message.classList.add("visible");
        form.reset();
    });
});
