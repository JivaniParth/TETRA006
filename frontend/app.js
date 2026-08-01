/* ==========================================================================
   MedGuard App - Core Frontend Controller
   ========================================================================== */

const API_BASE = "http://localhost:8000";

// Global App State
let token = localStorage.getItem("medguard_token") || null;
let role = localStorage.getItem("medguard_role") || null;
let userId = localStorage.getItem("medguard_user_id") || null;
let email = localStorage.getItem("medguard_email") || null;
let currentSessionId = null;
let vitalsChart = null;
let patientSosInterval = null;
let clinicianSosInterval = null;

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupEventListeners();
});

// Initial Setup
function initApp() {
  if (token && role && userId) {
    // Session exists
    document.getElementById("display-user-email").textContent = email || "User Profile";
    document.getElementById("main-header").classList.remove("hidden");
    showDashboard();
  } else {
    // Show Authentication Screen
    showAuthPortal();
  }
}

// Set up UI views
function showAuthPortal() {
  document.getElementById("main-header").classList.add("hidden");
  document.getElementById("auth-section").classList.remove("hidden");
  document.getElementById("patient-section").classList.add("hidden");
  document.getElementById("clinician-section").classList.add("hidden");
  document.getElementById("auth-error").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("auth-section").classList.add("hidden");
  document.getElementById("main-header").classList.remove("hidden");
  
  if (role === "clinician") {
    document.getElementById("patient-nav").classList.add("hidden");
    document.getElementById("clinician-nav").classList.remove("hidden");
    document.getElementById("clinician-section").classList.remove("hidden");
    document.getElementById("patient-section").classList.add("hidden");
    
    if (clinicianSosInterval) {
      clearInterval(clinicianSosInterval);
      clinicianSosInterval = null;
    }
    const selectEl = document.getElementById("clin-hospital-select");
    if (selectEl) {
      selectEl.value = "";
    }
    document.getElementById("clinician-sos-queue").innerHTML = `
      <p class="empty-state">Please select a hospital facility above to pull nearby emergency coordinates.</p>
    `;
    
    switchTab("tab-dashboard");
    fetchEscalations();
  } else {
    document.getElementById("patient-nav").classList.remove("hidden");
    document.getElementById("clinician-nav").classList.add("hidden");
    document.getElementById("patient-section").classList.remove("hidden");
    document.getElementById("clinician-section").classList.add("hidden");
    switchTab("tab-profile");
    fetchProfile();
    fetchIndicators();
    fetchHistory();
    fetchVitalsTimeline();
    
    // Check if there is an active emergency beacon running
    checkActivePatientSos();
  }
}

function switchTab(tabId) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  // Remove active styling on nav buttons
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));
  
  // Show target tab
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.remove("hidden");
  }
  
  // Mark active button
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
}

// Set up all DOM listeners
function setupEventListeners() {
  // Auth Tab Toggles
  document.getElementById("auth-tab-login").addEventListener("click", () => {
    document.getElementById("auth-tab-login").classList.add("active");
    document.getElementById("auth-tab-register").classList.remove("active");
    document.getElementById("role-group").classList.add("hidden");
    document.getElementById("auth-submit-btn").textContent = "Sign In";
    document.getElementById("auth-error").classList.add("hidden");
  });

  document.getElementById("auth-tab-register").addEventListener("click", () => {
    document.getElementById("auth-tab-register").classList.add("active");
    document.getElementById("auth-tab-login").classList.remove("active");
    document.getElementById("role-group").classList.remove("hidden");
    document.getElementById("auth-submit-btn").textContent = "Sign Up";
    document.getElementById("auth-error").classList.add("hidden");
  });

  // Auth Form Submit
  document.getElementById("auth-form").addEventListener("submit", handleAuthSubmit);

  // Logout Button
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // Tab Navigation Buttons
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const tabId = e.currentTarget.getAttribute("data-tab");
      switchTab(tabId);
      
      // Fetch fresh data when tabs are clicked
      if (tabId === "tab-profile") {
        fetchProfile();
        fetchIndicators();
        fetchVitalsTimeline();
      } else if (tabId === "tab-history") {
        fetchHistory();
      } else if (tabId === "tab-dashboard") {
        fetchEscalations();
      }
    });
  });

  // Patient Profile Submit
  document.getElementById("profile-form").addEventListener("submit", handleProfileSubmit);

  // Patient Vitals Submit
  document.getElementById("vitals-form").addEventListener("submit", handleVitalsSubmit);

  // AI Chat Submit
  document.getElementById("chat-form").addEventListener("submit", handleChatSubmit);
  
  // New Chat Session Button
  document.getElementById("new-chat-btn").addEventListener("click", () => {
    currentSessionId = null;
    const chatMsgs = document.getElementById("chat-messages");
    chatMsgs.innerHTML = `
      <div class="msg msg-system">
        <p>Started a fresh chat session. Describe your symptoms or ask a medical question.</p>
      </div>
    `;
    document.getElementById("clarify-panel").classList.add("hidden");
    document.getElementById("chat-alerts-container").innerHTML = `
      <div class="no-alerts">No safety flags triggered in this session.</div>
    `;
  });

  // Clarification loops button
  document.getElementById("clarify-submit-btn").addEventListener("click", handleClarifySubmit);

  // Report Upload Drag & Drop
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("report-file-input");

  dropZone.addEventListener("click", () => fileInput.click());
  
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleReportUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleReportUpload(e.target.files[0]);
    }
  });

  // Confirm extracted values submit
  document.getElementById("confirm-form").addEventListener("submit", handleReportConfirm);

  // Clinician refresh button
  document.getElementById("refresh-escalations").addEventListener("click", fetchEscalations);

  // OTP Generator click
  document.getElementById("generate-otp-btn").addEventListener("click", handleGenerateOtp);

  // Hospital Finder locator
  document.getElementById("find-hospitals-btn").addEventListener("click", handleFindHospitals);

  // Clinician history retriever
  document.getElementById("clinician-history-form").addEventListener("submit", handleClinicianHistoryRetrieve);

  // Clinician history updates
  document.getElementById("clinician-update-form").addEventListener("submit", handleClinicianHistoryUpdate);

  // History Filter Buttons
  document.querySelectorAll(".history-tab").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".history-tab, .history-tabactive").forEach(el => {
        el.className = "history-tab";
      });
      e.currentTarget.className = "history-tabactive";
      const filter = e.currentTarget.getAttribute("data-hist-filter");
      filterHistory(filter);
    });
  });
  
  document.querySelector('.history-tabactive').addEventListener("click", (e) => {
    document.querySelectorAll(".history-tab, .history-tabactive").forEach(el => {
      el.className = "history-tab";
    });
    e.currentTarget.className = "history-tabactive";
    filterHistory("all");
  });

  // Patient SOS request trigger button
  const triggerSosBtn = document.getElementById("trigger-sos-btn");
  if (triggerSosBtn) {
    triggerSosBtn.addEventListener("click", handlePatientSosTrigger);
  }

  // Clinician dispatch center selection dropdown
  const clinHospitalSelect = document.getElementById("clin-hospital-select");
  if (clinHospitalSelect) {
    clinHospitalSelect.addEventListener("change", handleHospitalSelectChange);
  }
}

