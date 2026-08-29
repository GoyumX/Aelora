# Deploy Aelora from zero: beginner step-by-step guide

This is the **start here** guide. Follow it from Step 1 to Step 12 without
skipping ahead.

You already have these GitHub repositories:

- Web application: https://github.com/GoyumX/Aelora
- ML service: https://github.com/GoyumX/aelora-ml-service
- Virtual gateway: https://github.com/GoyumX/aelora-virtual-gateway

For the first working deployment, select the **dev** branch in Railway for the
web and ML repositories. The gateway is not deployed to Railway; it runs on
your computer and sends data to the deployed web application.

## What you are going to create

~~~text
Railway project: Aelora
|
|-- postgres             Private PostgreSQL database
|-- aelora-ml            Private Python/FastAPI prediction service
|-- aelora-web           Public Next.js website
|-- aelora-scheduler     Private 15-minute background job

Your computer
|
|-- aelora-virtual-gateway
    Sends simulated solar data over HTTPS to aelora-web
~~~

Only **aelora-web** gets a public URL. Do not create public domains for
PostgreSQL, ML, or the scheduler.

---

## Before Step 1 — Use Windows Command Prompt

This guide is written for **Windows Command Prompt (CMD)**.

You are using Command Prompt when the line begins like this:

~~~text
C:\Users\GoYuM>
~~~

PowerShell looks different because it starts with `PS`:

~~~text
PS C:\Users\GoYuM>
~~~

The commands in this guide can be pasted into **Command Prompt**. To open it:

1. Press the Windows key.
2. Type **Command Prompt** or **cmd**.
3. Open **Command Prompt**.

Important Windows command rules:

- Copy only the command after the `>` prompt. Never type the prompt itself.
- Use `cd /d` when changing folders. The `/d` option also changes drives.
- Do not add backslashes before underscores in filenames.
- The exact model filename is `unisolar_capacity_candidate_v3.skops`.
- `unisolar\_capacity\_candidate\_v3.skops` is incorrect. Those extra
  backslashes sometimes appear when text is copied from formatted Markdown.
- Run one command at a time and wait for its result before continuing.

---

## Step 1 — Understand the .env files first

This is the most important distinction:

- **Railway does not use the .env file on your computer.**
- Web and ML production variables are entered in Railway under
  **Service → Variables**.
- The gateway runs on your computer, so its local **.env** file is used.
- Never edit or commit **.env.example**. Copy it to **.env** when instructed.
- Never push a real **.env** file to GitHub.

For now, do not edit the web or ML .env files. You will enter their values
directly into Railway in Steps 5 and 6.

The only production .env file you will edit is:

~~~text
C:\Users\GoYuM\Documents\ChatGPT\Aelora\Project\aelora-virtual-gateway\.env
~~~

You will create that file after the web application has a public URL.

---

## Step 2 — Create and save four secrets

Open Command Prompt. Run this command three separate times:

~~~bat
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
~~~

Each run prints a different random value. Save them in a password manager or a
temporary private note with these labels:

~~~text
BETTER_AUTH_SECRET=
WEATHER_SYNC_SECRET=
AELORA_ML_INTERNAL_API_TOKEN=
~~~

Now choose a different password, at least 16 characters long, for:

~~~text
BOOTSTRAP_ADMIN_PASSWORD=
~~~

Also decide:

~~~text
BOOTSTRAP_ADMIN_EMAIL=your real email address
BOOTSTRAP_ADMIN_NAME=your name
BOOTSTRAP_ADMIN_USERNAME=your username
~~~

Important rules:

1. The three generated secrets must be different from one another.
2. The ML token must later be copied identically into **aelora-ml** and
   **aelora-web**.
3. The weather secret must later be copied identically into **aelora-web** and
   **aelora-scheduler**.
4. Do not use 1234 as a production password.
5. Do not paste real secrets into GitHub, screenshots, or Markdown files.

### Secret mapping worksheet

