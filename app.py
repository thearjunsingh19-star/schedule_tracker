import os
import sys
import threading
import webbrowser
import calendar
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash

from database import (
    init_db,
    get_all_tasks,
    get_task_by_id,
    create_task,
    update_task,
    delete_task,
    toggle_completion,
    get_completions_for_period,
    get_user_by_username,
    get_user_by_id,
    create_user
)

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False
app.secret_key = os.environ.get("SECRET_KEY", "schedule_tracker_secret_vault_key_2026")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Initialize database schema on startup
try:
    init_db()
except Exception as e:
    print(f"Warning during DB init: {e}")

DAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
FULL_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

def get_current_user_id():
    return session.get("user_id")

def get_week_dates(reference_date=None):
    if reference_date is None:
        reference_date = datetime.now().date()
    elif isinstance(reference_date, str):
        reference_date = datetime.strptime(reference_date, "%Y-%m-%d").date()
        
    start_of_week = reference_date - timedelta(days=reference_date.weekday())
    
    week_days = []
    today_str = datetime.now().date().strftime("%Y-%m-%d")
    
    for i in range(7):
        current_date = start_of_week + timedelta(days=i)
        date_str = current_date.strftime("%Y-%m-%d")
        week_days.append({
            "code": DAY_CODES[i],
            "name": DAY_NAMES[i],
            "full_name": FULL_DAY_NAMES[i],
            "date": date_str,
            "display": current_date.strftime("%b %d"),
            "day_number": current_date.day,
            "is_today": (date_str == today_str),
            "is_past": (current_date <= datetime.now().date())
        })
        
    prev_week = (start_of_week - timedelta(days=7)).strftime("%Y-%m-%d")
    next_week = (start_of_week + timedelta(days=7)).strftime("%Y-%m-%d")
    week_label = f"{week_days[0]['display']} - {week_days[6]['display']}, {start_of_week.year}"
    
    return {
        "start_date": week_days[0]["date"],
        "end_date": week_days[6]["date"],
        "week_label": week_label,
        "prev_week": prev_week,
        "next_week": next_week,
        "current_week": datetime.now().date().strftime("%Y-%m-%d"),
        "days": week_days
    }

def get_month_dates(year=None, month=None):
    today = datetime.now().date()
    try:
        year = int(year) if year else today.year
        month = int(month) if month else today.month
    except Exception:
        year = today.year
        month = today.month

    num_days = calendar.monthrange(year, month)[1]
    days = []
    today_str = today.strftime("%Y-%m-%d")
    
    for day in range(1, num_days + 1):
        dt = datetime(year, month, day).date()
        date_str = dt.strftime("%Y-%m-%d")
        code = DAY_CODES[dt.weekday()]
        name = DAY_NAMES[dt.weekday()]
        days.append({
            "day_number": day,
            "date": date_str,
            "code": code,
            "name": name,
            "display": f"{name} {day}",
            "is_today": (date_str == today_str),
            "is_past": (dt <= today),
            "is_weekend": (code in ["sat", "sun"])
        })
        
    if month == 1:
        prev_month = {"year": year - 1, "month": 12}
    else:
        prev_month = {"year": year, "month": month - 1}
        
    if month == 12:
        next_month = {"year": year + 1, "month": 1}
    else:
        next_month = {"year": year, "month": month + 1}
        
    month_name = calendar.month_name[month]
    month_label = f"{month_name} {year}"
    
    return {
        "year": year,
        "month": month,
        "month_name": month_name,
        "month_label": month_label,
        "start_date": days[0]["date"],
        "end_date": days[-1]["date"],
        "total_days": num_days,
        "prev_month": prev_month,
        "next_month": next_month,
        "days": days
    }

# =========================================================================
# Web Pages
# =========================================================================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/bad-mood")
def bad_mood():
    return render_template("bad_mood.html")

# =========================================================================
# Authentication Endpoints
# =========================================================================

