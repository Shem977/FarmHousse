const farmerGrid = document.getElementById("farmerList");
const farmerSearch = document.getElementById("farmerSearch");
const farmerResults = document.getElementById("farmerResults");
const regionButtons = document.querySelectorAll("[data-region]");
let farmerList = [];
let selectedRegion = "all";

function initialsFor(name) {
    return name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toLocaleUpperCase();
}

function renderFarmers() {
    const query = farmerSearch.value.trim().toLocaleLowerCase();
    const visibleFarmers = farmerList.filter((farmer) => {
        const searchable = `${farmer.name} ${farmer.region} ${farmer.items} ${farmer.crops.join(" ")}`.toLocaleLowerCase();
        return (selectedRegion === "all" || farmer.region === selectedRegion) && searchable.includes(query);
    });

    farmerGrid.replaceChildren();
    if (!visibleFarmers.length) {
        const empty = document.createElement("p");
        empty.className = "product-empty";
        empty.textContent = "No farmers match your search. Try another region or name.";
        farmerGrid.append(empty);
    } else {
        visibleFarmers.forEach((farmer) => {
            const card = document.createElement("article");
            card.className = "farmer-card";
            const top = document.createElement("div");
            top.className = "farmer-card-top";
            const avatar = document.createElement("span");
            avatar.className = "farmer-avatar";
            avatar.textContent = initialsFor(farmer.name);
            const profile = document.createElement("div");
            const name = document.createElement("h3");
            name.textContent = farmer.name;
            const region = document.createElement("p");
            const locationIcon = document.createElement("i");
            locationIcon.className = "fa-solid fa-location-dot";
            region.append(locationIcon, ` ${farmer.region} region`);
            profile.append(name, region);
            top.append(avatar, profile);

            const meta = document.createElement("div");
            meta.className = "farmer-meta";
            const experience = document.createElement("span");
            experience.textContent = farmer.experience;
            const rating = document.createElement("span");
            rating.className = "rating";
            const star = document.createElement("i");
            star.className = "fa-solid fa-star";
            rating.append(star, ` ${Number(farmer.rating).toFixed(1)}`);
            meta.append(experience, rating);

            const about = document.createElement("p");
            about.textContent = farmer.about;
            about.style.minHeight = "3.2em";
            about.style.marginBottom = "13px";
            about.style.fontSize = ".83rem";
            const crops = document.createElement("div");
            crops.className = "farmer-crops";
            farmer.crops.forEach((crop) => {
                const tag = document.createElement("span");
                tag.textContent = crop;
                crops.append(tag);
            });
            card.append(top, meta, about, crops);
            farmerGrid.append(card);
        });
    }

    farmerResults.textContent = `${visibleFarmers.length} ${visibleFarmers.length === 1 ? "farmer" : "farmers"} shown · Sample profiles`;
}

regionButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedRegion = button.dataset.region;
        regionButtons.forEach((item) => {
            const isSelected = item === button;
            item.classList.toggle("active", isSelected);
            item.setAttribute("aria-pressed", String(isSelected));
        });
        renderFarmers();
    });
});

farmerSearch.addEventListener("input", renderFarmers);

fetch("/api/farmers")
    .then((response) => {
        if (!response.ok) throw new Error(`Farmer request failed with status ${response.status}.`);
        return response.json();
    })
    .then((data) => {
        if (!data || !Array.isArray(data.items)) throw new Error("The farmer API response must contain an items array.");
        farmerList = data.items.filter((farmer) =>
            typeof farmer.name === "string" &&
            typeof farmer.region === "string" &&
            Array.isArray(farmer.crops) &&
            typeof farmer.experience === "string" &&
            Number.isFinite(Number(farmer.rating))
        );
        renderFarmers();
    })
    .catch((error) => {
        console.error("Could not load farmer profiles.", error);
        farmerGrid.replaceChildren();
        const message = document.createElement("p");
        message.className = "error-message";
        message.textContent = "We couldn’t load farmer profiles right now. Please try again later.";
        farmerGrid.append(message);
        farmerResults.textContent = "Farmer profiles are temporarily unavailable.";
    });
