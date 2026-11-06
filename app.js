const STORAGE_KEY = "daymark-moments-v1";
const THEME_KEY = "daymark-theme-v1";
const today = startOfDay(new Date());
const todayKey = toDateKey(today);
const samples = [
  { date: toDateKey(offsetDate(today, -1)), caption: "An unhurried walk, and nowhere else to be", photo: "./assets/sample-walk.svg" },
  { date: toDateKey(offsetDate(today, -3)), caption: "The flowers on the corner have come back", photo: "./assets/sample-flowers.svg" },
  { date: toDateKey(offsetDate(today, -5)), caption: "One last swim before the sun went down", photo: "./assets/sample-swim.svg" },
  { date: toDateKey(offsetDate(today, -8)), caption: "A table full of people I love", photo: "./assets/sample-table.svg" },
];

const els = {
  todayView: document.querySelector("#todayView"),
  timelineView: document.querySelector("#timelineView"),
  selectedDate: document.querySelector("#selectedDate"),
  todayCardTitle: document.querySelector("#todayCardTitle"),
  todayCardDescription: document.querySelector("#todayCardDescription"),
  todayArt: document.querySelector("#todayArt"),
  todayArtCaption: document.querySelector("#todayArtCaption"),
  recentMoments: document.querySelector("#recentMoments"),
  recentEmpty: document.querySelector("#recentEmpty"),
  sampleNote: document.querySelector("#sampleNote"),
  calendarMonthLabel: document.querySelector("#calendarMonthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  monthCount: document.querySelector("#monthCount"),
  summaryCopy: document.querySelector("#summaryCopy"),
  summaryProgress: document.querySelector("#summaryProgress"),
  summaryProgressBar: document.querySelector(".summary-progress"),
  timelineMoments: document.querySelector("#timelineMoments"),
  timelineEmpty: document.querySelector("#timelineEmpty"),
  timelineCount: document.querySelector("#timelineCount"),
  timelineSubheading: document.querySelector("#timelineSubheading"),
  searchInput: document.querySelector("#searchInput"),
  captureDialog: document.querySelector("#captureDialog"),
  captureForm: document.querySelector("#captureForm"),
  memoryDate: document.querySelector("#memoryDate"),
  memoryCaption: document.querySelector("#memoryCaption"),
  memoryPhoto: document.querySelector("#memoryPhoto"),
  uploadLabel: document.querySelector("#uploadLabel"),
  uploadPreview: document.querySelector("#uploadPreview"),
  formError: document.querySelector("#formError"),
  saveMemory: document.querySelector("#saveMemory"),
  previewDialog: document.querySelector("#previewDialog"),
  previewContent: document.querySelector("#previewContent"),
  liveMessage: document.querySelector("#liveMessage"),
};

let memories = readMemories();
let selectedDate = todayKey;
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let photoPreviewUrl = "";

initializeTheme();
render();

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelector("#seeTimeline").addEventListener("click", () => showView("timeline"));
document.querySelector("#captureButton").addEventListener("click", openCapture);
document.querySelector("#timelineCapture").addEventListener("click", openCapture);
document.querySelector("#previousDay").addEventListener("click", () => moveSelectedDate(-1));
document.querySelector("#nextDay").addEventListener("click", () => moveSelectedDate(1));
document.querySelector("#previousMonth").addEventListener("click", () => moveMonth(-1));
document.querySelector("#nextMonth").addEventListener("click", () => moveMonth(1));
document.querySelector("#closeCapture").addEventListener("click", closeCapture);
document.querySelector("#cancelCapture").addEventListener("click", closeCapture);
document.querySelector("#closePreview").addEventListener("click", () => els.previewDialog.close());
document.querySelector("#themeToggle").addEventListener("click", toggleTheme);
document.querySelector("#topThemeToggle").addEventListener("click", toggleTheme);
els.searchInput.addEventListener("input", renderTimeline);
els.memoryPhoto.addEventListener("change", previewSelectedPhoto);
els.captureForm.addEventListener("submit", saveMemory);

els.captureDialog.addEventListener("click", (event) => {
  if (event.target === els.captureDialog) closeCapture();
});

els.previewDialog.addEventListener("click", (event) => {
  if (event.target === els.previewDialog) els.previewDialog.close();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !els.timelineView.hidden && !isTypingTarget(event.target)) {
    event.preventDefault();
    els.searchInput.focus();
  }
  if (event.key === "Escape" && els.captureDialog.open) closeCapture();
});

