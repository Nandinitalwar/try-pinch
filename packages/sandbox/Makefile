.PHONY: install test docker-build docker-test clean

install:
	pip install -r requirements.txt

test:
	pytest -v

docker-build:
	docker compose build

docker-test:
	docker compose run --rm sandbox

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