| Value | Put it in |
| --- | --- |
| BETTER_AUTH_SECRET | aelora-web only |
| WEATHER_SYNC_SECRET | aelora-web and aelora-scheduler |
| AELORA_ML_INTERNAL_API_TOKEN | aelora-ml and aelora-web |
| BOOTSTRAP_ADMIN_PASSWORD | aelora-web temporarily |

Checkpoint: you should now have the three generated secrets plus the admin
password, email, name, and username saved.

---

## Step 3 — Create the Railway project

1. Open https://railway.com and sign in.
2. Connect your GitHub account if Railway asks.
3. Click **New Project**.
4. Choose **Empty Project**.
5. Name the project **Aelora**.
6. If Railway shows a staging/deploy confirmation button, apply the change.

Checkpoint: the Railway canvas should be empty and its project name should be
**Aelora**.

---

## Step 4 — Add PostgreSQL

1. Inside the Aelora Railway project, click **New**.
2. Choose **Database**.
3. Choose **PostgreSQL**.
4. Wait until the database service is deployed.
5. Rename the service to exactly:

   ~~~text
   postgres
   ~~~

6. Do not generate a public domain or TCP proxy.
7. Open the PostgreSQL service.
8. Open **Backups**.
9. Enable daily backups. Enable weekly backups too if your plan allows them.

Do not copy the PostgreSQL password. The web application will use Railway's
private reference variable.

Checkpoint: the project canvas should contain a healthy service named
**postgres**.

---

## Step 5 — Deploy the ML service

### 5.1 Add the repository

1. On the Railway project canvas, click **New**.
2. Choose **GitHub Repo**.
3. Select:

   ~~~text
   GoyumX/aelora-ml-service
   ~~~

4. Select the **dev** branch.
5. Rename the Railway service to exactly:

   ~~~text
   aelora-ml
   ~~~

6. Do not generate a public domain.

The first deployment may fail or remain unready because the model file has not
been uploaded yet. That is expected at this point.

### 5.2 Add the ML variables

Open **aelora-ml → Variables → Raw Editor** and enter:

~~~text
PORT=8000
AELORA_ML_INTERNAL_API_TOKEN=PASTE_YOUR_ML_TOKEN_HERE
AELORA_ML_MODEL_METADATA_PATH=/app/models/unisolar_capacity_candidate_v3.metadata.json
AELORA_ML_MODEL_ARTIFACT_PATH=/model-artifacts/unisolar_capacity_candidate_v3.skops
~~~

Replace only **PASTE_YOUR_ML_TOKEN_HERE**. Do not include angle brackets.

Apply or deploy the staged variable changes.

### 5.3 Attach the model volume

1. Return to the project canvas.
2. Right-click **aelora-ml**, or use its volume/storage setting.
3. Choose **Attach Volume** or **Add Volume**.
4. Name the volume:

   ~~~text
   aelora-ml-models
   ~~~

5. Set the mount path to exactly:

   ~~~text
   /model-artifacts
   ~~~

6. Apply the staged change.

### 5.4 Install the Railway CLI

On your computer, open Command Prompt:

~~~bat
npm install --global @railway/cli
railway login
~~~

The login command opens a browser. Approve the login and return to Command
Prompt. A message such as `Signed in as Your Name (your@email.com)` means the
login succeeded.

#### If you accidentally opened PowerShell

PowerShell may block npm's `railway.ps1` launcher and display:

~~~text
railway.ps1 cannot be loaded because running scripts is disabled on this system
~~~

The Railway CLI is still installed. Use its Windows command launcher directly:

~~~powershell
railway.cmd login
~~~

This is the safest quick fix because it does not change your computer's
PowerShell execution policy. While staying in PowerShell, use `railway.cmd`
instead of `railway` for every Railway command in this guide. Alternatively,
close PowerShell, open **Command Prompt**, and use the commands as written.

The `npm warn deprecated` messages shown during installation come from packages
inside the Railway CLI. The line `changed ... packages` means npm completed the
installation; those warnings do not mean the installation failed.

### 5.5 Verify the model file before uploading

