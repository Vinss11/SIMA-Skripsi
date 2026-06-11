# Deployment Guide

This project is deployed as two separate apps:

- Backend API on Replit from `server/`
- Frontend React app on Vercel from `client/`

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
REACT_APP_API_BASE_URL=https://your-backend-replit-url.replit.app
```

After Vercel gives the final frontend URL, add it to Replit `CORS_ORIGIN`, then restart or redeploy the backend.

## Validation

Check these after both apps are published:

```text
GET https://your-backend-replit-url.replit.app/
POST https://your-backend-replit-url.replit.app/api/auth/login
Open https://your-frontend.vercel.app and login as admin
```
