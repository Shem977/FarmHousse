const featuredProducts = document.getElementById("top-items");

if (featuredProducts) {
    window.FarmHouseStore.loadProducts()
        .then((products) => {
            featuredProducts.replaceChildren();
            products.slice(0, 3).forEach((product) => {
                featuredProducts.append(window.FarmHouseStore.createProductCard(product, false));
            });
            if (!products.length) {
                const empty = document.createElement("p");
                empty.className = "product-empty";
                empty.textContent = "No products are available right now.";
                featuredProducts.append(empty);
            }
        })
        .catch((error) => {
            console.error("Could not load the featured products.", error);
            featuredProducts.replaceChildren();
            const message = document.createElement("p");
            message.className = "error-message";
            message.textContent = "We couldn’t load products right now. Please try again later.";
            featuredProducts.append(message);
        });
}