~~~bat
cd /d C:\Users\GoYuM\Documents\ChatGPT\Aelora\Project\aelora-ml-service
dir models\unisolar_capacity_candidate_v3.skops
certutil -hashfile models\unisolar_capacity_candidate_v3.skops SHA256
~~~

The `dir` result should list the file with a size of **54,799,511 bytes**.
`certutil` should print a SHA256 hash followed by:

~~~text
CertUtil: -hashfile command completed successfully.
~~~

The hash must be:

~~~text
BDB71B6E0436204D1CF33A9118D1E40C28052073512EB571AB4174CBEFB65FD9
~~~

Stop if the file is missing or the hash is different.

Do not type `Get-Item` or `Get-FileHash` in Command Prompt. Those are
PowerShell-only commands. Also ensure the filename contains ordinary
underscores with no backslash before them.

### 5.6 Link the CLI and upload the model

Stay inside the ML project directory and run:

~~~bat
railway link
~~~

When prompted:

1. Select your Railway workspace.
2. Select the **Aelora** project.
3. Select the production environment.
4. Select **aelora-ml** if it asks for a service.

Now run:

~~~bat
railway volume list
railway volume files --volume aelora-ml-models upload .\models\unisolar_capacity_candidate_v3.skops /unisolar_capacity_candidate_v3.skops
railway volume files --volume aelora-ml-models list /
~~~

The final command must list:

~~~text
/unisolar_capacity_candidate_v3.skops
~~~

### 5.7 Configure ML readiness

Open **aelora-ml → Settings → Deploy** and set:

~~~text
Healthcheck path: /ready
Healthcheck timeout: 300
Restart policy: On Failure
Maximum retries: 5
~~~

Redeploy the ML service.

In its deployment logs, verify that the container starts and the healthcheck
passes. If you want to verify from Command Prompt:

~~~bat
railway ssh --service aelora-ml -- python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/ready').read().decode())"
~~~

Checkpoint: **aelora-ml** should be active/healthy and should still have no
public domain.

---

## Step 6 — Deploy the web application

### 6.1 Add the web repository

1. On the Railway project canvas, click **New**.
2. Choose **GitHub Repo**.
3. Select:

   ~~~text
   GoyumX/Aelora
   ~~~

4. Select the **dev** branch.
5. Rename the service to exactly:

   ~~~text
   aelora-web
   ~~~

### 6.2 Generate the public domain first

1. Open **aelora-web → Settings → Networking**.
2. Click **Generate Domain**.
3. Copy the complete HTTPS URL.

It will look similar to:

~~~text
https://aelora-web-production-xxxx.up.railway.app
~~~

Save your actual URL as:

~~~text
AELORA_PUBLIC_URL=https://your-real-railway-domain
~~~

Do not add a final slash to this URL.

### 6.3 Add web variables

Open **aelora-web → Variables → Raw Editor** and paste the following. Replace
every value that begins with **PASTE_**:

~~~text
PORT=3000
DATABASE_URL=${{postgres.DATABASE_URL}}
BETTER_AUTH_SECRET=PASTE_BETTER_AUTH_SECRET
BETTER_AUTH_URL=PASTE_AELORA_PUBLIC_URL
WEATHER_SYNC_SECRET=PASTE_WEATHER_SYNC_SECRET
AELORA_ML_BASE_URL=http://aelora-ml.railway.internal:8000
AELORA_ML_INTERNAL_API_TOKEN=PASTE_THE_SAME_ML_TOKEN_USED_IN_AELORA_ML
BOOTSTRAP_ADMIN_EMAIL=PASTE_YOUR_ADMIN_EMAIL
BOOTSTRAP_ADMIN_NAME=PASTE_YOUR_NAME
BOOTSTRAP_ADMIN_USERNAME=PASTE_YOUR_USERNAME
BOOTSTRAP_ADMIN_PASSWORD=PASTE_YOUR_ADMIN_PASSWORD
~~~

Example of the URL line:

~~~text
BETTER_AUTH_URL=https://aelora-web-production-xxxx.up.railway.app
~~~

Critical checks before applying:

- DATABASE_URL must remain the Railway reference
  **${{postgres.DATABASE_URL}}**.
