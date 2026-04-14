.PHONY: install test eval clean

install:
	pip install -r requirements.txt

# Layer 1 — fast, no API key.
test:
	pytest -v

# Layer 2 — live eval. Requires GOOGLE_AI_API_KEY.
eval:
	python scripts/run_eval.py

eval-pro:
	python scripts/run_eval.py --model gemini-2.5-pro --out results/pro.md

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