@app.route("/api/auth/me", methods=["GET"])
def api_auth_me():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": True, "authenticated": False, "user": None})
    
    user = get_user_by_id(user_id)
    if not user:
        session.clear()
        return jsonify({"success": True, "authenticated": False, "user": None})

    return jsonify({
        "success": True,
        "authenticated": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user.get("display_name") or user["username"]
        }
    })

@app.route("/api/auth/register", methods=["POST"])
def api_auth_register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    display_name = (data.get("display_name") or "").strip()

    if not username:
        return jsonify({"success": False, "error": "Username is required."}), 400
    if len(username) < 3 or len(username) > 30:
        return jsonify({"success": False, "error": "Username must be between 3 and 30 characters."}), 400
    if not username.replace("_", "").replace("-", "").isalnum():
        return jsonify({"success": False, "error": "Username can only contain letters, numbers, hyphens, and underscores."}), 400
    if not password:
        return jsonify({"success": False, "error": "Password is required."}), 400
    if len(password) < 4:
        return jsonify({"success": False, "error": "Password must be at least 4 characters."}), 400

    pwd_hash = generate_password_hash(password)
    user, err = create_user(username, pwd_hash, display_name)
    if err:
        return jsonify({"success": False, "error": err}), 409

    # Set user session
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["display_name"] = user.get("display_name") or user["username"]

    return jsonify({
        "success": True,
        "message": f"Welcome, {user.get('display_name') or user['username']}! Your profile is ready.",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user.get("display_name") or user["username"]
        }
    }), 201

@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Please enter both username and password."}), 400

    user = get_user_by_username(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "error": "Invalid username or password. Please check your credentials."}), 401

    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["display_name"] = user.get("display_name") or user["username"]

    return jsonify({
        "success": True,
        "message": f"Welcome back, {user.get('display_name') or user['username']}!",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user.get("display_name") or user["username"]
        }
    })

@app.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    session.clear()
    return jsonify({"success": True, "message": "Signed out successfully."})

# =========================================================================
# Protected Task & Checkbook Endpoints
# =========================================================================

@app.route("/api/tasks", methods=["GET"])
def api_get_tasks():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
    tasks = get_all_tasks(user_id)
    return jsonify({"success": True, "tasks": tasks})

@app.route("/api/tasks", methods=["POST"])
def api_create_task():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
    data = request.get_json() or {}
    if not data.get("title", "").strip():
        return jsonify({"success": False, "error": "Task title is required"}), 400
    
    task = create_task(user_id, data)
    return jsonify({"success": True, "task": task}), 201