- AELORA_ML_BASE_URL must use **http**, not https, because it uses Railway's
  private network.
- AELORA_ML_INTERNAL_API_TOKEN must exactly match the token in **aelora-ml**.
- BETTER_AUTH_URL must use your public **https** URL.

Apply the staged variables.

### 6.4 Configure migrations and health

Open **aelora-web → Settings → Deploy** and enter:

~~~text
Pre-deploy command: npm run db:deploy
Healthcheck path: /api/health
Healthcheck timeout: 300
Restart policy: On Failure
Maximum retries: 5
~~~

Do not enter **npm run db:seed**. The seed is development-only.

Redeploy **aelora-web** and wait until it becomes active.

### 6.5 Verify web and database connectivity

In Command Prompt, replace the URL:

~~~bat
curl.exe https://YOUR-REAL-DOMAIN/api/health
~~~

Expected JSON contains:

~~~json
{"status":"ok","checks":{"database":"ok"}}
~~~

If it returns 503, do not continue. Use the troubleshooting table at the end.

Checkpoint: opening your Railway domain in a browser should display the Aelora
landing page.

---

## Step 7 — Create the first admin account

In Command Prompt, run:

~~~bat
cd /d C:\Users\GoYuM\Documents\ChatGPT\Aelora\Project\aelora
railway link
~~~

Select the same **Aelora** Railway project and **aelora-web** service.

Run:

~~~bat
railway ssh --service aelora-web -- npm run admin:bootstrap
~~~

Expected message:

~~~text
Created and activated production administrator your-email@example.com.
~~~

Run the same command once more. The second run should verify the existing
administrator rather than create a duplicate.

Now:

1. Open **aelora-web → Variables**.
2. Delete **BOOTSTRAP_ADMIN_PASSWORD**.
3. You may also delete the other BOOTSTRAP_ADMIN variables.
4. Apply/redeploy the variable changes.
5. Open:

   ~~~text
   https://YOUR-REAL-DOMAIN/sign-in
   ~~~

6. Sign in with the admin email and password chosen in Step 2.

Checkpoint: you should reach the Aelora dashboard and have access to admin
features.

---

## Step 8 — Add the scheduler service

The scheduler uses the **same web GitHub repository**, but it runs a different
Dockerfile from a subdirectory.

### 8.1 Create it

1. On the Railway project canvas, click **New**.
2. Choose **GitHub Repo**.
3. Select **GoyumX/Aelora** again.
4. Select the **dev** branch.
5. Rename this second service:

   ~~~text
   aelora-scheduler
   ~~~

6. Open its service settings.
7. Set **Root Directory** to:

   ~~~text
   /ops/scheduler
   ~~~

8. Confirm Railway detects the Dockerfile inside that directory.

### 8.2 Add scheduler variables

Open **aelora-scheduler → Variables → Raw Editor**:

~~~text
AELORA_WEB_INTERNAL_URL=http://aelora-web.railway.internal:3000
WEATHER_SYNC_SECRET=PASTE_THE_SAME_WEATHER_SECRET_USED_IN_AELORA_WEB
~~~

Apply the variables.

### 8.3 Configure the cron schedule

Open **aelora-scheduler → Settings**:

~~~text
Cron schedule: */15 * * * *
Restart policy: Never
~~~

Do not configure:

- a public domain;
- a volume;
- a database reference;
- a healthcheck.

Deploy it. A scheduler run should start, call the internal endpoints, and exit.
Its logs should show both routes completing:

~~~text
/api/internal/telemetry-rollups
/api/internal/intelligence-refresh
~~~

Checkpoint: the project canvas should now show **postgres**, **aelora-ml**,
**aelora-web**, and **aelora-scheduler**.

---

## Step 9 — Edit the gateway .env file

The web application is now public, so you can configure the gateway.

Open Command Prompt:

~~~bat
cd /d C:\Users\GoYuM\Documents\ChatGPT\Aelora\Project\aelora-virtual-gateway
copy .env.example .env
notepad .env
~~~

Replace the complete file with:

