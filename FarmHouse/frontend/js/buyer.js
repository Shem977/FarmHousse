const buyerProducts = document.getElementById("buyerProducts");

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
