// Schedule Tracker Application Logic (Weekly & Monthly with Dark Mode)

let currentDateParam = null;
let currentYear = null;
let currentMonth = null;

let weekData = null;
let monthData = null;

let activeCategory = 'all';
let activePriority = 'all';

let currentViewMode = localStorage.getItem("schedule_active_view") || 'weekly';

let trendChart = null;
let categoryChart = null;
let monthlyTrendChart = null;

let taskToDeleteId = null;

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initIcons();
  initEventListeners();
  initViewToggle();
  initPWA();
  initAuth();
});

let deferredPrompt = null;
function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/static/sw.js')
      .catch(err => console.log('SW registration error:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('ScheduleTrack installed successfully!');
        }
        deferredPrompt = null;
      } else {
        showToast("Open on your phone & tap browser menu (⋮) -> 'Install App' or 'Add to Home Screen'!", "info");
      }
    });
  }
}

function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// -------------------------------------------------------------
// Dark & Light Mode Support
// -------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem("schedule_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark) {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("schedule_theme", "light");
  } else {
    document.documentElement.classList.add("dark");
    localStorage.setItem("schedule_theme", "dark");
  }

  // Refresh charts with updated axis colors
  if (weekData) {
    renderTrendChart();
    renderCategoryChart();
  }
  if (monthData) {
    renderMonthTrendChart();
  }
}

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function getChartThemeColors() {
  const dark = isDarkMode();
  return {
    textColor: dark ? "#94a3b8" : "#64748b",
    gridColor: dark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9",
    tooltipBg: dark ? "#0f172a" : "#1e293b",
    remainingBar: dark ? "#334155" : "#e2e8f0"
  };
}

// -------------------------------------------------------------
// Notification Toast
// -------------------------------------------------------------
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMessage");
  const iconEl = document.getElementById("toastIcon");

  msgEl.textContent = message;
  if (type === "success") {
    iconEl.setAttribute("data-lucide", "check-circle-2");
    iconEl.className = "w-5 h-5 text-emerald-500";
  } else if (type === "error") {
    iconEl.setAttribute("data-lucide", "alert-circle");
    iconEl.className = "w-5 h-5 text-red-500";
  } else {
    iconEl.setAttribute("data-lucide", "info");
    iconEl.className = "w-5 h-5 text-indigo-500";
  }
  initIcons();

  toast.classList.remove("translate-y-[-100px]", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-[-100px]", "opacity-0");
  }, 2400);
}

// -------------------------------------------------------------
// View Switching Logic (Weekly vs Monthly)
// -------------------------------------------------------------
function initViewToggle() {
  const weeklyBtn = document.getElementById("viewToggleWeekly");
  const monthlyBtn = document.getElementById("viewToggleMonthly");

  if (weeklyBtn) {
    weeklyBtn.addEventListener("click", () => switchView("weekly"));
  }
  if (monthlyBtn) {
    monthlyBtn.addEventListener("click", () => switchView("monthly"));
  }

  // Apply initial view state without overriding storage
  switchView(currentViewMode, false);
}

