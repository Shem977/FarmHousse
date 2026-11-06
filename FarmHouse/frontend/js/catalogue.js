const catalogueGrid = document.getElementById("catalogueProducts");
const catalogueSearch = document.getElementById("catalogueSearch");
const catalogueResults = document.getElementById("catalogueResults");
const categoryButtons = document.querySelectorAll("[data-category]");
let selectedCategory = "all";
let catalogueItems = [];

function renderCatalogue() {
    const query = catalogueSearch.value.trim().toLocaleLowerCase();
    const visibleProducts = catalogueItems.filter((product) => {
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
        const matchesSearch = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });

    catalogueGrid.replaceChildren();
    if (!visibleProducts.length) {
        const empty = document.createElement("p");
        empty.className = "product-empty";
        empty.textContent = "No products match your search. Try another category or search term.";
        catalogueGrid.append(empty);
    } else {
        visibleProducts.forEach((product) => {
            catalogueGrid.append(window.FarmHouseStore.createProductCard(product, false));
        });
    }

    catalogueResults.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "product" : "products"} shown · Sample catalogue`;
}

categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedCategory = button.dataset.category;
        categoryButtons.forEach((item) => {
            const isSelected = item === button;
            item.classList.toggle("active", isSelected);
            item.setAttribute("aria-pressed", String(isSelected));
        });
        renderCatalogue();
    });
});

catalogueSearch.addEventListener("input", renderCatalogue);

window.FarmHouseStore.loadProducts()
    .then((products) => {
        catalogueItems = products;
        renderCatalogue();
    })
    .catch((error) => {
        console.error("Could not load the product catalogue.", error);
        catalogueGrid.replaceChildren();
        const message = document.createElement("p");
        message.className = "error-message";
        message.textContent = "We couldn’t load the catalogue. Please try again later.";
        catalogueGrid.append(message);
        catalogueResults.textContent = "The catalogue is temporarily unavailable.";
    });