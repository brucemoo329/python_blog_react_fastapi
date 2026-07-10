#!/usr/bin/env bash
# Generate a self-signed cert for public IP / host so browsers treat the site as HTTPS.
# Precise Geolocation requires a secure context (https:// or localhost).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="${CERT_DIR:-$ROOT_DIR/frontend/certs}"
HOST_IP="${1:-47.116.9.207}"
DAYS="${CERT_DAYS:-3650}"

mkdir -p "$CERT_DIR"

if [[ -f "$CERT_DIR/fullchain.pem" && -f "$CERT_DIR/privkey.pem" && "${FORCE_REGEN:-0}" != "1" ]]; then
  echo "Cert already exists in $CERT_DIR (set FORCE_REGEN=1 to overwrite)"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required"
  exit 1
fi

TMP_CONF="$(mktemp)"
cat >"$TMP_CONF" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn

[dn]
CN = ${HOST_IP}

[req_ext]
subjectAltName = @alt_names

[alt_names]
IP.1 = ${HOST_IP}
DNS.1 = localhost
IP.2 = 127.0.0.1
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -days "$DAYS" \
  -config "$TMP_CONF" \
  -extensions req_ext

chmod 600 "$CERT_DIR/privkey.pem"
chmod 644 "$CERT_DIR/fullchain.pem"
rm -f "$TMP_CONF"

echo "Generated:"
echo "  $CERT_DIR/fullchain.pem"
echo "  $CERT_DIR/privkey.pem"
echo "Open: https://${HOST_IP}/  (accept the browser warning for self-signed certs)"
