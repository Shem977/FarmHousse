(() => {
    const storageKey = "farmhouse-preview-cart";
    let products = [];
    let cart = [];
    let storageAvailable = true;

    try {
        const savedCart = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(savedCart)) {
            cart = savedCart.filter((item) =>
                item &&
                Number.isInteger(Number(item.id)) &&
                Number.isInteger(Number(item.quantity)) &&
                Number(item.quantity) > 0
            ).map((item) => ({ id: Number(item.id), quantity: Number(item.quantity) }));
        }
    } catch (error) {
        storageAvailable = false;
        console.warn("The preview basket could not be loaded from browser storage.", error);
    }

    function showToast(message) {
        window.FarmHouseUI?.showToast(message);
    }

    function saveCart() {
        if (!storageAvailable) return;
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(cart));
        } catch (error) {
            storageAvailable = false;
            console.warn("The preview basket could not be saved to browser storage.", error);
            showToast("Your basket is only available until this page is closed.");
        }
    }

    function updateCartCounts() {
        const count = cart.reduce((total, item) => total + item.quantity, 0);
        document.querySelectorAll("[data-cart-count]").forEach((element) => {
            element.textContent = String(count);
        });
        document.querySelectorAll("[data-cart-total-items]").forEach((element) => {
            element.textContent = String(count);
        });
    }

    function addToCart(productId, quantity) {
        const product = products.find((item) => item.id === Number(productId));
        const amount = Number(quantity);
        if (!product || !Number.isSafeInteger(amount) || amount < 1) {
            showToast("That product could not be added to your preview basket.");
            return;
        }
        const existing = cart.find((item) => item.id === product.id);
        if (existing) existing.quantity += amount;
        else cart.push({ id: product.id, quantity: amount });
        saveCart();
        updateCartCounts();
        renderCart();
        showToast(`${product.name} added to your basket.`);
    }

    function removeFromCart(productId) {
        cart = cart.filter((item) => item.id !== Number(productId));
        saveCart();
        updateCartCounts();
        renderCart();
        showToast("Item removed from your basket.");
    }

    async function placeOrder(customer) {
        if (!cart.length) throw new Error("Add at least one product to your basket.");
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customer,
                items: cart.map((item) => ({ productId: item.id, quantity: item.quantity }))
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The demo order could not be created.");
        cart = [];
        saveCart();
        updateCartCounts();
        renderCart();
        return result.order;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function createProductCard(product, compact) {
        const card = createElement("article", "product-card");
        const imageWrap = createElement("div", "product-image-wrap");
        const image = createElement("img", "product-image");
        image.src = product.picture;
        image.alt = product.name;
        image.loading = "lazy";
        const tag = createElement("span", "product-tag", product.category);
        imageWrap.append(image, tag);

        const body = createElement("div", "product-card-body");
        const category = createElement("span", "product-category", product.category);
        const name = createElement("h3", "", product.name);
        body.append(category, name);
        if (!compact) body.append(createElement("p", "", product.description));

        const bottom = createElement("div", "product-card-bottom");
        const price = createElement("strong", "product-price", `KSh ${Number(product.price).toLocaleString("en-KE")}`);
        const actions = createElement("div", "product-actions");
        const addButton = createElement("button", "button button-primary button-small", compact ? "Add" : "Add to basket");
        addButton.type = "button";
        addButton.dataset.addToCart = String(product.id);
        addButton.setAttribute("aria-label", `Add ${product.name} to basket`);
        actions.append(addButton);
        bottom.append(price, actions);
        body.append(bottom);
        card.append(imageWrap, body);
        return card;
    }

    function renderCart() {
        const container = document.getElementById("buyerCart");
        if (!container) return;
        container.replaceChildren();
        const lines = cart.map((entry) => {
            const product = products.find((item) => item.id === entry.id);
            return product ? { product, quantity: entry.quantity } : null;
        }).filter(Boolean);

        if (!lines.length) {
            const empty = createElement("div", "cart-empty");
            empty.append(createElement("i", "fa-solid fa-basket-shopping"));
            empty.append("Your basket is empty. Add something useful for your farm.");
            container.append(empty);
            updateCartCounts();
            return;
        }

        const list = createElement("div");
        let total = 0;
        lines.forEach(({ product, quantity }) => {
            total += Number(product.price) * quantity;
            const row = createElement("div", "cart-line");
            const description = createElement("span", "", `${product.name} × ${quantity}`);
            const end = createElement("span");
            end.append(createElement("strong", "", `KSh ${(Number(product.price) * quantity).toLocaleString("en-KE")} `));
            const remove = createElement("button", "cart-remove", "Remove");
            remove.type = "button";
            remove.dataset.cartRemove = String(product.id);
            remove.setAttribute("aria-label", `Remove ${product.name}`);
            end.append(remove);
            row.append(description, end);
            list.append(row);
        });
        container.append(list);

        const totalRow = createElement("div", "cart-total");
        totalRow.append(createElement("span", "", "Preview total"));
        totalRow.append(createElement("span", "", `KSh ${total.toLocaleString("en-KE")}`));
        container.append(totalRow);
        const checkout = createElement("button", "button button-primary cart-checkout", "Continue to checkout");
        checkout.type = "button";
        checkout.dataset.checkoutStart = "true";
        container.append(checkout);
        updateCartCounts();
    }

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-add-to-cart]");
        if (addButton) {
            addToCart(addButton.dataset.addToCart, 1);
            return;
        }
        const removeButton = event.target.closest("[data-cart-remove]");
        if (removeButton) removeFromCart(removeButton.dataset.cartRemove);
    });

    async function loadProducts() {
        const response = await fetch("/api/products");
        if (!response.ok) throw new Error(`Product request failed with status ${response.status}.`);
        const data = await response.json();
        if (!data || !Array.isArray(data.items)) throw new Error("The product API response must contain an items array.");
        products = data.items.filter((product) =>
            Number.isInteger(Number(product.id)) &&
            typeof product.name === "string" &&
            typeof product.category === "string" &&
            Number.isFinite(Number(product.price)) &&
            typeof product.picture === "string"
        ).map((product) => ({ ...product, id: Number(product.id), price: Number(product.price) }));
        updateCartCounts();
        renderCart();
        return products;
    }

    window.FarmHouseStore = {
        addToCart,
        createProductCard,
        loadProducts,
        placeOrder,
        products: () => [...products],
        renderCart
    };

    updateCartCounts();
})();