function render() {
  document.querySelector("#topbarDate").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(today);
  renderDay();
  renderRecent();
  renderCalendar();
  renderSummary();
  renderTimeline();
}

function renderDay() {
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(fromDateKey(selectedDate));
  els.selectedDate.textContent = formattedDate;
  document.querySelector("#nextDay").disabled = selectedDate >= todayKey;
  document.querySelector("#todayEyebrow").textContent =
    selectedDate === todayKey ? "YOUR DAY, GENTLY KEPT" : "A DAY WORTH REMEMBERING";

  const moment = visibleMemories().find((item) => item.date === selectedDate);
  els.todayArt.setAttribute(
    "aria-label",
    moment ? `Saved moment for ${formattedDate}` : `Illustration placeholder for ${formattedDate}`,
  );
  if (moment) {
    els.todayCardTitle.textContent = moment.caption;
    els.todayCardDescription.textContent = moment.sample
      ? "A sample moment. Imagine how your own little bits will add up."
      : "This little piece of the day is yours to keep.";
    els.todayArtCaption.textContent = moment.caption;
    els.todayArt.classList.toggle("has-photo", Boolean(moment.photo));
    els.todayArt.style.backgroundImage = moment.photo ? `url("${moment.photo}")` : "";
    document.querySelector("#captureButton span").textContent = "Add another moment";
  } else {
    els.todayCardTitle.textContent =
      selectedDate === todayKey ? "What would you like to remember?" : "A moment from this day?";
    els.todayCardDescription.textContent =
      selectedDate === todayKey
        ? "The tiny things count, too. Save one moment from this day."
        : "Leave yourself a little note about how this day felt.";
    els.todayArtCaption.textContent = "A little room for today";
    els.todayArt.classList.remove("has-photo");
    els.todayArt.style.backgroundImage = "";
    document.querySelector("#captureButton span").textContent = "Save a moment";
  }
}

function renderRecent() {
  const list = [...visibleMemories()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  els.recentMoments.innerHTML = list.map((item) => momentCard(item)).join("");
  els.sampleNote.hidden = memories.length > 0;
  els.recentEmpty.hidden = list.length > 0;
  bindMomentCards(els.recentMoments);
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  els.calendarMonthLabel.textContent = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);

  const existingHeaders = Array.from(els.calendarGrid.querySelectorAll(".calendar-day, .calendar-spacer"));
  existingHeaders.forEach((node) => node.remove());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthMemories = visibleMemories();
  const hasMemory = new Set(monthMemories.map((item) => item.date));
  const fragment = document.createDocumentFragment();

  for (let blank = 0; blank < mondayOffset; blank += 1) {
    const spacer = document.createElement("span");
    spacer.className = "calendar-spacer";
    spacer.setAttribute("aria-hidden", "true");
    fragment.append(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const button = document.createElement("button");
    button.className = "calendar-day";
    button.type = "button";
    button.textContent = String(day);
    button.setAttribute("aria-label", new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date));
    button.setAttribute("aria-pressed", String(key === selectedDate));
    if (key === selectedDate) button.classList.add("is-selected");
    if (key === todayKey) button.classList.add("is-today");
    if (key > todayKey) {
      button.classList.add("is-future");
      button.disabled = true;
    }
    if (hasMemory.has(key) && key <= todayKey) {
      button.classList.add("has-memory");
      button.setAttribute("aria-label", `${button.getAttribute("aria-label")}, a day with a saved moment`);
      const dot = document.createElement("span");
      dot.className = "memory-dot";
      dot.setAttribute("aria-hidden", "true");
      button.append(dot);
    }
    button.addEventListener("click", () => {
      selectedDate = key;
      renderDay();
      renderCalendar();
      renderSummary();
      if (!els.timelineView.hidden) showView("today");
    });
    fragment.append(button);
  }
  els.calendarGrid.append(fragment);
}

