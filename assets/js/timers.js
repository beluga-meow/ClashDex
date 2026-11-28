/* PekkaDex — recurring in-game event countdowns (index.html).
   All schedules are defined in UTC and converted to the visitor's local time
   for display. No game data is stored here beyond the schedule windows given
   by the site owner; Supercell can move any of these, and the page says so.

   Markup contract: an empty element with id="eventTimers". Rows are built with
   DOM nodes and textContent only, so nothing from data can become HTML. */
(() => {
  "use strict";

  const root = document.getElementById("eventTimers");
  if (!root || root.dataset.ready === "1") return;
  root.dataset.ready = "1";

  const DAY = 86400000;
  const HOUR = 3600000;
  const MINUTE = 60000;

  const pad = value => String(value).padStart(2, "0");

  /* "1d 4h 51m"; hours and minutes stay visible under a day, and a finished
     window shows 0m rather than a negative number. */
  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (days || hours) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  }

  function formatLocal(date) {
    try {
      return date.toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return date.toISOString().slice(0, 16).replace("T", " ");
    }
  }

  const utc = (year, month, day, hour) => new Date(Date.UTC(year, month, day, hour, 0, 0));

  /* A weekly window: start on `weekday` at `hour` UTC, lasting `lengthMs`.
     Returns the window that is running now, or the next one. */
  function weeklyWindow(now, weekday, hour, lengthMs) {
    const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour);
    let start = new Date(today.getTime() + ((weekday - now.getUTCDay() + 7) % 7) * DAY);
    if (start.getTime() > now.getTime()) start = new Date(start.getTime() - 7 * DAY);
    let end = new Date(start.getTime() + lengthMs);
    if (now.getTime() >= end.getTime()) {
      start = new Date(start.getTime() + 7 * DAY);
      end = new Date(start.getTime() + lengthMs);
    }
    return { start, end, active: now >= start && now < end, lengthMs, repeating: "weekly" };
  }

  /* A monthly window inside a single month (e.g. the 22nd to the 28th). */
  function monthlyWindow(now, startDay, startHour, endDay, endHour) {
    const monthStart = (year, month) => utc(year, month, startDay, startHour);
    const monthEnd = (year, month) => utc(year, month, endDay, endHour);
    const near = [0, -1, 1].map(offset => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      return {
        start: monthStart(date.getUTCFullYear(), date.getUTCMonth()),
        end: monthEnd(date.getUTCFullYear(), date.getUTCMonth()),
      };
    });
    const running = near.find(window => now >= window.start && now < window.end);
    if (running) return { ...running, active: true, repeating: "monthly" };
    const next = near.map(window => window.start).filter(start => start > now).sort((a, b) => a - b)[0];
    return { start: next, end: near.find(window => window.start.getTime() === next.getTime()).end, active: false, repeating: "monthly" };
  }

  /* The next monthly point event (1st at 08:00 UTC). */
  function nextMonthly(now, day, hour) {
    const thisMonth = utc(now.getUTCFullYear(), now.getUTCMonth(), day, hour);
    if (thisMonth > now) return thisMonth;
    return utc(now.getUTCFullYear(), now.getUTCMonth() + 1, day, hour);
  }

  /* The next weekly point event (Monday 05:00 UTC). */
  function nextWeekly(now, weekday, hour) {
    const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour);
    let next = new Date(today.getTime() + ((weekday - now.getUTCDay() + 7) % 7) * DAY);
    if (next <= now) next = new Date(next.getTime() + 7 * DAY);
    return next;
  }

  const EVENTS = [
    {
      key: "raid",
      name: "Raid Weekend",
      rule: "Friday 07:00 → Monday 07:00 UTC",
      detail: "Clan Capital raids are open for the weekend.",
      window: now => weeklyWindow(now, 5, 7, 3 * DAY),
    },
    {
      key: "clan-games",
      name: "Clan Games",
      rule: "22nd 08:00 → 28th 08:00 UTC",
      detail: "Clan Games run from the 22nd to the 28th of the month.",
      window: now => monthlyWindow(now, 22, 8, 28, 8),
    },
    {
      key: "league",
      name: "League Reset",
      rule: "Every Monday 05:00 UTC",
      detail: "The new league week begins.",
      point: now => nextWeekly(now, 1, 5),
    },
    {
      key: "season",
      name: "Season End",
      rule: "1st of the month, 08:00 UTC",
      detail: "The Gold Pass season rolls over.",
      point: now => nextMonthly(now, 1, 8),
    },
    {
      key: "cwl",
      name: "Clan War Leagues",
      rule: "1st of the month, 08:00 UTC",
      detail: "Sign-up for the new CWL season.",
      point: now => nextMonthly(now, 1, 8),
    },
    {
      key: "trader",
      name: "Trader Refresh",
      rule: "1st of the month, 08:00 UTC",
      detail: "The Trader's stock changes.",
      point: now => nextMonthly(now, 1, 8),
    },
  ];

  const rows = new Map();

  function buildRow(event) {
    const row = document.createElement("article");
    row.className = "timer-row";
    row.dataset.timer = event.key;

    const main = document.createElement("div");
    main.className = "timer-row__main";
    const name = document.createElement("h3");
    name.className = "timer-row__name";
    name.textContent = event.name;
    const rule = document.createElement("p");
    rule.className = "timer-row__rule";
    rule.textContent = event.rule;
    main.append(name, rule);

    const state = document.createElement("span");
    state.className = "pdx-chip timer-row__state";

    const time = document.createElement("p");
    time.className = "timer-row__time";

    const detail = document.createElement("p");
    detail.className = "timer-row__detail";
    detail.textContent = event.detail;

    row.append(main, state, time, detail);
    return { row, state, time };
  }

  function paint(now) {
    for (const event of EVENTS) {
      let parts = rows.get(event.key);
      if (!parts) {
        parts = buildRow(event);
        rows.set(event.key, parts);
        root.append(parts.row);
      }
      if (event.window) {
        const window = event.window(now);
        if (window.active) {
          const left = formatDuration(window.end - now);
          parts.state.textContent = `Active, ends in ${left}`;
          parts.state.classList.add("is-active");
          parts.time.textContent = `Ends ${formatLocal(window.end)} your time.`;
        } else {
          const left = formatDuration(window.start - now);
          parts.state.textContent = `Starts in ${left}`;
          parts.state.classList.remove("is-active");
          parts.time.textContent = `Next window: ${formatLocal(window.start)} your time.`;
        }
      } else {
        const next = event.point(now);
        parts.state.textContent = `Starts in ${formatDuration(next - now)}`;
        parts.state.classList.remove("is-active");
        parts.time.textContent = `Next: ${formatLocal(next)} your time.`;
      }
    }
  }

  let timer = 0;
  function tick() {
    paint(new Date());
    timer = window.setTimeout(tick, 15000);
  }

  /* Stop the loop while the tab is hidden and repaint on return, so a phone
     left in a pocket is not recalculating six countdowns every 15 seconds. */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(timer);
      timer = 0;
    } else if (!timer) {
      tick();
    }
  });

  tick();
})();
