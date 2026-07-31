# Production deployment

This deployment targets an Ubuntu Server virtual machine hosted on Windows Server Hyper-V. It also works on a physical Ubuntu Server. The existing `docker-compose.yml` and Windows scripts remain the development environment; production uses `docker-compose.production.yml` exclusively.

## 1. Server prerequisites

Recommended minimum for a small internal deployment:

- Ubuntu Server 24.04 LTS
- 4 CPU cores
- 8 GB RAM
- 100 GB SSD storage (increase according to PDF retention)
- Fixed LAN IP address
- Internal DNS record such as `quality-app` or `quality.agrupamarca.com`
- Correct time synchronization

Install Docker Engine and the Docker Compose v2 plugin from Docker's official Ubuntu repository. Add only the designated application administrator to the `docker` group; membership grants root-equivalent control of the server.

Configure the firewall to allow:

- SSH (22) only from administrator addresses
- HTTP (80) from the company LAN and VPN ranges

Do not expose PostgreSQL (5432), Redis (6379), or the backend (8000). The production Compose file keeps them on a private Docker network.

## 2. Copy and configure the release

Copy or clone the repository into `/opt/quality-platform`, then run:

```bash
cd /opt/quality-platform
chmod +x deploy/*.sh
./deploy/generate-env.sh
nano .env.production
./deploy/preflight.sh
```

Use the internal DNS hostname when prompted. If DNS is not ready, use the server's fixed LAN IP. `.env.production` contains generated secrets, is excluded from Git, and must be included in the organization's secure credential backup.

## 3. Install

```bash
./deploy/install.sh
./deploy/create-admin.sh administrator@agrupamarca.com
./deploy/status.sh
```

The administrator command asks for the password without printing or storing it in shell history. Use a unique password of at least 12 characters.

Users then browse to the `APP_URL` configured in `.env.production`. `localhost` works only from the server itself.

## 4. Routine operations

```bash
# Show container and dependency health
./deploy/status.sh

# Follow API logs (or pass worker/frontend/db)
./deploy/logs.sh backend

# Create a database and file backup
./deploy/backup.sh

# Stop or start all services
docker compose --env-file .env.production -f docker-compose.production.yml stop
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

Backups are written under `backups/<UTC timestamp>/`. Copy them automatically to a different physical machine or protected backup system. A backup stored only on the application server is not sufficient. Test restoration periodically.

Example daily cron entry at 02:15:

```cron
15 2 * * * cd /opt/quality-platform && ./deploy/backup.sh >> /var/log/quality-platform-backup.log 2>&1
```

Apply an organization-approved retention policy to old backups. The supplied script does not delete backups automatically.

## 5. Release and update workflow

Development does not modify production automatically:

1. Develop and test on a separate computer and branch.
2. Commit a reviewed release and tag it, for example `v1.1.0`.
3. On the server, fetch and check out that exact tag.
4. Run `./deploy/update.sh`.
5. Perform a login, PDF upload, validation, report, and export smoke test.

The update script creates a backup before rebuilding, runs Alembic migrations during API startup, and waits for health checks. Never run `docker compose down -v`; `-v` deletes production data volumes.

For code rollback, check out the previous release tag and run `./deploy/update.sh`. Database migrations may not be backward-compatible, so restore the matching pre-update backup when a release includes a destructive schema change:

```bash
./deploy/restore.sh /opt/quality-platform/backups/YYYYMMDDTHHMMSSZ --confirm-data-replacement
```

Restoration intentionally requires the confirmation flag and stops application services while data is replaced.

## 6. Remote access and HTTPS

For remote users, expose the application only through the company VPN. Users connect to the VPN and then open the same internal URL; RDP is not required.

The initial LAN deployment uses HTTP. Before handling sensitive data over an untrusted network, add HTTPS using an organization-issued certificate and an HTTPS reverse proxy. Do not expose port 80 directly to the public internet.

## 7. Security checklist

- Keep the repository private.
- Rotate every value that was previously committed in `.env`.
- Restrict `.env.production` to server administrators (`chmod 600`).
- Use individual application accounts; never share the administrator account.
- Keep Ubuntu, Docker, and base images patched on a scheduled maintenance cycle.
- Review `docker compose ... logs` and application audit logs.
- Back up `.env.production`, PostgreSQL, uploads, and exports to separate protected storage.
- Test both application updates and backup restoration before broad rollout.