// API Fetch Helpers
async function apiCall(endpoint, options = {}) {
  const headers = options.headers || {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers
    }
  });
  
  if (response.status === 401) {
    handleLogout();
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}

// Authentication Submit
async function handleAuthSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById("auth-email").value;
  const passwordInput = document.getElementById("auth-password").value;
  const isRegister = document.getElementById("auth-tab-register").classList.contains("active");
  const errorEl = document.getElementById("auth-error");
  
  errorEl.classList.add("hidden");
  
  try {
    let result;
    if (isRegister) {
      const roleInput = document.getElementById("auth-role").value;
      const payload = { email: emailInput, password: passwordInput, role: roleInput };
      
      if (roleInput === "clinician") {
        payload.facility_name = document.getElementById("auth-facility-name").value || `Hospital (${emailInput})`;
        payload.phone = document.getElementById("auth-facility-phone").value || "+1 800-MEDGUARD";
        payload.latitude = signupLat || 12.9238;
        payload.longitude = signupLon || 77.5996;
      }
      
      result = await apiCall("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      result = await apiCall("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
    }
    
    // Save to State & Cache
    token = result.access_token;
    role = result.role;
    userId = result.user_id;
    email = emailInput;
    
    localStorage.setItem("medguard_token", token);
    localStorage.setItem("medguard_role", role);
    localStorage.setItem("medguard_user_id", userId);
    localStorage.setItem("medguard_email", email);
    
    document.getElementById("display-user-email").textContent = email;
    showDashboard();
    
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove("hidden");
  }
}

function handleLogout() {
  token = null;
  role = null;
  userId = null;
  email = null;
  currentSessionId = null;
  
  if (patientSosInterval) {
    clearInterval(patientSosInterval);
    patientSosInterval = null;
  }
  if (clinicianSosInterval) {
    clearInterval(clinicianSosInterval);
    clinicianSosInterval = null;
  }
  
  localStorage.clear();
  showAuthPortal();
}

// Profile Submit
async function handleProfileSubmit(e) {
  e.preventDefault();
  const msgEl = document.getElementById("profile-message");
  msgEl.classList.add("hidden");

  const medsText = document.getElementById("prof-meds").value;
  const activeMeds = medsText ? medsText.split(",").map(s => s.trim()).filter(Boolean) : [];
  
  const allergiesText = document.getElementById("prof-allergies").value;
  const allergies = allergiesText ? allergiesText.split(",").map(s => s.trim()).filter(Boolean) : [];
  
  const historyText = document.getElementById("prof-history").value;
  const history = historyText ? historyText.split(",").map(s => s.trim()).filter(Boolean) : [];
  
  const operationsText = document.getElementById("prof-operations").value;
  const operations = operationsText ? operationsText.split(",").map(s => s.trim()).filter(Boolean) : [];

  const profilePayload = {
    age: parseInt(document.getElementById("prof-age").value),
    gender: document.getElementById("prof-gender").value,
    race: document.getElementById("prof-race").value,
    height: parseFloat(document.getElementById("prof-height").value),
    weight: parseFloat(document.getElementById("prof-weight").value),
    lifestyle_smoke: document.getElementById("prof-smoke").checked,
    lifestyle_active: document.getElementById("prof-active").checked,
    family_history_cardiovascular: document.getElementById("prof-fam-cardio").checked,
    family_history_diabetes: document.getElementById("prof-fam-diabetes").checked,
    sleep_duration: parseFloat(document.getElementById("prof-sleep-dur").value) || 7.0,
    sleep_quality: document.getElementById("prof-sleep-qual").value,
    alcohol_consumption: document.getElementById("prof-alcohol").value,
    tobacco_consumption: document.getElementById("prof-tobacco").value,
    active_medications: activeMeds,
    allergies: allergies,
    medical_history: history,
    past_operations: operations,
    additional_notes: document.getElementById("prof-additional-notes").value.trim()
  };

  try {
    await apiCall(`/patient/${userId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profilePayload)
    });
    
    showFormAlert("profile-message", "Patient profile successfully updated!", "alert-success");
    fetchIndicators();
  } catch (err) {
    showFormAlert("profile-message", err.message, "alert-danger");
  }
}

// Fetch Profile
async function fetchProfile() {
  try {
    const profile = await apiCall(`/patient/${userId}/profile`);
    
    document.getElementById("prof-age").value = profile.age;
    document.getElementById("prof-gender").value = profile.gender;
    document.getElementById("prof-race").value = profile.race;
    document.getElementById("prof-height").value = profile.height;
    document.getElementById("prof-weight").value = profile.weight;
    document.getElementById("prof-smoke").checked = profile.lifestyle_smoke;
    document.getElementById("prof-active").checked = profile.lifestyle_active;
    document.getElementById("prof-fam-cardio").checked = profile.family_history_cardiovascular;
    document.getElementById("prof-fam-diabetes").checked = profile.family_history_diabetes;
    
    document.getElementById("prof-sleep-dur").value = profile.sleep_duration || "";
    document.getElementById("prof-sleep-qual").value = profile.sleep_quality || "good";
    document.getElementById("prof-alcohol").value = profile.alcohol_consumption || "none";
    document.getElementById("prof-tobacco").value = profile.tobacco_consumption || "none";
    
    document.getElementById("prof-meds").value = profile.active_medications ? profile.active_medications.join(", ") : "";
    document.getElementById("prof-allergies").value = profile.allergies ? profile.allergies.join(", ") : "";
    document.getElementById("prof-history").value = profile.medical_history ? profile.medical_history.join(", ") : "";
    document.getElementById("prof-operations").value = profile.past_operations ? profile.past_operations.join(", ") : "";
    document.getElementById("prof-additional-notes").value = profile.additional_notes || "";
    
  } catch (err) {
    console.log("No profile created yet.", err);
  }
}

// Vitals Submit
async function handleVitalsSubmit(e) {
  e.preventDefault();
  const sbpVal = document.getElementById("vitals-sbp").value;
  const dbpVal = document.getElementById("vitals-dbp").value;
  const sugarVal = document.getElementById("vitals-sugar").value;
  const hrVal = document.getElementById("vitals-hr").value;
  const creatinineVal = document.getElementById("vitals-creatinine").value;

  const vitalsPayload = {};
  if (sbpVal) vitalsPayload.systolic_bp = parseInt(sbpVal);
  if (dbpVal) vitalsPayload.diastolic_bp = parseInt(dbpVal);
  if (sugarVal) {
    vitalsPayload.blood_sugar = parseFloat(sugarVal);
    vitalsPayload.blood_sugar_type = document.getElementById("vitals-sugar-type").value;
  }
  if (hrVal) vitalsPayload.heart_rate = parseInt(hrVal);
  if (creatinineVal) vitalsPayload.creatinine = parseFloat(creatinineVal);

  if (Object.keys(vitalsPayload).length === 0) {
    showFormAlert("vitals-message", "Please log at least one vital parameter.", "alert-danger");
    return;
  }

  try {
    await apiCall(`/patient/${userId}/vitals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vitalsPayload)
    });
    
    showFormAlert("vitals-message", "Vitals logged successfully!", "alert-success");
    document.getElementById("vitals-form").reset();
    fetchIndicators();
    fetchHistory();
    fetchVitalsTimeline();
  } catch (err) {
    showFormAlert("vitals-message", err.message, "alert-danger");
  }
}

