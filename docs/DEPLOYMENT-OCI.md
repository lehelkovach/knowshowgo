# Deployment on Oracle Cloud (Free Tier) — KnowShowGo MVP Pillar

This guide deploys the KnowShowGo REST API + ArangoDB using `docker-compose.yml` on an Oracle Cloud VM.

## VM prerequisites

- **Ubuntu** VM recommended (Ampere or AMD Free Tier).
- OCI network rules allow inbound:
  - **22** (SSH)
  - **3000** (API) *(or use a reverse proxy on 80/443 and keep 3000 private)*  
  - **8529** (Arango) **DO NOT expose publicly** (keep private/VPN only)

## Install Docker + Compose

On the VM:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out/in so your user can run Docker.

## Deploy with Docker Compose

```bash
git clone https://github.com/lehelkovach/knowshowgo.git
cd knowshowgo
```

## One-command provisioning (OCI CLI)

If you have the OCI CLI configured locally, you can provision a VM + deploy KnowShowGo using:

```bash
export OCI_COMPARTMENT_OCID='ocid1.compartment.oc1...'
export OCI_SSH_PUBLIC_KEY_FILE="$HOME/.ssh/id_ed25519.pub"
./scripts/oci-provision-knowshowgo.sh
```

The script prints the VM public IP, the `/health` URL, and the UI URL.

Set an Arango root password (choose your own):

```bash
export ARANGO_ROOT_PASSWORD='changeme'
```

Start services:

```bash
docker compose up -d --build
docker compose ps
```

## Verify

API health:

```bash
curl -sS http://localhost:3000/health | jq .
```

Seed the minimal ontology expected by `osl-agent-prototype` (idempotent):

```bash
curl -sS -X POST http://localhost:3000/api/seed/osl-agent | jq .
```

Open the Knode UI:

- `http://<vm-ip>:3000/ui/`

## Persistence

ArangoDB data persists in Docker volumes:
- `arango-data`
- `arango-apps`

## Notes

- For a public deployment, it’s recommended to add a reverse proxy (Caddy/Nginx) for **TLS** and keep ArangoDB unexposed.
- The default API uses a **mock embedder** in `src/server/rest-api.js`. For production, wire it to a real embedding provider (or a local embedder service) and keep the embedding dimension consistent with your index strategy.

