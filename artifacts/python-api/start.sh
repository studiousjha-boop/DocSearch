#!/bin/bash
set -e
cd /home/runner/workspace/artifacts/python-api

echo "Installing Python dependencies..."
python3 -m pip install --break-system-packages fastapi "uvicorn[standard]" python-multipart pypdf python-docx scikit-learn openai -q

echo "Starting FastAPI server on port $PORT..."
python3 main.py
