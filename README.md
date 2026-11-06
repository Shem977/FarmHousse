# FarmHouse demo backend

This is a local simulation built with Python's standard library and SQLite. It has no third-party package requirements and does not provide production authentication, payments, or deployment security.

## Run it

From the project root:

```powershell
python backend\server.py
```

Open `http://127.0.0.1:8000/`. On first startup, the server creates `backend\data\farmhouse.sqlite3` and loads the product and farmer fixtures from `frontend\data\JSON`. The SQLite file is generated and can be recreated by removing that file and restarting the server. Set `FARMHOUSE_DB_PATH` to use another database file.

Run the API integration tests from the project root with:

```powershell
python -m unittest backend.test_api
```

## Data model

`schema.sql` defines:

- `users`: buyer, farmer, and admin demo identities.
- `farmer_profiles`: farmer details linked to a user.
- `products`: product details, seller, price, inventory, and active state.
- `orders`: demo order header and buyer.
- `order_items`: product quantities and the unit price captured when ordered.

Foreign keys, uniqueness, and basic value checks are enforced by SQLite. The server enables SQLite foreign-key enforcement on every connection. It binds to `127.0.0.1` and is intended for local demos only.

## API

- `GET /api/health` — demo server status.
- `GET /api/products?category=Seeds&search=maize` — active products with seller and stock information.
- `GET /api/farmers?region=Central&search=John` — farmer profiles.
- `GET /api/orders` — sample and simulated order history.
- `POST /api/orders` — create a simulated order and decrement stock.

Example request:

```json
{
  "customer": {
    "name": "Demo Buyer",
    "email": "buyer@example.com"
  },
  "items": [
    { "productId": 1, "quantity": 2 }
  ]
}
```

The order endpoint records a demo buyer and order only; it does not collect credentials or process a payment.
