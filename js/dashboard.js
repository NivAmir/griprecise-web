/**
 * dashboard.js
 * PURPOSE: Manages gripper control, AI material recognition, and data visualization.
 */




// ==========================================
// SECTION 1: IMPORTS
// ==========================================

/** Firebase services and database operations. */
import {
    auth, database,
    signOut, onAuthStateChanged,
    ref, set, get, child, update, onValue
} from "./firebase.js";








// ==========================================
// SECTION 2: GLOBAL CONSTANTS & STATE
// ==========================================

/** Teachable Machine model instance. */
let aiModel;

/** Chart.js instance for pressure data. */
let pressureChart;

/** Local IP for ESP32-CAM stream. */
window.CAMERA_IP = "172.20.10.8";

/** * Stores the most recent material identified by the AI model.
 * Defaults to "None" until a successful classification occurs.
 */
let currentAiMaterial = "None";




// ==========================================
// SECTION 3: CORE UTILITY FUNCTIONS
// ==========================================



/** * Calculates Firebase value (192-255) based on material type and AI probability.
 */
function calculateLedValue(material, probability) {
    const mapping = { "Glass": 192, "Plastic": 208, "Wood": 224, "Metal": 240 };
    const baseValue = mapping[material];
    if (baseValue === undefined) return null;

    const normalized = (probability - 0.51) / (1.0 - 0.51);
    const offset = Math.floor(normalized * 15);
    return baseValue + offset;
}




/** * Updates the progress bars and percentage text for all material categories.
 */
function updateConfidenceUI(predictions) {
    predictions.forEach(prediction => {
        const label = prediction.className.toLowerCase();
        const percentage = (prediction.probability * 100).toFixed(1) + "%";

        const confSpan = document.getElementById(`conf-${label}`);
        confSpan.innerText = percentage;

        const bar = document.getElementById(`bar-${label}`);
        bar.style.width = percentage;
    });
}





/** * Fetches material pressure limits from Firebase and updates the UI status bubble.
 */
async function updateMaterialStatusUI(aiDetectedMaterial = null) {
    const materialSelect = document.getElementById('materialSelect');
    const isAuto = (materialSelect.value === "auto");
    const user = auth.currentUser;

    if (!user) return;


    if (aiDetectedMaterial) currentAiMaterial = aiDetectedMaterial;


    let activeMaterial = isAuto ? currentAiMaterial : materialSelect.value;

    const invalidStates = ["None", "Uncertain", "Waiting...", ""];
    if (!activeMaterial || invalidStates.includes(activeMaterial)) {
        document.getElementById('displayMaxPressure').innerText = "---";
        document.getElementById('displaySource').innerText = "(Waiting for AI...)";
        return;
    }

    try {
        const materialKey = activeMaterial.toLowerCase().trim();
        const snapshot = await get(ref(database, `users/${user.uid}/materials/${materialKey}`));

        if (snapshot.exists()) {
            document.getElementById('displayMaxPressure').innerText = snapshot.val();
            document.getElementById('displaySource').innerText = isAuto ? `(AI: ${activeMaterial})` : `(Manual: ${activeMaterial})`;
        } else {
            document.getElementById('displayMaxPressure').innerText = "255"; // ברירת מחדל
            document.getElementById('displaySource').innerText = `(${activeMaterial} - No Limit)`;
        }
    } catch (err) {
        console.error("Firebase fetch error:", err);
    }
}





/** * Updates the user's role badge color and text based on experience and account type.
 */
function updateRoleBadge(experience, accountType) {
    const badge = document.getElementById("userRoleBadge");
    badge.className = "badge fs-6";

    if (accountType === "admin") {
        badge.textContent = "Admin";
        badge.classList.add("bg-danger", "text-white");
        return;
    }

    badge.textContent = experience || "User";
    const colors = {
        beginner: ["bg-warning", "text-dark"],
        intermediate: ["bg-info", "text-dark"],
        expert: ["bg-success", "text-white"]
    };

    const currentStyle = colors[experience] || ["bg-secondary", "text-white"];
    badge.classList.add(...currentStyle);
}











// ==========================================
// SECTION 4: INITIALIZATION FUNCTIONS
// ==========================================
/** * Initializes the ESP32-CAM stream, loads the AI model, and handles identification logic.
 */
