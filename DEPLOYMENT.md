# Deployment Guide

This project can be deployed as two separate apps:

- Backend API on Vercel or Replit from `server/`
- Frontend React app on Vercel from `client/`

## Backend: Vercel

Create a second Vercel project from the same repository and set:

```text
Root Directory: server
Framework Preset: Other
Install Command: npm install
Build Command: leave empty
Output Directory: leave empty
```

The backend Vercel project uses:

```text
server/vercel.json
server/api/index.js
```

Set these Vercel environment variables for the backend project:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=replace-with-a-new-long-secret
JWT_EXPIRES_IN=24h
DEFAULT_PASSWORD_DOSEN=12345678
CORS_ORIGIN=https://your-frontend.vercel.app,http://localhost:3000
```

Run migrations from your local machine after `DATABASE_URL` points to production:

```bash
cd server
npx sequelize-cli db:migrate --env production
```

Seed only the first admin account:

```bash
npx sequelize-cli db:seed --seed production-admin-only.js --env production
```

Initial admin:

```text
username/nip: 199501012020121001
password: 12345678
```

Do not run `db:seed:all` for a clean production database.

Important: Vercel serverless filesystem is not permanent. Excel imports are processed as temporary files, but uploaded sidang documents should use external object storage before this is used as a real production system.

## Backend: Replit

Use the root `.replit` file or configure Replit manually with:

```bash
npm --prefix server install
npm --prefix server start
```

Set these Replit Secrets:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=replace-with-a-new-long-secret
JWT_EXPIRES_IN=24h
DEFAULT_PASSWORD_DOSEN=12345678
CORS_ORIGIN=https://your-frontend.vercel.app,http://localhost:3000
```

Run migrations from Replit Shell:

```bash
cd server
npx sequelize-cli db:migrate --env production
```

Seed only the first admin account:

```bash
npx sequelize-cli db:seed --seed production-admin-only.js --env production
```

Initial admin:

```text
username/nip: 199501012020121001
password: 12345678
```

Do not run `db:seed:all` for a clean production database.

## Frontend: Vercel

Import the repository in Vercel and set:

```text
Root Directory: client
Framework Preset: Create React App
Install Command: npm install
Build Command: npm run build
Output Directory: build
```

Set this Vercel environment variable:

```env
REACT_APP_API_BASE_URL=https://your-backend-url
```

After Vercel gives the final frontend URL, add it to backend `CORS_ORIGIN`, then redeploy the backend.

## Validation

Check these after both apps are published:

```text
GET https://your-backend-url/
POST https://your-backend-url/api/auth/login
Open https://your-frontend.vercel.app and login as admin
```
