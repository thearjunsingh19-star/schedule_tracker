# 🧠 Project Brain & Living Architecture Guide

> **CRITICAL OPERATING INSTRUCTION FOR AI AGENTS & DEVELOPERS:**  
> 1. **ALWAYS READ THIS FILE FIRST** before proposing, designing, or implementing any changes to this repository.  
> 2. **ALWAYS UPDATE THIS FILE** whenever any modifications, bug fixes, refactors, or new features are introduced. Register all changes in the [Change Registry & Activity Log](#-change-registry--activity-log) section at the bottom with timestamps, files modified, and rationale.

---

## 📌 1. Project Overview

**Schedule Tracker & Weekly/Monthly Checkbook Pro** is a fast, responsive, and aesthetically refined personal habit and schedule tracking web application. It combines an interactive checkbook ledger (inspired by physical check registers) with visual analytics (Chart.js), multi-view time horizons (7-day week and full 30/31-day month checkboard), and local SQLite persistence.

### Core Tech Stack
- **Backend**: Python 3 with Flask (`flask>=3.0.0`).
- **Database**: SQLite3 (`schedule_tracker.db`), zero cloud dependencies, foreign keys enabled with cascade deletion.
- **Frontend Core**: Semantic HTML5, Vanilla JavaScript (ES6+), Vanilla CSS (`style.css`).
- **CSS Framework**: Tailwind CSS via CDN (configured with Tailwind dark mode using `'class'`).
- **Visuals & Charts**: [Chart.js](https://cdn.jsdelivr.net/npm/chart.js) (v4+ via CDN) for stacked volume charts, completion percentage trend lines, and category distribution doughnuts.
- **Icons**: [Lucide Icons](https://unpkg.com/lucide@latest) via CDN with dynamic `lucide.createIcons()` re-rendering.
- **PWA & Offline**: Progressive Web App with `manifest.json`, Service Worker caching (`sw.js`), and mobile install prompt support.
- **Typography**: Google Fonts (*Plus Jakarta Sans*).

---

## 📂 2. Repository File Tree & Component Breakdown

```
schedule_tracker/
├── README.md                 # User documentation, launch instructions & feature overview
├── requirements.txt          # Python dependencies (flask>=3.0.0)
├── run.bat                   # Windows batch script to launch the app
├── app.py                    # Flask application, routing, date arithmetic, API endpoints
├── database.py               # SQLite schema definitions, seeding, and database operations
├── schedule_tracker.db       # Local SQLite database file
├── brain.md                  # Project memory, architecture blueprint & change registry (THIS FILE)
├── components.json           # shadcn project configuration & path mapping
├── tsconfig.json             # TypeScript config with @/* path alias
├── components/
│   ├── ui/
│   │   └── liquid-glass-button.tsx # shadcn LiquidButton & MetalButton React components
│   └── demo.tsx              # Demonstration component using LiquidButton
├── lib/
│   └── utils.ts              # cn() utility (clsx + tailwind-merge)
├── templates/
│   └── index.html            # Single-page application HTML structure with SVG filter & liquid glass cards
└── static/
    ├── manifest.json         # Web App Manifest for PWA installation
    ├── sw.js                 # Service Worker implementation for offline shell caching
    ├── images/
    │   └── logo.png          # Sword/shield branding logo used in header, favicon & PWA icon
    ├── css/
    │   └── style.css         # Liquid glass card/button styling, shader canvas, animations, print rules
    └── js/
        ├── app.js            # Client application controller, chart rendering, API calls, theme & state
        └── shader-background.js # Plain WebGL1 fullscreen Waves flow shader background
```

### Detailed File Analysis

#### 1. [`app.py`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/app.py)
- **Role**: Backend controller, HTTP server, and business logic engine.
- **Key Modules & Helpers**:
  - `get_week_dates(reference_date)`: Calculates Monday–Sunday boundaries for the current or specified date, formats day labels, checks if dates are past or today, and computes previous/next week anchor strings.
  - `get_month_dates(year, month)`: Calculates all days (1 to 28/30/31) of a given month using Python's `calendar.monthrange`, tagging weekdays/weekends and previous/next month navigation anchors.
  - `open_browser()`: Background timer thread automatically launching default browser at `http://127.0.0.1:5000` unless `--no-browser` flag is passed.
- **Exposed Routes**:
  - `GET /`: Serves `templates/index.html`.
  - `GET /api/tasks`: Returns list of non-archived tasks ordered by priority (High > Medium > Low).
  - `POST /api/tasks`: Creates a new task with title, description, category, priority, scheduled days, color, and target time.
  - `GET /api/tasks/<id>`: Fetches single task details.
  - `PUT /api/tasks/<id>`: Updates existing task attributes.
  - `DELETE /api/tasks/<id>`: Deletes a task and cascades completions.
  - `POST /api/completions/toggle`: Atomically toggles completion state (`0` or `1`) for a `task_id` on a specific `YYYY-MM-DD`.
  - `GET /api/week?date=YYYY-MM-DD`: Comprehensive weekly ledger payload including task rows with daily completion status, summary metrics (weekly completion %, total scheduled vs completed, best day, daily streak), and pre-aggregated Chart.js dataset arrays.
  - `GET /api/month?year=YYYY&month=MM`: Monthly ledger payload containing all tasks mapped across 1..31 days, monthly completion rates, best performing calendar day, and month trajectory chart data.

#### 2. [`database.py`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/database.py)
- **Role**: SQLite schema management, database lifecycle, seeding, and query operations.
- **Database Path**: Resolves dynamically to `schedule_tracker.db` in the script's directory.
- **Connection Configuration**: Sets `row_factory = sqlite3.Row` and enables foreign key enforcement via `PRAGMA foreign_keys = ON`.
- **Database Schema**:
  1. `tasks`:
     - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
     - `title`: TEXT NOT NULL
     - `description`: TEXT
     - `category`: TEXT DEFAULT 'General'
     - `priority`: TEXT DEFAULT 'Medium'
     - `days_of_week`: TEXT DEFAULT '["mon","tue","wed","thu","fri","sat","sun"]' (stored as JSON array)
     - `color`: TEXT DEFAULT '#3b82f6'
     - `target_time`: TEXT DEFAULT ''
     - `is_archived`: INTEGER DEFAULT 0
     - `created_at`: TEXT DEFAULT CURRENT_TIMESTAMP
  2. `completions`:
     - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
     - `task_id`: INTEGER NOT NULL (FOREIGN KEY -> `tasks(id)` ON DELETE CASCADE)
     - `date`: TEXT NOT NULL (ISO date `YYYY-MM-DD`)
     - `completed`: INTEGER DEFAULT 1
     - `notes`: TEXT DEFAULT ''
     - `updated_at`: TEXT DEFAULT CURRENT_TIMESTAMP
     - `UNIQUE(task_id, date)` constraint guarantees no duplicate completion rows.
- **Seed Data**: Automatically populates 6 realistic tasks across Work, Health, Study, Personal, and Chores categories with initial completions if `tasks` table is empty upon first run.

#### 3. [`templates/index.html`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/templates/index.html)
- **Role**: Single-page application structure styled with Tailwind CSS and custom tokens.
- **Key Sections**:
  1. **Ambient Motion Background**: 3 blurred floating radial gradient orbs (`.ambient-orb`) providing subtle visual depth.
  2. **Toast Notification**: Floating top-right notification banner for instant feedback on user actions.
  3. **Sticky Header Navigation**:
     - Branding logo and title ("ScheduleTrack Pro").
     - Week date navigation (Previous, Next, Today, and native Date Picker jump button).
     - Action buttons: Dark/Light Mode toggle, PWA Install button, Print Report button, and "+ Add Task" button.
  4. **Weekly Scorecards Grid (4 Metrics)**:
     - Metric 1: Weekly Completion Rate % with progress bar and performance status badge.
     - Metric 2: Total Tasks Completed vs Scheduled with trend icon.
     - Metric 3: Top Performing Day of the week.
     - Metric 4: Daily Consecutive Streak counter (🔥).
  5. **Top Graphs Section**:
     - Graph 1: Weekly Completion & Volume Trend (stacked bar of completed vs remaining + rate % curve line).
     - Graph 2: Category Balance (doughnut chart with dynamic category badge legend).
  6. **Full Month Overview Section**:
     - Month header with Previous/Next/This Month buttons and month completion score badge.
     - Monthly Completion Trajectory chart (Day 1..31).
     - Horizontal-scrolling Monthly Checkboard Ledger table with sticky task column and compact check buttons.
  7. **Weekly Checkbook Section**:
     - Category filter pills (All, Work, Health, Study, Personal) and Priority filter dropdown.
     - 7-day Monday–Sunday matrix with distinctive "Today" column highlight.
     - Dynamic checkmark buttons with bounce-pop animations.
     - Per-task weekly progress bars and completion counters.
     - Actions column (inline Edit and Delete buttons).
     - Daily Checkbook footer with daily task completion totals and rates.
     - Empty state container with CTA button.
  8. **Modals**:
     - Add/Edit Task Modal with day preset buttons (All, Weekdays, Weekends), individual 7-day toggles, color picker, category, and priority.
     - Delete Confirmation Modal.

#### 4. [`static/css/style.css`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/static/css/style.css)
- **Role**: Specialized visual styling, animations, and print overrides.
- **Highlights**:
  - **Ambient Motion Orbs**: `@keyframes floatOrb1`, `floatOrb2`, `floatOrb3` animating smooth floating multi-axis gradients with distinct light/dark color stops.
  - **Today Column Styling**: High-contrast indicator styling for current day column header, cells, and footer (`.col-today-header`, `.col-today-cell`, `.col-today-footer`).
  - **Check Buttons**:
    - `.check-btn`: 32x32px squircle button for weekly checkbook.
    - `.check-btn-sm`: 25x25px squircle button for monthly checkboard.
    - Three states: `.state-scheduled` (white/slate bordered), `.state-completed` (emerald filled with checkmark and box shadow), `.state-unscheduled` (dashed neutral border).
    - `@keyframes checkPop`: Scale-up bounce animation triggered on completion.
  - **Sticky Columns**: `.sticky-task-col` keeps task titles visible during horizontal scrolling of 31-day table.
  - **Priority Badges**: Distinct high, medium, and low styling supporting dark mode.
  - **Print Stylesheet**: Clean black-and-white print output hiding headers, buttons, and backgrounds for clean PDF/paper export.

#### 5. [`static/js/app.js`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/static/js/app.js)
- **Role**: Client application orchestration, chart lifecycles, and event handling.
- **State Management**:
  - `weekData`, `monthData`: Cached payloads from server.
  - `currentDateParam`, `currentYear`, `currentMonth`: Navigation coordinates.
  - `activeCategory`, `activePriority`: Active table filter states.
  - `trendChart`, `categoryChart`, `monthlyTrendChart`: Chart.js instances with cleanup on re-render.
- **Key Mechanics**:
  - **Optimistic UI Updates**: Toggling a task checkbox immediately alters the DOM element class and icon for zero perceived latency, then issues `POST /api/completions/toggle`. In the background, `refreshDataSilently()` synchronizes both weekly and monthly charts and scorecards without full-page reloads.
  - **Theme Persistence**: Reads and writes `schedule_theme` to `localStorage`. Dynamically adjusts Chart.js grid and label colors on theme flip.
  - **PWA Service Worker & Install Handler**: Intercepts `beforeinstallprompt` to empower the custom "Install App" button.
  - **Modal Management**: Supports both creation and editing mode with pre-filled fields and interactive day selector pills.

#### 6. [`static/manifest.json`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/static/manifest.json) & [`static/sw.js`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/static/sw.js)
- **Role**: Progressive Web App features enabling installation to desktop, Android, or iOS home screens.
- Caches core assets (`/`, `style.css`, `app.js`, `logo.png`, `manifest.json`) using network-first strategy with cache fallback.

#### 7. [`run.bat`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/run.bat) & [`requirements.txt`](file:///c:/Users/arjun/Desktop/Arjun/schedule_tracker/requirements.txt)
- Windows batch runner changing into project directory, executing `python app.py`, and pausing on exit.
- `requirements.txt` specifies `flask>=3.0.0`.

---

## ⚙️ 3. Key Architectural Patterns & Conventions

When modifying or expanding this codebase, strictly observe the following established patterns:

1. **Database Queries**:
   - Always acquire connection via `get_db_connection()` and close connections in `finally` or explicitly before returning.
   - Foreign key constraints must remain enforced (`PRAGMA foreign_keys = ON`).
   - Task `days_of_week` is stored as JSON text (e.g. `'["mon","tue"]'`). Always serialize/deserialize appropriately.
2. **API Design**:
   - Standard response format is JSON: `{"success": true, ...}` or `{"success": false, "error": "message"}` with appropriate HTTP status codes (200, 201, 400, 404).
3. **Frontend Reactivity & Chart.js**:
   - Always check if chart instance exists (`chart.destroy()`) before re-instantiating on a canvas to prevent canvas reuse errors.
   - Use `getChartThemeColors()` to dynamically pull appropriate text and grid colors based on active dark/light mode.
   - Re-run `initIcons()` (which executes `lucide.createIcons()`) whenever HTML with `data-lucide` attributes is injected into the DOM.
4. **Security & Input Sanitization**:
   - User inputs in dynamically rendered table rows must pass through `escapeHtml()` in `app.js` to prevent XSS vulnerabilities.

---

## 🔄 4. Change Registry & Activity Log

> **MANDATORY**: Whenever you make a change to this project, append an entry to this table and document the rationale below it.

| Date & Time | Author / Agent | Files Modified | Nature of Change | Summary & Impact |
| :--- | :--- | :--- | :--- | :--- |
| **2026-09-12 00:39** | Antigravity AI | `brain.md` | Initial Knowledge Extraction & Protocol Setup | Conducted complete scan of repository files and created master architecture document (`brain.md`) with ongoing update protocol. |
| **2026-09-12 00:50** | Antigravity AI | `templates/index.html`, `static/css/style.css`, `static/js/app.js`, `brain.md` | Feature: View Segmentation & Separation | Divided dashboard into dedicated Weekly and Monthly views with segmented toggle button (`#viewToggleWeekly`, `#viewToggleMonthly`), dynamic header date controls, dedicated scorecards, and responsive chart resizing. |
| **2026-09-12 01:10** | Antigravity AI | `static/css/style.css`, `templates/index.html`, `static/js/app.js`, `brain.md` | Feature: Mobile Responsiveness, Liquid Glass Buttons & Pop-Up Elevation | Overhauled UI for mobile ergonomics (2x2 scorecard grid, horizontal swipeable filters, mobile date jump buttons, scrollable modal forms). Implemented liquid glass effect system (`.glass-btn`, `.glass-btn-primary`, `.glass-btn-danger`) with translucent sheen, top specular highlights, and 3D tactile pop elevation on hover/active states. |
| **2026-09-12 01:35** | Antigravity AI | `database.py`, `app.py`, `templates/index.html`, `static/js/app.js`, `vercel.json`, `api/index.py`, `.vercelignore`, `requirements.txt`, `DEPLOYMENT_GUIDE.md`, `brain.md` | Architecture & Feature: Vercel Cloud Deployment & User Authentication System | Implemented dual-database compatibility (Cloud PostgreSQL for Vercel + local SQLite), complete user authentication and multi-user profile isolation with Werkzeug password hashing, case-insensitive duplicate username rejection (409), wrong password rejection (401), liquid glass auth modal (`#authModal`), header profile badge, and Vercel serverless package configuration. |
| **2026-09-12 02:00** | Antigravity AI | `database.py`, `neon.ts`, `.agents/skills`, `brain.md` | Integration & Cloud DB: Neon Serverless Postgres Setup & Live Verification | Configured Neon CLI with linked project `solitary-bonus-15077282` on `production` branch. Initialized Neon MCP, installed Neon agent skills in `.agents/skills`, refined `pg8000` SSL context connection in `database.py`, and verified live cloud PostgreSQL table creation (`users`, `tasks`, `completions`), password hashing, and user seeding. |
| **2026-09-12 02:10** | Antigravity AI | `.gitignore`, `brain.md` | Version Control & Git Initialization | Located Git executable on Windows (`C:\Program Files\Git\cmd\git.exe`), secured `.gitignore` to strictly exclude secrets (`.env*`, `*.db`, `.neon`, `.vercel`), initialized git repository on `main` branch, and created initial commit `ffd1989` containing all 36 application files. |
| **2026-09-12 02:23** | Antigravity AI | `.git/config`, `brain.md` | Remote Repository Link & GitHub Code Push | Linked origin remote to `https://github.com/thearjunsingh19-star/schedule_tracker.git`, authenticated upload, and pushed `main` branch live to GitHub. Zero credentials stored in repository metadata. |
| **2026-09-12 02:44** | Antigravity AI | `templates/index.html`, `static/css/style.css`, `static/js/app.js`, `brain.md` | Mobile Responsiveness & Viewport Containment Fix | Resolved mobile page zoom-out and horizontal empty space bug. Enforced strict `overflow-x: hidden` and `max-width: 100%` on `html`/`body`, redesigned header for mobile viewports (`hidden md:flex` for desktop nav), built dedicated mobile control center with full-width segmented view toggles and touch date navigator, added `.sticky-task-col` to weekly table, and created responsive column widths (`.weekly-day-col`) to ensure 100% edge-to-edge mobile fit. |
| **2026-09-17 19:55** | Antigravity AI | `components/ui/liquid-glass-button.tsx`, `components/demo.tsx`, `lib/utils.ts`, `components.json`, `tsconfig.json`, `package.json`, `templates/index.html`, `static/css/style.css`, `brain.md` | Feature: shadcn LiquidButton Integration & Full App Liquid Glass Elevation | Integrated shadcn React `LiquidButton` & `MetalButton` with `@radix-ui/react-slot` and `class-variance-authority`. Ported SVG turbulence filter (`#container-glass`) and 9-layer liquid glass shadow physics to all graphs, tables, and buttons across the live Flask app. |
| **2026-09-17 20:07** | Antigravity AI | `static/css/style.css`, `brain.md` | Refinement: Clean Modern Checkbook Buttons | Removed noisy liquid glass backdrop filters, 9-layer inset shadows, and glowing neon halo borders from `.check-btn` and `.check-btn-sm`. Restored crisp, modern, distraction-free checkboxes (clean slate borders for scheduled, solid emerald `#10b981` for completed). |
| **2026-09-17 20:15** | Antigravity AI | `templates/index.html`, `static/css/style.css`, `static/js/app.js`, `brain.md` | Feature: Apple macOS Navigation Bar to Floating Dock & Menu Bar Conversion | Converted top navigation header into a sleek 42px macOS Menu Bar and a floating Apple macOS Dock at the bottom center of the screen with liquid glass shelf, cursor proximity wave magnification, speech-bubble tooltips, active app indicator dots, and bounce physics. |

### Detailed Log Entries

#### Entry 1: 2026-09-12 00:39 — Project Baseline Documentation
- **Context**: User requested creation of `brain.md` to catalog all existing code and enforce a living change registry protocol for all future modifications.
- **Action**: Performed comprehensive read of all repository files (`app.py`, `database.py`, `templates/index.html`, `static/css/style.css`, `static/js/app.js`, `static/manifest.json`, `static/sw.js`, `requirements.txt`, `README.md`, `run.bat`).
- **Result**: Initialized `brain.md` containing full architectural breakdown, tech stack, API catalog, database schema, design conventions, and instructions for future changes.

#### Entry 2: 2026-09-12 00:50 — Separate Weekly & Monthly Views & Controls
- **Context**: User requested a separate toggle button for Weekly and Monthly options, and a clean division of all graphs and checkbook matrices into dedicated Weekly and Monthly sections.
- **Action**:
  - `templates/index.html`: Replaced static header date bar with segmented pill switcher (`#viewToggleContainer`) and dynamic `#weekNavControls` / `#monthNavControls`. Separated main content into `#weeklyViewContainer` (Weekly Scorecards, Weekly Volume/Trend Bar Chart, Category Doughnut, 7-Day Weekly Checkbook table) and `#monthlyViewContainer` (Monthly Scorecards, 31-Day Trajectory Line/Bar Chart, Monthly Checkboard Ledger table with synchronized filters). Added responsive mobile date navigators.
  - `static/css/style.css`: Added `.view-toggle-btn` active/hover styles with smooth border and shadow transitions for dark/light themes.
  - `static/js/app.js`: Added `currentViewMode` state (persisting to `localStorage.getItem("schedule_active_view")`), implemented `initViewToggle()` and `switchView(mode)` with Chart.js canvas resize handling, synchronized category & priority filters across both views, added mobile navigation listeners, and bound month scorecard metrics to `updateMonthHeader()`.
- **Result**: Users can seamlessly toggle between a focused 7-day Weekly Checkbook view and an expansive 31-day Monthly Checkboard view without visual clutter or stacked layout overload.

#### Entry 3: 2026-09-12 01:10 — Mobile Responsiveness, Liquid Glass Buttons & 3D Tactile Pop Elevation
- **Context**: User requested making the UI more mobile responsive, adding a liquid glass effect to the buttons, and making buttons tactilely pop up.
- **Action**:
  - `static/css/style.css`:
    - Designed custom liquid glass CSS class tokens: `.glass-btn` (neutral glass with multi-layered translucency, soft backdrop-blur, subtle inner specular highlight, and border glow), `.glass-btn-primary` (liquid sapphire/indigo gradient with top glass refraction sheen and ambient shadow), `.glass-btn-danger` (liquid ruby glass for delete actions), `.cat-active` (popped active state for category pills).
    - Added spring-physics tactile pop elevation: `.btn-pop` with `transform: translateY(-2.5px) scale(1.025)` on hover, `translateY(1.5px) scale(0.975)` on active, with `box-shadow` depth expansion and spring cubic-bezier timing `cubic-bezier(0.34, 1.56, 0.64, 1)`.
    - Overhauled `.check-btn` (weekly) and `.check-btn-sm` (monthly) into liquid glass checkmark buttons with emerald glow when completed, translucent glass border when scheduled, and 3D scale bounce animations.
    - Added `.no-scrollbar` utility for clean horizontal swipe on mobile touchscreens.
  - `templates/index.html`:
    - Upgraded both Weekly and Monthly scorecards from stacked single columns on mobile to a clean 2x2 grid (`grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4`) with responsive padding and typography.
    - Added dedicated mobile date sub-header with quick "Today" (`#mobileTodayBtn`) and "This Month" (`#mobileThisMonthBtn`) jump buttons.
    - Wrapped category filter containers in `overflow-x-auto no-scrollbar max-w-full flex-nowrap` for fluid touch swipe on mobile screens.
    - Enhanced task creation and delete confirmation modals with `max-h-[90vh] flex flex-col`, scrollable form body, and liquid glass action buttons.
    - Applied `.glass-btn`, `.glass-btn-primary`, and `.btn-pop` across header actions, view toggles, empty states, and modal buttons.
  - `static/js/app.js`:
    - Bound click event listeners to `#mobileTodayBtn` and `#mobileThisMonthBtn` for rapid navigation on mobile devices.
    - Updated category filter event handler to dynamically toggle `.cat-active` class to maintain specular highlight on active pills.
    - Added `.btn-pop` to dynamically rendered table row action buttons (Edit & Delete).
- **Result**: Drastically improved mobile phone experience with thumb-friendly controls, eliminated layout overflow/wrapping issues, and introduced a stunning iOS/macOS-style liquid glass aesthetic with tactile 3D pop physics across all buttons.

#### Entry 4: 2026-09-12 01:35 — Vercel Cloud Deployment & User Authentication System
- **Context**: User requested deploying to Vercel, asked how persistent data storage works on Vercel, requested a login window with username and password storage, profile creation, duplicate username error handling, and wrong password prevention.
- **Action**:
  - `database.py`: Built dual-database compatibility layer supporting cloud PostgreSQL (via `DATABASE_URL` with pure-Python `pg8000` or `psycopg2`) and local SQLite with `/tmp` serverless fallback. Added `users` table schema, password hashing integration, user creation, starter habits seeding per user, and user isolation (`user_id` foreign key) across all task and completion operations.
  - `app.py`: Configured session management with `SECRET_KEY`, added `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` endpoints with case-insensitive duplicate username checks (409 Conflict) and secure password verification (401 Unauthorized). Protected all task, checkbook, and analytics routes with authenticated user session checks.
  - `templates/index.html`: Added user profile badge in navigation bar with user avatar, display name, and liquid glass Sign Out button. Added Liquid Glass `#authModal` with segmented tabs for Sign In vs Create Profile, username/password/name inputs, show/hide password toggle, and red glass error banner.
  - `static/js/app.js`: Added `initAuth()`, `updateUserUI()`, modal tab switching, asynchronous auth submission with error alerts, 401 handling, and session logout.
  - `vercel.json` & `api/index.py` & `.vercelignore`: Configured serverless Python routing for Vercel deployment.
  - `requirements.txt`: Added `pg8000>=1.30.0` and `werkzeug>=3.0.0`.
  - `DEPLOYMENT_GUIDE.md`: Authored a beginner-friendly, step-by-step deployment guide detailing how serverless storage works on Vercel and how to connect a free cloud database (Neon/Supabase) in 1 minute.
- **Result**: Application is 100% production-ready for Vercel cloud deployment with persistent cloud data storage, individual user profiles, and secure authentication.

#### Entry 5: 2026-09-12 02:00 — Neon Serverless Postgres Setup & Live Verification
- **Context**: User provided Neon API credentials and requested setting up the Neon project in the workspace (`neon login`, `neon skills`, `neon mcp`, `neon link`, `neon config init`, `neon.ts`, `neon deploy`) and asked for the next steps while keeping API key details secure.
- **Action**:
  - `neon CLI`: Authenticated CLI profile `DEFAULT` securely using the user's Neon API key without exposing raw tokens in logs or console output.
  - `neon MCP`: Configured MCP endpoints across IDE environments.
  - `neon skills`: Installed all 7 official Neon agent skills into `.agents/skills`.
  - `neon link`: Linked workspace to project `solitary-bonus-15077282` on the `production` branch.
  - `neon config init` & `neon.ts`: Initialized `@neon/config` and verified `neon.ts` definitions.
  - `neon deploy`: Deployed configuration and synchronized live `DATABASE_URL` into `.env.local`.
  - `database.py`: Fixed `pg8000` SSL negotiation by passing standard `ssl.create_default_context()` to ensure seamless communication with Neon's AWS pooler.
  - Verification: Executed live validation script confirming that tables `users`, `tasks`, and `completions` were created, user profiles initialized, and tasks seeded directly in the live Neon cloud PostgreSQL database.
- **Result**: Neon PostgreSQL cloud database is completely live, linked, schema-initialized, and connected to the Schedule Tracker.

#### Entry 6: 2026-09-12 02:10 — Git Repository Initialization & Initial Commit
- **Context**: User installed Git on Windows and requested pushing the codebase to GitHub.
- **Action**:
  - Located the newly installed `git.exe` at `C:\Program Files\Git\cmd\git.exe`.
  - Strengthened `.gitignore` to prevent any credential or local data leakage (`.env*`, `*.db`, `*.sqlite3`, `.neon`, `.vercel/`, `node_modules/`, `__pycache__/`).
  - Initialized git repository with `git init -b main`.
  - Configured git author identity locally (`user.name "Arjun"`, `user.email "thearjunsingh19@gmail.com"`).
  - Staged all 36 application code, template, asset, and documentation files (`git add .`).
  - Created initial commit `ffd1989`: `"Initial commit: Schedule Tracker with Auth, Neon PostgreSQL, and Vercel support"`.
- **Result**: Local Git repository is fully initialized and committed, cleanly structured, and waiting for the user's remote GitHub repository URL to push.

#### Entry 7: 2026-09-12 02:23 — Remote Repository Linking & GitHub Code Push
- **Context**: User provided GitHub repository URL (`https://github.com/thearjunsingh19-star/schedule_tracker`) and Personal Access Token to complete code push.
- **Action**:
  - Attached origin remote to `https://github.com/thearjunsingh19-star/schedule_tracker.git`.
  - Pushed `main` branch to GitHub via authenticated HTTPS endpoint.
  - Reset local remote URL to remove token strings from configuration.
  - Verified `.git/config` to confirm zero credentials, tokens, or secret strings are saved on disk.
- **Result**: Codebase is live on GitHub at `https://github.com/thearjunsingh19-star/schedule_tracker` and ready for immediate 1-click import into Vercel.

#### Entry 8: 2026-09-12 02:44 — Mobile Responsiveness & Viewport Containment Fix
- **Context**: User reported that on mobile devices, only half the screen was usable, the other half remained empty (page zoomed out), and the taskbar/header had an unusual, stretched-out length.
- **Root Cause**:
  1. Header navigation crammed brand, weekly/monthly view switcher, user profile badge, theme toggle, and "Add Task" button onto a single non-wrapping flex row demanding >480px width on 360px-390px mobile screens.
  2. Weekly and monthly tables lacked strict root width constraints; the weekly table had a rigid `min-w-[760px]` without scroll isolation, forcing mobile browser viewports to zoom out to ~1000px and leaving the right half of the screen completely empty.
  3. `html` and `body` lacked `overflow-x: hidden !important`, allowing sub-elements to stretch the document body beyond screen boundaries on mobile Safari and Chrome.
  4. Ambient motion background container used `width: 100vw`, introducing horizontal scroll gutters.
- **Action**:
  - `static/css/style.css`:
    - Enforced strict root viewport containment: `html, body { width: 100%; max-width: 100%; overflow-x: hidden !important; -webkit-text-size-adjust: 100%; }`.
    - Constrained `.ambient-motion-container` to `width: 100%; max-width: 100%`.
    - Made `.sticky-task-col` sticky with solid, theme-aware opaque backgrounds on `thead`, `tbody`, and `tfoot` across both weekly and monthly matrices so the task name stays locked in place while days scroll horizontally.
    - Added `@media (max-width: 640px)` classes for weekly columns: `.weekly-task-col` (140px), `.weekly-day-col` (46px), `.weekly-progress-col` (85px), and `.weekly-actions-col` (58px).
  - `templates/index.html`:
    - Enhanced `<meta name="viewport">` with `maximum-scale=5.0, viewport-fit=cover`.
    - Re-engineered `<header>`: hidden desktop nav items on mobile (`hidden md:flex`), streamlined logo/brand, and preserved compact user profile + "Add Task" button.
    - Created a dedicated **Mobile Control Center** directly below the header with full-width segmented view toggles (`#mobileViewToggleWeekly`, `#mobileViewToggleMonthly`) and mobile touch date navigator with "Today" and "This Month" shortcuts.
    - Wrapped `checkbookTable` and `monthCheckboardTable` in isolated scroll containers: `w-full max-w-full overflow-x-auto overflow-y-hidden min-w-0` with native `-webkit-overflow-scrolling: touch`.
  - `static/js/app.js`:
    - Synchronized mobile view switcher buttons with desktop toggles inside `initViewToggle()` and `switchView()`.
    - Updated `renderCheckbookTable()` to inject `.sticky-task-col` on the task column and apply responsive width classes.
- **Result**: The dashboard now fills 100% of mobile phone screens with zero horizontal page blowout, eliminating empty side margins and unusual taskbar lengths. Tables scroll smoothly within their cards while keeping task names locked and visible.

#### Entry 9: 2026-09-17 19:35 — Animated WebGL Waves Flow Shader Background
- **Context**: Added an animated WebGL Waves flow shader background behind the application content using a plain WebGL1 fullscreen triangle and exact custom fragment shader without external libraries.
- **Action**:
  - Created `static/js/shader-background.js`:
    - Plain WebGL1 context initialization with a single fullscreen clip-space triangle `[-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]`.
    - Integrated 21st.dev Waves flow shader algorithm.
    - Fed packed uniform vectors: `u_colors[8]` (`#031C26`, `#1B6CA8`, `#5AD2F4`, `#EAF9FF`), `u_scene`, `u_shape`, `u_surface`, `u_finish`, `u_transform`, `u_space`, and `u_cursor` (Cursor: off).
    - Capped `devicePixelRatio` at 2; dynamic viewport resize listener; automatic RAF animation loop pausing on tab hidden (`visibilitychange`).
  - Updated `templates/index.html`:
    - Mounted `<canvas id="shader-background" class="shader-background-canvas" aria-hidden="true"></canvas>`.
    - Included `<script src="/static/js/shader-background.js"></script>`.
  - Updated `static/css/style.css`:
    - Styled `.shader-background-canvas` with `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: -1;`.
    - Set `body { background-color: transparent !important; }` and fallback `html { background-color: #031c26; }` so the shader is visible underneath the frosted glass cards.
    - Disabled legacy CSS ambient orbs container.
- **Result**: Seamless, GPU-accelerated animated Waves flow shader rendering behind the entire application with frosted glass cards floating on top.

#### Entry 10: 2026-09-17 19:55 — shadcn LiquidButton React Component Integration & Full Liquid Glass Theme Elevation
- **Context**: User requested integrating the `liquid-glass-button.tsx` React component into `/components/ui`, verifying shadcn/Tailwind/TypeScript setup, explaining the importance of `/components/ui`, and replacing legacy liquid glass styling across buttons, graphs, and table backgrounds with the new liquid glass filter and shadow physics.
- **Action**:
  - Installed NPM dependencies: `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`.
  - Scaffolding & Configuration:
    - Created `lib/utils.ts` exporting `cn()`.
    - Created `tsconfig.json` with `@/*` path aliases.
    - Created `components.json` conforming to shadcn CLI specification (`rsc: true`, `tsx: true`, `aliases: { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }`).
    - Added `components/ui/liquid-glass-button.tsx` exporting `Button`, `LiquidButton`, `GlassFilter`, `MetalButton`, and variants.
    - Added `components/demo.tsx` with `DemoOne` demonstration component.
  - Live Web Application Overhaul:
    - Injected SVG `#container-glass` filter (`feTurbulence`, `feDisplacementMap`, `feGaussianBlur`) into `templates/index.html`.
    - Applied `.liquid-glass-card` across all dashboard cards, scorecards, Chart.js graph containers (Weekly Trend, Category Doughnut, Monthly Trajectory), and checkbook table ledgers.
    - In `static/css/style.css`, applied authentic LiquidButton 9-layer multi-level inset and outset glass shadow physics, translucent rim bevels, and `backdrop-filter: url("#container-glass") blur(16px)` to all cards, graphs, tables, and elevated action buttons (`.glass-btn`, `.glass-btn-primary`, `.check-btn`, `.view-toggle-btn.active`, `.cat-active`).
- **Result**: Complete dual-stack support: the repository now has standard shadcn React component structure ready for Next.js / Vite import, while the live running Flask web dashboard now displays the authentic liquid glass SVG refraction and multi-layer rim highlights across all buttons, graphs, and table matrices.

#### Entry 11: 2026-09-17 20:07 — Refinement: Clean Modern Checkbook Buttons
- **Context**: User requested removing the glass distortion and glowing border effects from checkbook buttons in the weekly table and monthly checkboard matrices to eliminate visual clutter and achieve a clean, professional aesthetic.
- **Action**:
  - `static/css/style.css`:
    - Stripped `backdrop-filter: url("#container-glass")`, heavy multi-layered inset shadows, and glowing halo rings (`0 0 10px ...`, `0 0 16px ...`) from `.check-btn` and `.check-btn-sm`.
    - Scheduled state: Crisp, clean `#ffffff` (light) / `#1e293b` (dark) background with a solid `1.5px solid #cbd5e1` (light) / `#475569` (dark) border. Clean subtle hover transition with indigo border (`#6366f1` / `#818cf8`) and light lift.
    - Completed state: Solid, confident emerald green `#10b981` background, matching border, crisp white checkmark, and a subtle clean shadow (`0 1px 2px rgba(16, 185, 129, 0.2)`).
    - Unscheduled state: Clean, minimal dashed indicator (`1.5px dashed #cbd5e1` / `#334155`) with transparent background.
- **Result**: Checkbook ledger and monthly matrix are now razor-sharp, distraction-free, and easy on the eyes while the surrounding cards and graphs retain their liquid glass finish.

#### Entry 12: 2026-09-17 20:15 — Feature: Apple macOS Navigation Bar to Floating Dock & Menu Bar Conversion
- **Context**: User requested converting the navigation bar into the iconic Apple macOS Dock system.
- **Action**:
  - `templates/index.html`:
    - Replaced heavy navbar and redundant mobile control center with a streamlined macOS Top Menu Bar displaying brand, mode badge (`Weekly Checkbook` / `Monthly Checkboard`), active date range indicator, and profile status.
    - Mounted `#macosDock` floating dock with squircle app icons: Weekly View, Monthly View, Previous Period, Today Shortcut, Next Period, Calendar Picker, Add Task (elevated emerald icon), Theme Appearance Toggle, Print Ledger, and Install App.
    - Preserved hidden compatibility container for legacy selector binding.
    - Added `pb-28 sm:pb-36` to `<main>` to maintain safe clearance above the floating dock.
  - `static/css/style.css`:
    - Built `.macos-menubar` with glassmorphic backdrop blur and clean system typography.
    - Built `.macos-dock-wrap` and `.macos-dock` floating shelf (`fixed bottom-3`, 24px rounded pill, `backdrop-filter: blur(30px) saturate(200%)`, specular inner highlight, ambient drop shadow).
    - Designed squircle `.dock-icon` items, neutral `.dock-surface`, active indicator `.dock-dot`, macOS speech-bubble `.dock-tooltip` with arrow pointer, and vertical dividers (`.dock-separator`).
    - Added `@keyframes dockBounce` for tactile click bounce.
  - `static/js/app.js`:
    - Added `initMacosDock()` implementing dynamic cursor proximity wave magnification (`Math.cos()` distance-based scaling up to 1.32x on mousemove).
    - Added click bounce trigger on dock items.
    - Delegated `#dockPrevBtn`, `#dockNextBtn`, and `#dockTodayBtn` to dynamically dispatch week/month actions based on `currentViewMode`.
    - Enhanced `switchView()` to dynamically update top menu bar status label and dock tooltips.
- **Result**: The app now features an authentic Apple macOS desktop operating experience with a floating dock at the bottom and a slim status menu bar at the top, perfectly fluid across desktop and touch mobile devices.