function renderSummary() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthMemories = visibleMemories().filter((item) => {
    const date = fromDateKey(item.date);
    return date.getFullYear() === year && date.getMonth() === month && item.date <= todayKey;
  });
  const activeDays = new Set(monthMemories.map((item) => item.date)).size;
  const count = monthMemories.length;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const progress = Math.round((activeDays / daysInMonth) * 100);
  els.monthCount.textContent = String(count).padStart(2, "0");
  els.summaryCopy.textContent = count
    ? `${count} ${count === 1 ? "moment" : "moments"} tucked away over ${activeDays} ${activeDays === 1 ? "day" : "days"}.`
    : "The ordinary days are part of the story, too.";
  els.summaryProgress.style.width = `${progress}%`;
  els.summaryProgressBar.setAttribute("aria-valuemax", String(daysInMonth));
  els.summaryProgressBar.setAttribute("aria-valuenow", String(activeDays));
}

function renderTimeline() {
  const query = els.searchInput.value.trim().toLocaleLowerCase();
  const all = [...visibleMemories()].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = query
    ? all.filter((item) => item.caption.toLocaleLowerCase().includes(query))
    : all;
  els.timelineMoments.innerHTML = filtered.map((item) => momentCard(item)).join("");
  els.timelineCount.textContent = query ? "Search results" : "All your moments";
  els.timelineSubheading.textContent =
    `${filtered.length} ${filtered.length === 1 ? "moment" : "moments"}${query ? " found" : ""}`;
  els.timelineEmpty.hidden = filtered.length > 0;
  if (query && filtered.length === 0) {
    els.timelineEmpty.textContent = `No moments found for “${query}”. Try another word.`;
  }
  bindMomentCards(els.timelineMoments);
}

function momentCard(item) {
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(fromDateKey(item.date));
  const caption = escapeHtml(item.caption);
  const photo = escapeHtml(item.photo || "");
  const photoContent = item.photo
    ? `<img src="${photo}" alt="" loading="lazy" />`
    : `<span class="photo-placeholder" aria-hidden="true"></span>`;
  return `
    <button class="moment-card" type="button" data-moment-id="${escapeHtml(item.id)}" aria-label="${caption}, ${date}">
      <span class="moment-photo">${photoContent}</span>
      <span class="moment-date">${date}${item.sample ? " · SAMPLE" : ""}</span>
      <span class="moment-caption">${caption}</span>
    </button>
  `;
}

function bindMomentCards(container) {
  container.querySelectorAll("[data-moment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const moment = visibleMemories().find((item) => item.id === button.dataset.momentId);
      if (moment) showMoment(moment);
    });
  });
}

function showMoment(moment) {
  const date = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(fromDateKey(moment.date));
  els.previewContent.innerHTML = `
    ${moment.photo ? `<img class="preview-image" src="${escapeHtml(moment.photo)}" alt="" />` : ""}
    <div class="preview-copy">
      <p>${escapeHtml(date)}${moment.sample ? " · SAMPLE" : ""}</p>
      <h2 id="previewTitle">${escapeHtml(moment.caption)}</h2>
    </div>
  `;
  if (!moment.photo) {
    els.previewContent.querySelector(".preview-copy").style.paddingTop = "63px";
  }
  els.previewDialog.showModal();
  document.querySelector("#closePreview").focus();
}

function visibleMemories() {
  if (memories.length) return memories;
  return samples.map((item, index) => ({
    id: `sample-${index}`,
    ...item,
    sample: true,
  }));
}

function openCapture() {
  els.captureForm.reset();
  els.memoryDate.value = selectedDate;
  els.formError.hidden = true;
  els.uploadPreview.hidden = true;
  els.uploadLabel.textContent = "Add a photo";
  releasePhotoPreview();
  els.captureDialog.showModal();
  window.requestAnimationFrame(() => els.memoryCaption.focus());
}

function closeCapture() {
  if (!els.captureDialog.open) return;
  els.captureDialog.close();
  releasePhotoPreview();
  els.uploadPreview.hidden = true;
}

