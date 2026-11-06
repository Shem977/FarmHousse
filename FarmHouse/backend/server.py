import json
import logging
import mimetypes
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

if __package__:
    from . import db
else:
    import db


HOST = "127.0.0.1"
PORT = 8000
MAX_REQUEST_BYTES = 64 * 1024
PROJECT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_DIR / "frontend"
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("farmhouse")


class FarmHouseHandler(BaseHTTPRequestHandler):
    server_version = "FarmHouseDemo/1.0"

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: HTTPStatus, message: str) -> None:
        self.send_json(status, {"error": message})

    def do_GET(self) -> None:
        try:
            parsed_url = urlsplit(self.path)
            path = unquote(parsed_url.path)
            query = parse_qs(parsed_url.query, max_num_fields=20)
            if path == "/api/health":
                self.send_json(HTTPStatus.OK, {"status": "ok", "database": "sqlite", "mode": "demo"})
                return
            if path == "/api/products":
                self.send_json(
                    HTTPStatus.OK,
                    {
                        "items": db.list_products(
                            category=self._query_value(query, "category"),
                            search=self._query_value(query, "search"),
                        )
                    },
                )
                return
            if path == "/api/farmers":
                self.send_json(
                    HTTPStatus.OK,
                    {
                        "items": db.list_farmers(
                            region=self._query_value(query, "region"),
                            search=self._query_value(query, "search"),
                        )
                    },
                )
                return
            if path == "/api/orders":
                self.send_json(HTTPStatus.OK, {"items": db.list_orders()})
                return
            if path.startswith("/api/"):
                self.send_error_json(HTTPStatus.NOT_FOUND, "API route not found.")
                return
            self._serve_static_file(path)
        except ValueError as error:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(error))
        except OSError:
            LOGGER.exception("Could not serve GET %s", path)
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "The request could not be completed.")
        except Exception:
            LOGGER.exception("Unexpected error handling GET %s", path)
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "The request could not be completed.")

    def do_POST(self) -> None:
        path = unquote(urlsplit(self.path).path)
        if path != "/api/orders":
            self.send_error_json(HTTPStatus.NOT_FOUND, "API route not found.")
            return

        try:
            payload = self._read_json_body()
            name, email, items = self._validate_order(payload)
            order = db.create_order(name, email, items)
        except ValueError as error:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(error))
            return
        except OSError:
            LOGGER.exception("Could not create an order.")
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "The order could not be saved.")
            return
        except Exception:
            LOGGER.exception("Unexpected error creating an order.")
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "The order could not be saved.")
            return

        self.send_json(HTTPStatus.CREATED, {"order": order, "demo": True})

    def do_HEAD(self) -> None:
        path = unquote(urlsplit(self.path).path)
        if path.startswith("/api/"):
            self.send_error_json(HTTPStatus.METHOD_NOT_ALLOWED, "HEAD is not supported for API routes.")
            return
        self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def _query_value(self, query: dict[str, list[str]], key: str) -> str:
        value = query.get(key, [""])[0].strip()
        if len(value) > 100:
            raise ValueError(f"{key} must be 100 characters or fewer.")
        return value

    def _read_json_body(self) -> dict[str, Any]:
        if self.headers.get_content_type() != "application/json":
            raise ValueError("Content-Type must be application/json.")
        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError as error:
            raise ValueError("A valid Content-Length header is required.") from error
        if content_length < 1:
            raise ValueError("A JSON request body is required.")
        if content_length > MAX_REQUEST_BYTES:
            raise ValueError("The request body is too large.")
        try:
            payload = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ValueError("The request body must be valid JSON.") from error
        if not isinstance(payload, dict):
            raise ValueError("The request body must be a JSON object.")
        return payload

    def _validate_order(self, payload: dict[str, Any]) -> tuple[str, str, list[dict[str, int]]]:
        customer = payload.get("customer")
        items = payload.get("items")
        if not isinstance(customer, dict):
            raise ValueError("A customer name and email are required.")

        name = customer.get("name")
        email = customer.get("email")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
            raise ValueError("Customer name must be between 1 and 80 characters.")
        if not isinstance(email, str) or len(email.strip()) > 254 or not EMAIL_PATTERN.fullmatch(email.strip()):
            raise ValueError("Enter a valid customer email address.")
        if not isinstance(items, list) or not 1 <= len(items) <= 50:
            raise ValueError("An order must contain between 1 and 50 product lines.")

        validated_items: list[dict[str, int]] = []
        for item in items:
            if not isinstance(item, dict):
                raise ValueError("Each order line must include a productId and quantity.")
            product_id = item.get("productId")
            quantity = item.get("quantity")
            if isinstance(product_id, bool) or not isinstance(product_id, int) or product_id < 1:
                raise ValueError("Each productId must be a positive integer.")
            if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 100:
                raise ValueError("Each quantity must be an integer from 1 to 100.")
            validated_items.append({"productId": product_id, "quantity": quantity})

        return name.strip(), email.strip().lower(), validated_items

    def _serve_static_file(self, url_path: str) -> None:
        if url_path == "/":
            requested_file = (FRONTEND_DIR / "index.html").resolve()
        elif url_path.startswith("/frontend/"):
            requested_file = (PROJECT_DIR / url_path.lstrip("/")).resolve()
        else:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            requested_file.relative_to(FRONTEND_DIR.resolve())
        except ValueError:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not requested_file.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            content = requested_file.read_bytes()
        except OSError:
            LOGGER.exception("Could not read static file %s", requested_file)
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        content_type, _encoding = mimetypes.guess_type(str(requested_file))
        if content_type and content_type.startswith("text/"):
            content_type += "; charset=utf-8"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format_string: str, *args: Any) -> None:
        LOGGER.info("%s - %s", self.address_string(), format_string % args)


def main() -> None:
    database_path = db.initialize_database()
    server = ThreadingHTTPServer((HOST, PORT), FarmHouseHandler)
    LOGGER.info("SQLite database ready at %s", database_path)
    LOGGER.info("FarmHouse demo server running at http://%s:%s", HOST, PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("Shutting down FarmHouse demo server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