async function initCameraAI() {
    const modelURL = "https://teachablemachine.withgoogle.com/models/3GNtLCLw7/";
    const privacyIcon = "https://img.icons8.com/ios-filled/100/000000/no-video.png";

    const cameraFrame = document.getElementById('cameraFrame');
    const cameraStatus = document.getElementById('cameraStatus');
    const btnIdentify = document.getElementById('btnIdentify');
    const startBtn = document.getElementById('startCameraBtn');
    const stopBtn = document.getElementById('stopCameraBtn');
    const aiResultDiv = document.getElementById('aiResult');

    let isAnalyzing = false;

    // --- 1. הפעלת המצלמה ---
    startBtn.addEventListener('click', () => {
        isAnalyzing = false;
        cameraFrame.src = "";
        cameraFrame.style.width = "100%";

        cameraStatus.innerText = "Connecting...";
        cameraStatus.className = "text-warning fw-bold";

        cameraFrame.crossOrigin = "anonymous";
        cameraFrame.src = `http://${window.CAMERA_IP}:81/stream`;
    });

    // --- עצירת המצלמה ---
    stopBtn.addEventListener('click', () => {
        isAnalyzing = false;
        cameraFrame.src = privacyIcon;

        // איפוס הברים של ה-AI
        updateConfidenceUI([
            { className: "Metal", probability: 0 },
            { className: "Plastic", probability: 0 },
            { className: "Wood", probability: 0 },
            { className: "Glass", probability: 0 }
        ]);
    });

    // --- ניהול אירועי טעינה של ה-Image ---
    cameraFrame.onload = () => {
        if (isAnalyzing) return;

        if (cameraFrame.src.includes("no-video.png")) {
            cameraFrame.style.width = "30%";
            cameraStatus.innerText = "Disconnected";
            cameraStatus.className = "text-danger fw-bold";
        } else {
            cameraFrame.style.width = "100%";
            cameraStatus.innerText = "Live";
            cameraStatus.className = "text-success fw-bold";
        }
    };

    cameraFrame.onerror = () => {
        if (isAnalyzing) return;
        cameraStatus.innerText = "Error (Check IP/CORS)";
        cameraStatus.className = "text-danger fw-bold";
    };


    try {
        aiModel = await tmImage.load(modelURL + "model.json", modelURL + "metadata.json");
    } catch (e) {
        console.error("AI Model failed to load", e);
    }


    btnIdentify.addEventListener('click', async () => {
        if (!aiModel) return alert("AI Model is still loading...");
        if (cameraFrame.src.includes("no-video.png") || !cameraFrame.src) {
            return alert("Please start the camera before initiating detection.");
        }

        const originalText = btnIdentify.innerHTML;
        btnIdentify.disabled = true;
        btnIdentify.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...`;

        isAnalyzing = true;
        cameraStatus.innerText = "AI Analyzing...";
        cameraStatus.className = "text-primary fw-bold";

        try {
            const predictions = await aiModel.predict(cameraFrame);
            updateConfidenceUI(predictions);

            const top = predictions.reduce((prev, curr) => (prev.probability > curr.probability) ? prev : curr);

            if (aiResultDiv) aiResultDiv.classList.remove('d-none');

            if (top.probability >= 0.51) {

                await updateMaterialStatusUI(top.className);
                const valToSend = calculateLedValue(top.className, top.probability);

                if (valToSend !== null) {
                    set(ref(database, 'toAltera'), valToSend);
                }
            } else {
                cameraStatus.innerText = "Low Confidence (<51%)";
                cameraStatus.className = "text-warning fw-bold";
            }
        } catch (err) {
            console.error("Identification Error:", err);
            isAnalyzing = false;
        } finally {
            setTimeout(() => {
                isAnalyzing = false;
                btnIdentify.disabled = false;
                btnIdentify.innerHTML = originalText;
                cameraFrame.onload();
            }, 4000);
        }
    });
}







/** * Initializes Chart.js for pressure tracking and sets up real-time Firebase listeners for sensors.
 */
function initExpertPanel() {
    const canvas = document.getElementById('pressureChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    pressureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Left Pressure',
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                    data: [],
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Right Pressure',
                    borderColor: '#212529',
                    backgroundColor: 'rgba(33, 37, 41, 0.1)',
                    data: [],
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: { beginAtZero: true, suggestedMax: 255 },
                x: { display: false }
            }
        }
    });

    let lastLeft = 0;
    let lastRight = 0;


    const performPhysicsAnalysis = (l, r) => {
        const total = l + r;
        document.getElementById('totalForceVal').textContent = total;

        const symmetryBar = document.getElementById('symmetryBar');
        const symmetryStatus = document.getElementById('symmetryStatus');

        if (total > 0) {
            const leftPercent = (l / total) * 100;
            symmetryBar.style.width = `${leftPercent}%`;

            if (leftPercent > 70) {
                symmetryBar.className = "progress-bar bg-danger";
                symmetryStatus.textContent = "Unstable - Left Bias";
            } else if (leftPercent < 30) {
                symmetryBar.className = "progress-bar bg-danger";
                symmetryStatus.textContent = "Unstable - Right Bias";
            } else {
                symmetryBar.className = "progress-bar bg-success";
                symmetryStatus.textContent = "Optimal Grip";
            }
        } else {
            symmetryStatus.textContent = "No Pressure";
            symmetryBar.style.width = "50%";
        }


        const hardnessEl = document.getElementById('hardnessLevel');
        if (total > 100) hardnessEl.textContent = "Hard / Solid";
        else if (total > 30) hardnessEl.textContent = "Soft / Elastic";
        else if (total > 5) hardnessEl.textContent = "Contact Established";
        else hardnessEl.textContent = "No Object";
    };
    const updateChartData = (l, r) => {
        if (!pressureChart) return;
        const d = new Date();
        const now = [d.getHours(), d.getMinutes(), d.getSeconds()]
            .map(v => v < 10 ? '0' + v : v)
            .join(':');

        pressureChart.data.labels.push(now);
        pressureChart.data.datasets[0].data.push(l);
        pressureChart.data.datasets[1].data.push(r);

        if (pressureChart.data.labels.length > 25) {
            pressureChart.data.labels.shift();
            pressureChart.data.datasets[0].data.shift();
            pressureChart.data.datasets[1].data.shift();
        }
        pressureChart.update();
        performPhysicsAnalysis(l, r);
    };

    document.getElementById('btnExport').addEventListener('click', () => {
        if (pressureChart.data.labels.length === 0) return alert("No data to export!");

        let csvContent = "Time,Left Pressure,Right Pressure\n";
        pressureChart.data.labels.forEach((label, index) => {
            csvContent += `${label},${pressureChart.data.datasets[0].data[index] || 0},${pressureChart.data.datasets[1].data[index] || 0}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `experiment_data_${Date.now()}.csv`;
        link.click();
    });

    onValue(ref(database, 'fromAltera/B'), (snapshot) => {
        lastLeft = snapshot.val() || 0;
        document.getElementById('leftPressureValue').textContent = lastLeft;
        updateChartData(lastLeft, lastRight);
    });

    onValue(ref(database, 'fromAltera/C'), (snapshot) => {
        lastRight = snapshot.val() || 0;
        document.getElementById('rightPressureValue').textContent = lastRight;
        updateChartData(lastLeft, lastRight);
    });
}







