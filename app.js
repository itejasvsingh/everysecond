const STORAGE_KEY = "daymark-moments-v1";
const THEME_KEY = "daymark-theme-v1";
const USER_STORAGE_PREFIX = `${STORAGE_KEY}-user-`;
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
  authButton: document.querySelector("#authButton"),
  authButtonLabel: document.querySelector("#authButtonLabel"),
  authDialog: document.querySelector("#authDialog"),
  authForm: document.querySelector("#authForm"),
  authTitle: document.querySelector("#authTitle"),
  authIntro: document.querySelector("#authIntro"),
  authFields: document.querySelector("#authFields"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authError: document.querySelector("#authError"),
  authStatusMessage: document.querySelector("#authStatusMessage"),
  accountActions: document.querySelector("#accountActions"),
  signedInActions: document.querySelector("#signedInActions"),
  signedInEmail: document.querySelector("#signedInEmail"),
  authSubmitActions: document.querySelector("#authSubmitActions"),
  authSubmit: document.querySelector("#authSubmit"),
  toggleAuthMode: document.querySelector("#toggleAuthMode"),
  importNotice: document.querySelector("#importNotice"),
  importDescription: document.querySelector("#importDescription"),
  importLocalButton: document.querySelector("#importLocalButton"),
};

let memories = readMemories();
let activeStorageKey = STORAGE_KEY;
let selectedDate = todayKey;
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let photoPreviewUrl = "";
let firebaseAuth = null;
let firestore = null;
let cloudStorage = null;
let currentUser = null;
let authMode = "signin";
let firebaseReady = false;
let firebaseLoading = false;
const photoObjectUrls = new Set();

initializeTheme();
render();
registerServiceWorker();

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
els.authButton.addEventListener("click", openAuthDialog);
document.querySelector("#closeAuth").addEventListener("click", closeAuthDialog);
document.querySelector("#cancelAuth").addEventListener("click", closeAuthDialog);
document.querySelector("#toggleAuthMode").addEventListener("click", toggleAuthMode);
document.querySelector("#resetPassword").addEventListener("click", resetPassword);
document.querySelector("#signOutButton").addEventListener("click", signOut);
document.querySelector("#importLocalButton").addEventListener("click", importLocalMemories);
els.searchInput.addEventListener("input", renderTimeline);
els.memoryPhoto.addEventListener("change", previewSelectedPhoto);
els.captureForm.addEventListener("submit", saveMemory);
els.authForm.addEventListener("submit", submitAuthForm);

els.captureDialog.addEventListener("click", (event) => {
  if (event.target === els.captureDialog) closeCapture();
});

els.previewDialog.addEventListener("click", (event) => {
  if (event.target === els.previewDialog) els.previewDialog.close();
});

els.authDialog.addEventListener("click", (event) => {
  if (event.target === els.authDialog) closeAuthDialog();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !els.timelineView.hidden && !isTypingTarget(event.target)) {
    event.preventDefault();
    els.searchInput.focus();
  }
  if (event.key === "Escape" && els.captureDialog.open) closeCapture();
});

window.addEventListener("online", () => {
  if (currentUser) syncPendingMemories().catch(reportCloudError);
});

initializeFirebase();

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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch((error) => {
    console.error("Could not register the offline app shell.", error);
  });
}

async function initializeFirebase() {
  if (!window.daymarkFirebaseConfig) {
    updateAuthUI();
    return;
  }
  firebaseLoading = true;
  updateAuthUI();
  try {
    await loadFirebaseSdk();
    const app = window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(window.daymarkFirebaseConfig);
    firebaseAuth = app.auth();
    firestore = app.firestore();
    cloudStorage = app.storage();
    firebaseReady = true;
    firebaseAuth.onAuthStateChanged(
      (user) => {
        handleAuthStateChanged(user).catch(reportCloudError);
      },
      (error) => {
        console.error("Could not read the Firebase sign-in state.", error);
        setAuthStatus("We couldn’t check your sign-in. Please refresh and try again.", true);
      },
    );
  } catch (error) {
    console.error("Could not initialize Firebase.", error);
    setAuthStatus("Firebase couldn’t start. Check your connection and app configuration.", true);
  } finally {
    firebaseLoading = false;
    updateAuthUI();
  }
}

