/* PekkaDex — Village Tools (upgrades.html)
   Two independent tools that share one storage helper:

   1. Calculator ("How long to max") — every time and cost comes from the user.
      Builder work is spread across the builder count, the Laboratory and the
      "Other queue" rows run in parallel, and the finish time is the slowest
      of the three.
   2. Tracker — a local list of upgrades with a greedy builder-lane planner.
      Nothing is stored anywhere except this browser's localStorage.

   No timers, costs or Town Hall tables are bundled: inventing them would make
   the tool lie. Data from inputs is written with textContent / value only. */
(() => {
  "use strict";

  const CALC_KEY = "pekkadex.village.calc.v1";
  const TRACK_KEY = "pekkadex.village.track.v1";
  const DAY = 86400000;
  const HOUR = 3600000;
  const MINUTE = 60000;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const num = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(parsed)) return min;
    return clamp(parsed, min, max);
  };

  /* ------------------------------------------------------------ formatting */
  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (days || hours) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(" ");
  }

  const formatDate = ms => {
    try {
      return new Date(ms).toLocaleString(undefined, {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) {
      return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
    }
  };

  const formatNumber = value => {
    try {
      return new Intl.NumberFormat().format(Math.round(value));
    } catch (_) {
      return String(Math.round(value));
    }
  };

  const RESOURCE_LABEL = { gold: "Gold", elixir: "Elixir", dark: "Dark Elixir" };
  const QUEUE_LABEL = { builders: "Builders", laboratory: "Laboratory", other: "Other queue" };

  /* --------------------------------------------------------------- storage */
  function readStore(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  const uid = () => `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  /* =========================================================== CALCULATOR */
  const EXAMPLE_ROWS = [
    { name: "Example — Archer Queen 59 → 60", queue: "builders", d: 6, h: 0, m: 0, gold: 0, elixir: 0, dark: 320000 },
    { name: "Example — Cannon 20 → 21", queue: "builders", d: 4, h: 12, m: 0, gold: 3200000, elixir: 0, dark: 0 },
    { name: "Example — Wizard Tower 15 → 16", queue: "builders", d: 5, h: 8, m: 30, gold: 4100000, elixir: 0, dark: 0 },
    { name: "Example — Wall ring (10 walls)", queue: "builders", d: 2, h: 0, m: 0, gold: 8000000, elixir: 0, dark: 0 },
    { name: "Example — Balloon 11 → 12", queue: "laboratory", d: 5, h: 0, m: 0, gold: 0, elixir: 2400000, dark: 0 },
    { name: "Example — Pet House 8 → 9", queue: "other", d: 7, h: 12, m: 0, gold: 0, elixir: 0, dark: 180000 },
  ];

  const defaultCalc = () => ({
    builders: 5,
    builderTime: 0,
    builderCost: 0,
    researchTime: 0,
    researchCost: 0,
    longest: { d: 0, h: 0, m: 0 },
    rows: [{ id: uid(), name: "", queue: "builders", d: 0, h: 0, m: 0, gold: 0, elixir: 0, dark: 0 }],
  });

  const savedCalc = readStore(CALC_KEY, null);
  const calcState = {
    ...defaultCalc(),
    ...(savedCalc && typeof savedCalc === "object" ? savedCalc : {}),
  };
  if (!Array.isArray(calcState.rows) || !calcState.rows.length) calcState.rows = defaultCalc().rows;
  calcState.rows = calcState.rows.map(row => ({ id: row.id || uid(), name: String(row.name || ""), queue: ["builders", "laboratory", "other"].includes(row.queue) ? row.queue : "builders", d: num(row.d, 0, 365), h: num(row.h, 0, 23), m: num(row.m, 0, 59), gold: num(row.gold), elixir: num(row.elixir), dark: num(row.dark) }));
  calcState.longest = {
    d: num(calcState.longest?.d, 0, 365),
    h: num(calcState.longest?.h, 0, 23),
    m: num(calcState.longest?.m, 0, 59),
  };

  const calcForm = $("#calcForm");
  const calcRows = $("#calcRows");
  const calcSummary = $("#calcSummary");

  const rowSeconds = row => row.d * 86400 + row.h * 3600 + row.m * 60;
  const longestSeconds = () => calcState.longest.d * 86400 + calcState.longest.h * 3600 + calcState.longest.m * 60;

  function computeCalc() {
    const builders = clamp(num(calcState.builders, 1, 6), 1, 6);
    const builderTime = clamp(num(calcState.builderTime, 0, 95), 0, 95) / 100;
    const builderCost = clamp(num(calcState.builderCost, 0, 95), 0, 95) / 100;
    const researchTime = clamp(num(calcState.researchTime, 0, 95), 0, 95) / 100;
    const researchCost = clamp(num(calcState.researchCost, 0, 95), 0, 95) / 100;

    let builderTotal = 0;
    let labTotal = 0;
    let otherTotal = 0;
    const resources = { gold: 0, elixir: 0, dark: 0 };

    for (const row of calcState.rows) {
      const seconds = rowSeconds(row);
      if (row.queue === "builders") {
        builderTotal += seconds;
        resources.gold += row.gold * (1 - builderCost);
        resources.elixir += row.elixir * (1 - builderCost);
        resources.dark += row.dark * (1 - builderCost);
      } else if (row.queue === "laboratory") {
        labTotal += seconds;
        resources.gold += row.gold * (1 - researchCost);
        resources.elixir += row.elixir * (1 - researchCost);
        resources.dark += row.dark * (1 - researchCost);
      } else {
        otherTotal += seconds;
        resources.gold += row.gold;
        resources.elixir += row.elixir;
        resources.dark += row.dark;
      }
    }

    const builderWork = Math.max((builderTotal * (1 - builderTime)) / builders, longestSeconds() * (1 - builderTime));
    const labWork = labTotal * (1 - researchTime);
    const overall = Math.max(builderWork, labWork, otherTotal);
    const whatIf = [1, 2, 3, 4, 5, 6].map(count => ({
      count,
      seconds: Math.max((builderTotal * (1 - builderTime)) / count, longestSeconds() * (1 - builderTime)),
    }));

    return { builders, builderTotal, labTotal, otherTotal, builderWork, labWork, otherWork: otherTotal, overall, resources, whatIf, builderTime, researchTime };
  }

  function calcField(label, control) {
    const wrap = document.createElement("label");
    wrap.className = "tool-row__field";
    const span = document.createElement("span");
    span.textContent = label;
    wrap.append(span, control);
    return wrap;
  }

  function calcRowNode(row) {
    const node = document.createElement("div");
    node.className = "tool-row";
    node.dataset.row = row.id;

    const nameInput = document.createElement("input");
    nameInput.className = "pdx-input";
    nameInput.type = "text";
    nameInput.maxLength = 60;
    nameInput.placeholder = "e.g. Archer Queen to 60";
    nameInput.value = row.name;
    nameInput.dataset.field = "name";
    const nameWrap = calcField("Upgrade", nameInput);
    nameWrap.classList.add("tool-row__name");

    const queueSelect = document.createElement("select");
    queueSelect.className = "pdx-select";
    queueSelect.dataset.field = "queue";
    for (const [value, label] of Object.entries(QUEUE_LABEL)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      queueSelect.append(option);
    }
    queueSelect.value = row.queue;
    const queueWrap = calcField("Queue", queueSelect);

    const duration = document.createElement("fieldset");
    duration.className = "tool-row__field tool-row__duration";
    const legend = document.createElement("span");
    legend.textContent = "Time left";
    const dhms = document.createElement("div");
    dhms.className = "tool-dhms";
    for (const [unit, label] of [["d", "days"], ["h", "hours"], ["m", "minutes"]]) {
      const wrap = document.createElement("label");
      const input = document.createElement("input");
      input.className = "pdx-input";
      input.type = "number";
      input.min = "0";
      input.max = unit === "d" ? "365" : unit === "h" ? "23" : "59";
      input.step = "1";
      input.inputMode = "numeric";
      input.value = row[unit];
      input.dataset.field = unit;
      input.setAttribute("aria-label", `Time left ${label}`);
      const small = document.createElement("small");
      small.textContent = unit;
      wrap.append(input, small);
      dhms.append(wrap);
    }
    duration.append(legend, dhms);

    const fields = [
      calcField("Gold", resourceInput(row, "gold")),
      calcField("Elixir", resourceInput(row, "elixir")),
      calcField("Dark elixir", resourceInput(row, "dark")),
    ];
    fields[0].classList.add("tool-row__cost");

    const remove = document.createElement("button");
    remove.className = "pdx-btn pdx-btn--danger pdx-btn--sm tool-row__remove";
    remove.type = "button";
    remove.dataset.remove = row.id;
    remove.setAttribute("aria-label", `Remove ${row.name || "this row"}`);
    remove.textContent = "×";

    node.append(nameWrap, queueWrap, duration, ...fields, remove);
    return node;
  }

  function resourceInput(row, field) {
    const input = document.createElement("input");
    input.className = "pdx-input";
    input.type = "number";
    input.min = "0";
    input.step = "1000";
    input.inputMode = "numeric";
    input.value = row[field];
    input.dataset.field = field;
    return input;
  }

  function paintCalcRows() {
    if (!calcRows) return;
    calcRows.textContent = "";
    if (!calcState.rows.length) {
      const empty = document.createElement("p");
      empty.className = "tool-rows__empty";
      empty.textContent = "No rows yet. Add an upgrade row, or load the example numbers to see how the calculator works.";
      calcRows.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const row of calcState.rows) fragment.append(calcRowNode(row));
    calcRows.append(fragment);
  }

  function summaryCell(value, label) {
    const cell = document.createElement("div");
    cell.className = "tool-summary__cell";
    const strong = document.createElement("b");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    cell.append(strong, span);
    return cell;
  }

  function buildWhatIfTable(result) {
    const wrap = document.createElement("div");
    wrap.className = "tool-table-wrap";
    const table = document.createElement("table");
    table.className = "tool-table";
    const caption = document.createElement("caption");
    caption.textContent = "What if you had a different number of builders?";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["Builders", "Builder time", "Estimated finish"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headRow.append(th);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const option of result.whatIf) {
      const tr = document.createElement("tr");
      if (option.count === result.builders) tr.className = "is-current";
      const count = document.createElement("td");
      const strong = document.createElement("b");
      strong.textContent = String(option.count);
      count.append(strong);
      const time = document.createElement("td");
      time.textContent = formatDuration(option.seconds);
      const finish = document.createElement("td");
      finish.textContent = formatDate(Date.now() + option.seconds * 1000);
      tr.append(count, time, finish);
      body.append(tr);
    }
    table.append(caption, head, body);
    wrap.append(table);
    return wrap;
  }

  function paintCalcSummary() {
    if (!calcSummary) return;
    calcSummary.textContent = "";
    const result = computeCalc();
    const hasWork = calcState.rows.some(row => rowSeconds(row) > 0) || longestSeconds() > 0;
    if (!hasWork) {
      const note = document.createElement("p");
      note.className = "pdx-note";
      note.textContent = "Add at least one upgrade time (or a longest single upgrade) and the totals will appear here.";
      calcSummary.append(note);
      return;
    }

    const summary = document.createElement("div");
    summary.className = "tool-summary";
    const label = document.createElement("p");
    label.className = "tool-summary__label";
    label.textContent = "Estimated time to finish everything";
    const time = document.createElement("p");
    time.className = "tool-summary__time";
    time.textContent = formatDuration(result.overall);
    const finish = document.createElement("p");
    finish.className = "tool-summary__finish";
    finish.textContent = `Finish around ${formatDate(Date.now() + result.overall * 1000)} — if every upgrade stays queued back to back.`;
    const grid = document.createElement("div");
    grid.className = "tool-summary__grid";
    grid.append(
      summaryCell(formatDuration(result.builderWork), `Builders · ${result.builders} at a time`),
      summaryCell(formatDuration(result.labWork), "Laboratory (parallel)"),
      summaryCell(formatDuration(result.otherWork), "Other queue (parallel)"),
    );
    summary.append(label, time, finish, grid);

    const resourceWrap = document.createElement("div");
    resourceWrap.className = "tool-table-wrap";
    const resourceTable = document.createElement("table");
    resourceTable.className = "tool-table";
    const resourceCaption = document.createElement("caption");
    resourceCaption.textContent = "Total resources after the discounts you entered";
    const resourceHead = document.createElement("tr");
    for (const heading of ["Resource", "Cost"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = heading;
      resourceHead.append(th);
    }
    const resourceBody = document.createElement("tbody");
    for (const [key, value] of Object.entries(result.resources)) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = RESOURCE_LABEL[key];
      const cost = document.createElement("td");
      cost.textContent = value > 0 ? formatNumber(value) : "—";
      tr.append(name, cost);
      resourceBody.append(tr);
    }
    const resourceTableHead = document.createElement("thead");
    resourceTableHead.append(resourceHead);
    resourceTable.append(resourceCaption, resourceTableHead, resourceBody);
    resourceWrap.append(resourceTable);

    const queueWrap = document.createElement("div");
    queueWrap.className = "tool-table-wrap";
    const queueTable = document.createElement("table");
    queueTable.className = "tool-table";
    const queueCaption = document.createElement("caption");
    queueCaption.textContent = "Time per queue";
    const queueHead = document.createElement("tr");
    for (const heading of ["Queue", "Raw time", "After boosts"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = heading;
      queueHead.append(th);
    }
    const queueThead = document.createElement("thead");
    queueThead.append(queueHead);
    const queueBody = document.createElement("tbody");
    const queueRows = [
      ["Builders", result.builderTotal, result.builderWork],
      ["Laboratory", result.labTotal, result.labWork],
      ["Other queue", result.otherTotal, result.otherWork],
    ];
    for (const [name, raw, boosted] of queueRows) {
      const tr = document.createElement("tr");
      const cellName = document.createElement("td");
      cellName.textContent = name;
      const cellRaw = document.createElement("td");
      cellRaw.textContent = formatDuration(raw);
      const cellBoosted = document.createElement("td");
      cellBoosted.textContent = formatDuration(boosted);
      tr.append(cellName, cellRaw, cellBoosted);
      queueBody.append(tr);
    }
    queueTable.append(queueCaption, queueThead, queueBody);
    queueWrap.append(queueTable);

    calcSummary.append(summary, queueWrap, buildWhatIfTable(result));
  }

  function saveCalc() {
    writeStore(CALC_KEY, calcState);
  }

  function setCalcInput(id, value) {
    const node = $(id);
    if (node) node.value = value;
  }

  function syncCalcInputs() {
    setCalcInput("#calcBuilders", calcState.builders);
    setCalcInput("#calcBuilderTime", calcState.builderTime);
    setCalcInput("#calcBuilderCost", calcState.builderCost);
    setCalcInput("#calcResearchTime", calcState.researchTime);
    setCalcInput("#calcResearchCost", calcState.researchCost);
    setCalcInput("#calcLongestD", calcState.longest.d);
    setCalcInput("#calcLongestH", calcState.longest.h);
    setCalcInput("#calcLongestM", calcState.longest.m);
  }

  function bindCalc() {
    if (!calcForm) return;
    calcForm.addEventListener("input", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      switch (input.id) {
        case "calcBuilders": calcState.builders = clamp(num(input.value, 1, 6), 1, 6); break;
        case "calcBuilderTime": calcState.builderTime = clamp(num(input.value, 0, 95), 0, 95); break;
        case "calcBuilderCost": calcState.builderCost = clamp(num(input.value, 0, 95), 0, 95); break;
        case "calcResearchTime": calcState.researchTime = clamp(num(input.value, 0, 95), 0, 95); break;
        case "calcResearchCost": calcState.researchCost = clamp(num(input.value, 0, 95), 0, 95); break;
        case "calcLongestD": calcState.longest.d = num(input.value, 0, 365); break;
        case "calcLongestH": calcState.longest.h = num(input.value, 0, 23); break;
        case "calcLongestM": calcState.longest.m = num(input.value, 0, 59); break;
        default: return;
      }
      saveCalc();
      paintCalcSummary();
    });

    calcRows?.addEventListener("input", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
      const rowNode = input.closest("[data-row]");
      if (!rowNode) return;
      const row = calcState.rows.find(item => item.id === rowNode.dataset.row);
      if (!row) return;
      const field = input.dataset.field;
      if (!field) return;
      if (field === "name") row.name = input.value.slice(0, 60);
      else if (field === "queue") row.queue = ["builders", "laboratory", "other"].includes(input.value) ? input.value : "builders";
      else if (field === "d") row.d = num(input.value, 0, 365);
      else if (field === "h") row.h = num(input.value, 0, 23);
      else if (field === "m") row.m = num(input.value, 0, 59);
      else if (field === "gold" || field === "elixir" || field === "dark") row[field] = num(input.value);
      saveCalc();
      paintCalcSummary();
    });

    calcRows?.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const remove = target.closest("[data-remove]");
      if (!remove) return;
      calcState.rows = calcState.rows.filter(row => row.id !== remove.dataset.remove);
      paintCalcRows();
      paintCalcSummary();
      saveCalc();
    });

    $("#calcAdd")?.addEventListener("click", () => {
      calcState.rows.push({ id: uid(), name: "", queue: "builders", d: 0, h: 0, m: 0, gold: 0, elixir: 0, dark: 0 });
      paintCalcRows();
      paintCalcSummary();
      saveCalc();
      const fields = $$("#calcRows [data-field='name']");
      fields[fields.length - 1]?.focus();
    });

    $("#calcExample")?.addEventListener("click", () => {
      calcState.rows = EXAMPLE_ROWS.map(row => ({ ...row, id: uid() }));
      calcState.builders = 5;
      calcState.builderTime = 10;
      calcState.builderCost = 0;
      calcState.researchTime = 10;
      calcState.researchCost = 0;
      calcState.longest = { d: 6, h: 0, m: 0 };
      syncCalcInputs();
      paintCalcRows();
      paintCalcSummary();
      saveCalc();
      $("#calcHint").textContent = "These rows are sample numbers, not real game data. Replace them with your own before trusting the result.";
    });

    $("#calcClear")?.addEventListener("click", () => {
      const fresh = defaultCalc();
      Object.assign(calcState, fresh);
      syncCalcInputs();
      paintCalcRows();
      paintCalcSummary();
      saveCalc();
      $("#calcHint").textContent = "Cleared. The example button fills clearly labelled sample numbers so you can see how the maths works.";
    });
  }

  /* ============================================================== TRACKER */
  const defaultTrack = () => ({ schema: 1, builders: 4, notify: false, items: [] });
  const savedTrack = readStore(TRACK_KEY, null);
  const trackState = {
    ...defaultTrack(),
    ...(savedTrack && typeof savedTrack === "object" ? savedTrack : {}),
  };
  trackState.builders = clamp(num(trackState.builders, 1, 6), 1, 6);
  trackState.notify = Boolean(trackState.notify);
  if (!Array.isArray(trackState.items)) trackState.items = [];
  trackState.items = trackState.items
    .filter(item => item && typeof item === "object")
    .map(item => ({
      id: item.id || uid(),
      name: String(item.name || "Upgrade").slice(0, 60),
      queue: item.queue === "lab" ? "lab" : "builder",
      seconds: num(item.seconds, 0),
      cost: num(item.cost),
      resource: ["gold", "elixir", "dark"].includes(item.resource) ? item.resource : "gold",
      status: item.status === "running" ? "running" : "queued",
      startedAt: Number.isFinite(item.startedAt) ? item.startedAt : null,
      lane: Number.isInteger(item.lane) ? item.lane : null,
      notified: Boolean(item.notified),
    }))
    .filter(item => item.seconds > 0);

  const trackList = $("#trackList");
  const trackTimeline = $("#trackTimeline");
  const trackStatus = $("#trackStatus");
  let restoring = false;
  let clearArmed = false;
  let clearTimer = 0;

  const saveTrack = () => writeStore(TRACK_KEY, trackState);

  function endOf(item) {
    return item.status === "running" && item.startedAt ? item.startedAt + item.seconds * 1000 : null;
  }

  function earliestFreeBuilderLane(now, builders) {
    /* A builder lane is free when every item on it has finished. */
    for (let lane = 0; lane < builders; lane += 1) {
      const busy = trackState.items.some(item => item.queue === "builder" && item.status === "running" && item.lane === lane && (endOf(item) || 0) > now);
      if (!busy) return lane;
    }
    return null;
  }

  function runningBuilderCount() {
    return trackState.items.filter(item => item.queue === "builder" && item.status === "running").length;
  }

  /* Greedy plan: running items keep their lane, queued items go to the lane
     that frees up first. The laboratory is a single serial lane. */
  function schedule() {
    const now = Date.now();
    const builders = clamp(trackState.builders, 1, 6);
    const lanes = Array.from({ length: builders }, (_, index) => ({ name: `Builder ${index + 1}`, end: now, blocks: [] }));
    const lab = { name: "Laboratory", end: now, blocks: [] };

    const running = trackState.items.filter(item => item.status === "running");
    for (const item of running) {
      const start = item.startedAt || now;
      const end = start + item.seconds * 1000;
      if (item.queue === "lab") {
        lab.end = Math.max(lab.end, end);
        lab.blocks.push({ item, start, end });
      } else {
        let lane = Number.isInteger(item.lane) && item.lane < builders ? item.lane : 0;
        const taken = new Set(running.filter(other => other !== item && other.queue === "builder" && other.lane === lane).map(other => other.lane));
        if (taken.has(lane)) {
          const free = lanes.findIndex((_, index) => !running.some(other => other !== item && other.queue === "builder" && other.lane === index));
          if (free >= 0) lane = free;
        }
        item.lane = lane;
        lanes[lane].end = Math.max(lanes[lane].end, end);
        lanes[lane].blocks.push({ item, start, end });
      }
    }

    const queued = trackState.items.filter(item => item.status === "queued");
    for (const item of queued) {
      if (item.queue === "lab") {
        const start = Math.max(now, lab.end);
        lab.end = start + item.seconds * 1000;
        lab.blocks.push({ item, start, end: lab.end, planned: true });
      } else {
        let lane = 0;
        for (let index = 1; index < lanes.length; index += 1) {
          if (lanes[index].end < lanes[lane].end) lane = index;
        }
        const start = Math.max(now, lanes[lane].end);
        lanes[lane].end = start + item.seconds * 1000;
        lanes[lane].blocks.push({ item, start, end: lanes[lane].end, planned: true });
      }
    }

    const ends = [...lanes.map(lane => lane.end), lab.end];
    const starts = [...lanes.flatMap(lane => lane.blocks.map(block => block.start)), ...lab.blocks.map(block => block.start), now];
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    return { lanes, lab, min, max: max > min ? max : min + HOUR };
  }

  function trackItemNode(item, now) {
    const node = document.createElement("article");
    node.className = "track-item";
    node.dataset.id = item.id;
    node.dataset.status = item.status;

    const head = document.createElement("div");
    head.className = "track-item__head";
    const name = document.createElement("h3");
    name.className = "track-item__name";
    name.textContent = item.name;
    const meta = document.createElement("p");
    meta.className = "track-item__meta";
    const queue = document.createElement("b");
    queue.textContent = item.queue === "lab" ? "Laboratory" : `Builder${Number.isInteger(item.lane) ? ` ${item.lane + 1}` : ""}`;
    meta.append(queue, document.createTextNode(` · ${formatDuration(item.seconds)}${item.cost ? ` · ${formatNumber(item.cost)} ${RESOURCE_LABEL[item.resource]}` : ""}`));
    head.append(name, meta);

    node.append(head);

    if (item.status === "running") {
      const end = endOf(item) || now;
      const start = item.startedAt || now;
      const total = Math.max(1, end - start);
      const progress = clamp((now - start) / total, 0, 1);
      const bar = document.createElement("div");
      bar.className = "track-progress";
      const fill = document.createElement("span");
      fill.style.width = `${Math.round(progress * 100)}%`;
      bar.append(fill);
      const time = document.createElement("p");
      time.className = "track-item__time";
      time.textContent = end <= now ? "Finished — ready to collect." : `Finishes ${formatDate(end)} · ${formatDuration((end - now) / 1000)} left`;
      node.append(bar, time);
    } else {
      const time = document.createElement("p");
      time.className = "track-item__time";
      time.textContent = `Queued · ${formatDuration(item.seconds)} · starts when a${item.queue === "lab" ? " Laboratory slot" : " builder"} is free`;
      node.append(time);
    }

    const actions = document.createElement("div");
    actions.className = "track-item__actions";
    if (item.status === "running" && (endOf(item) || 0) <= now) {
      const collect = document.createElement("button");
      collect.className = "pdx-btn pdx-btn--sm";
      collect.type = "button";
      collect.dataset.collect = item.id;
      collect.textContent = "Collect";
      actions.append(collect);
    }
    if (item.status === "queued") {
      const start = document.createElement("button");
      start.className = "pdx-btn pdx-btn--sky pdx-btn--sm";
      start.type = "button";
      start.dataset.start = item.id;
      start.textContent = "Start now";
      const laneFree = item.queue === "lab" ? !trackState.items.some(other => other.queue === "lab" && other.status === "running" && (endOf(other) || 0) > now) : runningBuilderCount() < trackState.builders;
      start.disabled = !laneFree;
      start.title = laneFree ? "Start this upgrade now" : "No free slot yet";
      actions.append(start);
    }
    const remove = document.createElement("button");
    remove.className = "pdx-btn pdx-btn--danger pdx-btn--sm";
    remove.type = "button";
    remove.dataset.removeItem = item.id;
    remove.textContent = "Remove";
    actions.append(remove);
    node.append(actions);
    return node;
  }

  function paintTrackList() {
    if (!trackList) return;
    const now = Date.now();
    trackList.textContent = "";
    if (!trackState.items.length) {
      const empty = document.createElement("div");
      empty.className = "pdx-empty";
      const title = document.createElement("b");
      title.textContent = "Nothing tracked yet";
      const note = document.createElement("p");
      note.className = "pdx-note";
      note.textContent = "Add an upgrade above. Queued items are drawn on the planner below and can be started once a slot frees up.";
      empty.append(title, note);
      trackList.append(empty);
      return;
    }
    const order = { running: 0, queued: 1 };
    const sorted = [...trackState.items].sort((a, b) => (order[a.status] - order[b.status]) || a.name.localeCompare(b.name));
    const fragment = document.createDocumentFragment();
    for (const item of sorted) fragment.append(trackItemNode(item, now));
    trackList.append(fragment);
  }

  function paintTimeline() {
    if (!trackTimeline) return;
    const plan = schedule();
    trackTimeline.textContent = "";
    if (!trackState.items.length) {
      const empty = document.createElement("p");
      empty.className = "tl-empty";
      empty.textContent = "The planner appears as soon as you add an upgrade.";
      trackTimeline.append(empty);
      return;
    }
    const span = Math.max(1, plan.max - plan.min);
    const laneNodes = [...plan.lanes, plan.lab];
    for (const lane of laneNodes) {
      const row = document.createElement("div");
      row.className = "tl-lane";
      const name = document.createElement("span");
      name.className = "tl-lane__name";
      name.textContent = lane.name;
      const track = document.createElement("div");
      track.className = "tl-lane__track";
      for (const block of lane.blocks) {
        const el = document.createElement("span");
        el.className = "tl-block";
        el.dataset.status = block.item.status;
        el.dataset.queue = block.item.queue;
        el.style.left = `${((block.start - plan.min) / span) * 100}%`;
        el.style.width = `${Math.max(1.5, ((block.end - block.start) / span) * 100)}%`;
        el.textContent = block.item.name;
        el.title = `${block.item.name} — ${formatDuration(block.item.seconds)} from ${formatDate(block.start)}`;
        track.append(el);
      }
      row.append(name, track);
      trackTimeline.append(row);
    }
    const axis = document.createElement("div");
    axis.className = "tl-axis";
    const from = document.createElement("span");
    from.textContent = "now";
    const to = document.createElement("span");
    to.textContent = `plan ends ${formatDate(plan.max)}`;
    axis.append(from, to);
    trackTimeline.append(axis);
  }

  let lastNotifyKey = "";
  function notifyFinished() {
    if (!trackState.notify) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = Date.now();
    const finished = trackState.items.filter(item => item.status === "running" && (endOf(item) || Infinity) <= now && !item.notified);
    for (const item of finished) {
      item.notified = true;
      const key = `${item.id}:${item.startedAt}`;
      if (key === lastNotifyKey) continue;
      lastNotifyKey = key;
      try {
        new Notification("PekkaDex upgrade finished", { body: `${item.name} is ready to collect.`, tag: item.id });
      } catch (_) { /* notifications can be blocked per site */ }
    }
    if (finished.length) saveTrack();
  }

  function tickTracker() {
    let dirty = false;
    for (const item of trackState.items) {
      if (item.status === "running" && item.lane === null && item.queue === "builder") {
        const free = earliestFreeBuilderLane(Date.now(), trackState.builders);
        if (free !== null) { item.lane = free; dirty = true; }
      }
    }
    if (dirty) saveTrack();
    notifyFinished();
    paintTrackList();
    paintTimeline();
  }

  function syncTrackInputs() {
    setCalcInput("#trackBuilders", trackState.builders);
  }

  function startQueued(id) {
    const item = trackState.items.find(entry => entry.id === id);
    if (!item || item.status !== "queued") return;
    const now = Date.now();
    if (item.queue === "lab") {
      const labBusy = trackState.items.some(other => other.queue === "lab" && other.status === "running" && (endOf(other) || 0) > now);
      if (labBusy) { setStatus("The Laboratory is busy until the running research finishes."); return; }
      item.lane = null;
    } else {
      const lane = earliestFreeBuilderLane(now, trackState.builders);
      if (lane === null) { setStatus("Every builder is busy. Free one up or wait for a lane to finish."); return; }
      item.lane = lane;
    }
    item.status = "running";
    item.startedAt = now;
    item.notified = false;
    saveTrack();
    tickTracker();
    setStatus(`${item.name} started.`);
  }

  function setStatus(message) {
    if (trackStatus) trackStatus.textContent = String(message || "");
  }

  function bindTracker() {
    const form = $("#trackForm");
    form?.addEventListener("submit", event => {
      event.preventDefault();
      const name = $("#trackName")?.value.trim() || "";
      const seconds = num($("#trackD")?.value, 0, 365) * 86400 + num($("#trackH")?.value, 0, 23) * 3600 + num($("#trackM")?.value, 0, 59) * 60;
      if (!name) { setStatus("Give the upgrade a name first."); $("#trackName")?.focus(); return; }
      if (!seconds) { setStatus("Add a duration of at least one minute."); $("#trackD")?.focus(); return; }
      const wantRunning = $("#trackStart")?.value === "running";
      const item = {
        id: uid(),
        name: name.slice(0, 60),
        queue: $("#trackQueue")?.value === "lab" ? "lab" : "builder",
        seconds,
        cost: num($("#trackCost")?.value),
        resource: ["gold", "elixir", "dark"].includes($("#trackResource")?.value) ? $("#trackResource").value : "gold",
        status: "queued",
        startedAt: null,
        lane: null,
        notified: false,
      };
      trackState.items.push(item);
      saveTrack();
      if (wantRunning) startQueued(item.id);
      else { tickTracker(); setStatus(`${item.name} queued.`); }
      form.reset();
      $("#trackName")?.focus();
    });

    trackList?.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const collect = target.closest("[data-collect]");
      if (collect) {
        trackState.items = trackState.items.filter(item => item.id !== collect.dataset.collect);
        saveTrack();
        tickTracker();
        setStatus("Collected and removed from the tracker.");
        return;
      }
      const start = target.closest("[data-start]");
      if (start) { startQueued(start.dataset.start); return; }
      const remove = target.closest("[data-remove-item]");
      if (remove) {
        trackState.items = trackState.items.filter(item => item.id !== remove.dataset.removeItem);
        saveTrack();
        tickTracker();
        setStatus("Removed.");
      }
    });

    $("#trackBuilders")?.addEventListener("input", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      trackState.builders = clamp(num(input.value, 1, 6), 1, 6);
      /* Re-seat lanes that no longer exist. */
      trackState.items.forEach(item => {
        if (item.queue === "builder" && Number.isInteger(item.lane) && item.lane >= trackState.builders) item.lane = null;
      });
      saveTrack();
      tickTracker();
    });

    $("#trackNotify")?.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        setStatus("This browser has no notification support. The countdowns still work while the page is open.");
        return;
      }
      if (trackState.notify && Notification.permission === "granted") {
        trackState.notify = false;
        saveTrack();
        $("#trackNotify").textContent = "Turn on notifications";
        setStatus("Notifications off.");
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        trackState.notify = permission === "granted";
        saveTrack();
        $("#trackNotify").textContent = trackState.notify ? "Notifications on" : "Turn on notifications";
        setStatus(trackState.notify
          ? "Notifications on. They only fire while this page is open."
          : "Notifications were blocked, so nothing will pop up. The countdowns still work.");
      } catch (_) {
        setStatus("Notifications could not be enabled in this browser.");
      }
    });

    $("#trackCopy")?.addEventListener("click", async () => {
      const payload = JSON.stringify({ ...trackState, savedAt: new Date().toISOString() }, null, 2);
      let ok = false;
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(payload); ok = true; }
      } catch (_) { ok = false; }
      if (!ok) {
        const area = document.createElement("textarea");
        area.value = payload;
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.append(area);
        area.select();
        try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
        area.remove();
      }
      if (ok) setStatus("Backup JSON copied to the clipboard.");
      else {
        setStatus("Copying failed. Select the text in Restore from backup to copy it by hand.");
        $("#trackRestoreToggle")?.click();
        const box = $("#trackRestoreText");
        if (box) box.value = payload;
      }
    });

    $("#trackRestoreToggle")?.addEventListener("click", () => {
      const box = $("#trackRestore");
      if (!box) return;
      restoring = box.hidden;
      box.hidden = !restoring;
      $("#trackRestoreToggle").setAttribute("aria-expanded", String(restoring));
      $("#trackRestoreToggle").textContent = restoring ? "Hide restore box" : "Restore from backup";
    });

    $("#trackRestoreApply")?.addEventListener("click", () => {
      const raw = $("#trackRestoreText")?.value || "";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        setStatus("That is not valid JSON, so nothing was restored.");
        return;
      }
      if (!parsed || !Array.isArray(parsed.items)) {
        setStatus("The backup has no items array, so nothing was restored.");
        return;
      }
      const items = parsed.items
        .filter(item => item && typeof item === "object" && num(item.seconds, 0) > 0)
        .map(item => ({
          id: typeof item.id === "string" ? item.id : uid(),
          name: String(item.name || "Upgrade").slice(0, 60),
          queue: item.queue === "lab" ? "lab" : "builder",
          seconds: num(item.seconds, 0),
          cost: num(item.cost),
          resource: ["gold", "elixir", "dark"].includes(item.resource) ? item.resource : "gold",
          status: item.status === "running" ? "running" : "queued",
          startedAt: Number.isFinite(item.startedAt) ? item.startedAt : null,
          lane: Number.isInteger(item.lane) ? item.lane : null,
          notified: Boolean(item.notified),
        }));
      trackState.items = items;
      trackState.builders = clamp(num(parsed.builders, 1, 6), 1, 6);
      trackState.notify = Boolean(parsed.notify);
      syncTrackInputs();
      saveTrack();
      tickTracker();
      setStatus(`Restored ${items.length} item${items.length === 1 ? "" : "s"} from the backup.`);
    });

    $("#trackClear")?.addEventListener("click", () => {
      const button = $("#trackClear");
      if (!clearArmed) {
        clearArmed = true;
        button.textContent = "Tap again to clear everything";
        setStatus("Press the same button again within four seconds to clear the tracker.");
        clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => {
          clearArmed = false;
          button.textContent = "Clear tracker";
          setStatus("");
        }, 4000);
        return;
      }
      clearTimeout(clearTimer);
      clearArmed = false;
      button.textContent = "Clear tracker";
      trackState.items = [];
      saveTrack();
      tickTracker();
      setStatus("Tracker cleared. There is no undo, but you can restore a backup.");
    });

    $("#trackToCalc")?.addEventListener("click", () => {
      const pending = trackState.items.filter(item => item.queue === "builder" || item.queue === "lab");
      if (!pending.length) { setStatus("The tracker is empty, so there is nothing to send."); return; }
      /* Keep existing calculator rows, then add only what is not already there. */
      const existing = new Set(calcState.rows.map(row => `${row.name}|${row.queue}|${rowSeconds(row)}`));
      let added = 0;
      for (const item of pending) {
        const key = `${item.name}|${item.queue === "lab" ? "laboratory" : "builders"}|${item.seconds}`;
        if (existing.has(key)) continue;
        existing.add(key);
        calcState.rows.push({
          id: uid(),
          name: item.name,
          queue: item.queue === "lab" ? "laboratory" : "builders",
          d: Math.floor(item.seconds / 86400),
          h: Math.floor((item.seconds % 86400) / 3600),
          m: Math.floor((item.seconds % 3600) / 60),
          gold: item.resource === "gold" ? item.cost : 0,
          elixir: item.resource === "elixir" ? item.cost : 0,
          dark: item.resource === "dark" ? item.cost : 0,
        });
        added += 1;
      }
      saveCalc();
      paintCalcRows();
      paintCalcSummary();
      selectTool("calc");
      setStatus(added ? `${added} item${added === 1 ? "" : "s"} added to the calculator.` : "Those items are already in the calculator.");
    });
  }

  /* ================================================================= TABS */
  function selectTool(name) {
    const tool = name === "tracker" ? "tracker" : "calc";
    $$("[data-tool]").forEach(tab => {
      const on = tab.dataset.tool === tool;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    const panels = { calc: $("#calcPanel"), tracker: $("#trackerPanel") };
    Object.keys(panels).forEach(key => {
      if (panels[key]) panels[key].hidden = key !== tool;
    });
    if (location.hash !== `#${tool}` && !location.hash.startsWith("#tracker")) {
      try { history.replaceState(null, "", `#${tool}`); } catch (_) { /* file:// can refuse */ }
    }
    if (tool === "tracker") tickTracker();
  }

  function init() {
    bindCalc();
    bindTracker();
    syncCalcInputs();
    syncTrackInputs();
    paintCalcRows();
    paintCalcSummary();
    paintTrackList();
    paintTimeline();
    if ("Notification" in window && trackState.notify && Notification.permission === "granted") {
      const button = $("#trackNotify");
      if (button) button.textContent = "Notifications on";
    }

    document.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest("[data-tool]");
      if (tab) { selectTool(tab.dataset.tool); return; }
      const tabKey = target.closest("[role='tab']");
      if (tabKey && tabKey.hasAttribute("data-tool")) selectTool(tabKey.dataset.tool);
    });

    document.addEventListener("keydown", event => {
      const tab = event.target instanceof Element ? event.target.closest("[data-tool]") : null;
      if (!tab) return;
      const list = tab.closest("[role='tablist']");
      const tabs = list ? $$("[data-tool]", list) : [];
      const index = tabs.indexOf(tab);
      if (index < 0) return;
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      tabs[next].focus();
      tabs[next].click();
    });

    window.addEventListener("hashchange", () => {
      if (location.hash === "#tracker") selectTool("tracker");
      else if (location.hash === "#calc") selectTool("calc");
    });

    selectTool(location.hash === "#tracker" ? "tracker" : "calc");

    /* One shared tick keeps progress bars, countdowns and notifications fresh
       without touching the calculator's focused inputs. */
    window.setInterval(tickTracker, 5000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tickTracker();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