/** * Configures the notes section, toggling visibility and handling save operations for Admin/User.
 */
function setupNotes(currentUserData) {
    const adminNotesEl = document.getElementById("adminNotesTextarea");
    const userNotesEl = document.getElementById("userNotesTextarea");

    if (adminNotesEl) adminNotesEl.value = currentUserData?.notes || "";
    if (userNotesEl) userNotesEl.value = currentUserData?.notes || "";

    // Save buttons
    document.getElementById("saveAdminNotesBtn")?.addEventListener("click", async () => {
        if (!currentUserData) return;
        const newNotes = adminNotesEl.value;
        try { await update(ref(database, 'users/' + auth.currentUser.uid), { notes: newNotes }); alert("Admin notes saved!"); }
        catch (err) { console.error(err); alert("Failed to save notes."); }
    });

    document.getElementById("saveUserNotesBtn")?.addEventListener("click", async () => {
        if (!currentUserData) return;
        const newNotes = userNotesEl.value;
        try { await update(ref(database, 'users/' + auth.currentUser.uid), { notes: newNotes }); alert("Notes saved!"); }
        catch (err) { console.error(err); alert("Failed to save notes."); }
    });

    if (currentUserData.accountType === "admin") {
        const userSection = document.getElementById("userNotesSection");
        userSection?.classList.add("d-none"); // מסתיר את כל החלק של המשתמש
    }


}