@app.route("/api/tasks/<int:task_id>", methods=["GET"])
def api_get_task(task_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
    task = get_task_by_id(task_id, user_id)
    if not task:
        return jsonify({"success": False, "error": "Task not found"}), 404
    return jsonify({"success": True, "task": task})

@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def api_update_task(task_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
    data = request.get_json() or {}
    if not data.get("title", "").strip():
        return jsonify({"success": False, "error": "Task title is required"}), 400
        
    task = update_task(task_id, user_id, data)
    if not task:
        return jsonify({"success": False, "error": "Task not found"}), 404
    return jsonify({"success": True, "task": task})

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def api_delete_task(task_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
    success = delete_task(task_id, user_id)
    return jsonify({"success": success})

@app.route("/api/completions/toggle", methods=["POST"])
def api_toggle_completion():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401
    data = request.get_json() or {}
    task_id = data.get("task_id")
    date_str = data.get("date")
    
    if not task_id or not date_str:
        return jsonify({"success": False, "error": "task_id and date are required"}), 400
        
    res = toggle_completion(task_id, user_id, date_str)
    if res is None:
        return jsonify({"success": False, "error": "Task not found or unauthorized"}), 404
    return jsonify({"success": True, "result": res})

@app.route("/api/week", methods=["GET"])
def api_get_week():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401

    date_param = request.args.get("date")
    try:
        week_info = get_week_dates(date_param)
    except Exception:
        week_info = get_week_dates(None)
        
    start_date = week_info["start_date"]
    end_date = week_info["end_date"]
    
    tasks = get_all_tasks(user_id)
    completions = get_completions_for_period(user_id, start_date, end_date)
    
    daily_stats = {d["code"]: {"date": d["date"], "name": d["name"], "scheduled": 0, "completed": 0, "rate": 0} for d in week_info["days"]}
    category_stats = {}
    
    rows = []
    total_week_scheduled = 0
    total_week_completed = 0
    
    for task in tasks:
        task_days = task.get("days_of_week", [])
        category = task.get("category", "General")
        
        if category not in category_stats:
            category_stats[category] = {"total_scheduled": 0, "total_completed": 0, "color": task.get("color", "#3b82f6")}
            
        task_row_completions = {}
        task_week_scheduled = 0
        task_week_completed = 0
        
        for day in week_info["days"]:
            day_code = day["code"]
            date_str = day["date"]
            is_scheduled = day_code in task_days
            is_done = completions.get(f"{task['id']}_{date_str}", False)
            
            task_row_completions[day_code] = {
                "date": date_str,
                "is_scheduled": is_scheduled,
                "is_completed": is_done
            }
            
            if is_scheduled:
                task_week_scheduled += 1
                total_week_scheduled += 1
                daily_stats[day_code]["scheduled"] += 1
                category_stats[category]["total_scheduled"] += 1
                
                if is_done:
                    task_week_completed += 1
                    total_week_completed += 1
                    daily_stats[day_code]["completed"] += 1
                    category_stats[category]["total_completed"] += 1
            elif is_done:
                task_week_completed += 1
                total_week_completed += 1
                daily_stats[day_code]["completed"] += 1
                category_stats[category]["total_completed"] += 1
                
        task_rate = round((task_week_completed / task_week_scheduled * 100)) if task_week_scheduled > 0 else 0
        
        rows.append({
            "task": task,
            "days": task_row_completions,
            "weekly_scheduled": task_week_scheduled,
            "weekly_completed": task_week_completed,
            "completion_rate": task_rate
        })
        
    best_day = None
    best_rate = -1
    chart_days = []
    chart_completed = []
    chart_incomplete = []
    chart_rates = []
    
    for day in week_info["days"]:
        code = day["code"]
        st = daily_stats[code]
        sch = st["scheduled"]
        comp = st["completed"]
        incomp = max(0, sch - comp)
        rate = round((comp / sch * 100)) if sch > 0 else (100 if comp > 0 else 0)
        st["rate"] = rate
        st["incomplete"] = incomp
        
        chart_days.append(f"{day['name']} ({day['display']})")
        chart_completed.append(comp)
        chart_incomplete.append(incomp)
        chart_rates.append(rate)
        
        if sch > 0 and rate > best_rate:
            best_rate = rate
            best_day = f"{day['full_name']} ({rate}%)"
            
    weekly_rate = round((total_week_completed / total_week_scheduled * 100)) if total_week_scheduled > 0 else 0
    
    streak = 0
    today_date = datetime.now().date()
    for day in reversed(week_info["days"]):
        day_date = datetime.strptime(day["date"], "%Y-%m-%d").date()
        if day_date <= today_date:
            st = daily_stats[day["code"]]
            if st["completed"] > 0:
                streak += 1
            else:
                if day_date == today_date and st["scheduled"] > 0:
                    continue
                break
                
    return jsonify({
        "success": True,
        "week_info": week_info,
        "rows": rows,
        "summary": {
            "total_scheduled": total_week_scheduled,
            "total_completed": total_week_completed,
            "weekly_rate": weekly_rate,
            "best_day": best_day or "N/A",
            "current_streak": streak,
            "daily_stats": daily_stats
        },
        "chart_data": {
            "labels": chart_days,
            "completed": chart_completed,
            "incomplete": chart_incomplete,
            "rates": chart_rates,
            "categories": {
                "labels": list(category_stats.keys()),
                "scheduled": [v["total_scheduled"] for v in category_stats.values()],
                "completed": [v["total_completed"] for v in category_stats.values()],
                "colors": [v["color"] for v in category_stats.values()]
            }
        }
    })

@app.route("/api/month", methods=["GET"])
def api_get_month():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"success": False, "error": "Authentication required. Please sign in."}), 401

    year = request.args.get("year")
    month = request.args.get("month")
    month_info = get_month_dates(year, month)
    
    tasks = get_all_tasks(user_id)
    completions = get_completions_for_period(user_id, month_info["start_date"], month_info["end_date"])
    
    daily_stats = {d["day_number"]: {"date": d["date"], "day": d["day_number"], "name": d["name"], "scheduled": 0, "completed": 0, "rate": 0} for d in month_info["days"]}
    
    rows = []
    total_month_scheduled = 0
    total_month_completed = 0
    
    for task in tasks:
        task_days = task.get("days_of_week", [])
        task_month_scheduled = 0
        task_month_completed = 0
        task_row_completions = {}
        
        for day in month_info["days"]:
            day_num = day["day_number"]
            day_code = day["code"]
            date_str = day["date"]
            
            is_scheduled = day_code in task_days
            is_done = completions.get(f"{task['id']}_{date_str}", False)
            
            task_row_completions[day_num] = {
                "date": date_str,
                "is_scheduled": is_scheduled,
                "is_completed": is_done
            }
            
            if is_scheduled:
                task_month_scheduled += 1
                total_month_scheduled += 1
                daily_stats[day_num]["scheduled"] += 1
                if is_done:
                    task_month_completed += 1
                    total_month_completed += 1
                    daily_stats[day_num]["completed"] += 1
            elif is_done:
                task_month_completed += 1
                total_month_completed += 1
                daily_stats[day_num]["completed"] += 1
                
        rate = round((task_month_completed / task_month_scheduled * 100)) if task_month_scheduled > 0 else 0
        rows.append({
            "task": task,
            "days": task_row_completions,
            "monthly_scheduled": task_month_scheduled,
            "monthly_completed": task_month_completed,
            "completion_rate": rate
        })
        
    chart_labels = []
    chart_completed = []
    chart_incomplete = []
    chart_rates = []
    
    best_day = None
    best_rate = -1
    
    for day in month_info["days"]:
        num = day["day_number"]
        st = daily_stats[num]
        sch = st["scheduled"]
        comp = st["completed"]
        incomp = max(0, sch - comp)
        r = round((comp / sch * 100)) if sch > 0 else (100 if comp > 0 else 0)
        st["rate"] = r
        st["incomplete"] = incomp
        
        chart_labels.append(f"{num}")
        chart_completed.append(comp)
        chart_incomplete.append(incomp)
        chart_rates.append(r)
        
        if sch > 0 and r > best_rate:
            best_rate = r
            best_day = f"{month_info['month_name']} {num} ({r}%)"
            
    month_rate = round((total_month_completed / total_month_scheduled * 100)) if total_month_scheduled > 0 else 0
    
    return jsonify({
        "success": True,
        "month_info": month_info,
        "rows": rows,
        "summary": {
            "total_scheduled": total_month_scheduled,
            "total_completed": total_month_completed,
            "month_rate": month_rate,
            "best_day": best_day or "N/A",
            "daily_stats": daily_stats
        },
        "chart_data": {
            "labels": chart_labels,
            "completed": chart_completed,
            "incomplete": chart_incomplete,
            "rates": chart_rates
        }
    })

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")

if __name__ == "__main__":
    init_db()
    port = 5000
    if "--no-browser" not in sys.argv:
        threading.Timer(1.2, open_browser).start()
    print(f"Schedule Tracker starting on all interfaces at http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