// Fetch Diagnostic Indicators
async function fetchIndicators() {
  try {
    const report = await apiCall(`/patient/${userId}/indicators`);
    updateIndicatorCard("ind-bp", report.blood_pressure_stage.stage, report.blood_pressure_stage.stage.includes("Emergency") || report.blood_pressure_stage.stage.includes("Crisis") ? "danger" : report.blood_pressure_stage.stage.includes("Normal") ? "normal" : "elevated");
    
    const ascvdScore = (report.ascvd_risk.score !== undefined && report.ascvd_risk.score !== null) ? `${report.ascvd_risk.score.toFixed(1)}%` : "N/A";
    const ascvdRisk = (report.ascvd_risk.score !== undefined && report.ascvd_risk.score !== null) ? (report.ascvd_risk.score >= 15 ? "danger" : report.ascvd_risk.score >= 7.5 ? "elevated" : "normal") : "normal";
    updateIndicatorCard("ind-ascvd", ascvdScore, ascvdRisk);

    updateIndicatorCard("ind-diabetes", report.diabetes_risk.category, report.diabetes_risk.category.includes("High") ? "danger" : report.diabetes_risk.category.includes("Low") ? "normal" : "elevated");
    updateIndicatorCard("ind-kidney", report.kidney_gfr.stage, report.kidney_gfr.stage.includes("Failure") || report.kidney_gfr.stage.includes("Severe") ? "danger" : report.kidney_gfr.stage.includes("Normal") ? "normal" : "elevated");
    
  } catch (err) {
    console.log("Could not load diagnostic indicators", err);
  }
}

function updateIndicatorCard(elementId, value, status) {
  const card = document.getElementById(elementId);
  if (!card) return;
  
  card.className = "indicator-card";
  card.classList.add(`risk-${status}`);
  
  card.querySelector(".ind-val").textContent = value || "No Data";
}

