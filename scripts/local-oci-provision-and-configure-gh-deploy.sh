#!/usr/bin/env bash
set -euo pipefail

# Local one-command: provision OCI VM (via OCI CLI) and configure GitHub Actions deploy secrets (via gh).
#
# Requirements:
# - oci CLI configured locally (oci setup config)
# - gh CLI authenticated (gh auth login)
# - jq
#
# Usage:
#   ./scripts/local-oci-provision-and-configure-gh-deploy.sh --repo owner/repo \
#     --compartment ocid1.compartment.oc1... \
#     --ssh-user ubuntu \
#     --ssh-public-key ~/.ssh/id_ed25519.pub \
#     --ssh-private-key ~/.ssh/id_ed25519
#
# Optional:
#   --openai-key "<key>" --openai-embed-model text-embedding-3-small
#   --shape VM.Standard.A1.Flex --ocpus 4 --memory 24
#
# Notes:
# - This script will set GitHub repo secrets (encrypted) for auto-deploy on push to main.
# - It will NOT commit secrets to git.

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }
}

need oci
need gh
need jq

REPO=""
COMPARTMENT=""
SSH_USER="ubuntu"
SSH_PUB=""
SSH_PRIV=""
OPENAI_KEY=""
OPENAI_EMBED_MODEL="text-embedding-3-small"
OCI_SHAPE="VM.Standard.A1.Flex"
OCI_OCPUS="4"
OCI_MEM="24"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --compartment) COMPARTMENT="$2"; shift 2 ;;
    --ssh-user) SSH_USER="$2"; shift 2 ;;
    --ssh-public-key) SSH_PUB="$2"; shift 2 ;;
    --ssh-private-key) SSH_PRIV="$2"; shift 2 ;;
    --openai-key) OPENAI_KEY="$2"; shift 2 ;;
    --openai-embed-model) OPENAI_EMBED_MODEL="$2"; shift 2 ;;
    --shape) OCI_SHAPE="$2"; shift 2 ;;
    --ocpus) OCI_OCPUS="$2"; shift 2 ;;
    --memory) OCI_MEM="$2"; shift 2 ;;
    -h|--help)
      sed -n '1,120p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" ]]; then
  # Try infer from git remote
  if git remote get-url origin >/dev/null 2>&1; then
    url="$(git remote get-url origin)"
    # supports https://github.com/owner/repo(.git) and git@github.com:owner/repo(.git)
    REPO="$(echo "$url" | sed -E 's#^https://github.com/##; s#^git@github.com:##; s#\.git$##')"
  fi
fi

if [[ -z "$REPO" ]]; then
  echo "Missing --repo owner/repo (or run from a git clone with origin set)." >&2
  exit 1
fi

if [[ -z "$COMPARTMENT" ]]; then
  echo "Missing --compartment <compartment_ocid>" >&2
  exit 1
fi

if [[ -z "$SSH_PUB" || -z "$SSH_PRIV" ]]; then
  echo "Missing --ssh-public-key and/or --ssh-private-key" >&2
  exit 1
fi

if [[ ! -f "$SSH_PUB" ]]; then
  echo "SSH public key file not found: $SSH_PUB" >&2
  exit 1
fi
if [[ ! -f "$SSH_PRIV" ]]; then
  echo "SSH private key file not found: $SSH_PRIV" >&2
  exit 1
fi

echo "Checking gh auth..."
gh auth status >/dev/null

echo "Provisioning OCI VM (this can take a few minutes)..."
tmp_out="$(mktemp)"
trap 'rm -f "$tmp_out"' EXIT

export OCI_COMPARTMENT_OCID="$COMPARTMENT"
export OCI_SSH_PUBLIC_KEY_FILE="$SSH_PUB"
export OCI_SHAPE="$OCI_SHAPE"
export OCI_INSTANCE_OCPUS="$OCI_OCPUS"
export OCI_INSTANCE_MEMORY_GBS="$OCI_MEM"
export OPENAI_API_KEY="$OPENAI_KEY"
export OPENAI_EMBED_MODEL="$OPENAI_EMBED_MODEL"

./scripts/oci-provision-knowshowgo.sh | tee "$tmp_out"

ip="$(grep -Eo 'Public IP: [0-9.]+' "$tmp_out" | head -n1 | awk '{print $3}')"
if [[ -z "${ip:-}" ]]; then
  echo "Failed to parse Public IP from provisioning output." >&2
  echo "Open $tmp_out and locate the 'Public IP:' line." >&2
  exit 1
fi

echo
echo "Setting GitHub Actions secrets for repo: $REPO"

gh secret set OCI_SSH_HOST -b "$ip" --repo "$REPO"
gh secret set OCI_SSH_USER -b "$SSH_USER" --repo "$REPO"
gh secret set OCI_SSH_PRIVATE_KEY --repo "$REPO" < "$SSH_PRIV"
gh secret set OCI_SSH_PORT -b "22" --repo "$REPO"
gh secret set OCI_APP_DIR -b "/opt/knowshowgo/repo" --repo "$REPO"

if [[ -n "${OPENAI_KEY:-}" ]]; then
  gh secret set OPENAI_API_KEY -b "$OPENAI_KEY" --repo "$REPO"
  gh secret set OPENAI_EMBED_MODEL -b "$OPENAI_EMBED_MODEL" --repo "$REPO"
fi

echo
echo "Done."
echo "- VM IP: $ip"
echo "- Health: http://$ip:3000/health"
echo "- UI:     http://$ip:3000/ui/"
echo
echo "Next:"
echo "- Push to main; GitHub Actions 'Deploy to OCI VM' will update the instance."