function loadFirebaseSdk() {
  const sdkFiles = [
    "firebase-app-compat.js",
    "firebase-auth-compat.js",
    "firebase-firestore-compat.js",
    "firebase-storage-compat.js",
  ];
  const loadScripts = async () => {
    for (const file of sdkFiles) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://www.gstatic.com/firebasejs/11.6.1/${file}`;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Could not load ${file}.`));
        document.head.append(script);
      });
    }
  };
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(
      () => reject(new Error("Firebase SDK loading timed out.")),
      8000,
    );
  });
  return Promise.race([loadScripts(), timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function handleAuthStateChanged(user) {
  clearPhotoObjectUrls();
  currentUser = user;
  activeStorageKey = user ? userStorageKey(user.uid) : STORAGE_KEY;
  memories = readMemories(activeStorageKey);
  render();
  updateAuthUI();

  if (!user) return;
  try {
    const cloudMemories = await loadCloudMemories(user);
    const pending = memories.filter((moment) => moment.pendingSync);
    memories = mergeMemories(memories, cloudMemories, pending);
    persistMemories();
    render();
    await hydrateCloudPhotos();
    if (pending.length && navigator.onLine) {
      await syncPendingMemories();
    } else if (pending.length) {
      setAuthStatus(`${pending.length} ${pending.length === 1 ? "moment is" : "moments are"} waiting to sync.`, false);
    } else {
      setAuthStatus(`${memories.length} ${memories.length === 1 ? "moment" : "moments"} synced to your account.`, false);
    }
    updateAuthUI();
  } catch (error) {
    console.error("Could not sync this account’s moments.", error);
    setAuthStatus(
      "You’re signed in, but cloud moments could not load. Check that Firestore, Storage, and their rules are set up.",
      true,
    );
  }
}

async function loadCloudMemories(user) {
  const snapshot = await firestore
    .collection("users")
    .doc(user.uid)
    .collection("moments")
    .orderBy("date", "desc")
    .get();
  return snapshot.docs.map((document) => {
    const data = document.data();
    const photoPath = typeof data.photoPath === "string" ? data.photoPath : "";
    if (photoPath && photoPath !== `users/${user.uid}/moments/${document.id}.jpg`) {
      throw new Error("A cloud moment points to a photo outside its account.");
    }
    return {
      id: document.id,
      date: data.date,
      caption: data.caption,
      photo: "",
      photoPath,
      createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    };
  }).filter(isValidMemory);
}

async function hydrateCloudPhotos() {
  if (!currentUser || !navigator.onLine) return;
  const momentsWithPhotos = memories.filter((moment) => moment.photoPath && !moment.photo);
  const results = await Promise.allSettled(momentsWithPhotos.map(async (moment) => {
    const blob = await cloudStorage.ref(moment.photoPath).getBlob(5 * 1024 * 1024);
    const objectUrl = URL.createObjectURL(blob);
    photoObjectUrls.add(objectUrl);
    moment.photo = objectUrl;
  }));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    failures.forEach((result) => console.error("Could not load a private Firebase photo.", result.reason));
    setAuthStatus("Some photos couldn’t load. Check Storage setup and its cross-origin configuration.", true);
  }
  render();
}

function clearPhotoObjectUrls() {
  photoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  photoObjectUrls.clear();
}

function mergeMemories(...groups) {
  const merged = new Map();
  groups.flat().forEach((moment) => {
    const existing = merged.get(moment.id);
    merged.set(moment.id, existing ? { ...existing, ...moment, photo: moment.photo || existing.photo } : moment);
  });
  return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function userStorageKey(uid) {
  return `${USER_STORAGE_PREFIX}${uid}`;
}

function persistMemories() {
  const localMemories = memories.map((moment) => ({
    ...moment,
    photo: moment.photo.startsWith("data:image/jpeg;base64,") ? moment.photo : "",
  }));
  localStorage.setItem(activeStorageKey, JSON.stringify(localMemories));
}

function updateAuthUI() {
  els.authButtonLabel.textContent = currentUser ? "Account" : "Sign in";
  els.authButton.setAttribute(
    "aria-label",
    currentUser ? `Signed in as ${currentUser.email || "your account"}` : "Sign in to sync your moments",
  );
  if (els.authDialog.open) updateAuthDialog();
}

function updateAuthDialog() {
  const isSignedIn = Boolean(currentUser);
  const firebaseAvailable = firebaseReady && firebaseAuth;
  els.authError.hidden = true;
  els.authFields.hidden = isSignedIn || !firebaseAvailable;
  els.accountActions.hidden = isSignedIn || !firebaseAvailable;
  els.signedInActions.hidden = !isSignedIn;
  els.authSubmitActions.hidden = isSignedIn || !firebaseAvailable;
  els.importNotice.hidden = !isSignedIn || !hasUnimportedLocalMemories(currentUser.uid);

  if (isSignedIn) {
    els.authTitle.textContent = "Your account";
    els.authIntro.textContent = "Signed in. Your cloud moments are private to this account.";
    els.signedInEmail.textContent = currentUser.email || "Signed in";
    const localCount = readMemories(STORAGE_KEY).length;
    els.importDescription.textContent =
      `This browser has ${localCount} local ${localCount === 1 ? "moment" : "moments"}. Import them to this account?`;
  } else if (firebaseAvailable) {
    els.authTitle.textContent = authMode === "signup" ? "Create your account" : "Sign in to sync";
    els.authIntro.textContent = authMode === "signup"
      ? "Create a private account for your moments. Use at least 6 characters for your password."
      : "Sign in to keep your moments private and synced across devices.";
    els.authSubmit.querySelector("span").textContent =
      authMode === "signup" ? "Create account" : "Sign in";
    els.toggleAuthMode.textContent =
      authMode === "signup" ? "Already have an account? Sign in" : "Create an account";
    els.authPassword.autocomplete = authMode === "signup" ? "new-password" : "current-password";
  } else {
    els.authTitle.textContent = firebaseLoading ? "Connecting to Firebase" : "Sign-in unavailable";
    els.authIntro.textContent = firebaseLoading
      ? "Connecting securely. You can keep using moments saved in this browser while we connect."
      : "Firebase couldn’t load. You can still use moments saved in this browser; cloud sync needs a network connection.";
  }
}

function hasUnimportedLocalMemories(uid) {
  try {
    return readMemories(STORAGE_KEY).length > 0 &&
      localStorage.getItem(`${USER_STORAGE_PREFIX}${uid}-imported`) !== "true";
  } catch (error) {
    console.error("Could not check the local import state.", error);
    return false;
  }
}

function openAuthDialog() {
  authMode = "signin";
  els.authForm.reset();
  els.authStatusMessage.hidden = true;
  updateAuthDialog();
  els.authDialog.showModal();
  if (!currentUser && firebaseReady) window.requestAnimationFrame(() => els.authEmail.focus());
}

function closeAuthDialog() {
  if (els.authDialog.open) els.authDialog.close();
}

function toggleAuthMode() {
  authMode = authMode === "signin" ? "signup" : "signin";
  els.authError.hidden = true;
  els.authStatusMessage.hidden = true;
  updateAuthDialog();
  els.authPassword.value = "";
  els.authEmail.focus();
}

async function submitAuthForm(event) {
  event.preventDefault();
  if (!firebaseReady || !firebaseAuth) {
    showAuthError("Firebase is not available. Check your connection and reload.");
    return;
  }
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  setAuthBusy(true);
  els.authError.hidden = true;
  try {
    if (authMode === "signup") {
      await firebaseAuth.createUserWithEmailAndPassword(email, password);
    } else {
      await firebaseAuth.signInWithEmailAndPassword(email, password);
    }
    closeAuthDialog();
    announce("You’re signed in. Your cloud moments are loading.");
  } catch (error) {
    console.error("Firebase sign-in failed.", error);
    showAuthError(authErrorMessage(error));
  } finally {
    setAuthBusy(false);
  }
}

async function resetPassword() {
  const email = els.authEmail.value.trim();
  if (!email) {
    showAuthError("Enter your email address first, then choose Forgot password.");
    els.authEmail.focus();
    return;
  }
  try {
    await firebaseAuth.sendPasswordResetEmail(email);
    setAuthStatus("If an account exists for that address, Firebase will email a password reset link.", false);
  } catch (error) {
    console.error("Could not send a password reset email.", error);
    showAuthError(authErrorMessage(error));
  }
}

async function signOut() {
  try {
    await firebaseAuth.signOut();
    closeAuthDialog();
    announce("Signed out. This browser’s local moments are still here.");
  } catch (error) {
    console.error("Could not sign out.", error);
    setAuthStatus("We couldn’t sign out. Please try again.", true);
  }
}

async function importLocalMemories() {
  if (!currentUser || !navigator.onLine) {
    setAuthStatus("Connect to the internet before importing local moments.", true);
    return;
  }
  const localMoments = readMemories(STORAGE_KEY);
  if (!localMoments.length) {
    setAuthStatus("There are no local moments to import.", false);
    return;
  }
  els.importLocalButton.disabled = true;
  els.importLocalButton.textContent = "Importing...";
  try {
    const imported = [];
    for (const moment of localMoments) imported.push(await uploadCloudMemory(currentUser, moment));
    memories = mergeMemories(memories, imported);
    persistMemories();
    localStorage.setItem(`${USER_STORAGE_PREFIX}${currentUser.uid}-imported`, "true");
    render();
    updateAuthDialog();
    await hydrateCloudPhotos();
    setAuthStatus(`${imported.length} local ${imported.length === 1 ? "moment was" : "moments were"} imported.`, false);
  } catch (error) {
    console.error("Could not import local moments.", error);
    setAuthStatus("Some moments could not be imported. You can retry; already imported moments won’t be duplicated.", true);
  } finally {
    els.importLocalButton.disabled = false;
    els.importLocalButton.textContent = "Import these moments";
  }
}

async function uploadCloudMemory(user, moment) {
  let photoPath = moment.photoPath || "";
  if (moment.photo.startsWith("data:image/jpeg;base64,")) {
    photoPath = `users/${user.uid}/moments/${moment.id}.jpg`;
    await cloudStorage.ref(photoPath).putString(moment.photo, "data_url", {
      contentType: "image/jpeg",
      cacheControl: "private, max-age=3600",
    });
  }
  const momentRef = firestore
    .collection("users")
    .doc(user.uid)
    .collection("moments")
    .doc(moment.id);
  await momentRef.set({
    date: moment.date,
    caption: moment.caption,
    photoPath,
    createdAt: window.firebase.firestore.Timestamp.fromDate(
      new Date(moment.createdAt || Date.now()),
    ),
    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
  });
  return { ...moment, photoPath, pendingSync: false };
}

async function syncPendingMemories() {
  if (!currentUser || !navigator.onLine) return;
  const pending = memories.filter((moment) => moment.pendingSync);
  if (!pending.length) return;
  for (const moment of pending) {
    const synced = await uploadCloudMemory(currentUser, moment);
    memories = memories.map((item) => item.id === synced.id ? synced : item);
    persistMemories();
  }
  render();
  updateAuthUI();
  announce(`${pending.length} ${pending.length === 1 ? "moment was" : "moments were"} synced.`);
}

function setAuthBusy(busy) {
  els.authSubmit.disabled = busy;
  els.authSubmit.querySelector("span").textContent = busy
    ? "Please wait..."
    : authMode === "signup" ? "Create account" : "Sign in";
}

function authErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password combination didn’t work.";
    case "auth/email-already-in-use":
      return "An account already uses this email. Try signing in instead.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in isn’t enabled in Firebase Authentication yet.";
    case "auth/network-request-failed":
      return "Firebase needs an internet connection to sign in.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a little and try again.";
    default:
      return "Firebase couldn’t complete that request. Check the setup and try again.";
  }
}

