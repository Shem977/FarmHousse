import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from backend import db
from backend.server import FarmHouseHandler


class FarmHouseApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_file = Path(self.temp_dir.name) / "test.sqlite3"
        self.previous_database_path = os.environ.get("FARMHOUSE_DB_PATH")
        os.environ["FARMHOUSE_DB_PATH"] = str(self.database_file)
        db.initialize_database(self.database_file)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FarmHouseHandler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.server_thread.join(timeout=2)
        if self.previous_database_path is None:
            os.environ.pop("FARMHOUSE_DB_PATH", None)
        else:
            os.environ["FARMHOUSE_DB_PATH"] = self.previous_database_path
        self.temp_dir.cleanup()

    def request_json(self, path: str, payload: dict | None = None) -> tuple[int, dict]:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers=headers,
        )
        try:
            with urllib.request.urlopen(request, timeout=3) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_api_lists_seeded_products_and_supports_filters(self) -> None:
        status, response = self.request_json("/api/products?category=Seeds&search=maize")
        self.assertEqual(status, 200)
        self.assertEqual(len(response["items"]), 1)
        self.assertEqual(response["items"][0]["name"], "High Yield Maize Seed")
        self.assertEqual(response["items"][0]["farmer"], "John Kamau")

    def test_api_lists_seeded_farmers(self) -> None:
        status, response = self.request_json("/api/farmers?region=Central")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(response["items"]), 3)
        self.assertEqual(response["items"][0]["name"], "John Kamau")
        self.assertIsInstance(response["items"][0]["crops"], list)

    def test_order_api_creates_order_and_updates_inventory(self) -> None:
        status, response = self.request_json(
            "/api/orders",
            {
                "customer": {"name": "Demo Buyer", "email": "newbuyer@example.com"},
                "items": [{"productId": 1, "quantity": 2}],
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(response["order"]["orderNumber"], "FH-2048")
        self.assertEqual(response["order"]["totalAmount"], 5200)
        self.assertTrue(response["demo"])

        products_status, products = self.request_json("/api/products?search=High%20Yield")
        self.assertEqual(products_status, 200)
        self.assertEqual(products["items"][0]["stock"], 82)

    def test_invalid_order_does_not_change_inventory(self) -> None:
        status, response = self.request_json(
            "/api/orders",
            {
                "customer": {"name": "Demo Buyer", "email": "newbuyer@example.com"},
                "items": [{"productId": 999, "quantity": 1}],
            },
        )
        self.assertEqual(status, 400)
        self.assertIn("not available", response["error"])
        products_status, products = self.request_json("/api/products?search=High%20Yield")
        self.assertEqual(products_status, 200)
        self.assertEqual(products["items"][0]["stock"], 84)

    def test_server_serves_frontend_and_health_check(self) -> None:
        status, health = self.request_json("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(health["database"], "sqlite")

        with urllib.request.urlopen(f"{self.base_url}/", timeout=3) as response:
            self.assertEqual(response.status, 200)
            self.assertIn(b"FarmHouse", response.read())


if __name__ == "__main__":
    unittest.main()