// AI Chat Loop Invocations
async function handleChatSubmit(e) {
  e.preventDefault();
  const inputEl = document.getElementById("chat-input");
  const queryText = inputEl.value.trim();
  if (!queryText) return;

  appendChatMessage("user", queryText);
  inputEl.value = "";
  
  // Create loading element
  const loadingId = appendChatMessage("assistant", "Thinking...");

  try {
    const payload = { text: queryText };
    if (currentSessionId) {
      payload.session_id = currentSessionId;
    }
    
    const res = await apiCall("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    removeLoadingMessage(loadingId);
    processQueryResponse(res);
  } catch (err) {
    removeLoadingMessage(loadingId);
    appendChatMessage("assistant msg-assistant-offline", `An error occurred: ${err.message}`);
  }
}

async function handleClarifySubmit() {
  const inputEl = document.getElementById("clarify-input");
  const answerText = inputEl.value.trim();
  if (!answerText) return;

  appendChatMessage("user", answerText);
  inputEl.value = "";
  document.getElementById("clarify-panel").classList.add("hidden");
  
  const loadingId = appendChatMessage("assistant", "Thinking...");

  try {
    const payload = {
      text: answerText,
      session_id: currentSessionId
    };
    
    const res = await apiCall("/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    removeLoadingMessage(loadingId);
    processQueryResponse(res);
  } catch (err) {
    removeLoadingMessage(loadingId);
    appendChatMessage("assistant msg-assistant-offline", `An error occurred: ${err.message}`);
  }
}

function processQueryResponse(res) {
  if (res.status === "awaiting_user_input") {
    // Session continues, clarify missing fields
    currentSessionId = res.session_id;
    appendChatMessage("assistant", res.response, res.html_response);
    
    document.getElementById("clarify-text").textContent = res.response;
    document.getElementById("clarify-panel").classList.remove("hidden");
    document.getElementById("clarify-input").focus();
  } else {
    // Session completed
    appendChatMessage("assistant", res.response, res.html_response);
    currentSessionId = null; // reset
    document.getElementById("clarify-panel").classList.add("hidden");
    
    // Load fresh history indicators
    fetchIndicators();
    fetchHistory();
  }
  
  // Render Alerts
  renderSafetyAlerts(res.safety_alerts || []);
}

function renderSafetyAlerts(alerts) {
  const container = document.getElementById("chat-alerts-container");
  if (!alerts || alerts.length === 0) {
    container.innerHTML = `<div class="no-alerts">No safety flags triggered in this session.</div>`;
    return;
  }
  
  container.innerHTML = "";
  alerts.forEach(alert => {
    const banner = document.createElement("div");
    banner.className = "alert-banner";
    
    if (alert.includes("INTERACTION") || alert.includes("ALLERGY")) {
      banner.classList.add("alert-ddi");
      banner.innerHTML = `
        <strong>⚠️ CRITICAL DRUG WARNING</strong>
        <span>${alert}</span>
      `;
    } else {
      banner.classList.add("alert-escalation");
      banner.innerHTML = `
        <strong>⚡ CLINICAL ALERT</strong>
        <span>${alert}</span>
      `;
    }
    container.appendChild(banner);
  });
}

function appendChatMessage(sender, text, htmlText = null) {
  const chatMsgs = document.getElementById("chat-messages");
  const msgEl = document.createElement("div");
  const randomId = "msg_" + Math.random().toString(36).substring(2, 9);
  
  msgEl.id = randomId;
  msgEl.className = `msg msg-${sender}`;
  
  // AI Fallback Disclaimer styling checks
  if (text.includes("disclaimer") || text.includes("Safety Checks")) {
    msgEl.classList.add("msg-assistant-offline");
  }
  
  if (htmlText) {
    msgEl.innerHTML = htmlText;
  } else {
    msgEl.innerHTML = `<p>${escapeHTML(text)}</p>`;
  }
  chatMsgs.appendChild(msgEl);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  return randomId;
}

function removeLoadingMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Report Upload logic
async function handleReportUpload(file) {
  const statusEl = document.getElementById("upload-status");
  statusEl.className = "alert alert-info";
  statusEl.textContent = `Uploading and extracting "${file.name}"...`;
  statusEl.classList.remove("hidden");
  
  document.getElementById("confirm-card").classList.add("hidden");
  
  const formData = new FormData();
  formData.append("file", file);
  
  try {
    const res = await apiCall("/reports/upload", {
      method: "POST",
      body: formData
    });
    
    statusEl.className = "alert alert-success";
    statusEl.textContent = "Extraction complete! Please review values below.";
    
    // Show verification pane
    document.getElementById("extr-confidence").textContent = `${Math.round(res.confidence * 100)}%`;
    document.getElementById("extr-filename").textContent = res.file_name;
    
    // Store report ID on the form element dataset
    document.getElementById("confirm-form").dataset.reportId = res.report_id;
    
    // Fill inputs
    const vals = res.extracted_values || {};
    document.getElementById("extr-sbp").value = vals.systolic_bp || "";
    document.getElementById("extr-dbp").value = vals.diastolic_bp || "";
    document.getElementById("extr-sugar").value = vals.blood_sugar || vals.glucose || "";
    document.getElementById("extr-hr").value = vals.heart_rate || "";
    document.getElementById("extr-creatinine").value = vals.creatinine || "";
    
    document.getElementById("confirm-card").classList.remove("hidden");
  } catch (err) {
    statusEl.className = "alert alert-danger";
    statusEl.textContent = `Upload failed: ${err.message}`;
  }
}

// Confirm Extracted Report Values
async function handleReportConfirm(e) {
  e.preventDefault();
  const form = document.getElementById("confirm-form");
  const reportId = form.dataset.reportId;
  const msgEl = document.getElementById("confirm-message");
  
  msgEl.classList.add("hidden");
  
  if (!document.getElementById("confirm-approve-check").checked) {
    msgEl.className = "alert alert-danger";
    msgEl.textContent = "You must approve the accuracy of the values to verify.";
    msgEl.classList.remove("hidden");
    return;
  }

  const sbp = document.getElementById("extr-sbp").value;
  const dbp = document.getElementById("extr-dbp").value;
  const sugar = document.getElementById("extr-sugar").value;
  const hr = document.getElementById("extr-hr").value;
  const creatinine = document.getElementById("extr-creatinine").value;

  const corrected_values = {};
  if (sbp) corrected_values.systolic_bp = parseInt(sbp);
  if (dbp) corrected_values.diastolic_bp = parseInt(dbp);
  if (sugar) corrected_values.blood_sugar = parseFloat(sugar);
  if (hr) corrected_values.heart_rate = parseInt(hr);
  if (creatinine) corrected_values.creatinine = parseFloat(creatinine);

  try {
    await apiCall(`/reports/${reportId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        corrected_values: corrected_values
      })
    });
    
    msgEl.className = "alert alert-success";
    msgEl.textContent = "Report successfully confirmed and clinical metrics saved!";
    msgEl.classList.remove("hidden");
    
    // Hide panel shortly
    setTimeout(() => {
      document.getElementById("confirm-card").classList.add("hidden");
      document.getElementById("upload-status").classList.add("hidden");
    }, 2000);
    
    fetchIndicators();
    fetchHistory();
  } catch (err) {
    msgEl.className = "alert alert-danger";
    msgEl.textContent = err.message;
    msgEl.classList.remove("hidden");
  }
}

// History Records
let rawHistoryData = { vitals: [], reports: [], inferences: [] };

async function fetchHistory() {
  try {
    rawHistoryData = await apiCall(`/patient/${userId}/history`);
    filterHistory("all");
  } catch (err) {
    console.log("Failed to load patient history records", err);
  }
}

function filterHistory(filterType) {
  const container = document.getElementById("history-list");
  container.innerHTML = "";
  
  const items = [];
  
  if (filterType === "all" || filterType === "vitals") {
    rawHistoryData.vitals.forEach(v => {
      let metrics = [];
      if (v.systolic_bp) metrics.push(`Blood Pressure: ${v.systolic_bp}/${v.diastolic_bp} mmHg`);
      if (v.blood_sugar) metrics.push(`Blood Sugar: ${v.blood_sugar} mg/dL`);
      if (v.heart_rate) metrics.push(`Heart Rate: ${v.heart_rate} bpm`);
      if (v.creatinine) metrics.push(`Creatinine: ${v.creatinine} mg/dL`);
      
      items.push({
        type: "vitals",
        badge: "vitals",
        time: new Date(v.recorded_at).toLocaleString(),
        body: metrics.join(" | ") || "Vitals entry (no parameters set)"
      });
    });
  }
  
  if (filterType === "all" || filterType === "reports") {
    rawHistoryData.reports.forEach(r => {
      items.push({
        type: "reports",
        badge: "reports",
        time: new Date(r.created_at).toLocaleString(),
        body: `Ingested File: ${r.file_name} (${r.status.toUpperCase()})\nCalculated Severity: ${r.severity_tier.toUpperCase()}\nExtracted parameters: ${JSON.stringify(r.extracted_values)}`
      });
    });
  }
  
  if (filterType === "all" || filterType === "queries") {
    rawHistoryData.inferences.forEach(inf => {
      items.push({
        type: "queries",
        badge: "queries",
        time: new Date(inf.created_at).toLocaleString(),
        body: inf.text_content
      });
    });
  }
  
  // Sort items chronological (newest first)
  items.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">No medical history logs match this filter.</p>`;
    return;
  }
  
  items.forEach(item => {
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `
      <div class="hist-header">
        <span class="hist-badge badge-${item.badge}">${item.badge}</span>
        <span class="hist-time">${item.time}</span>
      </div>
      <div class="hist-body">${escapeHTML(item.body)}</div>
    `;
    container.appendChild(el);
  });
}

// Clinician Dashboard Triage
async function fetchEscalations() {
  const queue = document.getElementById("escalations-queue");
  queue.innerHTML = `<div class="empty-state">Loading active alert cases...</div>`;
  
  try {
    const escalations = await apiCall("/clinician/escalations");
    
    // filter out resolved ones
    const active = escalations.filter(e => e.status === "pending");
    
    if (active.length === 0) {
      queue.innerHTML = `<p class="empty-state">No active clinical escalations in queue. System is fully stable.</p>`;
      return;
    }
    
    queue.innerHTML = "";
    active.forEach(item => {
      const card = document.createElement("div");
      card.className = "escalation-card";
      if (item.severity_tier === "important") {
        card.classList.add("escal-important");
      }
      
      card.innerHTML = `
        <div class="escal-meta">
          <span>Patient ID: ${item.patient_id}</span>
          <span class="severity-${item.severity_tier}">${item.severity_tier.toUpperCase()} severity</span>
        </div>
        <div class="escal-reason">${escapeHTML(item.reason)}</div>
        <div class="escal-details">Triggered: ${new Date(item.created_at).toLocaleString()}</div>
        <div class="escal-actions">
          <input type="text" id="comments_${item.id}" placeholder="Triage comment (e.g. Advised ER, Scheduled consult)" style="flex: 1; padding: 0.4rem 0.8rem; font-size: 0.85rem;">
          <button onclick="handleResolveEscalation('${item.id}')" class="btn-primary btn-small">Acknowledge & Resolve</button>
        </div>
      `;
      queue.appendChild(card);
    });
  } catch (err) {
    queue.innerHTML = `<div class="alert alert-danger">Failed to fetch escalations: ${err.message}</div>`;
  }
}

// ----------------------------------------------------
// NEW FEATURES: Timeline Graph, OTP Access & Hospital Locator
// ----------------------------------------------------

async function fetchVitalsTimeline() {
  const ctx = document.getElementById("vitals-chart");
  if (!ctx) return;
  
  try {
    const timeline = await apiCall(`/patient/${userId}/vitals/timeline`);
    
    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    
    const labels = timeline.map(t => {
      const d = new Date(t.recorded_at);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    });
    
    const sbpData = timeline.map(t => t.systolic_bp);
    const dbpData = timeline.map(t => t.diastolic_bp);
    const sugarData = timeline.map(t => t.blood_sugar);
    const hrData = timeline.map(t => t.heart_rate);
    const creatinineData = timeline.map(t => t.creatinine);
    
    if (vitalsChart) {
      vitalsChart.destroy();
    }
    
    vitalsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Systolic BP (mmHg)',
            data: sbpData,
            borderColor: '#ff5252',
            backgroundColor: 'rgba(255, 82, 82, 0.05)',
            borderWidth: 2,
            tension: 0.35,
            fill: true
          },
          {
            label: 'Diastolic BP (mmHg)',
            data: dbpData,
            borderColor: '#ffeb3b',
            backgroundColor: 'rgba(255, 235, 59, 0.05)',
            borderWidth: 2,
            tension: 0.35,
            fill: true
          },
          {
            label: 'Blood Sugar (mg/dL)',
            data: sugarData,
            borderColor: '#00e5ff',
            backgroundColor: 'rgba(0, 229, 255, 0.05)',
            borderWidth: 2,
            tension: 0.35,
            fill: true
          },
          {
            label: 'Heart Rate (bpm)',
            data: hrData,
            borderColor: '#00e676',
            backgroundColor: 'rgba(0, 230, 118, 0.05)',
            borderWidth: 2,
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(255,255,255,0.7)', font: { family: 'Inter' } }
          },
          x: {
            grid: { display: false },
            ticks: { color: 'rgba(255,255,255,0.7)', font: { family: 'Inter' } }
          }
        },
        plugins: {
          legend: {
            labels: { color: 'rgba(255,255,255,0.8)', font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  } catch (err) {
    console.error("Failed to render vitals graph timeline:", err);
  }
}

let otpTimer = null;

async function handleGenerateOtp() {
  const container = document.getElementById("otp-display-container");
  const codeVal = document.getElementById("otp-code-value");
  const timerVal = document.getElementById("otp-timer-value");
  
  try {
    const data = await apiCall("/patient/access-code/generate", { method: "POST" });
    container.classList.remove("hidden");
    
    const rawCode = data.otp_code;
    codeVal.textContent = rawCode.substring(0, 3) + " " + rawCode.substring(3);
    
    let secondsLeft = data.expires_in_seconds || 60;
    timerVal.textContent = secondsLeft;
    
    if (otpTimer) {
      clearInterval(otpTimer);
    }
    
    otpTimer = setInterval(() => {
      secondsLeft--;
      timerVal.textContent = secondsLeft;
      if (secondsLeft <= 0) {
        clearInterval(otpTimer);
        container.classList.add("hidden");
        alert("Your temporary secure access OTP code has expired.");
      }
    }, 1000);
  } catch (err) {
    alert("Failed to generate OTP: " + err.message);
  }
}

async function handleFindHospitals() {
  const listContainer = document.getElementById("hospitals-list");
  listContainer.innerHTML = `<div class="empty-state">Requesting location coordinates...</div>`;
  
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      listContainer.innerHTML = `<div class="empty-state">Searching closest hospitals...</div>`;
      
      try {
        const hospitals = await apiCall(`/patient/hospitals/nearby?latitude=${lat}&longitude=${lon}`);
        listContainer.innerHTML = "";
        
        if (hospitals.length === 0) {
          listContainer.innerHTML = `<div class="empty-state">No medical centers found nearby.</div>`;
          return;
        }
        
        hospitals.forEach(h => {
          const item = document.createElement("div");
          item.className = "hospital-item";
          item.style.background = "rgba(255,255,255,0.015)";
          item.style.border = "1px solid var(--border)";
          item.style.padding = "0.8rem 1rem";
          item.style.borderRadius = "6px";
          item.style.display = "flex";
          item.style.justifyContent = "space-between";
          item.style.alignItems = "center";
          
          item.innerHTML = `
            <div>
              <strong style="color: var(--primary); font-size: 0.9rem;">${escapeHTML(h.name)}</strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHTML(h.address)}</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.1rem;">Phone: ${escapeHTML(h.phone)}</div>
            </div>
            <div style="text-align: right;">
              <span style="background: rgba(0, 229, 255, 0.1); color: var(--secondary); font-size: 0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 4px;">
                ${h.distance_km} km
              </span>
            </div>
          `;
          listContainer.appendChild(item);
        });
      } catch (err) {
        listContainer.innerHTML = `<div class="alert alert-danger">Error querying locator: ${err.message}</div>`;
      }
    },
    (err) => {
      // Fallback coordinate search if blocked
      const fallbackLat = 12.925;
      const fallbackLon = 77.600;
      console.warn("Geolocation blocked. Using default coordinates.", err);
      listContainer.innerHTML = `<div class="empty-state">Location access denied. Finding relative to city center...</div>`;
      
      setTimeout(async () => {
        try {
          const hospitals = await apiCall(`/patient/hospitals/nearby?latitude=${fallbackLat}&longitude=${fallbackLon}`);
          listContainer.innerHTML = "";
          
          hospitals.forEach(h => {
            const item = document.createElement("div");
            item.className = "hospital-item";
            item.style.background = "rgba(255,255,255,0.015)";
            item.style.border = "1px solid var(--border)";
            item.style.padding = "0.8rem 1rem";
            item.style.borderRadius = "6px";
            item.style.display = "flex";
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";
            
            item.innerHTML = `
              <div>
                <strong style="color: var(--primary); font-size: 0.9rem;">${escapeHTML(h.name)}</strong>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHTML(h.address)}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.1rem;">Phone: ${escapeHTML(h.phone)}</div>
              </div>
              <div style="text-align: right;">
                <span style="background: rgba(0, 229, 255, 0.1); color: var(--secondary); font-size: 0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 4px;">
                  ${h.distance_km} km
                </span>
              </div>
            `;
            listContainer.appendChild(item);
          });
        } catch (err) {
          listContainer.innerHTML = `<div class="alert alert-danger">Error querying locator: ${err.message}</div>`;
        }
      }, 1000);
    }
  );
}

async function handleClinicianHistoryRetrieve(e) {
  e.preventDefault();
  const emailVal = document.getElementById("clin-patient-email").value.trim();
  const otpVal = document.getElementById("clin-otp-code").value.trim();
  const msgEl = document.getElementById("clin-otp-message");
  const recordPane = document.getElementById("retrieved-patient-record");
  
  msgEl.classList.add("hidden");
  recordPane.classList.add("hidden");
  
  try {
    const data = await apiCall("/clinician/patient-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_email: emailVal, otp_code: otpVal })
    });
    
    // Save email / otp on forms data attributes
    const updateForm = document.getElementById("clinician-update-form");
    updateForm.dataset.patientEmail = emailVal;
    
    document.getElementById("retrieved-patient-email").textContent = data.email;
    
    // Populating baseline Profile
    const p = data.profile || {};
    const profHtml = `
      <div><strong>Age / Gender / Race:</strong> ${p.age || 'N/A'} yrs | ${p.gender || 'N/A'} | ${p.race || 'N/A'}</div>
      <div><strong>Height / Weight:</strong> ${p.height || 'N/A'} cm | ${p.weight || 'N/A'} kg</div>
      <div><strong>Active Medications:</strong> ${p.active_medications ? p.active_medications.join(", ") : 'None'}</div>
      <div><strong>Allergies:</strong> ${p.allergies ? p.allergies.join(", ") : 'None'}</div>
      <div><strong>Surgeries / Operations:</strong> ${p.past_operations ? p.past_operations.join(", ") : 'None'}</div>
      <div><strong>Chronic Illnesses:</strong> ${p.medical_history ? p.medical_history.join(", ") : 'None'}</div>
      <div><strong>Additional Baseline Notes:</strong> <span style="color: var(--secondary);">${escapeHTML(p.additional_notes) || 'None'}</span></div>
    `;
    document.getElementById("retrieved-profile-data").innerHTML = profHtml;
    
    // Autofill updates
    document.getElementById("clin-update-meds").value = p.active_medications ? p.active_medications.join(", ") : "";
    document.getElementById("clin-update-operations").value = p.past_operations ? p.past_operations.join(", ") : "";
    document.getElementById("clin-update-otp").value = "";
    
    // Populating vitals timeline list
    const vitalsData = data.vitals || [];
    const vitalsContainer = document.getElementById("retrieved-vitals-data");
    vitalsContainer.innerHTML = "";
    
    if (vitalsData.length === 0) {
      vitalsContainer.innerHTML = `<div class="empty-state">No historical vitals logged.</div>`;
    } else {
      vitalsData.forEach(v => {
        const item = document.createElement("div");
        item.style.padding = "0.6rem";
        item.style.background = "rgba(255,255,255,0.01)";
        item.style.borderRadius = "4px";
        item.style.border = "1px solid var(--border)";
        item.style.fontSize = "0.85rem";
        
        let details = `BP: ${v.systolic_bp || 'N/A'}/${v.diastolic_bp || 'N/A'} mmHg`;
        if (v.blood_sugar) details += ` | Blood Sugar: ${v.blood_sugar} mg/dL (${v.blood_sugar_type || 'unclassified'})`;
        if (v.heart_rate) details += ` | Heart Rate: ${v.heart_rate} bpm`;
        if (v.creatinine) details += ` | Creatinine: ${v.creatinine} mg/dL`;
        
        item.innerHTML = `
          <div style="font-weight: 600; color: var(--text-secondary); font-size: 0.75rem;">${new Date(v.recorded_at).toLocaleString()}</div>
          <div style="margin-top: 0.2rem; line-height: 1.4;">${details}</div>
        `;
        vitalsContainer.appendChild(item);
      });
    }
    
    recordPane.classList.remove("hidden");
    
  } catch (err) {
    msgEl.className = "alert alert-danger";
    msgEl.textContent = `Access Denied: ${err.message}`;
    msgEl.classList.remove("hidden");
  }
}

async function handleClinicianHistoryUpdate(e) {
  e.preventDefault();
  const updateForm = document.getElementById("clinician-update-form");
  const emailVal = updateForm.dataset.patientEmail;
  const otpVal = document.getElementById("clin-update-otp").value.trim();
  const medsText = document.getElementById("clin-update-meds").value;
  const operationsText = document.getElementById("clin-update-operations").value;
  const msgEl = document.getElementById("clin-update-message");
  
  msgEl.classList.add("hidden");
  
  const activeMeds = medsText ? medsText.split(",").map(s => s.trim()).filter(Boolean) : [];
  const operations = operationsText ? operationsText.split(",").map(s => s.trim()).filter(Boolean) : [];
  
  try {
    await apiCall("/clinician/patient-history/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_email: emailVal,
        otp_code: otpVal,
        active_medications: activeMeds,
        past_operations: operations
      })
    });
    
    msgEl.className = "alert alert-success";
    msgEl.textContent = "Patient record successfully updated and Kafka audit log transmitted!";
    msgEl.classList.remove("hidden");
    
    setTimeout(() => {
      msgEl.classList.add("hidden");
      document.getElementById("retrieved-patient-record").classList.add("hidden");
      document.getElementById("clinician-history-form").reset();
    }, 3000);
  } catch (err) {
    msgEl.className = "alert alert-danger";
    msgEl.textContent = `Update Failed: ${err.message}`;
    msgEl.classList.remove("hidden");
  }
}

