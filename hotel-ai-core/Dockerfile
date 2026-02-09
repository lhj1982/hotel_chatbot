FROM python:3.11-slim

WORKDIR /app

# Update CA certificates and install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install wheel for better compatibility
RUN pip install --upgrade pip setuptools wheel

# Copy pip configuration (workaround for SSL certificate issues)
COPY pip.conf /etc/pip.conf

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