function switchView(mode, save = true) {
  currentViewMode = mode;
  if (save) {
    localStorage.setItem("schedule_active_view", mode);
  }

  const weeklyContainer = document.getElementById("weeklyViewContainer");
  const monthlyContainer = document.getElementById("monthlyViewContainer");
  const weekNav = document.getElementById("weekNavControls");
  const monthNav = document.getElementById("monthNavControls");
  const mobileWeekNav = document.getElementById("mobileWeekNav");
  const mobileMonthNav = document.getElementById("mobileMonthNav");

  const weeklyBtn = document.getElementById("viewToggleWeekly");
  const monthlyBtn = document.getElementById("viewToggleMonthly");

  if (mode === "weekly") {
    if (weeklyContainer) weeklyContainer.classList.remove("hidden");
    if (monthlyContainer) monthlyContainer.classList.add("hidden");

    if (weekNav) {
      weekNav.className = "hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner";
    }
    if (monthNav) {
      monthNav.className = "hidden items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner";
    }
    if (mobileWeekNav) mobileWeekNav.classList.remove("hidden");
    if (mobileMonthNav) mobileMonthNav.classList.add("hidden");

    if (weeklyBtn) {
      weeklyBtn.classList.add("active");
      weeklyBtn.classList.remove("text-slate-600", "dark:text-slate-400");
    }
    if (monthlyBtn) {
      monthlyBtn.classList.remove("active");
      monthlyBtn.classList.add("text-slate-600", "dark:text-slate-400");
    }

    setTimeout(() => {
      if (trendChart) trendChart.resize();
      if (categoryChart) categoryChart.resize();
    }, 60);
  } else {
    if (weeklyContainer) weeklyContainer.classList.add("hidden");
    if (monthlyContainer) monthlyContainer.classList.remove("hidden");

    if (weekNav) {
      weekNav.className = "hidden items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner";
    }
    if (monthNav) {
      monthNav.className = "hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner";
    }
    if (mobileWeekNav) mobileWeekNav.classList.add("hidden");
    if (mobileMonthNav) mobileMonthNav.classList.remove("hidden");

    if (weeklyBtn) {
      weeklyBtn.classList.remove("active");
      weeklyBtn.classList.add("text-slate-600", "dark:text-slate-400");
    }
    if (monthlyBtn) {
      monthlyBtn.classList.add("active");
      monthlyBtn.classList.remove("text-slate-600", "dark:text-slate-400");
    }

    setTimeout(() => {
      if (monthlyTrendChart) monthlyTrendChart.resize();
    }, 60);
  }

  initIcons();
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------
function initEventListeners() {
  // Theme Toggle
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);

  // Week Navigation
  document.getElementById("prevWeekBtn").addEventListener("click", () => {
    if (weekData && weekData.week_info) {
      loadWeekData(weekData.week_info.prev_week);
    }
  });

  document.getElementById("nextWeekBtn").addEventListener("click", () => {
    if (weekData && weekData.week_info) {
      loadWeekData(weekData.week_info.next_week);
    }
  });

  document.getElementById("todayBtn").addEventListener("click", () => {
    loadWeekData(null);
    loadMonthData(null, null);
  });

  // Mobile Quick Jump Buttons
  const mobileTodayBtn = document.getElementById("mobileTodayBtn");
  if (mobileTodayBtn) {
    mobileTodayBtn.addEventListener("click", () => {
      loadWeekData(null);
      loadMonthData(null, null);
    });
  }

  const mobileThisMonthBtn = document.getElementById("mobileThisMonthBtn");
  if (mobileThisMonthBtn) {
    mobileThisMonthBtn.addEventListener("click", () => {
      loadMonthData(null, null);
    });
  }

  // Mobile Week Navigation
  const mobilePrevWeek = document.getElementById("mobilePrevWeekBtn");
  const mobileNextWeek = document.getElementById("mobileNextWeekBtn");
  if (mobilePrevWeek) {
    mobilePrevWeek.addEventListener("click", () => {
      if (weekData && weekData.week_info) loadWeekData(weekData.week_info.prev_week);
    });
  }
  if (mobileNextWeek) {
    mobileNextWeek.addEventListener("click", () => {
      if (weekData && weekData.week_info) loadWeekData(weekData.week_info.next_week);
    });
  }

  // Calendar Date Picker
  const datePicker = document.getElementById("datePickerInput");
  document.getElementById("calendarPickerBtn").addEventListener("click", () => {
    datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
  });
  datePicker.addEventListener("change", (e) => {
    if (e.target.value) {
      loadWeekData(e.target.value);
      const parts = e.target.value.split("-");
      loadMonthData(parts[0], parts[1]);
    }
  });

  // Month Navigation
  document.getElementById("prevMonthBtn").addEventListener("click", () => {
    if (monthData && monthData.month_info && monthData.month_info.prev_month) {
      const pm = monthData.month_info.prev_month;
      loadMonthData(pm.year, pm.month);
    }
  });

  document.getElementById("nextMonthBtn").addEventListener("click", () => {
    if (monthData && monthData.month_info && monthData.month_info.next_month) {
      const nm = monthData.month_info.next_month;
      loadMonthData(nm.year, nm.month);
    }
  });

  document.getElementById("thisMonthBtn").addEventListener("click", () => {
    loadMonthData(null, null);
  });

  // Mobile Month Navigation
  const mobilePrevMonth = document.getElementById("mobilePrevMonthBtn");
  const mobileNextMonth = document.getElementById("mobileNextMonthBtn");
  if (mobilePrevMonth) {
    mobilePrevMonth.addEventListener("click", () => {
      if (monthData && monthData.month_info && monthData.month_info.prev_month) {
        const pm = monthData.month_info.prev_month;
        loadMonthData(pm.year, pm.month);
      }
    });
  }
  if (mobileNextMonth) {
    mobileNextMonth.addEventListener("click", () => {
      if (monthData && monthData.month_info && monthData.month_info.next_month) {
        const nm = monthData.month_info.next_month;
        loadMonthData(nm.year, nm.month);
      }
    });
  }

  // Print Report
  document.getElementById("printReportBtn").addEventListener("click", () => {
    window.print();
  });

  // Category Filters (sync across both views)
  const catButtons = document.querySelectorAll(".cat-filter-btn");
  catButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedCat = btn.getAttribute("data-cat");
      activeCategory = selectedCat;

      catButtons.forEach(b => {
        if (b.getAttribute("data-cat") === selectedCat) {
          b.classList.add("bg-white", "dark:bg-slate-700", "text-indigo-600", "dark:text-indigo-300", "font-semibold", "shadow-xs", "cat-active");
          b.classList.remove("hover:text-slate-900", "dark:hover:text-white");
        } else {
          b.classList.remove("bg-white", "dark:bg-slate-700", "text-indigo-600", "dark:text-indigo-300", "font-semibold", "shadow-xs", "cat-active");
          b.classList.add("hover:text-slate-900", "dark:hover:text-white");
        }
      });

      renderCheckbookTable();
      renderMonthCheckboard();
    });
  });

  // Priority Filter (sync across both views)
  const prioritySelect = document.getElementById("priorityFilterSelect");
  const monthPrioritySelect = document.getElementById("monthPriorityFilterSelect");

  if (prioritySelect) {
    prioritySelect.addEventListener("change", (e) => {
      activePriority = e.target.value;
      if (monthPrioritySelect) monthPrioritySelect.value = activePriority;
      renderCheckbookTable();
      renderMonthCheckboard();
    });
  }

  if (monthPrioritySelect) {
    monthPrioritySelect.addEventListener("change", (e) => {
      activePriority = e.target.value;
      if (prioritySelect) prioritySelect.value = activePriority;
      renderCheckbookTable();
      renderMonthCheckboard();
    });
  }

  // Modal Open
  document.getElementById("openNewTaskModalBtn").addEventListener("click", () => {
    openCreateModal();
  });

  // Color picker sync
  const colorInput = document.getElementById("taskColorInput");
  const colorHex = document.getElementById("colorHexDisplay");
  colorInput.addEventListener("input", (e) => {
    colorHex.textContent = e.target.value;
  });

  // Day picker buttons in modal
  const dayButtons = document.querySelectorAll(".day-btn");
  dayButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
    });
  });

  // Form submit
  document.getElementById("taskForm").addEventListener("submit", handleTaskFormSubmit);

  // Delete confirm button
  document.getElementById("confirmDeleteBtn").addEventListener("click", confirmDeleteTask);
}

// -------------------------------------------------------------
// Load Weekly Data
// -------------------------------------------------------------
async function loadWeekData(dateStr = null) {
  try {
    currentDateParam = dateStr;
    const url = dateStr ? `/api/week?date=${dateStr}` : `/api/week`;
    const res = await fetch(url);
    const data = await res.json();

    if (res.status === 401 || !data.success) {
      if (res.status === 401) {
        currentUser = null;
        updateUserUI();
        openAuthModal('login');
      } else {
        showToast(data.error || "Failed to load week data", "error");
      }
      return;
    }

    weekData = data;
    updateWeekHeader();
    updateScorecards();
    renderCheckbookTable();
    renderTrendChart();
    renderCategoryChart();
    initIcons();
  } catch (err) {
    console.error("Error loading week data:", err);
  }
}

