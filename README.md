# Schedule Tracker & Weekly Checkbook

A fast, responsive web application for managing your weekly schedule, checking off daily tasks in an interactive checkbook ledger, and visualizing weekly progress and category habits with interactive charts.

---

## 🌟 Key Features

1. **Weekly Checkbook Matrix (Mon – Sun)**:
   - Complete 7-day grid showing all your scheduled tasks.
   - Interactive checkmark buttons with smooth pop animations.
   - "Today" column highlight to keep you oriented on the current day.
   - Per-task progress indicator showing weekly completion rate (e.g. `4/5 (80%)`).
   - Daily Checkbook summary footer showing total completed vs scheduled tasks per day.

2. **Weekly Performance Graphs (Chart.js)**:
   - **Weekly Completion Trend Chart**: Stacked bar chart showing completed vs. remaining tasks per day, combined with a completion percentage curve.
   - **Category Breakdown Chart**: Doughnut chart showing task distribution and progress across categories (Work, Health, Study, Personal, Chores).

3. **Weekly Scorecards**:
   - Weekly Completion Rate (%) with status badge ("Outstanding", "Good Progress", etc.).
   - Total Tasks Completed vs Total Scheduled.
   - Top Performing Day of the week.
   - Active Daily Streak counter (🔥).

4. **Flexible Task Management**:
   - Add, edit, or delete tasks.
   - Assign categories, priorities (High, Medium, Low), scheduled times, and custom color tags.
   - Schedule on specific days: All Days, Weekdays, Weekends, or custom days of the week.

5. **Week Navigation & Tools**:
   - Navigate backward and forward across weeks or jump to any date with the calendar picker.
   - Category and priority filters.
   - Print / PDF export support for weekly reviews.

---

## 🚀 How to Run

### Method 1: Double-Click Launcher (Easiest)
Double-click `Start_Schedule_Tracker.bat` on your desktop workspace folder (`c:\Users\arjun\Desktop\Arjun\Start_Schedule_Tracker.bat`).
It will automatically launch the server and open your default web browser at `http://127.0.0.1:5000`.

### Method 2: Command Line
Open PowerShell or Command Prompt:
```powershell
cd c:\Users\arjun\Desktop\Arjun\schedule_tracker
python app.py
```
Then visit [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

---

## 💾 Data Storage

All tasks and completion records are safely stored locally in an SQLite database:
`schedule_tracker.db` in the `schedule_tracker` directory. No cloud login or external database needed.