/** * Sets up the admin user management table, including role promotion and demotion logic.
 */

function setupRoleManagement() {
    const promoteBtn = document.getElementById("promoteBtn");
    const demoteBtn = document.getElementById("demoteBtn");
    const emailInput = document.getElementById("adminEmailInput");

    const rolesOrder = ["beginner", "intermediate", "expert"]; // סדר הדרגות

    async function changeRole(isPromote) {
        const email = emailInput.value.trim();
        if (!email) { alert("Please enter an email."); return; }

        const dbRef = ref(database);

        try {
            const snapshot = await get(child(dbRef, 'users'));
            if (!snapshot.exists()) { alert("No users found."); return; }

            let targetUid = null;
            let currentExp = null;
            let targetAccountType = null;

            snapshot.forEach((childSnap) => {
                const userData = childSnap.val();
                if (userData.email === email) {
                    targetUid = childSnap.key;
                    currentExp = userData.experience || "beginner";
                    targetAccountType = userData.accountType || "regular";
                }
            });

            if (!targetUid) { alert("User not found."); return; }

            // בדיקה: אם זה מנהל אחר → אסור לשנות
            if (targetAccountType === "admin" && targetUid !== auth.currentUser.uid) {
                alert("Cannot change another admin's role!");
                return;
            }

            let idx = rolesOrder.indexOf(currentExp);
            if (idx === -1) idx = 0;

            let newExp = currentExp;
            if (isPromote && idx < rolesOrder.length - 1) newExp = rolesOrder[idx + 1];
            if (!isPromote && idx > 0) newExp = rolesOrder[idx - 1];

            if (newExp === currentExp) {
                alert("Cannot change role further in this direction.");
                return;
            }

            await update(ref(database, 'users/' + targetUid), { experience: newExp });
            alert(`User ${email} is now ${newExp}`);

            // רענון אוטומטי
            loadUsersTable();

        } catch (err) {
            console.error(err);
            alert("Failed to update role.");
        }
    }


    promoteBtn?.addEventListener("click", () => changeRole(true));
    demoteBtn?.addEventListener("click", () => changeRole(false));

    // טען את הטבלה בהפעלה
    loadUsersTable();


    function loadUsersTable() {
        const tableBody = document.getElementById("adminUserTable");
        if (!tableBody) return;

        tableBody.innerHTML = ""; // נקע לפני טעינה

        const usersRef = ref(database, "users");

        get(usersRef)
            .then(snapshot => {
                if (!snapshot.exists()) {
                    tableBody.innerHTML = `<tr><td colspan="3">No users found</td></tr>`;
                    return;
                }

                const users = snapshot.val();

                Object.keys(users).forEach(uid => {
                    const u = users[uid];

                    const tr = document.createElement("tr");

                    tr.innerHTML = `
            <td>${u.email || "Unknown"}</td>
            <td>${u.experience || "beginner"}</td>
            <td>${u.accountType || "regular"}</td>
          `;

                    tableBody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error("Error loading users:", err);
                tableBody.innerHTML = `<tr><td colspan="3">Failed to load users</td></tr>`;
            });
    }
}




/** * Dynamically shows/hides dashboard sections based on the user's experience level and role.
 */
function updateDashboardSections(experience, accountType) {
    const levels = ["beginner", "intermediate", "expert"];

    // 1. Hide everything first
    levels.forEach(lvl => {
        document.getElementById(`${lvl}Section`).classList.add("d-none");
        document.getElementById(`hr${lvl.charAt(0).toUpperCase() + lvl.slice(1)}`)?.classList.add("d-none");
    });
    document.getElementById("adminSection").classList.add("d-none");
    document.getElementById("hrAdmin")?.classList.add("d-none");

    // 2. Show sections based on experience hierarchy
    const currentIdx = levels.indexOf(experience);
    if (currentIdx !== -1) {
        for (let i = 0; i <= currentIdx; i++) {
            const lvl = levels[i];
            document.getElementById(`${lvl}Section`).classList.remove("d-none");
            document.getElementById(`hr${lvl.charAt(0).toUpperCase() + lvl.slice(1)}`)?.classList.remove("d-none");
        }
    }

    // 3. Admin logic
    if (accountType === "admin") {
        document.getElementById("adminSection").classList.remove("d-none");
        document.getElementById("hrAdmin")?.classList.remove("d-none");
    }
}





/**
 * Fetches user-defined materials from Firebase and builds the UI sliders and dropdown options.
 * This function also attaches real-time listeners to the sliders to update pressure limits.
 */
function setupUserMaterials() {
    const user = auth.currentUser;
    const materialSelect = document.getElementById('materialSelect');
    const container = document.getElementById('materialSettingsContainer');
    const applyBtn = document.getElementById('applyMaterial');

    if (!user || !materialSelect) return;

    const userMaterialsRef = ref(database, `users/${user.uid}/materials`);

    get(userMaterialsRef).then((snapshot) => {
        const materialsObj = snapshot.val() || {};

        // Filter out the 'automatic' key to handle only custom materials
        const userMaterials = Object.keys(materialsObj).filter(m => m.toLowerCase() !== "automatic");

        // 1. Rebuild Material Select Dropdown
        materialSelect.innerHTML = `<option value="auto">Automatic (AI Detection)</option>`;

        if (userMaterials.length === 0) {
            materialSelect.disabled = true;
            if (applyBtn) applyBtn.disabled = true;
            if (container) container.innerHTML = "";
            return;
        }

        materialSelect.disabled = false;
        if (applyBtn) applyBtn.disabled = false;

        userMaterials.forEach(materialName => {
            const opt = document.createElement("option");
            opt.value = materialName;
            opt.textContent = materialName;
            materialSelect.appendChild(opt);
        });

        // 2. Dynamically Generate Pressure Sliders
        if (container) {
            container.innerHTML = ""; // Clear existing sliders
            userMaterials.forEach(materialName => {
                const initialVal = materialsObj[materialName] ?? 128;

                const sliderDiv = document.createElement("div");
                sliderDiv.className = "mb-3 p-2 border-bottom";
                sliderDiv.innerHTML = `
                    <label class="form-label d-flex justify-content-between">
                        ${materialName} pressure limit: <strong id="value-${materialName}">${initialVal}</strong>
                    </label>
                    <input type="range" class="form-range" min="0" max="255" value="${initialVal}" id="slider-${materialName}">
                `;
                container.appendChild(sliderDiv);

                // Add real-time update listener for each slider
                document.getElementById(`slider-${materialName}`).addEventListener("input", (e) => {
                    const newVal = Number(e.target.value);
                    document.getElementById(`value-${materialName}`).textContent = newVal;
                    update(userMaterialsRef, { [materialName]: newVal });
                });
            });
        }
    }).catch(err => console.error("Error loading user materials:", err));
}












/**
 * The main controller: initializes all dashboard buttons, movement logic, and sensor listeners.
 */
function initDashboardControls() {
    // 1. Initialize Sub-Modules
    initExpertPanel();
    initCameraAI();
    setupUserMaterials(); // The function we just created

    const toAlteraRef = ref(database, 'toAltera');
    const materialSelect = document.getElementById('materialSelect');

    // Helper: Send value to Gripper
    const sendToGripper = (val) => set(toAlteraRef, val);

    // Helper: Get Current Gripper State
    const getGripperState = async () => Number((await get(toAlteraRef)).val() ?? 0);

    // ==========================================
    // A. MOVEMENT CONTROL (128-137)
    // ==========================================
    const moveMapping = {
        'moveForward': { slow: 130, fast: 131 },
        'moveBackward': { slow: 136, fast: 137 },
        'moveLeft': { slow: 134, fast: 135 },
        'moveRight': { slow: 132, fast: 133 }
    };

    Object.entries(moveMapping).forEach(([id, speeds]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const speed = document.querySelector("input[name='speed']:checked")?.value || "slow";
                sendToGripper(speeds[speed]);
            });
        }
    });

    document.getElementById('moveStop')?.addEventListener('click', () => sendToGripper(128));

    // ==========================================
    // B. GRIPPER & LIFT CONTROL
    // ==========================================

    // --- Close Gripper (With Safety Logic) ---
    document.getElementById('btnClose')?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;

        // 1. Distance Check
        const distSnap = await get(ref(database, 'fromAltera/A'));
        if (Number(distSnap.val() ?? 0) > 100) return alert("Object out of range!");

        // 2. Material & Pressure Check
        const isAuto = (document.getElementById('materialSelect').value === "auto");

        const activeMaterial = isAuto ? currentAiMaterial : document.getElementById('materialSelect').value;

        const invalidStates = ["None", "Uncertain", "Waiting...", ""];
        if (!activeMaterial || invalidStates.includes(activeMaterial)) {
            return alert("Wait for AI or select material manually.");
        }

        const maxAllowedSnap = await get(ref(database, `users/${user.uid}/materials/${activeMaterial.toLowerCase().trim()}`));
        const maxAllowed = Number(maxAllowedSnap.val() ?? 255);

        const leftP = Number((await get(ref(database, 'fromAltera/B'))).val() ?? 0);
        const rightP = Number((await get(ref(database, 'fromAltera/C'))).val() ?? 0);

        if (Math.max(leftP, rightP) >= maxAllowed) {
            sendToGripper(16);
            alert(`Limit reached for ${activeMaterial}!`);
            return;
        }

        // 3. Execution
        let val = await getGripperState();
        if (val > 15) val = 0;
        val < 15 ? sendToGripper(val + 1) : alert("Fully closed!");
        updateMaterialStatusUI();
    });

    // --- Open Gripper ---
    document.getElementById('btnOpen')?.addEventListener('click', async () => {
        let val = await getGripperState();
        if (val > 15) val = 1;
        val > 0 ? sendToGripper(val - 1) : alert("Fully opened!");
    });

    // --- Lift Control ---
    document.getElementById('btnLift')?.addEventListener('click', async () => {
        let val = await getGripperState();
        if (val < 64 || val > 79) val = 65;
        val > 64 ? sendToGripper(val - 1) : alert("Maximum height reached!");
    });

    document.getElementById('btnLower')?.addEventListener('click', async () => {
        let val = await getGripperState();
        if (val < 64 || val > 79) val = 64;
        val < 79 ? sendToGripper(val + 1) : alert("Minimum height reached!");
    });

    // ==========================================
    // C. UI UPDATES & SENSORS
    // ==========================================
    document.getElementById('applyMaterial')?.addEventListener('click', () => updateMaterialStatusUI());

    // Real-time Distance Warning
    onValue(ref(database, 'fromAltera/A'), (snap) => {
        const dist = snap.val();
        document.getElementById('distanceValue').textContent = dist ?? "–";
        document.getElementById('distanceWarning')?.classList.toggle('d-none', dist <= 100);
    });
}






