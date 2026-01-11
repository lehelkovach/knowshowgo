#!/usr/bin/env bash
set -euo pipefail

# Provision an OCI (Oracle Cloud) VM and deploy KnowShowGo via cloud-init.
#
# Requirements (on your machine):
# - OCI CLI authenticated (oci setup config)
# - jq
#
# Required env vars:
# - OCI_COMPARTMENT_OCID: target compartment OCID
# - OCI_SSH_PUBLIC_KEY_FILE: path to an SSH public key (e.g. ~/.ssh/id_ed25519.pub)
#
# Optional env vars:
# - OCI_REGION: override region (otherwise uses OCI CLI config)
# - OCI_PREFIX: resource name prefix (default: knowshowgo)
# - OCI_VCN_CIDR: default 10.0.0.0/16
# - OCI_SUBNET_CIDR: default 10.0.0.0/24
# - OCI_SHAPE: default VM.Standard.E2.1.Micro (Always Free where available)
# - OCI_UBUNTU_VERSION: default 22.04
# - OCI_INSTANCE_OCPUS / OCI_INSTANCE_MEMORY_GBS: for Flex shapes (optional)
# - KSG_PORT: default 3000
# - ARANGO_ROOT_PASSWORD: default random
# - OPENAI_API_KEY / OPENAI_EMBED_MODEL: enable OpenAI embeddings in deployed service
# - ENV_OUT_FILE: write a local .env copy (default: ./knowshowgo.env)
# - PRINT_ENV: if "1", prints the generated env file to console (includes secrets!)
#
# Security:
# - Opens inbound TCP 22 and 3000 to the world.
# - Does NOT expose ArangoDB (8529) publicly.

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing dependency: $1" >&2
    exit 1
  }
}

need oci
need jq

: "${OCI_COMPARTMENT_OCID:?set OCI_COMPARTMENT_OCID}"
: "${OCI_SSH_PUBLIC_KEY_FILE:?set OCI_SSH_PUBLIC_KEY_FILE}"

if [[ ! -f "$OCI_SSH_PUBLIC_KEY_FILE" ]]; then
  echo "SSH public key file not found: $OCI_SSH_PUBLIC_KEY_FILE" >&2
  exit 1
fi

OCI_PREFIX="${OCI_PREFIX:-knowshowgo}"
OCI_VCN_CIDR="${OCI_VCN_CIDR:-10.0.0.0/16}"
OCI_SUBNET_CIDR="${OCI_SUBNET_CIDR:-10.0.0.0/24}"
OCI_SHAPE="${OCI_SHAPE:-VM.Standard.E2.1.Micro}"
OCI_UBUNTU_VERSION="${OCI_UBUNTU_VERSION:-22.04}"
KSG_PORT="${KSG_PORT:-3000}"
ENV_OUT_FILE="${ENV_OUT_FILE:-./knowshowgo.env}"
PRINT_ENV="${PRINT_ENV:-0}"

if [[ -z "${ARANGO_ROOT_PASSWORD:-}" ]]; then
  # Simple random; you can override with ARANGO_ROOT_PASSWORD env var.
  ARANGO_ROOT_PASSWORD="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Optional: set OPENAI_API_KEY to enable real embeddings."
  read -r -s -p "Enter OPENAI_API_KEY (leave blank to skip): " OPENAI_API_KEY || true
  echo
fi
OPENAI_EMBED_MODEL="${OPENAI_EMBED_MODEL:-text-embedding-3-small}"
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  read -r -p "OpenAI embed model [${OPENAI_EMBED_MODEL}]: " _m || true
  if [[ -n "${_m:-}" ]]; then OPENAI_EMBED_MODEL="$_m"; fi
fi

ts="$(date +%Y%m%d-%H%M%S)"
name="${OCI_PREFIX}-${ts}"

echo "Provisioning in compartment: $OCI_COMPARTMENT_OCID"
echo "Resource prefix: $name"
echo "Shape: $OCI_SHAPE"

