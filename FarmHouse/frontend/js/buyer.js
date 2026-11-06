const buyerProducts = document.getElementById("buyerProducts");
const checkoutDialog = document.getElementById("checkoutDialog");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutMessage = document.getElementById("checkoutMessage");

function closeCheckout() {
    checkoutDialog.hidden = true;
    checkoutForm.reset();
    checkoutMessage.classList.remove("visible");
    checkoutMessage.textContent = "";
}

document.addEventListener("click", (event) => {
    if (event.target.closest("[data-checkout-start]")) {
        checkoutDialog.hidden = false;
        checkoutForm.querySelector('[name="name"]').focus();
    }
});

document.getElementById("closeCheckout").addEventListener("click", closeCheckout);
document.getElementById("cancelCheckout").addEventListener("click", closeCheckout);
checkoutDialog.addEventListener("click", (event) => {
    if (event.target === checkoutDialog) closeCheckout();
});

checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    checkoutMessage.classList.remove("visible");
    if (!checkoutForm.reportValidity()) return;

    const formData = new FormData(checkoutForm);
    const submitButton = checkoutForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Placing order…";
    try {
        const order = await window.FarmHouseStore.placeOrder({
            name: formData.get("name").trim(),
            email: formData.get("email").trim()
        });
        closeCheckout();
        window.FarmHouseUI?.showToast(`Demo order ${order.orderNumber} saved to the database.`);
    } catch (error) {
        checkoutMessage.textContent = error.message;
        checkoutMessage.classList.add("visible");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Place demo order";
    }
});

window.FarmHouseStore.loadProducts()
    .then((products) => {
        buyerProducts.replaceChildren();
        products.slice(0, 4).forEach((product) => {
            buyerProducts.append(window.FarmHouseStore.createProductCard(product, true));
        });
        if (!products.length) {
            const empty = document.createElement("p");
            empty.className = "product-empty";
            empty.textContent = "There are no products to show right now.";
            buyerProducts.append(empty);
        }
    })
    .catch((error) => {
        console.error("Could not load products for the buyer dashboard.", error);
        buyerProducts.replaceChildren();
        const message = document.createElement("p");
        message.className = "error-message";
        message.textContent = "We couldn’t load products right now. Please try again later.";
        buyerProducts.append(message);
    });