function previewSelectedPhoto() {
  releasePhotoPreview();
  const file = els.memoryPhoto.files?.[0];
  if (!file) {
    els.uploadPreview.hidden = true;
    els.uploadLabel.textContent = "Add a photo";
    return;
  }
  if (!file.type.startsWith("image/")) {
    showFormError("Choose an image file to add to your moment.");
    els.memoryPhoto.value = "";
    return;
  }
  photoPreviewUrl = URL.createObjectURL(file);
  els.uploadPreview.src = photoPreviewUrl;
  els.uploadPreview.hidden = false;
  els.uploadLabel.textContent = "Change photo";
  els.formError.hidden = true;
}

async function saveMemory(event) {
  event.preventDefault();
  const caption = els.memoryCaption.value.trim();
  const date = els.memoryDate.value;
  const file = els.memoryPhoto.files?.[0];
  if (!caption || !date) {
    showFormError("Add a date and a few words before saving.");
    return;
  }
  if (date > todayKey) {
    showFormError("A moment can’t be saved to a future day.");
    return;
  }
  if (file && !file.type.startsWith("image/")) {
    showFormError("Choose an image file to add to your moment.");
    return;
  }

  els.saveMemory.disabled = true;
  els.saveMemory.querySelector("span").textContent = "Saving...";
  els.formError.hidden = true;
  try {
    const photo = file ? await compressImage(file) : "";
    const newMemory = {
      id: createId(),
      date,
      caption,
      photo,
      createdAt: new Date().toISOString(),
    };
    const nextMemories = [newMemory, ...memories].sort((a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextMemories));
    memories = nextMemories;
    selectedDate = date;
    const savedMonth = fromDateKey(date);
    visibleMonth = new Date(savedMonth.getFullYear(), savedMonth.getMonth(), 1);
    closeCapture();
    render();
    announce("Your moment is saved on this browser.");
  } catch (error) {
    console.error("Could not save this moment.", error);
    showFormError(
      error instanceof DOMException && error.name === "QuotaExceededError"
        ? "This browser is out of space. Try a smaller photo or remove some browser data."
        : "We couldn’t save that just now. Your moment is still here—please try again.",
    );
  } finally {
    els.saveMemory.disabled = false;
    els.saveMemory.querySelector("span").textContent = "Keep this moment";
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("This browser cannot process the selected photo."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected photo could not be opened."));
    };
    image.src = url;
  });
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = false;
  els.formError.focus?.();
}

function showView(view) {
  const isToday = view === "today";
  els.todayView.hidden = !isToday;
  els.timelineView.hidden = isToday;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (!isToday) {
    renderTimeline();
    els.searchInput.focus({ preventScroll: true });
  }
  history.replaceState(null, "", isToday ? "#today" : "#timeline");
}

function moveSelectedDate(amount) {
  selectedDate = toDateKey(offsetDate(fromDateKey(selectedDate), amount));
  const date = fromDateKey(selectedDate);
  visibleMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  renderDay();
  renderCalendar();
  renderSummary();
}

function moveMonth(amount) {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1);
  renderCalendar();
  renderSummary();
}

function readMemories() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.caption === "string" &&
        typeof item.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
        toDateKey(fromDateKey(item.date)) === item.date &&
        typeof item.photo === "string" &&
        (item.photo === "" || /^data:image\/jpeg;base64,[a-z\d+/]+=*$/i.test(item.photo)),
    );
  } catch (error) {
    console.error("Could not read saved moments.", error);
    return [];
  }
}

function initializeTheme() {
  let theme = "light";
  try {
    theme = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch (error) {
    console.error("Could not read appearance preference.", error);
  }
  document.documentElement.dataset.theme = theme;
  updateThemeLabels(theme);
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  updateThemeLabels(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Could not save appearance preference.", error);
  }
}

function updateThemeLabels(theme) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} mode`;
  document.querySelector("#themeToggle").setAttribute("aria-label", label);
  document.querySelector("#topThemeToggle").setAttribute("aria-label", label);
}

function releasePhotoPreview() {
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = "";
  els.uploadPreview.removeAttribute("src");
}

function announce(message) {
  els.liveMessage.textContent = "";
  window.requestAnimationFrame(() => {
    els.liveMessage.textContent = message;
  });
}

function isTypingTarget(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function offsetDate(date, offset) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + offset);
  return result;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
