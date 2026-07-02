FROM python:3.12-slim

# Install system dependencies for pdfplumber, PyMuPDF, WeasyPrint, and Camelot
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpoppler-cpp-dev \
    poppler-utils \
    libcairo2-dev \
    libpango1.0-dev \
    libffi-dev \
    libgdk-pixbuf2.0-dev \
    shared-mime-info \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure storage directory exists inside container
RUN mkdir -p /app/storage/uploads

EXPOSE 8000
