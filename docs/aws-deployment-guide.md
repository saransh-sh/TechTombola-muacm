# AWS Deployment Guide — Tech Tombola

This guide provides end-to-end instructions for deploying the Tech Tombola system on **Amazon Web Services (AWS)** for high reliability, zero-downtime WebSocket support, and low latency for 500+ concurrent live participants.

---

## 1. AWS Architecture Options

Choose the architecture that best fits your scale, operational budget, and infrastructure preference:

| Architecture | Best For | Typical Monthly Cost | Complexity |
|---|---|---|---|
| **Option A: AWS EC2 / Lightsail (Recommended)** | Live events, university hackathons, single-host simplicity | ~$10 – $25/mo | Low (1-Command Script) |
| **Option B: AWS ECS Fargate + RDS** | Enterprise scaling, managed multi-AZ database, zero OS patching | ~$40 – $90/mo | Medium |
| **Option C: AWS App Runner** | Serverless container execution with auto-scaling | ~$15 – $40/mo | Low |

---

## 2. Option A: AWS EC2 / Lightsail Deployment (Recommended)

This is the fastest, most cost-effective production deployment for Tech Tombola.

### Step 1: Launch an EC2 Instance
- **AMI**: Amazon Linux 2023 or Ubuntu 24.04 LTS
- **Instance Type**: `t3.small` or `t3.medium` (2 vCPU, 2-4 GiB RAM is ideal for 500 participants)
- **Storage**: 20 GiB gp3 EBS volume
- **Security Group (Inbound Rules)**:
  - `HTTP` (TCP 80) from `0.0.0.0/0`
  - `HTTPS` (TCP 443) from `0.0.0.0/0`
  - `SSH` (TCP 22) from your IP

### Step 2: Connect and Clone Repository
```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
git clone https://github.com/saransh-sh/TechTombola-muacm.git
cd TechTombola-muacm
git checkout aws
```

### Step 3: Run the Automated Deployment Script
```bash
bash scripts/deploy-aws.sh
```

The script automatically:
1. Installs Docker and the Docker Compose plugin.
2. Creates `.env` and generates strong 32+ character secrets (`JWT_SECRET`, `SESSION_SECRET`, `SUPER_ADMIN_BOOTSTRAP_SECRET`).
3. Sets up container log rotation (`json-file` with 50MB max-size) to prevent EBS disk exhaustion.
4. Builds and launches the multi-container stack (`postgres`, `migrate`, `backend`, `frontend`).
5. Installs the systemd unit file (`/etc/systemd/system/techtombola.service`) so the app automatically restarts on server reboots.
6. Verifies system readiness probes.

### Step 4: Configure Domain & Free SSL (Let's Encrypt / Certbot)
If you have a domain pointed to your EC2 Elastic IP:
```bash
sudo dnf install -y certbot || sudo apt-get install -y certbot
sudo certbot certonly --standalone -d tombola.yourdomain.com
```
Update your frontend Nginx configuration or `.env` `APP_URL` and `CORS_ORIGIN` to `https://tombola.yourdomain.com`.

---

## 3. Option B: AWS ECS Fargate + RDS PostgreSQL (Serverless Containers)

For production deployments using managed AWS services:

### Step 1: Create Amazon RDS PostgreSQL
1. Go to **Amazon RDS** → **Create database**.
2. Select **PostgreSQL 16**.
3. Choose **Free tier** or **Dev/Test** (`db.t4g.micro` or `db.t4g.small`).
4. Set database name: `techtombola`.
5. Ensure the RDS security group allows inbound TCP 5432 from your ECS security group.
6. Note the endpoint: `postgresql://postgres:<PASSWORD>@<RDS_ENDPOINT>:5432/techtombola`.

### Step 2: Store Secrets in AWS Systems Manager (SSM) Parameter Store
Store sensitive credentials as `SecureString`:
```bash
aws ssm put-parameter --name "/techtombola/DATABASE_URL" --type "SecureString" --value "postgresql://user:pass@rds-endpoint:5432/techtombola"
aws ssm put-parameter --name "/techtombola/JWT_SECRET" --type "SecureString" --value "$(openssl rand -hex 24)"
aws ssm put-parameter --name "/techtombola/SESSION_SECRET" --type "SecureString" --value "$(openssl rand -hex 24)"
aws ssm put-parameter --name "/techtombola/SUPER_ADMIN_BOOTSTRAP_SECRET" --type "SecureString" --value "$(openssl rand -hex 24)"
```

### Step 3: Build & Push Images to Amazon ECR
```bash
# Login to ECR
aws ecr get-login-password --region <AWS_REGION> | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com

# Create repositories
aws ecr create-repository --repository-name techtombola-backend
aws ecr create-repository --repository-name techtombola-frontend

# Build & Push Backend
docker build -t techtombola-backend ./backend
docker tag techtombola-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/techtombola-backend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/techtombola-backend:latest

# Build & Push Frontend
docker build -t techtombola-frontend ./frontend
docker tag techtombola-frontend:latest <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/techtombola-frontend:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/techtombola-frontend:latest
```

### Step 4: Register ECS Task Definition & Deploy Service
1. Review the template at [`aws/ecs/task-definition.json`](../aws/ecs/task-definition.json) and substitute your `<AWS_ACCOUNT_ID>` and `<AWS_REGION>`.
2. Register the task definition:
```bash
aws ecs register-task-definition --cli-input-json file://aws/ecs/task-definition.json
```
3. Create an ECS Cluster and Service with an Application Load Balancer (ALB).
4. Configure the ALB Target Group for port 80 with health check path `/ready`.

---

## 4. Option C: AWS App Runner

If you prefer serverless container deployment without managing an ALB or ECS cluster:
1. Connect your repository in AWS App Runner.
2. Select the [`aws/apprunner.yaml`](../aws/apprunner.yaml) configuration file.
3. Configure the secrets from AWS Secrets Manager.
4. App Runner automatically provisions TLS and handles container routing.

---

## 5. Operations, Monitoring & Backups

### Health Check Probes
- `GET /health` — Verifies system process liveness.
- `GET /ready` — Verifies database connection readiness and schema integrity.

### Automated Backups (EC2 / Lightsail)
Create a daily PostgreSQL backup cron job:
```bash
sudo crontab -e
# Add line:
0 3 * * * docker compose -f /opt/techtombola/docker-compose.yml exec -T postgres pg_dump -U postgres techtombola | gzip > /opt/backups/techtombola_$(date +\%F).sql.gz
```