function updateWeekHeader() {
  const weekDisplay = document.getElementById("currentWeekDisplay");
  const mobileWeekDisplay = document.getElementById("mobileWeekDisplay");
  if (weekData && weekData.week_info) {
    if (weekDisplay) weekDisplay.textContent = weekData.week_info.week_label;
    if (mobileWeekDisplay) mobileWeekDisplay.textContent = weekData.week_info.week_label;
    if (weekData.week_info.start_date) {
      document.getElementById("datePickerInput").value = weekData.week_info.start_date;
    }
  }
}

function updateScorecards() {
  if (!weekData || !weekData.summary) return;

  const s = weekData.summary;
  const rateEl = document.getElementById("metricWeeklyRate");
  const statusEl = document.getElementById("metricTargetStatus");
  const barEl = document.getElementById("metricProgressBar");
  const doneEl = document.getElementById("metricTasksDone");
  const totalEl = document.getElementById("metricTasksTotal");
  const bestDayEl = document.getElementById("metricBestDay");
  const streakEl = document.getElementById("metricStreak");

  rateEl.textContent = `${s.weekly_rate}%`;
  barEl.style.width = `${Math.min(100, s.weekly_rate)}%`;

  if (s.weekly_rate >= 80) {
    statusEl.textContent = "Outstanding!";
    statusEl.className = "text-xs font-semibold text-emerald-600 dark:text-emerald-400";
    barEl.className = "bg-emerald-500 h-2 rounded-full transition-all duration-500";
  } else if (s.weekly_rate >= 50) {
    statusEl.textContent = "Good Progress";
    statusEl.className = "text-xs font-semibold text-indigo-600 dark:text-indigo-400";
    barEl.className = "bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-500";
  } else {
    statusEl.textContent = "Getting Started";
    statusEl.className = "text-xs font-semibold text-amber-600 dark:text-amber-400";
    barEl.className = "bg-amber-500 h-2 rounded-full transition-all duration-500";
  }

  doneEl.textContent = s.total_completed;
  totalEl.textContent = `/ ${s.total_scheduled} scheduled`;
  bestDayEl.textContent = s.best_day;
  streakEl.textContent = `${s.current_streak} Day${s.current_streak === 1 ? '' : 's'}`;

  const monthStreakEl = document.getElementById("metricMonthStreak");
  if (monthStreakEl) {
    monthStreakEl.textContent = `${s.current_streak} Day${s.current_streak === 1 ? '' : 's'}`;
  }
}

