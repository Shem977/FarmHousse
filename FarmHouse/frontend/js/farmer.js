const listingFormWrap = document.getElementById("listingFormWrap");
const listingForm = document.getElementById("listingForm");
const listingRows = document.getElementById("farmerProducts");
const listingCount = document.getElementById("farmerProductCount");

document.getElementById("showListingForm").addEventListener("click", () => {
    listingFormWrap.hidden = !listingFormWrap.hidden;
    if (!listingFormWrap.hidden) listingForm.querySelector('[name="name"]').focus();
});

document.getElementById("cancelListing").addEventListener("click", () => {
    listingForm.reset();
    listingFormWrap.hidden = true;
});

listingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!listingForm.reportValidity()) return;

    const formData = new FormData(listingForm);
    const name = formData.get("name").trim();
    const category = formData.get("category");
    const price = Number(formData.get("price"));
    const quantity = Number(formData.get("quantity"));
    if (!name || !Number.isSafeInteger(price) || price < 1 || !Number.isSafeInteger(quantity) || quantity < 1) return;

    const row = document.createElement("tr");
    const cells = [name, category, `KSh ${price.toLocaleString("en-KE")}`, `${quantity} units`];
    cells.forEach((value, index) => {
        const cell = document.createElement("td");
        if (index === 0) {
            const productName = document.createElement("strong");
            productName.textContent = value;
            cell.append(productName);
        } else {
            cell.textContent = value;
        }
        row.append(cell);
    });
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "status-dot";
    status.textContent = "Preview";
    statusCell.append(status);
    row.append(statusCell);
    listingRows.prepend(row);
    listingCount.textContent = String(listingRows.querySelectorAll("tr").length);
    listingForm.reset();
    listingFormWrap.hidden = true;
    window.FarmHouseUI?.showToast("Listing added to this preview only.");
});
