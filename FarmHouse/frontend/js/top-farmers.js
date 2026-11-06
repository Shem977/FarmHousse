const topFarmersGrid = document.getElementById("top-farmers");

function createTopFarmerCard(farmer) {
    const card = document.createElement("article");
    card.className = "farmer-card";

    const header = document.createElement("div");
    header.className = "farmer-card-top";

    const avatar = document.createElement("span");
    avatar.className = "farmer-avatar";
    avatar.textContent = farmer.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toLocaleUpperCase();

    const profile = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = farmer.name;
    const region = document.createElement("p");
    const locationIcon = document.createElement("i");
    locationIcon.className = "fa-solid fa-location-dot";
    region.append(locationIcon, ` ${farmer.region} region`);
    profile.append(name, region);
    header.append(avatar, profile);

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
    const crops = document.createElement("div");
    crops.className = "farmer-crops";
    farmer.crops.slice(0, 3).forEach((crop) => {
        const tag = document.createElement("span");
        tag.textContent = crop;
        crops.append(tag);
    });

    card.append(header, meta, about, crops);
    return card;
}

fetch("/api/farmers")
    .then((response) => {
        if (!response.ok) throw new Error(`Farmer request failed with status ${response.status}.`);
        return response.json();
    })
    .then((data) => {
        if (!data || !Array.isArray(data.items)) throw new Error("The farmer API response must contain an items array.");
        const featuredFarmers = data.items
            .filter((farmer) =>
                typeof farmer.name === "string" &&
                typeof farmer.region === "string" &&
                Array.isArray(farmer.crops) &&
                typeof farmer.experience === "string" &&
                typeof farmer.about === "string" &&
                Number.isFinite(Number(farmer.rating))
            )
            .sort((first, second) => Number(second.score || 0) - Number(first.score || 0))
            .slice(0, 5);

        topFarmersGrid.replaceChildren();
        if (featuredFarmers.length < 5) {
            throw new Error(`At least five valid farmer profiles are required; found ${featuredFarmers.length}.`);
        }
        featuredFarmers.forEach((farmer) => topFarmersGrid.append(createTopFarmerCard(farmer)));
    })
    .catch((error) => {
        console.error("Could not load the featured farmers.", error);
        topFarmersGrid.replaceChildren();
        const message = document.createElement("p");
        message.className = "error-message";
        message.textContent = "We couldn’t load farmer profiles right now. Please try again later.";
        topFarmersGrid.append(message);
    });
