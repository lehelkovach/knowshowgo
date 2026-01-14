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

## One-command provisioning + configure GitHub auto-deploy (OCI CLI + gh)

If you want pushes to `main` to automatically update the OCI VM, use:

```bash
./scripts/local-oci-provision-and-configure-gh-deploy.sh \
  --repo owner/repo \
  --compartment ocid1.compartment.oc1... \
  --ssh-user ubuntu \
  --ssh-public-key ~/.ssh/id_ed25519.pub \
  --ssh-private-key ~/.ssh/id_ed25519
```

This provisions the VM and then sets the GitHub Actions deploy secrets via `gh secret set`.

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

## OpenAI embeddings (recommended for real semantic search)

The service will use OpenAI embeddings automatically if `OPENAI_API_KEY` is set.

Example (VM shell or `.env` used by Docker Compose):

```bash
OPENAI_API_KEY=your_key_here
OPENAI_EMBED_MODEL=text-embedding-3-small
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

## CI/CD: auto-deploy on push to `main`

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-oci.yml` that SSHes into your VM and runs:
- `git reset --hard origin/main`
- `docker compose up -d --build`

## Provision from GitHub Actions (no local OCI CLI required)

If you want GitHub Actions to create the VM for you, use `.github/workflows/provision-oci.yml` (manual dispatch).

### Required GitHub secrets for provisioning

OCI API auth:
- `OCI_TENANCY_OCID`
- `OCI_USER_OCID`
- `OCI_FINGERPRINT`
- `OCI_REGION`
- `OCI_PRIVATE_KEY` (API signing key PEM contents)
- `OCI_COMPARTMENT_OCID`

Instance SSH key (public):
- `OCI_DEPLOY_SSH_PUBLIC_KEY` (e.g. contents of `~/.ssh/id_ed25519.pub`)

Optional (recommended):
- `OPENAI_API_KEY`
- `OPENAI_EMBED_MODEL`

After provisioning, copy the printed VM IP into `OCI_SSH_HOST` and add `OCI_SSH_PRIVATE_KEY` for the deploy workflow.

### One-time VM prep

On the VM, ensure:
- the repo is cloned at `/opt/knowshowgo/repo` (or your chosen path)
- `docker` and `docker compose` are installed
- your `.env` exists (Arango password, optional OpenAI key, etc.)

### GitHub repo secrets to add

In GitHub → Repo → Settings → Secrets and variables → Actions → New repository secret:

- `OCI_SSH_HOST`: VM public IP or hostname
- `OCI_SSH_USER`: usually `ubuntu`
- `OCI_SSH_PRIVATE_KEY`: a private key that can SSH into the VM (PEM/OpenSSH format)
- `OCI_SSH_PORT`: optional (default 22)
- `OCI_APP_DIR`: optional (default `/opt/knowshowgo/repo`)

Security note: use a dedicated deploy SSH key (and ideally a dedicated deploy user) rather than your personal key.