if [[ -n "${OCI_REGION:-}" ]]; then
  OCI_REGION_FLAG=(--region "$OCI_REGION")
else
  OCI_REGION_FLAG=()
fi

ad="$(oci iam availability-domain list "${OCI_REGION_FLAG[@]}" --compartment-id "$OCI_COMPARTMENT_OCID" \
  --query 'data[0].name' --raw-output)"
echo "Availability domain: $ad"

echo "Creating VCN..."
vcn_id="$(oci network vcn create "${OCI_REGION_FLAG[@]}" --compartment-id "$OCI_COMPARTMENT_OCID" \
  --display-name "${name}-vcn" --cidr-block "$OCI_VCN_CIDR" \
  --query 'data.id' --raw-output)"

ig_id="$(oci network internet-gateway create "${OCI_REGION_FLAG[@]}" --compartment-id "$OCI_COMPARTMENT_OCID" \
  --vcn-id "$vcn_id" --is-enabled true --display-name "${name}-ig" \
  --query 'data.id' --raw-output)"

rt_id="$(oci network route-table create "${OCI_REGION_FLAG[@]}" --compartment-id "$OCI_COMPARTMENT_OCID" \
  --vcn-id "$vcn_id" --display-name "${name}-rt" \
  --route-rules "[{\"cidrBlock\":\"0.0.0.0/0\",\"networkEntityId\":\"$ig_id\"}]" \
  --query 'data.id' --raw-output)"

echo "Creating security list (22 + ${KSG_PORT} only)..."
seclist_id="$(oci network security-list create "${OCI_REGION_FLAG[@]}" --compartment-id "$OCI_COMPARTMENT_OCID" \
  --vcn-id "$vcn_id" --display-name "${name}-seclist" \
  --egress-security-rules '[{"protocol":"all","destination":"0.0.0.0/0","isStateless":false}]' \
  --ingress-security-rules "[
    {\"protocol\":\"6\",\"source\":\"0.0.0.0/0\",\"isStateless\":false,\"tcpOptions\":{\"destinationPortRange\":{\"min\":22,\"max\":22}}},
    {\"protocol\":\"6\",\"source\":\"0.0.0.0/0\",\"isStateless\":false,\"tcpOptions\":{\"destinationPortRange\":{\"min\":${KSG_PORT},\"max\":${KSG_PORT}}}}
  ]" \
  --query 'data.id' --raw-output)"

echo "Creating subnet..."
subnet_id="$(oci network subnet create "${OCI_REGION_FLAG[@]}" --compartment-id "$OCI_COMPARTMENT_OCID" \
  --vcn-id "$vcn_id" --display-name "${name}-subnet" \
  --cidr-block "$OCI_SUBNET_CIDR" --route-table-id "$rt_id" \
  --security-list-ids "[\"$seclist_id\"]" --prohibit-public-ip-on-vnic false \
  --query 'data.id' --raw-output)"

echo "Finding Ubuntu image OCID for ${OCI_UBUNTU_VERSION}..."
image_id="$(oci compute image list "${OCI_REGION_FLAG[@]}" --compartment-id "$OCI_COMPARTMENT_OCID" \
  --operating-system "Canonical Ubuntu" --operating-system-version "$OCI_UBUNTU_VERSION" \
  --shape "$OCI_SHAPE" --sort-by TIMECREATED --sort-order DESC \
  --query 'data[0].id' --raw-output)"

if [[ -z "$image_id" || "$image_id" == "null" ]]; then
  echo "Could not find an Ubuntu image for shape=$OCI_SHAPE and version=$OCI_UBUNTU_VERSION." >&2
  echo "Try setting OCI_SHAPE to an Always-Free available shape in your region (e.g., VM.Standard.A1.Flex)." >&2
  exit 1
fi

ssh_pub="$(cat "$OCI_SSH_PUBLIC_KEY_FILE")"

env_content="$(cat <<EOF
# Generated $(date -Is)
ARANGO_ROOT_PASSWORD=${ARANGO_ROOT_PASSWORD}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_EMBED_MODEL=${OPENAI_EMBED_MODEL}
EOF
)"

echo "$env_content" > "$ENV_OUT_FILE"
chmod 600 "$ENV_OUT_FILE" || true
echo "Wrote local env file: $ENV_OUT_FILE"
if [[ "$PRINT_ENV" == "1" ]]; then
  echo
  echo "===== ${ENV_OUT_FILE} (contains secrets) ====="
  echo "$env_content"
  echo "============================================="
  echo
else
  echo "Not printing env to console (set PRINT_ENV=1 to print)."
fi

ENV_B64="$(printf "%s" "$env_content" | base64 -w 0)"

cloud_init="$(cat <<CLOUDINIT
#cloud-config
package_update: true
packages:
  - ca-certificates
  - curl
  - git

runcmd:
  # Install Docker (includes docker compose plugin on Ubuntu)
  - [ sh, -lc, "curl -fsSL https://get.docker.com | sh" ]
  - [ sh, -lc, "systemctl enable --now docker" ]

  # Deploy KnowShowGo
  - [ sh, -lc, "mkdir -p /opt/knowshowgo" ]
  - [ sh, -lc, "cd /opt/knowshowgo && (test -d repo && cd repo && git fetch --all --prune && git reset --hard origin/main || git clone https://github.com/lehelkovach/knowshowgo.git repo)" ]
  - [ sh, -lc, "cd /opt/knowshowgo/repo && printf '%s' '${ENV_B64}' | base64 -d > .env && chmod 600 .env" ]
  - [ sh, -lc, "cd /opt/knowshowgo/repo && docker compose up -d --build" ]

  # Seed minimal ontology for osl-agent-prototype (idempotent)
  - [ sh, -lc, "sleep 12" ]
  - [ sh, -lc, "curl -sS -X POST http://localhost:${KSG_PORT}/api/seed/osl-agent >/opt/knowshowgo/seed.json || true" ]
CLOUDINIT
)"

# OCI expects base64 user_data
user_data_b64="$(printf "%s" "$cloud_init" | base64 -w 0)"

echo "Creating instance..."
shape_config_args=()
if [[ -n "${OCI_INSTANCE_OCPUS:-}" || -n "${OCI_INSTANCE_MEMORY_GBS:-}" ]]; then
  # Only relevant for Flex shapes; safe to pass when set.
  ocpus="${OCI_INSTANCE_OCPUS:-1}"
  mem="${OCI_INSTANCE_MEMORY_GBS:-6}"
  shape_config_args=(--shape-config "{\"ocpus\":${ocpus},\"memoryInGBs\":${mem}}")
fi

instance_id="$(oci compute instance launch "${OCI_REGION_FLAG[@]}" \
  --compartment-id "$OCI_COMPARTMENT_OCID" \
  --availability-domain "$ad" \
  --display-name "${name}-vm" \
  --shape "$OCI_SHAPE" \
  "${shape_config_args[@]}" \
  --subnet-id "$subnet_id" \
  --assign-public-ip true \
  --image-id "$image_id" \
  --metadata "{\"ssh_authorized_keys\":\"$ssh_pub\",\"user_data\":\"$user_data_b64\"}" \
  --query 'data.id' --raw-output)"

echo "Instance OCID: $instance_id"
echo "Waiting for instance to be RUNNING..."
oci compute instance get "${OCI_REGION_FLAG[@]}" --instance-id "$instance_id" --wait-for-state RUNNING >/dev/null

pub_ip="$(oci compute instance list-vnics "${OCI_REGION_FLAG[@]}" --instance-id "$instance_id" \
  --query 'data[0]."public-ip"' --raw-output)"

echo
echo "Provisioned."
echo "- Public IP: ${pub_ip}"
echo "- API health: http://${pub_ip}:${KSG_PORT}/health"
echo "- UI:         http://${pub_ip}:${KSG_PORT}/ui/"
echo
echo "ArangoDB password (save this): ${ARANGO_ROOT_PASSWORD}"
echo "NOTE: ArangoDB (8529) is NOT exposed publicly by this script."