// Exposed globally to trigger from onclick attribute
window.handleResolveEscalation = async function(id) {
  const commentInput = document.getElementById(`comments_${id}`);
  const comments = commentInput.value.trim() || "Escalation triaged and resolved by clinician.";
  
  try {
    await apiCall(`/clinician/escalations/${id}/resolve?comments=${encodeURIComponent(comments)}`, {
      method: "POST"
    });
    fetchEscalations(); // Refresh list
  } catch (err) {
    alert(`Failed to resolve escalation: ${err.message}`);
  }
};

// Utilities
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showFormAlert(elementId, message, alertClass) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `alert ${alertClass}`;
  el.textContent = message;
  el.classList.remove("hidden");
  
  // auto hide success messages
  if (alertClass === "alert-success") {
    setTimeout(() => {
      el.classList.add("hidden");
    }, 4000);
  }
}

// ----------------------------------------------------
// EMERGENCY SOS SYSTEM FUNCTIONS
// ----------------------------------------------------

async function handlePatientSosTrigger() {
  const container = document.getElementById("sos-status-container");
  const label = document.getElementById("sos-status-label");
  const detail = document.getElementById("sos-status-detail");
  const pulse = document.getElementById("sos-pulse");
  const btn = document.getElementById("trigger-sos-btn");
  
  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.textContent = "Broadcasting...";
  
  container.classList.remove("hidden");
  label.textContent = "Determining Geolocation...";
  label.style.color = "#ff5252";
  pulse.style.background = "#ff5252";
  detail.textContent = "Requesting coordinate points from browser GPS sensor...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      detail.textContent = `Coordinates locked: ${lat.toFixed(4)}, ${lon.toFixed(4)}. Transmitting broadcast beacon...`;
      await sendSosRequest(lat, lon);
    },
    async (err) => {
      console.warn("Geolocation denied/blocked. Using default fallback city center coordinates.", err);
      const fallbackLat = 12.9250;
      const fallbackLon = 77.6000;
      detail.textContent = `Location access denied. Broadcasting default coordinates: ${fallbackLat}, ${fallbackLon}...`;
      await sendSosRequest(fallbackLat, fallbackLon);
    }
  );
}

