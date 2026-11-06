const accountForm = document.getElementById("accountForm");
const accountMessage = document.getElementById("accountMessage");
const roleOptions = document.querySelectorAll(".role-option");
const nameField = document.getElementById("nameField");
const passwordInput = accountForm.querySelector('[name="password"]');
let selectedRole = "buyer";
let isRegisterMode = window.location.hash === "#register";

function updateAccountMode() {
    document.getElementById("authEyebrow").textContent = isRegisterMode ? "JOIN THE COMMUNITY" : "WELCOME BACK";
    document.getElementById("authTitle").textContent = isRegisterMode ? "Create your account" : "Sign in to FarmHouse";
    document.getElementById("authDescription").textContent = isRegisterMode
        ? "Choose how you’ll use FarmHouse and enter your details."
        : "Choose your account type and enter your details.";
    nameField.hidden = !isRegisterMode;
    nameField.querySelector("input").required = isRegisterMode;
    document.getElementById("authOptions").hidden = isRegisterMode;
    document.getElementById("submitAccount").innerHTML = isRegisterMode
        ? 'Create preview account <i class="fa-solid fa-arrow-right"></i>'
        : 'Sign in <i class="fa-solid fa-arrow-right"></i>';
    document.getElementById("switchPrompt").textContent = isRegisterMode ? "Already have an account?" : "New to FarmHouse?";
    document.getElementById("switchMode").textContent = isRegisterMode ? "Sign in" : "Create an account";
    document.getElementById("switchMode").href = isRegisterMode ? "#login" : "#register";
    passwordInput.autocomplete = isRegisterMode ? "new-password" : "current-password";
}

roleOptions.forEach((button) => {
    button.addEventListener("click", () => {
        selectedRole = button.dataset.role;
        roleOptions.forEach((option) => {
            const isSelected = option === button;
            option.classList.toggle("active", isSelected);
            option.setAttribute("aria-pressed", String(isSelected));
        });
    });
});

document.getElementById("switchMode").addEventListener("click", (event) => {
    event.preventDefault();
    isRegisterMode = !isRegisterMode;
    window.history.replaceState(null, "", isRegisterMode ? "#register" : "#login");
    accountMessage.classList.remove("visible");
    updateAccountMode();
});

window.addEventListener("hashchange", () => {
    if (window.location.hash === "#register" || window.location.hash === "#login") {
        isRegisterMode = window.location.hash === "#register";
        updateAccountMode();
    }
});

document.querySelector(".password-toggle").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const shouldShow = passwordInput.type === "password";
    passwordInput.type = shouldShow ? "text" : "password";
    button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    button.innerHTML = `<i class="fa-regular ${shouldShow ? "fa-eye-slash" : "fa-eye"}"></i>`;
});

document.getElementById("forgotPassword").addEventListener("click", (event) => {
    event.preventDefault();
    accountMessage.textContent = "Password recovery will be available when account services are connected.";
    accountMessage.classList.add("visible");
});

accountForm.addEventListener("submit", (event) => {
    event.preventDefault();
    accountMessage.classList.remove("visible");
    if (!accountForm.reportValidity()) return;

    const destination = selectedRole === "admin"
        ? "/frontend/RBA%20(accounts)/admin.html"
        : selectedRole === "farmer"
            ? "/frontend/RBA%20(accounts)/farmer.html"
            : "/frontend/RBA%20(accounts)/buyer.html";
    accountMessage.textContent = `Opening the ${selectedRole} dashboard preview. This does not sign you in or send your credentials.`;
    accountMessage.classList.add("visible");
    window.setTimeout(() => window.location.assign(destination), 800);
});

updateAccountMode();
