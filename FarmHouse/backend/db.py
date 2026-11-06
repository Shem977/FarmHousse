import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "farmhouse.sqlite3"
PRODUCTS_PATH = PROJECT_DIR / "frontend" / "data" / "JSON" / "products.json"
FARMERS_PATH = PROJECT_DIR / "frontend" / "data" / "JSON" / "farmers.json"
PRODUCT_STOCK = {1: 84, 2: 52, 3: 31, 4: 68, 5: 12, 6: 25}
PRODUCT_SELLERS = {1: 1, 2: 2, 3: 1, 4: 3, 5: 2, 6: 4}


def database_path() -> Path:
    configured_path = os.environ.get("FARMHOUSE_DB_PATH")
    return Path(configured_path).expanduser().resolve() if configured_path else DEFAULT_DB_PATH


def connect(path: Path | None = None) -> sqlite3.Connection:
    db_path = path or database_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def connection_scope(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    connection = connect(path)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _read_fixture(path: Path) -> list[dict[str, Any]]:
    try:
        with path.open(encoding="utf-8") as fixture:
            data = json.load(fixture)
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Could not load mock data from {path}: {error}") from error
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        raise RuntimeError(f"Mock data in {path} must be a JSON array of objects.")
    return data


def _seed_database(connection: sqlite3.Connection) -> None:
    farmers = _read_fixture(FARMERS_PATH)
    products = _read_fixture(PRODUCTS_PATH)

    for farmer in farmers:
        farmer_id = int(farmer["id"])
        connection.execute(
            "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, 'farmer')",
            (farmer_id, farmer["name"], f"farmer{farmer_id}@farmhouse.example"),
        )
        connection.execute(
            """
            INSERT INTO farmer_profiles
                (user_id, region, items, crops_json, experience, rating, score, about)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                farmer_id,
                farmer["region"],
                farmer["items"],
                json.dumps(farmer.get("crops", [])),
                farmer.get("experience", "Local farmer"),
                float(farmer.get("rating", 0)),
                int(farmer.get("score", 0)),
                farmer.get("about", ""),
            ),
        )

    for product in products:
        product_id = int(product["id"])
        seller_id = PRODUCT_SELLERS.get(product_id, int(farmers[0]["id"]))
        connection.execute(
            """
            INSERT INTO products
                (id, seller_id, name, category, price, picture, description, stock_quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                product_id,
                seller_id,
                product["name"],
                product["category"],
                int(product["price"]),
                product["picture"],
                product["description"],
                PRODUCT_STOCK.get(product_id, 20),
            ),
        )

    connection.executemany(
        "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, 'buyer')",
        [
            (101, "Mary Wanjiku", "mary.w@email.example"),
            (102, "Joseph Otieno", "joseph.o@email.example"),
            (103, "Grace Kamau", "grace.k@email.example"),
        ],
    )
    connection.execute(
        "INSERT INTO users (id, name, email, role) VALUES (999, 'Demo Admin', 'admin@farmhouse.example', 'admin')"
    )
    connection.executemany(
        """
        INSERT INTO orders (id, order_number, customer_id, status, total_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (1, "FH-2047", 102, "delivered", 2600, "2026-11-06 06:18:00"),
            (2, "FH-2046", 103, "pending", 8350, "2026-11-05 13:36:00"),
            (3, "FH-2045", 101, "delivered", 5200, "2026-11-05 10:02:00"),
        ],
    )
    connection.executemany(
        """
        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
        VALUES (?, ?, ?, ?)
        """,
        [
            (1, 1, 1, 2600),
            (2, 2, 1, 1800),
            (2, 3, 1, 2400),
            (2, 5, 1, 2200),
            (2, 6, 1, 1950),
            (3, 2, 1, 1800),
            (3, 4, 1, 1450),
            (3, 6, 1, 1950),
        ],
    )


def initialize_database(path: Path | None = None) -> Path:
    db_path = path or database_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    schema_path = BACKEND_DIR / "schema.sql"
    try:
        schema = schema_path.read_text(encoding="utf-8")
    except OSError as error:
        raise RuntimeError(f"Could not read the database schema at {schema_path}: {error}") from error

    with connection_scope(db_path) as connection:
        connection.executescript(schema)
        existing_users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if existing_users == 0:
            _seed_database(connection)
    return db_path


def list_products(category: str = "", search: str = "") -> list[dict[str, Any]]:
    query = """
        SELECT p.id, p.name, p.category, p.price, p.picture, p.description,
               p.stock_quantity AS stock, u.name AS farmer, fp.region
        FROM products AS p
        JOIN users AS u ON u.id = p.seller_id
        LEFT JOIN farmer_profiles AS fp ON fp.user_id = u.id
        WHERE p.active = 1
    """
    parameters: list[str] = []
    if category:
        query += " AND p.category = ?"
        parameters.append(category)
    if search:
        query += " AND (p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?)"
        term = f"%{search}%"
        parameters.extend((term, term, term))
    query += " ORDER BY p.id"
    with connection_scope() as connection:
        return [dict(row) for row in connection.execute(query, parameters).fetchall()]


def list_farmers(region: str = "", search: str = "") -> list[dict[str, Any]]:
    query = """
        SELECT u.id, u.name, fp.region, fp.items, fp.crops_json, fp.experience,
               fp.rating, fp.score, fp.about
        FROM farmer_profiles AS fp
        JOIN users AS u ON u.id = fp.user_id
        WHERE 1 = 1
    """
    parameters: list[str] = []
    if region:
        query += " AND fp.region = ?"
        parameters.append(region)
    if search:
        query += " AND (u.name LIKE ? OR fp.items LIKE ? OR fp.about LIKE ? OR fp.region LIKE ?)"
        term = f"%{search}%"
        parameters.extend((term, term, term, term))
    query += " ORDER BY fp.score DESC, u.name"
    with connection_scope() as connection:
        farmers = []
        for row in connection.execute(query, parameters).fetchall():
            farmer = dict(row)
            farmer["crops"] = json.loads(farmer.pop("crops_json"))
            farmers.append(farmer)
        return farmers


def list_orders() -> list[dict[str, Any]]:
    with connection_scope() as connection:
        orders = connection.execute(
            """
            SELECT o.id, o.order_number AS orderNumber, u.name AS customer,
                   u.email, o.status, o.total_amount AS totalAmount, o.created_at AS createdAt
            FROM orders AS o
            JOIN users AS u ON u.id = o.customer_id
            ORDER BY o.id DESC
            """
        ).fetchall()
        results = []
        for order_row in orders:
            order = dict(order_row)
            order["items"] = [
                dict(item)
                for item in connection.execute(
                    """
                    SELECT p.id AS productId, p.name, oi.quantity, oi.unit_price AS unitPrice
                    FROM order_items AS oi
                    JOIN products AS p ON p.id = oi.product_id
                    WHERE oi.order_id = ?
                    ORDER BY oi.id
                    """,
                    (order["id"],),
                ).fetchall()
            ]
            results.append(order)
        return results


def create_order(name: str, email: str, requested_items: list[dict[str, int]]) -> dict[str, Any]:
    if not requested_items:
        raise ValueError("Add at least one product to the order.")

    quantities: dict[int, int] = {}
    for item in requested_items:
        product_id = item.get("productId")
        quantity = item.get("quantity")
        if isinstance(product_id, bool) or not isinstance(product_id, int) or product_id < 1:
            raise ValueError("Each productId must be a positive integer.")
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1 or quantity > 100:
            raise ValueError("Each quantity must be an integer from 1 to 100.")
        quantities[product_id] = quantities.get(product_id, 0) + quantity
        if quantities[product_id] > 100:
            raise ValueError("The maximum quantity per product is 100.")

    with connection_scope() as connection:
        connection.execute("BEGIN IMMEDIATE")
        products: list[dict[str, Any]] = []
        for product_id, quantity in quantities.items():
            row = connection.execute(
                """
                SELECT id, name, price, stock_quantity
                FROM products WHERE id = ? AND active = 1
                """,
                (product_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Product {product_id} is not available.")
            if row["stock_quantity"] < quantity:
                raise ValueError(f"Only {row['stock_quantity']} units of {row['name']} are available.")
            products.append({**dict(row), "quantity": quantity})

        buyer = connection.execute(
            "SELECT id, role FROM users WHERE email = ? COLLATE NOCASE",
            (email,),
        ).fetchone()
        if buyer is not None and buyer["role"] != "buyer":
            raise ValueError("This email is already associated with a non-buyer account.")
        if buyer is None:
            cursor = connection.execute(
                "INSERT INTO users (name, email, role) VALUES (?, ?, 'buyer')",
                (name, email),
            )
            customer_id = cursor.lastrowid
        else:
            customer_id = buyer["id"]
            connection.execute("UPDATE users SET name = ? WHERE id = ?", (name, customer_id))

        total_amount = sum(product["price"] * product["quantity"] for product in products)
        next_order_number = connection.execute(
            """
            SELECT COALESCE(MAX(CAST(SUBSTR(order_number, 4) AS INTEGER)), 2040) + 1
            FROM orders
            """
        ).fetchone()[0]
        order_number = f"FH-{next_order_number}"
        cursor = connection.execute(
            """
            INSERT INTO orders (order_number, customer_id, status, total_amount)
            VALUES (?, ?, 'processing', ?)
            """,
            (order_number, customer_id, total_amount),
        )
        order_id = cursor.lastrowid
        for product in products:
            connection.execute(
                """
                INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                VALUES (?, ?, ?, ?)
                """,
                (order_id, product["id"], product["quantity"], product["price"]),
            )
            connection.execute(
                "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?",
                (product["quantity"], product["id"]),
            )

        created_at = connection.execute(
            "SELECT created_at FROM orders WHERE id = ?", (order_id,)
        ).fetchone()[0]

    return {
        "id": order_id,
        "orderNumber": order_number,
        "customer": name,
        "email": email,
        "status": "processing",
        "totalAmount": total_amount,
        "createdAt": created_at,
        "items": [
            {
                "productId": product["id"],
                "name": product["name"],
                "quantity": product["quantity"],
                "unitPrice": product["price"],
            }
            for product in products
        ],
    }
