# 🚀 Deploying Schedule Tracker on Vercel (Step-by-Step Guide)

This guide explains **how data storage works on Vercel** and provides simple, step-by-step instructions to deploy your application with **100% persistent data storage** and **secure multi-user authentication**.

---

## 💾 How Data Storage Works on Vercel

### ⚠️ Why Local SQLite Doesn't Work on Vercel
- Vercel is a **serverless platform**. Every request runs in an isolated, temporary microVM (AWS Lambda).
- The filesystem on Vercel is **read-only** (except for `/tmp`, which is wiped every time the serverless function cold-starts or restarts).
- If you use a local SQLite file on Vercel, your users, tasks, and checkmarks will disappear on every cold restart!

### ✅ The Solution: Free Cloud PostgreSQL Database
Your application is now built with **Dual-Database Compatibility**:
- **When running locally**: Uses local SQLite (`schedule_tracker.db`) automatically with zero setup.
- **When deployed to Vercel**: Connects to a cloud PostgreSQL database via the `DATABASE_URL` environment variable. All tables (`users`, `tasks`, `completions`) and starter habits are **auto-created** on first load, and data persists permanently forever!

The best and completely **free** cloud database providers are:
1. **Neon** ([neon.tech](https://neon.tech)) — *Recommended: Generous free tier, serverless Postgres, takes 30 seconds.*
2. **Supabase** ([supabase.com](https://supabase.com)) — *Free PostgreSQL database.*
3. **Vercel Postgres** (Built right into the Vercel Dashboard).

---

## 📋 Step-by-Step Deployment Instructions

### Step 1: Cloud Database Status (✅ ALREADY COMPLETED)
Your Neon PostgreSQL cloud database has already been created and linked to this project!
- **Neon Project ID**: `solitary-bonus-15077282`
- **Branch**: `production`
- **Connection URL**: Configured in `.env.local` (as `DATABASE_URL`)
- **Status**: Live tables (`users`, `tasks`, `completions`) have been initialized and verified.
*(When you deploy to Vercel in Step 4, simply copy the `DATABASE_URL` from your `.env.local` into Vercel's Environment Variables).*

---

### Step 2: Push Your Code to GitHub
1. Initialize git and push your repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Schedule Tracker with Auth and Vercel support"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/schedule_tracker.git
   git push -u origin main
   ```

---

### Step 3: Import Project into Vercel
1. Go to [https://vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** -> **"Project"**.
3. Locate your `schedule_tracker` repository and click **"Import"**.
4. In the Project Configuration:
   - **Framework Preset**: Other (automatically detected from `vercel.json`).
   - **Root Directory**: `./` (default).

---

### Step 4: Configure Environment Variables in Vercel
Before clicking Deploy, expand the **"Environment Variables"** section and add two variables:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| **`DATABASE_URL`** | `postgresql://user:password@ep-...neon.tech/neondb?sslmode=require` | The connection string copied from Neon in Step 1. |
| **`SECRET_KEY`** | *(Any long random string, e.g. `my_super_secret_schedule_key_2026`)* | Used by Flask to encrypt user session cookies. |

---

### Step 5: Click Deploy!
1. Click **"Deploy"**.
2. Vercel will install dependencies from `requirements.txt` (`flask`, `pg8000`), package the serverless function, and give you your live URL (e.g., `https://schedule-tracker-xyz.vercel.app`).
3. Open your live URL:
   - The app will automatically initialize the `users`, `tasks`, and `completions` tables in your Neon cloud database!
   - You can click **"Create Profile"**, register your name, and start tracking your schedule with full persistence!

---

## 🔒 Authentication & Data Security Features Included

- **Duplicate Username Prevention**: The system rejects registration if a username already exists (`"Username already exists. Please choose a different username."`).
- **Cryptographic Password Hashing**: Passwords are never stored as plaintext; they are hashed using Werkzeug's secure `scrypt` hashing algorithm.
- **Wrong Password Rejection**: Logging in with an incorrect password is immediately blocked (`"Invalid username or password. Please check your credentials."`).
- **Multi-User Data Isolation**: Every user only sees and edits their own private tasks and checkmarks.