// ==========================================
// SECTION 5: AUTH & MAIN EXECUTION
// ==========================================



/** * Handles UI changes and displays user info if logged in.
 */
function updatePageForAuth(user) {
    const emailNameDisplay = document.getElementById("emailName");
    if (user && emailNameDisplay) {
        emailNameDisplay.textContent = user.email ? user.email.split("@")[0] : user.uid;
    }
}





/** * Signs out the user and redirects to the login page.
 */
async function handleLogout(e) {
    if (e) e.preventDefault();
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (err) {
        console.error("Logout error:", err);
    }
}



/** * Main DOM Entry Point. Runs immediately when the page structure is ready. */
document.addEventListener("DOMContentLoaded", () => {
    // כפתור התנתקות - תמיד פעיל
    const logoutBtn = document.getElementById("dashboardLogoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    onAuthStateChanged(auth, (user) => {
        updatePageForAuth(user);

        if (user) {
            get(child(ref(database), 'users/' + user.uid)).then(snapshot => {
                if (!snapshot.exists()) return;
                const data = snapshot.val();

                updateDashboardSections(data.experience, data.accountType);
                updateRoleBadge(data.experience, data.accountType);
                setupNotes(data);

                if (data.accountType === "admin") setupRoleManagement();

                // הפעלת בקרת הרובוט והחומרים
                if (typeof initDashboardControls === "function") initDashboardControls();
            });
        } else {
            window.location.href = "login.html";
        }
    });

});