async function sendSosRequest(lat, lon) {
  const label = document.getElementById("sos-status-label");
  const detail = document.getElementById("sos-status-detail");
  const btn = document.getElementById("trigger-sos-btn");
  
  try {
    await apiCall(`/patient/${userId}/emergency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: lat, longitude: lon })
    });
    
    label.textContent = "SOS Broadcast Active";
    detail.textContent = "Beacons sent to all nearby medical centers. Monitoring ambulance dispatch queues...";
    btn.textContent = "SOS Alert Transmitted";
    
    startPatientSosPolling();
  } catch (err) {
    label.textContent = "Broadcast Failed";
    detail.textContent = `Error: ${err.message}. Please call emergency services directly.`;
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.textContent = "Request Ambulance SOS";
  }
}

function startPatientSosPolling() {
  if (patientSosInterval) {
    clearInterval(patientSosInterval);
  }
  patientSosInterval = setInterval(checkActivePatientSos, 4000);
}

async function checkActivePatientSos() {
  const container = document.getElementById("sos-status-container");
  const label = document.getElementById("sos-status-label");
  const detail = document.getElementById("sos-status-detail");
  const pulse = document.getElementById("sos-pulse");
  const btn = document.getElementById("trigger-sos-btn");
  
  if (!userId || role !== "patient") return;
  
  try {
    const alert = await apiCall(`/patient/${userId}/emergency/active`);
    
    if (!alert) {
      container.classList.add("hidden");
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = "Request Ambulance SOS";
      if (patientSosInterval) {
        clearInterval(patientSosInterval);
        patientSosInterval = null;
      }
      return;
    }
    
    container.classList.remove("hidden");
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.textContent = "SOS Alert Transmitted";
    
    if (alert.status === "pending") {
      label.textContent = "SOS Broadcast Active";
      label.style.color = "#ff5252";
      pulse.style.background = "#ff5252";
      detail.textContent = `Broadcast coordinates: ${alert.latitude.toFixed(4)}, ${alert.longitude.toFixed(4)}. Awaiting hospital acceptance...`;
      startPatientSosPolling();
    } else if (alert.status === "accepted") {
      label.textContent = "Ambulance Dispatched";
      label.style.color = "#00e676";
      pulse.style.background = "#00e676";
      detail.innerHTML = `
        <div style="font-weight: 600; color: #a7f3d0; margin-bottom: 0.3rem;">ALERT ACCEPTED BY: ${escapeHTML(alert.accepted_by_hospital)}</div>
        <div>Contact: <strong style="color: var(--secondary);">${escapeHTML(alert.accepted_by_phone)}</strong></div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem;">An emergency vehicle has been dispatched with medical attention. Please remain calm.</div>
      `;
      if (patientSosInterval) {
        clearInterval(patientSosInterval);
        patientSosInterval = null;
      }
    }
  } catch (err) {
    console.error("Error checking active SOS alert:", err);
  }
}

let activeClinicianHospital = null;
let activeClinicianLat = null;
let activeClinicianLon = null;
let activeClinicianPhone = null;
let signupLat = null;
let signupLon = null;

async function handleHospitalSelectChange(e) {
  const value = e.target.value;
  if (!value) {
    activeClinicianHospital = null;
    activeClinicianLat = null;
    activeClinicianLon = null;
    activeClinicianPhone = null;
  } else {
    const parts = value.split("|");
    activeClinicianHospital = parts[0];
    activeClinicianLat = parseFloat(parts[1]);
    activeClinicianLon = parseFloat(parts[2]);
    activeClinicianPhone = parts[3];
  }
  
  if (clinicianSosInterval) {
    clearInterval(clinicianSosInterval);
  }
  
  fetchClinicianEmergencies();
  clinicianSosInterval = setInterval(fetchClinicianEmergencies, 4000);
}

async function fetchClinicianEmergencies() {
  const queue = document.getElementById("clinician-sos-queue");
  if (!queue) return;
  
  try {
    let url = "/clinician/emergencies?radius_km=50";
    if (activeClinicianLat !== null && activeClinicianLon !== null) {
      url += `&latitude=${activeClinicianLat}&longitude=${activeClinicianLon}`;
    }
    
    const alerts = await apiCall(url);
    
    if (!alerts || alerts.length === 0) {
      queue.innerHTML = `<p class="empty-state" style="color: var(--text-muted);">No active patient SOS alerts within your 50 km facility radius. Monitoring active signals...</p>`;
      return;
    }
    
    queue.innerHTML = "";
    alerts.forEach(alert => {
      const card = document.createElement("div");
      card.className = "escalation-card";
      card.style.border = "1px solid rgba(239, 68, 68, 0.4)";
      card.style.background = "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(255,255,255,0) 100%)";
      card.style.padding = "1rem";
      card.style.borderRadius = "8px";
      card.style.marginBottom = "0.8rem";
      
      const distance = alert.distance_km !== null ? `${alert.distance_km.toFixed(2)} km away` : "Nearby";
      
      card.innerHTML = `
        <div class="escal-meta" style="color: #ff5252; font-weight: 700; display: flex; justify-content: space-between; font-size: 0.85rem;">
          <span>🚨 IMMEDIATE PATIENT SOS</span>
          <span style="background: rgba(239,68,68,0.15); padding: 2px 8px; border-radius: 4px; color: #ff6b6b;">${distance}</span>
        </div>
        <div class="escal-reason" style="font-size: 1rem; font-weight: 700; margin: 0.4rem 0; color: #fff;">Patient: ${escapeHTML(alert.patient_email)}</div>
        <div class="escal-details" style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
          <div>GPS Target: <strong>${alert.latitude.toFixed(5)}, ${alert.longitude.toFixed(5)}</strong></div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">Beacon Time: ${new Date(alert.created_at).toLocaleTimeString()}</div>
        </div>
        <div class="escal-actions" style="margin-top: 0.8rem;">
          <button type="button" class="btn-primary full-width" style="background: #ef4444; border-color: #ef4444; font-weight: 700;" onclick="handleAcceptSos('${alert.id}')">
            🚨 Accept SOS & Send Ambulance
          </button>
        </div>
      `;
      queue.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to fetch emergencies:", err);
    queue.innerHTML = `<div class="alert alert-danger" style="font-size: 0.8rem;">Failed to retrieve alerts: ${escapeHTML(err.message)}</div>`;
  }
}

window.handleAcceptSos = async function(id) {
  const payload = {};
  if (activeClinicianHospital && activeClinicianPhone) {
    payload.hospital_name = activeClinicianHospital;
    payload.phone = activeClinicianPhone;
  }
  
  if (!confirm("Confirm dispatching emergency response unit for this patient? This will accept the alert and notify the patient immediately.")) {
    return;
  }
  
  try {
    await apiCall(`/clinician/emergencies/${id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    alert("Emergency SOS Accepted! Dispatch logged and patient notified.");
    fetchClinicianEmergencies();
  } catch (err) {
    alert(`Failed to accept emergency alert: ${err.message}`);
  }
};