function showAuthError(message) {
  els.authError.textContent = message;
  els.authError.hidden = false;
  els.authStatusMessage.hidden = true;
  els.authError.focus();
}

function setAuthStatus(message, isError) {
  els.authStatusMessage.textContent = message;
  els.authStatusMessage.classList.toggle("is-error", isError);
  els.authStatusMessage.hidden = false;
}

function reportCloudError(error) {
  console.error("Firebase cloud sync failed.", error);
  setAuthStatus(
    "Cloud sync couldn’t finish. Check your connection, Firebase setup, and security rules.",
    true,
  );
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
  document.querySelector("#uploadHint").textContent = currentUser
    ? "Private to your account. Saved securely."
    : "Kept in this browser until you sign in.";
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
      photoPath: "",
      pendingSync: Boolean(currentUser),
    };
    let cloudSaved = false;
    if (currentUser && navigator.onLine) {
      try {
        Object.assign(newMemory, await uploadCloudMemory(currentUser, newMemory));
        cloudSaved = true;
      } catch (error) {
        console.error("Could not save this moment to Firebase yet.", error);
        newMemory.pendingSync = true;
      }
    }
    const nextMemories = [newMemory, ...memories].sort((a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    try {
      localStorage.setItem(activeStorageKey, JSON.stringify(nextMemories.map((moment) => ({
        ...moment,
        photo: moment.photo.startsWith("data:image/jpeg;base64,") ? moment.photo : "",
      }))));
    } catch (error) {
      if (!cloudSaved) throw error;
      console.error("The cloud moment was saved, but its local copy could not be cached.", error);
      setAuthStatus("Saved to your account, but this browser couldn’t keep an offline copy.", true);
    }
    memories = nextMemories;
    selectedDate = date;
    const savedMonth = fromDateKey(date);
    visibleMonth = new Date(savedMonth.getFullYear(), savedMonth.getMonth(), 1);
    closeCapture();
    render();
    if (currentUser && !cloudSaved) {
      setAuthStatus(
        navigator.onLine
          ? "Saved on this device. It will sync when Firebase is available."
          : "Saved on this device. It will sync when you’re back online.",
        false,
      );
      announce("Saved on this device. Cloud sync is pending.");
    } else {
      announce(cloudSaved ? "Your moment is saved to your account." : "Your moment is saved on this browser.");
    }
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

function readMemories(storageKey = STORAGE_KEY) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMemory);
  } catch (error) {
    console.error("Could not read saved moments.", error);
    return [];
  }
}

function isValidMemory(item) {
  return Boolean(
    item &&
    typeof item.id === "string" &&
    /^[A-Za-z0-9_-]+$/.test(item.id) &&
    typeof item.caption === "string" &&
    item.caption.length > 0 &&
    item.caption.length <= 160 &&
    typeof item.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    toDateKey(fromDateKey(item.date)) === item.date &&
    typeof item.photo === "string" &&
    (item.photo === "" ||
      /^data:image\/jpeg;base64,[a-z\d+/]+=*$/i.test(item.photo) ||
      item.photo.startsWith("blob:")) &&
    (item.photoPath === undefined ||
      item.photoPath === "" ||
      typeof item.photoPath === "string") &&
    (item.pendingSync === undefined || typeof item.pendingSync === "boolean")
  );
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