~~~text
AELORA_BASE_URL=https://YOUR-REAL-AELORA-DOMAIN
AELORA_GATEWAY_HOST=127.0.0.1
AELORA_GATEWAY_PORT=4100
AELORA_GATEWAY_DB=data/gateway.db
AELORA_GATEWAY_RELOAD=false
~~~

Replace only **https://YOUR-REAL-AELORA-DOMAIN**. Use the same public URL from
Step 6, with no final slash.

Save and close Notepad.

Check that Git will not upload the .env:

~~~bat
git status --short
~~~

The .env file should not be shown. If it is shown, stop and do not commit it.

---

## Step 10 — Run the virtual gateway

### Recommended method: Docker Desktop

1. Install and open Docker Desktop.
2. Wait until Docker Desktop says its engine is running.
3. In the gateway Command Prompt window, run:

   ~~~bat
   docker compose up --build -d
   docker compose ps
   ~~~

4. The service should show as running/healthy.
5. Open:

   ~~~text
   http://127.0.0.1:4100
   ~~~

To see gateway logs:

~~~bat
docker compose logs --follow gateway
~~~

Press Ctrl+C to leave the log view. This does not stop the gateway.

To stop the gateway later:

~~~bat
docker compose stop
~~~

To start it again:

~~~bat
docker compose start
~~~

Do not run **docker compose down -v** because **-v** removes the saved gateway
volume and can discard its enrollment.

### Alternative: native Python

If Docker is not available:

~~~bat
cd /d C:\Users\GoYuM\Documents\ChatGPT\Aelora\Project\aelora-virtual-gateway
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
set AELORA_BASE_URL=https://YOUR-REAL-AELORA-DOMAIN
set AELORA_GATEWAY_HOST=127.0.0.1
set AELORA_GATEWAY_PORT=4100
set AELORA_GATEWAY_DB=data/gateway.db
.\.venv\Scripts\aelora-virtual-gateway.exe
~~~

Keep that Command Prompt window open when using native Python. The `set`
values apply only to that open Command Prompt window, which helps avoid
accidentally changing permanent Windows environment variables.

Checkpoint: the gateway console should open and show its computer date/time,
equipment, and latest simulated power values.

---

## Step 11 — Enroll the gateway into Aelora

1. Sign in to the deployed Aelora website.
2. Open **System Configuration**.
3. Select the correct solar site.
4. Find **Site gateways**.
5. Choose **Create enrollment**.
6. Copy the one-time enrollment token. It expires after 30 minutes.
7. Open the local gateway console:

   ~~~text
   http://127.0.0.1:4100
   ~~~

8. Paste the token into **Aelora enrollment**.
9. Click the enroll/connect button.
10. Confirm that the gateway console says enrolled.
11. Set publishing to 30 or 60 seconds.
12. Click **Publish now** once.
13. Return to Aelora Dashboard or Live Monitoring.

You should see:

- gateway online;
- solar arrays online;
- inverter online;
- battery online;
- grid online;
- new power measurements;
- timestamps moving forward.

Now test offline behavior:

1. Turn one virtual array's communications off.
2. Wait for the web app's stale/offline threshold.
3. Confirm only that device becomes offline.
4. Turn communications on again.
5. Publish and confirm recovery.

Checkpoint: virtual data should now travel from your computer to Railway
through the same HTTPS ingestion API intended for future real hardware.

---

## Step 12 — Configure location, weather, and AI

1. In Aelora, open **Settings**.
2. Set the correct site location/coordinates and timezone.
3. Save the settings.
4. Open the Dashboard and manually refresh weather once.
5. Confirm the weather timestamp and provider are updated.
6. Open **AI Forecast**.
7. Use the manual AI refresh/rerun button once.
8. Confirm a generated timestamp appears and the forecast contains future data.
9. Check **aelora-scheduler** logs after 15 minutes.

Weather is fetched by the web service. The web service then sends normalized
weather and site details to the private ML service. The scheduler repeats the
refresh process automatically.

---

## Final acceptance checklist