// -------------------------------------------------------------
// Render Weekly Checkbook Table
// -------------------------------------------------------------
function renderCheckbookTable() {
  if (!weekData || !weekData.week_info) return;

  const thead = document.getElementById("checkbookTableHeader");
  const tbody = document.getElementById("checkbookTableBody");
  const tfoot = document.getElementById("checkbookTableFooter");
  const emptyState = document.getElementById("checkbookEmptyState");

  const days = weekData.week_info.days;
  let headerHtml = `
    <th class="py-3.5 px-4 text-left w-64 text-slate-700 dark:text-slate-300">Task & Details</th>
  `;

  days.forEach(d => {
    const todayClass = d.is_today ? "col-today-header font-extrabold" : "";
    headerHtml += `
      <th class="py-3 px-2 text-center w-20 day-col ${todayClass}" data-col="${d.code}">
        <div class="flex flex-col items-center">
          <span class="text-xs uppercase tracking-wider">${d.name}</span>
          <span class="text-[11px] font-normal opacity-75">${d.display.split(" ")[1]}</span>
        </div>
      </th>
    `;
  });

  headerHtml += `
    <th class="py-3.5 px-4 text-center w-28 text-slate-700 dark:text-slate-300">Progress</th>
    <th class="py-3.5 px-3 text-center w-16 text-slate-700 dark:text-slate-300">Actions</th>
  `;
  thead.innerHTML = headerHtml;

  let rows = weekData.rows || [];
  if (activeCategory !== 'all') {
    rows = rows.filter(r => (r.task.category || '').toLowerCase() === activeCategory.toLowerCase());
  }
  if (activePriority !== 'all') {
    rows = rows.filter(r => (r.task.priority || '').toLowerCase() === activePriority.toLowerCase());
  }

  if (rows.length === 0) {
    tbody.innerHTML = "";
    tfoot.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");

  let bodyHtml = "";
  rows.forEach(r => {
    const t = r.task;
    const taskDays = r.days;
    const color = t.color || "#6366f1";
    const isFullDone = r.weekly_scheduled > 0 && r.weekly_completed >= r.weekly_scheduled;

    bodyHtml += `
      <tr class="task-row hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition group" data-task-id="${t.id}">
        <!-- Task Info Cell -->
        <td class="py-3.5 px-4">
          <div class="flex items-start gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style="background-color: ${color};"></span>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-slate-900 dark:text-white ${isFullDone ? 'line-through text-slate-400 dark:text-slate-500' : ''}">${escapeHtml(t.title)}</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md badge-priority-${t.priority || 'Medium'}">${t.priority}</span>
              </div>
              ${t.description ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(t.description)}</p>` : ''}
              <div class="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                <span class="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  <i data-lucide="tag" class="w-3 h-3"></i>
                  ${escapeHtml(t.category)}
                </span>
                ${t.target_time ? `
                  <span class="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 px-1.5 py-0.5 rounded">
                    <i data-lucide="clock" class="w-3 h-3"></i>
                    ${escapeHtml(t.target_time)}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        </td>
    `;

    // 7 Day Cells with Interactive Checkboxes
    days.forEach(d => {
      const dayCode = d.code;
      const dayData = taskDays[dayCode] || { is_scheduled: false, is_completed: false, date: d.date };
      const todayCellClass = d.is_today ? "col-today-cell" : "";
      
      let stateClass = "state-unscheduled";
      if (dayData.is_completed) {
        stateClass = "state-completed";
      } else if (dayData.is_scheduled) {
        stateClass = "state-scheduled";
      }

      bodyHtml += `
        <td class="py-2 px-1 text-center ${todayCellClass}">
          <button 
            type="button"
            class="check-btn ${stateClass}" 
            title="${t.title} - ${d.full_name} (${dayData.is_completed ? 'Completed' : (dayData.is_scheduled ? 'Scheduled' : 'Unscheduled')})"
            onclick="toggleTask(${t.id}, '${d.date}', this)"
          >
            <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
          </button>
        </td>
      `;
    });

    // Progress Column
    const progColor = r.completion_rate >= 80 ? 'bg-emerald-500' : (r.completion_rate >= 50 ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700');
    bodyHtml += `
      <td class="py-3.5 px-4 text-center">
        <div class="flex flex-col items-center gap-1">
          <span class="text-xs font-bold text-slate-700 dark:text-slate-200">${r.weekly_completed}/${r.weekly_scheduled} <span class="text-slate-400 dark:text-slate-500 font-normal">(${r.completion_rate}%)</span></span>
          <div class="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div class="${progColor} h-1.5 rounded-full transition-all duration-300" style="width: ${Math.min(100, r.completion_rate)}%"></div>
          </div>
        </div>
      </td>
    `;

    // Actions Column
    bodyHtml += `
      <td class="py-3.5 px-3 text-center">
        <div class="flex items-center justify-center gap-1 row-actions">
          <button onclick="openEditModal(${t.id})" title="Edit Task" class="btn-pop p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button onclick="promptDeleteTask(${t.id})" title="Delete Task" class="btn-pop p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    </tr>`;
  });

  tbody.innerHTML = bodyHtml;

  // Table Footer
  let footerHtml = `
    <tr>
      <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
        <div class="flex items-center gap-2">
          <i data-lucide="check-square" class="w-4 h-4 text-indigo-600 dark:text-indigo-400"></i>
          <span>Daily Checkbook Total</span>
        </div>
      </td>
  `;

  days.forEach(d => {
    const st = weekData.summary.daily_stats[d.code] || { scheduled: 0, completed: 0, rate: 0 };
    const todayFooterClass = d.is_today ? "col-today-footer text-indigo-900 dark:text-indigo-200" : "";
    footerHtml += `
      <td class="py-3 px-1 text-center ${todayFooterClass}">
        <div class="flex flex-col items-center">
          <span class="font-extrabold text-xs text-slate-900 dark:text-white">${st.completed}/${st.scheduled}</span>
          <span class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">${st.rate}%</span>
        </div>
      </td>
    `;
  });

  footerHtml += `
    <td class="py-3 px-4 text-center font-extrabold text-xs text-indigo-700 dark:text-indigo-400">
      ${weekData.summary.total_completed}/${weekData.summary.total_scheduled} (${weekData.summary.weekly_rate}%)
    </td>
    <td></td>
  </tr>`;

  tfoot.innerHTML = footerHtml;
  initIcons();
}

// -------------------------------------------------------------
// Load & Render Month Section
// -------------------------------------------------------------
async function loadMonthData(year = null, month = null) {
  try {
    currentYear = year;
    currentMonth = month;
    let url = "/api/month";
    if (year && month) {
      url += `?year=${year}&month=${month}`;
    }
    const res = await fetch(url);
    const data = await res.json();

    if (res.status === 401 || !data.success) {
      if (res.status === 401) {
        currentUser = null;
        updateUserUI();
        openAuthModal('login');
      } else {
        showToast(data.error || "Failed to load month data", "error");
      }
      return;
    }

    monthData = data;
    updateMonthHeader();
    renderMonthTrendChart();
    renderMonthCheckboard();
    initIcons();
  } catch (err) {
    console.error("Error loading month data:", err);
  }
}

function updateMonthHeader() {
  if (!monthData || !monthData.month_info) return;
  const m = monthData.month_info;
  const monthDisplay = document.getElementById("currentMonthDisplay");
  const mobileMonthDisplay = document.getElementById("mobileMonthDisplay");

  if (monthDisplay) monthDisplay.textContent = m.month_label;
  if (mobileMonthDisplay) mobileMonthDisplay.textContent = m.month_label;

  const scoreBadge = document.getElementById("monthScoreBadge");
  const s = monthData.summary;
  const rate = s ? s.month_rate : 0;
  if (scoreBadge) scoreBadge.textContent = `${rate}% Month Rate`;

  // Populate Monthly Scorecards
  if (s) {
    const rateEl = document.getElementById("metricMonthRate");
    const statusEl = document.getElementById("metricMonthStatus");
    const barEl = document.getElementById("metricMonthProgressBar");
    const doneEl = document.getElementById("metricMonthTasksDone");
    const totalEl = document.getElementById("metricMonthTasksTotal");
    const bestDayEl = document.getElementById("metricMonthBestDay");
    const streakEl = document.getElementById("metricMonthStreak");

    if (rateEl) rateEl.textContent = `${s.month_rate}%`;
    if (barEl) barEl.style.width = `${Math.min(100, s.month_rate)}%`;

    if (statusEl && barEl) {
      if (s.month_rate >= 80) {
        statusEl.textContent = "Outstanding!";
        statusEl.className = "text-xs font-semibold text-emerald-600 dark:text-emerald-400";
        barEl.className = "bg-emerald-500 h-2 rounded-full transition-all duration-500";
      } else if (s.month_rate >= 50) {
        statusEl.textContent = "Good Progress";
        statusEl.className = "text-xs font-semibold text-violet-600 dark:text-violet-400";
        barEl.className = "bg-violet-600 dark:bg-violet-500 h-2 rounded-full transition-all duration-500";
      } else {
        statusEl.textContent = "Getting Started";
        statusEl.className = "text-xs font-semibold text-amber-600 dark:text-amber-400";
        barEl.className = "bg-amber-500 h-2 rounded-full transition-all duration-500";
      }
    }

    if (doneEl) doneEl.textContent = s.total_completed;
    if (totalEl) totalEl.textContent = `/ ${s.total_scheduled} scheduled`;
    if (bestDayEl) bestDayEl.textContent = s.best_day;
    if (streakEl && weekData && weekData.summary) {
      streakEl.textContent = `${weekData.summary.current_streak} Day${weekData.summary.current_streak === 1 ? '' : 's'}`;
    }
  }
}

function renderMonthTrendChart() {
  if (!monthData || !monthData.chart_data) return;

  const ctx = document.getElementById("monthlyTrendChart").getContext("2d");
  const cData = monthData.chart_data;
  const theme = getChartThemeColors();

  if (monthlyTrendChart) {
    monthlyTrendChart.destroy();
  }

  monthlyTrendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cData.labels,
      datasets: [
        {
          type: 'line',
          label: 'Daily Rate (%)',
          data: cData.rates,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2.5,
          tension: 0.3,
          yAxisID: 'y1',
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#ffffff',
          order: 1
        },
        {
          label: 'Completed Tasks',
          data: cData.completed,
          backgroundColor: '#8b5cf6',
          borderRadius: 4,
          stack: 'monthStack',
          order: 2
        },
        {
          label: 'Remaining Tasks',
          data: cData.incomplete || cData.scheduled.map((s, i) => Math.max(0, s - cData.completed[i])),
          backgroundColor: theme.remainingBar,
          borderRadius: 4,
          stack: 'monthStack',
          order: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleFont: { family: '"Plus Jakarta Sans", sans-serif', size: 12, weight: 'bold' },
          bodyFont: { family: '"Plus Jakarta Sans", sans-serif', size: 12 },
          padding: 9,
          cornerRadius: 8,
          callbacks: {
            title: function(items) {
              return `Day ${items[0].label} of Month`;
            },
            label: function(context) {
              if (context.dataset.type === 'line') {
                return ` Completion: ${context.parsed.y}%`;
              }
              return ` ${context.dataset.label}: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: '600' }, color: theme.textColor }
        },
        y: {
          beginAtZero: true,
          grid: { color: theme.gridColor },
          title: { display: true, text: 'Tasks', font: { size: 10, weight: 'bold' }, color: theme.textColor },
          ticks: { precision: 0, font: { size: 10 }, color: theme.textColor }
        },
        y1: {
          beginAtZero: true,
          max: 100,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Rate %', font: { size: 10, weight: 'bold' }, color: theme.textColor },
          ticks: {
            callback: value => value + '%',
            font: { size: 10 },
            color: theme.textColor
          }
        }
      }
    }
  });
}

function renderMonthCheckboard() {
  if (!monthData || !monthData.month_info) return;

  const thead = document.getElementById("monthTableHeader");
  const tbody = document.getElementById("monthTableBody");
  const tfoot = document.getElementById("monthTableFooter");

  const days = monthData.month_info.days;

  // Render month table headers (Day number + initial)
  let headerHtml = `
    <tr>
      <th class="py-2.5 px-3 text-left w-52 sticky-task-col border-r border-slate-200 dark:border-slate-700">Task Name</th>
  `;

  days.forEach(d => {
    const todayClass = d.is_today ? "col-today-header font-extrabold" : "";
    const weekendClass = d.is_weekend ? "text-amber-600 dark:text-amber-400" : "";
    headerHtml += `
      <th class="py-2 px-1 text-center min-w-[28px] ${todayClass} ${weekendClass}">
        <div class="flex flex-col items-center text-[10px]">
          <span class="opacity-70">${d.name.charAt(0)}</span>
          <span class="font-bold">${d.day_number}</span>
        </div>
      </th>
    `;
  });

  headerHtml += `
      <th class="py-2.5 px-3 text-center w-24 border-l border-slate-200 dark:border-slate-700">Month Total</th>
    </tr>
  `;
  thead.innerHTML = headerHtml;

  // Filter rows
  let rows = monthData.rows || [];
  if (activeCategory !== 'all') {
    rows = rows.filter(r => (r.task.category || '').toLowerCase() === activeCategory.toLowerCase());
  }
  if (activePriority !== 'all') {
    rows = rows.filter(r => (r.task.priority || '').toLowerCase() === activePriority.toLowerCase());
  }

  let bodyHtml = "";
  rows.forEach(r => {
    const t = r.task;
    const taskDays = r.days;
    const color = t.color || "#8b5cf6";

    bodyHtml += `
      <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition">
        <!-- Sticky task info -->
        <td class="py-2 px-3 sticky-task-col border-r border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${color};"></span>
            <span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px] text-xs">${escapeHtml(t.title)}</span>
          </div>
        </td>
    `;

    // 30/31 Day cells
    days.forEach(d => {
      const dayNum = d.day_number;
      const dayData = taskDays[dayNum] || { is_scheduled: false, is_completed: false, date: d.date };
      const todayCellClass = d.is_today ? "col-today-cell" : "";

      let stateClass = "state-unscheduled";
      if (dayData.is_completed) {
        stateClass = "state-completed";
      } else if (dayData.is_scheduled) {
        stateClass = "state-scheduled";
      }

      bodyHtml += `
        <td class="py-1 px-0.5 text-center ${todayCellClass}">
          <button
            type="button"
            class="check-btn-sm ${stateClass}"
            title="${t.title} - Day ${dayNum} (${dayData.is_completed ? 'Done' : (dayData.is_scheduled ? 'Scheduled' : 'Unscheduled')})"
            onclick="toggleTask(${t.id}, '${d.date}', this)"
          >
            <i data-lucide="check" class="w-3 h-3 stroke-[3]"></i>
          </button>
        </td>
      `;
    });

    // Month Total progress
    bodyHtml += `
        <td class="py-2 px-2 text-center border-l border-slate-200 dark:border-slate-700">
          <span class="font-bold text-[11px] text-slate-700 dark:text-slate-300">${r.monthly_completed}/${r.monthly_scheduled}</span>
          <span class="text-[10px] text-slate-400 block">(${r.completion_rate}%)</span>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = bodyHtml;

  // Month Table Footer Summary
  let footerHtml = `
    <tr>
      <td class="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 sticky-task-col border-r border-slate-200 dark:border-slate-700">
        Daily Total
      </td>
  `;

  days.forEach(d => {
    const st = monthData.summary.daily_stats[d.day_number] || { scheduled: 0, completed: 0, rate: 0 };
    const todayFooterClass = d.is_today ? "col-today-footer" : "";
    footerHtml += `
      <td class="py-1.5 px-0.5 text-center ${todayFooterClass}">
        <span class="font-bold text-[10px] text-slate-800 dark:text-slate-200 block">${st.completed}</span>
        <span class="text-[9px] text-slate-400 block">${st.scheduled}</span>
      </td>
    `;
  });

  footerHtml += `
      <td class="py-2.5 px-2 text-center font-bold text-[11px] text-violet-600 dark:text-violet-400 border-l border-slate-200 dark:border-slate-700">
        ${monthData.summary.total_completed}/${monthData.summary.total_scheduled}
      </td>
    </tr>
  `;
  tfoot.innerHTML = footerHtml;

  initIcons();
}

// -------------------------------------------------------------
// Toggle Task Completion
// -------------------------------------------------------------
async function toggleTask(taskId, dateStr, btnElement) {
  // Optimistic UI toggle
  const isCompleted = btnElement.classList.contains("state-completed");
  if (isCompleted) {
    btnElement.classList.remove("state-completed");
    btnElement.classList.add("state-scheduled");
  } else {
    btnElement.classList.remove("state-scheduled", "state-unscheduled");
    btnElement.classList.add("state-completed");
  }
  initIcons();

  try {
    const res = await fetch("/api/completions/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, date: dateStr })
    });
    const data = await res.json();
    if (data.success) {
      // Silently refresh both week and month data
      refreshDataSilently();
    } else {
      showToast(data.error || "Failed to update status", "error");
      loadWeekData(currentDateParam);
      loadMonthData(currentYear, currentMonth);
    }
  } catch (err) {
    console.error("Error toggling completion:", err);
    showToast("Network error updating task", "error");
  }
}

async function refreshDataSilently() {
  try {
    const weekUrl = currentDateParam ? `/api/week?date=${currentDateParam}` : `/api/week`;
    const monthUrl = (currentYear && currentMonth) ? `/api/month?year=${currentYear}&month=${currentMonth}` : `/api/month`;

    const [weekRes, monthRes] = await Promise.all([
      fetch(weekUrl),
      fetch(monthUrl)
    ]);

    const [wData, mData] = await Promise.all([
      weekRes.json(),
      monthRes.json()
    ]);

    if (wData.success) {
      weekData = wData;
      updateScorecards();
      renderCheckbookTable();
      renderTrendChart();
      renderCategoryChart();
    }

    if (mData.success) {
      monthData = mData;
      updateMonthHeader();
      renderMonthTrendChart();
      renderMonthCheckboard();
    }
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// Render Weekly Charts
// -------------------------------------------------------------
function renderTrendChart() {
  if (!weekData || !weekData.chart_data) return;

  const ctx = document.getElementById("weeklyTrendChart").getContext("2d");
  const cData = weekData.chart_data;
  const theme = getChartThemeColors();

  if (trendChart) {
    trendChart.destroy();
  }

  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cData.labels,
      datasets: [
        {
          type: 'line',
          label: 'Completion Rate (%)',
          data: cData.rates,
          borderColor: isDarkMode() ? '#818cf8' : '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.12)',
          borderWidth: 3,
          tension: 0.35,
          yAxisID: 'y1',
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: isDarkMode() ? '#818cf8' : '#4f46e5',
          pointBorderColor: isDarkMode() ? '#0f172a' : '#ffffff',
          pointBorderWidth: 2,
          order: 1
        },
        {
          label: 'Completed Tasks',
          data: cData.completed,
          backgroundColor: '#10b981',
          borderRadius: 6,
          stack: 'tasks',
          order: 2
        },
        {
          label: 'Remaining Tasks',
          data: cData.incomplete,
          backgroundColor: theme.remainingBar,
          borderRadius: 6,
          stack: 'tasks',
          order: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleFont: { family: '"Plus Jakarta Sans", sans-serif', size: 12, weight: 'bold' },
          bodyFont: { family: '"Plus Jakarta Sans", sans-serif', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              if (context.dataset.type === 'line') {
                return ` Completion: ${context.parsed.y}%`;
              }
              return ` ${context.dataset.label}: ${context.parsed.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: '"Plus Jakarta Sans", sans-serif', size: 11, weight: '600' }, color: theme.textColor }
        },
        y: {
          beginAtZero: true,
          grid: { color: theme.gridColor },
          title: { display: true, text: 'Task Volume', font: { size: 11, weight: 'bold' }, color: theme.textColor },
          ticks: { precision: 0, font: { size: 11 }, color: theme.textColor }
        },
        y1: {
          beginAtZero: true,
          max: 100,
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Completion %', font: { size: 11, weight: 'bold' }, color: theme.textColor },
          ticks: {
            callback: value => value + '%',
            font: { size: 11 },
            color: theme.textColor
          }
        }
      }
    }
  });
}

function renderCategoryChart() {
  if (!weekData || !weekData.chart_data) return;

  const ctx = document.getElementById("categoryChart").getContext("2d");
  const catData = weekData.chart_data.categories;
  const listEl = document.getElementById("categorySummaryList");
  const theme = getChartThemeColors();

  if (categoryChart) {
    categoryChart.destroy();
  }

  const defaultPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
  const backgroundColors = catData.colors.map((c, i) => c || defaultPalette[i % defaultPalette.length]);

  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: catData.labels,
      datasets: [{
        data: catData.scheduled.map(s => s > 0 ? s : 0),
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: isDarkMode() ? '#0f172a' : '#ffffff',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleFont: { size: 12, weight: 'bold' },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const idx = context.dataIndex;
              const scheduled = catData.scheduled[idx];
              const completed = catData.completed[idx];
              const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
              return ` ${context.label}: ${completed}/${scheduled} done (${rate}%)`;
            }
          }
        }
      }
    }
  });

  let listHtml = "";
  catData.labels.forEach((label, i) => {
    const sch = catData.scheduled[i];
    const comp = catData.completed[i];
    const col = backgroundColors[i];
    listHtml += `
      <div class="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300">
        <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${col}"></span>
        <span>${escapeHtml(label)}</span>
        <span class="text-slate-400 dark:text-slate-500 font-semibold">${comp}/${sch}</span>
      </div>
    `;
  });
  listEl.innerHTML = listHtml;
}

// -------------------------------------------------------------
// Modal & CRUD Operations
// -------------------------------------------------------------
function openCreateModal() {
  document.getElementById("taskIdInput").value = "";
  document.getElementById("modalTitle").innerHTML = `<i data-lucide="plus-circle" class="w-5 h-5 text-indigo-600 dark:text-indigo-400"></i> Add New Task`;
  document.getElementById("taskForm").reset();
  document.getElementById("taskColorInput").value = "#3b82f6";
  document.getElementById("colorHexDisplay").textContent = "#3b82f6";
  selectDaysPreset("all");

  openModalElement("taskModal");
  initIcons();
}

function openEditModal(taskId) {
  const row = (weekData.rows || []).find(r => r.task.id === taskId);
  if (!row) return;

  const t = row.task;
  document.getElementById("taskIdInput").value = t.id;
  document.getElementById("modalTitle").innerHTML = `<i data-lucide="edit-3" class="w-5 h-5 text-indigo-600 dark:text-indigo-400"></i> Edit Task`;
  document.getElementById("taskTitleInput").value = t.title;
  document.getElementById("taskDescInput").value = t.description || "";
  document.getElementById("taskCategoryInput").value = t.category || "General";
  document.getElementById("taskPriorityInput").value = t.priority || "Medium";
  document.getElementById("taskTimeInput").value = t.target_time || "";
  document.getElementById("taskColorInput").value = t.color || "#3b82f6";
  document.getElementById("colorHexDisplay").textContent = t.color || "#3b82f6";

  const taskDays = t.days_of_week || [];
  document.querySelectorAll(".day-btn").forEach(btn => {
    const day = btn.getAttribute("data-day");
    if (taskDays.includes(day)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  openModalElement("taskModal");
  initIcons();
}

function closeTaskModal() {
  closeModalElement("taskModal");
}

function selectDaysPreset(preset) {
  const weekdays = ["mon", "tue", "wed", "thu", "fri"];
  const weekends = ["sat", "sun"];

  document.querySelectorAll(".day-btn").forEach(btn => {
    const day = btn.getAttribute("data-day");
    if (preset === "all") {
      btn.classList.add("active");
    } else if (preset === "weekdays") {
      weekdays.includes(day) ? btn.classList.add("active") : btn.classList.remove("active");
    } else if (preset === "weekends") {
      weekends.includes(day) ? btn.classList.add("active") : btn.classList.remove("active");
    }
  });
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();
  const taskId = document.getElementById("taskIdInput").value;
  const title = document.getElementById("taskTitleInput").value.trim();
  const description = document.getElementById("taskDescInput").value.trim();
  const category = document.getElementById("taskCategoryInput").value;
  const priority = document.getElementById("taskPriorityInput").value;
  const target_time = document.getElementById("taskTimeInput").value.trim();
  const color = document.getElementById("taskColorInput").value;

  const selectedDays = [];
  document.querySelectorAll(".day-btn.active").forEach(b => {
    selectedDays.push(b.getAttribute("data-day"));
  });

  if (selectedDays.length === 0) {
    showToast("Please select at least one day for this task", "error");
    return;
  }

  const payload = {
    title,
    description,
    category,
    priority,
    target_time,
    color,
    days_of_week: selectedDays
  };

  try {
    let res;
    if (taskId) {
      res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (data.success) {
      closeTaskModal();
      showToast(taskId ? "Task updated successfully!" : "Task added successfully!");
      loadWeekData(currentDateParam);
      loadMonthData(currentYear, currentMonth);
    } else {
      showToast(data.error || "Failed to save task", "error");
    }
  } catch (err) {
    console.error("Error saving task:", err);
    showToast("Failed to connect to server", "error");
  }
}

function promptDeleteTask(taskId) {
  taskToDeleteId = taskId;
  openModalElement("deleteConfirmModal");
}

function closeDeleteModal() {
  taskToDeleteId = null;
  closeModalElement("deleteConfirmModal");
}

async function confirmDeleteTask() {
  if (!taskToDeleteId) return;

  try {
    const res = await fetch(`/api/tasks/${taskToDeleteId}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (data.success) {
      closeDeleteModal();
      showToast("Task deleted");
      loadWeekData(currentDateParam);
      loadMonthData(currentYear, currentMonth);
    } else {
      showToast("Failed to delete task", "error");
    }
  } catch (err) {
    console.error("Error deleting task:", err);
    showToast("Failed to delete task", "error");
  }
}

function openModalElement(id) {
  const modal = document.getElementById(id);
  const content = modal.querySelector("div");
  modal.classList.remove("opacity-0", "pointer-events-none");
  modal.classList.add("opacity-100", "pointer-events-auto");
  content.classList.remove("scale-95");
  content.classList.add("scale-100");
}

function closeModalElement(id) {
  const modal = document.getElementById(id);
  const content = modal.querySelector("div");
  modal.classList.remove("opacity-100", "pointer-events-auto");
  modal.classList.add("opacity-0", "pointer-events-none");
  content.classList.remove("scale-100");
  content.classList.add("scale-95");
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// Authentication & User Profile Management
// -------------------------------------------------------------
let currentUser = null;
let currentAuthMode = 'login'; // 'login' | 'register'

async function initAuth() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.success && data.authenticated && data.user) {
      currentUser = data.user;
      updateUserUI();
      loadWeekData();
      loadMonthData();
    } else {
      currentUser = null;
      updateUserUI();
      // Show login modal automatically if not authenticated
      openAuthModal('login');
    }
  } catch (err) {
    console.error("Error checking auth status:", err);
    openAuthModal('login');
  }
}

function updateUserUI() {
  const openBtn = document.getElementById("authOpenBtn");
  const badge = document.getElementById("userLoggedInBadge");
  const avatar = document.getElementById("userAvatarCircle");
  const nameEl = document.getElementById("userProfileName");

  if (currentUser) {
    if (openBtn) openBtn.classList.add("hidden");
    if (badge) {
      badge.classList.remove("hidden");
      badge.classList.add("flex");
    }
    const displayName = currentUser.display_name || currentUser.username || "User";
    if (nameEl) nameEl.textContent = displayName;
    if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();
  } else {
    if (openBtn) openBtn.classList.remove("hidden");
    if (badge) {
      badge.classList.add("hidden");
      badge.classList.remove("flex");
    }
  }
}

function openAuthModal(mode = 'login') {
  if (mode === 'switch') {
    switchAuthTab('login');
  } else {
    switchAuthTab(mode);
  }
  clearAuthAlerts();
  openModalElement("authModal");
  setTimeout(() => {
    const input = document.getElementById("authUsernameInput");
    if (input) input.focus();
  }, 100);
}

function closeAuthModal() {
  closeModalElement("authModal");
  clearAuthAlerts();
}

function clearAuthAlerts() {
  const alertEl = document.getElementById("authAlert");
  const succEl = document.getElementById("authSuccessAlert");
  if (alertEl) alertEl.classList.add("hidden");
  if (succEl) succEl.classList.add("hidden");
}

function showAuthError(msg) {
  const alertEl = document.getElementById("authAlert");
  const textEl = document.getElementById("authAlertText");
  const succEl = document.getElementById("authSuccessAlert");
  if (succEl) succEl.classList.add("hidden");
  if (alertEl && textEl) {
    textEl.textContent = msg;
    alertEl.classList.remove("hidden");
  }
}

function showAuthSuccess(msg) {
  const alertEl = document.getElementById("authAlert");
  const succEl = document.getElementById("authSuccessAlert");
  const textEl = document.getElementById("authSuccessAlertText");
  if (alertEl) alertEl.classList.add("hidden");
  if (succEl && textEl) {
    textEl.textContent = msg;
    succEl.classList.remove("hidden");
  }
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  clearAuthAlerts();

  const tabSignIn = document.getElementById("tabSignInBtn");
  const tabRegister = document.getElementById("tabRegisterBtn");
  const title = document.getElementById("authModalTitle");
  const submitBtn = document.getElementById("authSubmitBtn");
  const submitText = document.getElementById("authSubmitText");
  const submitIcon = document.getElementById("authSubmitIcon");
  const displayNameGroup = document.getElementById("authDisplayNameGroup");
  const pwdHelp = document.getElementById("authPasswordHelp");
  const switchPrompt = document.getElementById("authSwitchPrompt");
  const switchBtn = document.getElementById("authSwitchBtn");

  if (mode === 'login') {
    if (tabSignIn) {
      tabSignIn.classList.add("active");
      tabSignIn.classList.remove("text-slate-600", "dark:text-slate-400");
    }
    if (tabRegister) {
      tabRegister.classList.remove("active");
      tabRegister.classList.add("text-slate-600", "dark:text-slate-400");
    }
    if (title) title.textContent = "Sign In";
    if (displayNameGroup) displayNameGroup.classList.add("hidden");
    if (pwdHelp) pwdHelp.classList.add("hidden");
    if (submitText) submitText.textContent = "Sign In to Tracker";
    if (submitIcon) submitIcon.setAttribute("data-lucide", "log-in");
    if (switchPrompt) switchPrompt.textContent = "Don't have a profile yet?";
    if (switchBtn) switchBtn.textContent = "Create a new profile";
  } else {
    if (tabRegister) {
      tabRegister.classList.add("active");
      tabRegister.classList.remove("text-slate-600", "dark:text-slate-400");
    }
    if (tabSignIn) {
      tabSignIn.classList.remove("active");
      tabSignIn.classList.add("text-slate-600", "dark:text-slate-400");
    }
    if (title) title.textContent = "Create Profile";
    if (displayNameGroup) displayNameGroup.classList.remove("hidden");
    if (pwdHelp) pwdHelp.classList.remove("hidden");
    if (submitText) submitText.textContent = "Create Account & Start";
    if (submitIcon) submitIcon.setAttribute("data-lucide", "user-plus");
    if (switchPrompt) switchPrompt.textContent = "Already have a profile?";
    if (switchBtn) switchBtn.textContent = "Sign In here";
  }
  initIcons();
}

function toggleAuthMode() {
  switchAuthTab(currentAuthMode === 'login' ? 'register' : 'login');
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById("authPasswordInput");
  const icon = document.getElementById("togglePwdIcon");
  if (!pwdInput || !icon) return;

  if (pwdInput.type === "password") {
    pwdInput.type = "text";
    icon.setAttribute("data-lucide", "eye-off");
  } else {
    pwdInput.type = "password";
    icon.setAttribute("data-lucide", "eye");
  }
  initIcons();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthAlerts();

  const usernameInput = document.getElementById("authUsernameInput");
  const passwordInput = document.getElementById("authPasswordInput");
  const displayNameInput = document.getElementById("authDisplayNameInput");
  const submitBtn = document.getElementById("authSubmitBtn");

  const username = usernameInput ? usernameInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";
  const displayName = displayNameInput ? displayNameInput.value.trim() : "";

  if (!username || !password) {
    showAuthError("Please fill in both username and password.");
    return;
  }

  const endpoint = currentAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';
  const payload = { username, password };
  if (currentAuthMode === 'register' && displayName) {
    payload.display_name = displayName;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-75");
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      showAuthError(data.error || "Authentication failed. Please try again.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-75");
      }
      return;
    }

    // Success!
    currentUser = data.user;
    updateUserUI();
    showAuthSuccess(data.message || "Success!");

    setTimeout(() => {
      closeAuthModal();
      if (usernameInput) usernameInput.value = "";
      if (passwordInput) passwordInput.value = "";
      if (displayNameInput) displayNameInput.value = "";
      showToast(`Welcome, ${currentUser.display_name || currentUser.username}!`);
      loadWeekData();
      loadMonthData();
    }, 600);

  } catch (err) {
    console.error("Auth submit error:", err);
    showAuthError("Network error. Please try again.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-75");
    }
  }
}

async function handleLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
    currentUser = null;
    updateUserUI();
    showToast("Signed out successfully.", "info");
    openAuthModal('login');
  } catch (err) {
    console.error("Logout error:", err);
  }
}