- [ ] Railway has four services with the exact names from this guide.
- [ ] PostgreSQL has no public application endpoint.
- [ ] ML has no public domain and passes /ready.
- [ ] Web /api/health reports status ok and database ok.
- [ ] The admin account can sign in.
- [ ] BOOTSTRAP_ADMIN_PASSWORD was removed from Railway after bootstrap.
- [ ] The scheduler runs every 15 minutes and exits successfully.
- [ ] The gateway .env contains the deployed HTTPS URL.
- [ ] The gateway console opens only on 127.0.0.1:4100.
- [ ] Enrollment, heartbeat, and telemetry work.
- [ ] Pausing a device or the gateway produces the expected offline status.
- [ ] Site location drives stored weather.
- [ ] AI Forecast produces a new generated timestamp.
- [ ] Daily PostgreSQL backups are enabled.
- [ ] No real secret or .env file is present on GitHub.

## What happens when you push new code?

For the first deployment, Railway is connected to **dev**. A new push to dev
will trigger a rebuild of the connected service.

- Changes to the ML repository redeploy **aelora-ml**.
- Changes to the web repository can redeploy both **aelora-web** and
  **aelora-scheduler**.
- Changes to the gateway repository do not change Railway. Pull the changes on
  the site computer and rebuild/restart the local gateway.

After the system is stable, create/use **main** branches and change Railway to
deploy main. Keep dev for development and use pull requests into main.

## Beginner troubleshooting

| Problem | Most likely cause | Exact check |
| --- | --- | --- |
| `railway.ps1 cannot be loaded` | PowerShell script execution is restricted | Run `railway.cmd login`, or switch to Command Prompt |
| `'Get-Item' is not recognized` | A PowerShell command was pasted into Command Prompt | Use the CMD `dir` command shown in Step 5.5 |
| `.Hash was unexpected at this time` | PowerShell checksum syntax was pasted into Command Prompt | Use `certutil -hashfile` exactly as shown in Step 5.5 |
| Model file cannot be found | The filename contains copied Markdown escapes | Use `unisolar_capacity_candidate_v3.skops`, with no backslashes before underscores |
| Web deployment fails during migration | DATABASE_URL is wrong | Web Variables must contain ${{postgres.DATABASE_URL}} |
| Web health returns 503 | PostgreSQL cannot be reached | Check postgres is active and web DATABASE_URL is a reference |
| Sign-in redirects to localhost | BETTER_AUTH_URL is wrong | It must equal the exact public HTTPS domain |
| ML stays unready | Model is missing from the volume | List the volume and verify /unisolar_capacity_candidate_v3.skops |
| ML says checksum mismatch | Wrong model file | Re-run SHA-256 and compare with Step 5 |
| Web cannot generate AI forecast | ML URL or token mismatch | Check private URL and make both ML tokens identical |
| Scheduler receives 401 | Weather secrets differ | Copy the same WEATHER_SYNC_SECRET to web and scheduler |
| Scheduler remains running | Wrong root directory | It must be /ops/scheduler |
| Gateway cannot connect | Gateway URL is wrong | .env must use the public HTTPS web domain |
| Gateway opens but sends no data | Not enrolled or publishing paused | Enroll, enable publishing, then click Publish now |
| Gateway loses enrollment after restart | Docker volume was deleted | Do not use docker compose down -v |
| Weather is for the wrong place | Site coordinates are wrong | Save correct location and refresh weather |

## If you become stuck

Record these four things without including secrets:

1. Which numbered step failed.
2. The Railway service name.
3. The deployment status and last 30 log lines.
4. A screenshot of the error with passwords/tokens hidden.

Do not send the Railway Variables screen if secret values are visible.

## Official references

- Railway Dockerfiles: https://docs.railway.com/builds/dockerfiles
- Railway variables: https://docs.railway.com/variables
- Railway healthchecks: https://docs.railway.com/deployments/healthchecks
- Railway pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Railway volumes: https://docs.railway.com/volumes
- Railway volume CLI: https://docs.railway.com/cli/volume
- Railway cron jobs: https://docs.railway.com/cron-jobs
- Railway private networking: https://docs.railway.com/networking/private-networking
