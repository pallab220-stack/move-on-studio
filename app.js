/* -------------------------------------------------------------
 * AETHER WORKSPACE - FIREBASE INTERACTIVE INTERFACE LOGIC
 * ------------------------------------------------------------- */

// Import Firebase Web SDK Modules (Version 10 modular format) from gstatic CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

/* =============================================================
 * 📌 INSERT YOUR FIREBASE CONFIG SNIPPET HERE:
 * ============================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyDZGtN7ACxYFrQJYvuB_xazbcnv7bg6InA",
  authDomain: "move-on-data.firebaseapp.com",
  projectId: "move-on-data",
  storageBucket: "move-on-data.firebasestorage.app",
  messagingSenderId: "529534749232",
  appId: "1:529534749232:web:cc90c3c11627cde6c2bbf5",
  measurementId: "G-CERYX601WB"
};
/* ============================================================= */

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// Application State
let tasks = [];
let currentUser = null;
let activeFilter = 'all';
let searchQuery = '';
let activeTab = 'my-workspace'; // 'my-workspace', 'team-workload', 'monthly-analytics'

// DOM Elements
const taskGridContainer = document.getElementById('task-grid-container');
const pendingBadgeCount = document.getElementById('pending-badge-count');
const statsPendingCount = document.getElementById('stats-pending-count');
const statsCompletedCount = document.getElementById('stats-completed-count');
const statsVelocityValue = document.getElementById('stats-velocity-value');
const filteredCountEl = document.getElementById('filtered-count');

const pendingProgressBar = document.getElementById('pending-progress');
const completedProgressBar = document.getElementById('completed-progress');

const roleSelect = document.getElementById('role-select');
const userAvatarEl = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name');
const userRoleLabel = document.getElementById('user-role-label');
const greetingTitle = document.getElementById('greeting-title');

const adminTaskFormContainer = document.getElementById('admin-task-form-container');
const btnNewTaskShortcut = document.getElementById('btn-new-task-shortcut');
const btnCancelForm = document.getElementById('btn-cancel-form');
const addTaskForm = document.getElementById('add-task-form');

const loginModal = document.getElementById('login-modal');
const btnTriggerLogin = document.getElementById('btn-trigger-login');
const btnCloseModal = document.getElementById('btn-close-modal');
const authForm = document.getElementById('auth-form');
const signupExtraFields = document.getElementById('signup-extra-fields');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const btnAuthSubmit = document.getElementById('btn-auth-submit');

const searchInput = document.getElementById('search-input');
const navMyWorkspace = document.getElementById('nav-my-workspace');
const navTeamWorkload = document.getElementById('nav-team-workload');
const navMonthlyAnalytics = document.getElementById('nav-monthly-analytics');
const navAdmin = document.getElementById('nav-admin');

// 3. SYSTEM CLOCK SETUP
function updateClock() {
  const clockEl = document.getElementById('live-time');
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  clockEl.textContent = `SYS_TIME: ${hours}:${minutes}:${seconds} // REGION_06`;
}
setInterval(updateClock, 1000);
updateClock();

// 4. FIREBASE AUTHENTICATION METHODS

// A. User Signup (Email & Password)
async function registerNewAgent(email, password, displayName) {
  try {
    const inviteCodeInput = document.getElementById('invite-code');
    const inviteCode = inviteCodeInput ? inviteCodeInput.value.trim() : '';

    if (inviteCode !== "MOVEON2026") {
      const errorMsg = "Access Denied: Invalid Agency Code";
      alert(errorMsg);
      throw new Error(errorMsg);
    }

    // Enforces actual Firebase Auth method for signup
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Automatically create a document in the Firestore 'users' collection with default role
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      name: displayName || "New Editor Node",
      role: "user"
    });
    console.log("registerNewAgent: Firestore document node successfully created for uid:", user.uid);
    await fetchUsersAndPopulateDropdown();
  } catch (error) {
    console.error("registerNewAgent Error:", error.message);
    alert(`Registration Error: ${error.message}`);
  }
}

// B. User Login
async function authenticateAgent(email, password) {
  try {
    // Enforces actual Firebase Auth method for login
    await signInWithEmailAndPassword(auth, email, password);
    console.log("authenticateAgent: Credentials validated successfully.");
  } catch (error) {
    console.error("authenticateAgent Error:", error.message);
    alert(`Login Error: ${error.message}`);
  }
}

// C. User Logout
async function deauthenticateAgent() {
  try {
    await signOut(auth);
    console.log("deauthenticateAgent: Session terminated successfully.");
  } catch (error) {
    console.error("deauthenticateAgent Error:", error.message);
  }
}

// D. Check User Role (Runs immediately after login)
async function checkUserRole(uid) {
  let role = 'user';
  let name = 'Agent Node';

  try {
    // Fetch corresponding user document from Firestore 'users' collection
    const userDocRef = doc(db, "users", uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      role = userData.role || 'user';
      name = userData.name || 'Agent';
    }
  } catch (error) {
    console.error("checkUserRole Firestore retrieval error:", error.message);
  }

  // Update current session data
  currentUser.role = role;
  currentUser.name = name;
  currentUser.avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Sync profile UI
  userAvatarEl.textContent = currentUser.avatar;
  userNameEl.textContent = currentUser.name;
  userRoleLabel.textContent = role === 'admin' ? 'Administrator' : 'Team Member';
  roleSelect.value = role;

  // Unhide or hide HTML Add Task Form based on role privileges
  if (role === 'admin') {
    greetingTitle.textContent = `Welcome back, Administrator`;
    adminTaskFormContainer.style.display = 'block';
    btnNewTaskShortcut.style.display = 'inline-flex';
    document.querySelector('.lock-indicator').style.display = 'none';
    navAdmin.classList.remove('restricted');
    if (navMonthlyAnalytics) navMonthlyAnalytics.style.display = 'inline-flex';
  } else {
    greetingTitle.textContent = `Welcome back, Operator`;
    adminTaskFormContainer.style.display = 'none';
    btnNewTaskShortcut.style.display = 'none';
    document.querySelector('.lock-indicator').style.display = 'flex';
    navAdmin.classList.add('restricted');
    if (navMonthlyAnalytics) navMonthlyAnalytics.style.display = 'none';
    if (activeTab === 'monthly-analytics') {
      switchTab('my-workspace');
    }
  }

  renderTaskGrid();
  updateDashboardStats(tasks);
}

// E. Live Auth Observer (Tied to real Firebase Authentication State)
onAuthStateChanged(auth, async (user) => {
  const appLayout = document.querySelector('.app-layout');
  const gatewayScreen = document.getElementById('branch-gateway');

  if (user) {
    console.log("AuthObserver: Session validated for uid:", user.uid);
    currentUser = {
      uid: user.uid,
      email: user.email
    };

    // Runs immediately after login
    await checkUserRole(user.uid);
    await fetchUsersAndPopulateDropdown();
    await requestNotificationPermission();
    closeModal();

    // Determine gateway vs dashboard transition
    const urlParams = new URLSearchParams(window.location.search);
    let activeBranch = urlParams.get('branch');
    if (activeBranch !== 'jadukor' && activeBranch !== 'moveon') {
      activeBranch = sessionStorage.getItem('selectedBranch');
    }

    if (activeBranch) {
      // Direct to Dashboard State
      if (gatewayScreen) {
        gatewayScreen.classList.add('hidden');
      }
      if (appLayout) {
        appLayout.classList.remove('hidden');
      }
      applyBranchSettings(activeBranch);

      // On initial load, activate the correct tab
      const tabParam = urlParams.get('tab') || 'my-workspace';
      switchTab(tabParam, false);
    } else {
      // Post-Login Gateway State
      if (gatewayScreen) {
        gatewayScreen.classList.remove('hidden');
        gatewayScreen.classList.remove('fade-out');
      }
      if (appLayout) {
        appLayout.classList.add('hidden');
      }
    }
  } else {
    console.log("AuthObserver: Session cleared.");
    currentUser = null;
    sessionStorage.removeItem('selectedBranch'); // Clear selected branch on logout

    // Clean URL parameter
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);

    // Hide both gateway and dashboard
    if (gatewayScreen) {
      gatewayScreen.classList.add('hidden');
    }
    if (appLayout) {
      appLayout.classList.add('hidden');
    }

    updateUIElements();
    renderTaskGrid();
    updateDashboardStats(tasks);
    openModal();
  }
});

// UI Reset on session signout
function updateUIElements() {
  userAvatarEl.textContent = "??";
  userNameEl.textContent = "Guest Agent";
  userRoleLabel.textContent = "Unauthorized";
  roleSelect.value = "user";
  roleSelect.disabled = true;

  greetingTitle.textContent = `Access Restricted`;
  adminTaskFormContainer.style.display = 'none';
  btnNewTaskShortcut.style.display = 'none';
  document.querySelector('.lock-indicator').style.display = 'flex';
  navAdmin.classList.add('restricted');
  if (navMonthlyAnalytics) navMonthlyAnalytics.style.display = 'none';
  if (activeTab === 'monthly-analytics') {
    switchTab('my-workspace');
  }

  btnTriggerLogin.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
    Account Login
  `;
}

// 5. FIRESTORE REAL-TIME TASK ACTIONS

// A. addTask(title, description, deadline, assignedTo)
async function addTask(title, description, deadline, assignedTo, priority = 'medium', tags = 'General', extraData = null) {
  try {
    const activeBranch = sessionStorage.getItem('selectedBranch') || 'moveon';
    const taskDoc = {
      title,
      description,
      date: deadline,
      assignee: assignedTo,
      priority,
      tags,
      status: 'pending',
      completed: false,
      progressUpdates: [],
      branch: activeBranch,
      createdAt: new Date().toISOString()
    };

    if (extraData) {
      taskDoc.extraData = extraData;
      if (extraData.category === 'shooting') {
        taskDoc.photographer = extraData.photographer || '';
        taskDoc.cinematographer = extraData.cinematographer || '';
      }
    }

    await addDoc(collection(db, "tasks"), taskDoc);
    console.log("addTask: Successfully deployed to Firestore.");

    // Fetch assignee's FCM token from 'users' collection (check both name and email matching)
    const usersRef = collection(db, "users");
    const nameQuery = query(usersRef, where("name", "==", assignedTo));
    const emailQuery = query(usersRef, where("email", "==", assignedTo));

    const [nameSnapshot, emailSnapshot] = await Promise.all([
      getDocs(nameQuery),
      getDocs(emailQuery)
    ]);

    let assigneeToken = null;
    nameSnapshot.forEach((docSnap) => {
      if (docSnap.data().fcmToken) assigneeToken = docSnap.data().fcmToken;
    });

    if (!assigneeToken) {
      emailSnapshot.forEach((docSnap) => {
        if (docSnap.data().fcmToken) assigneeToken = docSnap.data().fcmToken;
      });
    }

    if (assigneeToken) {
      await sendFCMNotification(assigneeToken, title, description);
    } else {
      console.log(`No FCM token found for assignee: ${assignedTo}`);
    }
  } catch (error) {
    console.error("addTask error:", error.message);
    alert(`Failed to add task: ${error.message}`);
  }
}

// B. loadTasks() (Real-time snapshot listener)
let unsubscribeTasks = null;
function loadTasks() {
  if (unsubscribeTasks) unsubscribeTasks();

  const activeBranch = sessionStorage.getItem('selectedBranch');
  if (!activeBranch) {
    console.log("loadTasks: No branch selected. Subscription suspended.");
    return;
  }

  const tasksQuery = query(collection(db, "tasks"), where("branch", "==", activeBranch));
  unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
    tasks = [];
    snapshot.forEach(docSnap => {
      tasks.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort tasks by creation date
    tasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (activeTab === 'my-workspace') {
      renderTaskGrid();
      updateDashboardStats(tasks);
    } else if (activeTab === 'team-workload') {
      renderTeamWorkload();
    } else if (activeTab === 'monthly-analytics') {
      renderMonthlyAnalytics();
    }
    console.log(`loadTasks: Grid synced with Firestore in real-time for branch: ${activeBranch}.`);
  }, (error) => {
    console.error("loadTasks Snapshot Error:", error.message);
  });
}

// C. submitDailyProgress(taskId, text)
async function submitDailyProgress(taskId, text) {
  if (!text.trim()) return;

  const newUpdate = {
    text: text.trim(),
    timestamp: new Date().toISOString(),
    editorName: currentUser ? currentUser.name : 'Unknown Editor',
    status: 'pending'
  };

  try {
    const taskDocRef = doc(db, "tasks", taskId);
    await updateDoc(taskDocRef, {
      progressUpdates: arrayUnion(newUpdate)
    });
    console.log("submitDailyProgress: Appended update to Firestore tasks.");
  } catch (error) {
    console.error("submitDailyProgress Error:", error.message);
  }
}

// D. approveProgressUpdate(taskId, timestamp)
async function approveProgressUpdate(taskId, timestamp) {
  try {
    const taskDocRef = doc(db, "tasks", taskId);
    const taskDocSnap = await getDoc(taskDocRef);
    if (taskDocSnap.exists()) {
      const taskData = taskDocSnap.data();
      const updates = taskData.progressUpdates || [];
      const updatedList = updates.map(upd => {
        if (upd.timestamp === timestamp) {
          return { ...upd, status: 'approved' };
        }
        return upd;
      });
      await updateDoc(taskDocRef, { progressUpdates: updatedList });
      console.log("approveProgressUpdate: Status updated to approved in Firestore.");
    }
  } catch (error) {
    console.error("approveProgressUpdate Error:", error.message);
  }
}

// E. rejectProgressUpdate(taskId, timestamp)
async function rejectProgressUpdate(taskId, timestamp) {
  try {
    const taskDocRef = doc(db, "tasks", taskId);
    const taskDocSnap = await getDoc(taskDocRef);
    if (taskDocSnap.exists()) {
      const taskData = taskDocSnap.data();
      const updates = taskData.progressUpdates || [];
      const updatedList = updates.map(upd => {
        if (upd.timestamp === timestamp) {
          return { ...upd, status: 'rejected' };
        }
        return upd;
      });
      await updateDoc(taskDocRef, { progressUpdates: updatedList });
      console.log("rejectProgressUpdate: Status updated to rejected in Firestore.");
    }
  } catch (error) {
    console.error("rejectProgressUpdate Error:", error.message);
  }
}

// F. Admin Actions: Task Completions and Deletions
async function toggleTaskCompletion(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const isCompleted = task.status === 'completed';
  const newStatus = isCompleted ? 'pending' : 'completed';
  const completedAtVal = !isCompleted ? new Date().toISOString() : null;

  try {
    await updateDoc(doc(db, "tasks", id), {
      status: newStatus,
      completed: !isCompleted,
      completedAt: completedAtVal
    });
  } catch (error) {
    console.error("toggleTaskCompletion Error:", error.message);
  }
}

async function toggleTaskUpdating(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const isUpdating = task.status === 'updating';
  const newStatus = isUpdating ? 'pending' : 'updating';

  try {
    await updateDoc(doc(db, "tasks", id), {
      status: newStatus,
      completed: false,
      completedAt: null
    });
  } catch (error) {
    console.error("toggleTaskUpdating Error:", error.message);
  }
}

async function deleteOldTask(id) {
  try {
    await deleteDoc(doc(db, "tasks", id));
    console.log("deleteOldTask: Task document removed from Firestore.");
  } catch (error) {
    console.error("deleteOldTask Error:", error.message);
  }
}

// Function to fetch all user documents and populate the assignee dropdown
// Function to fetch all user documents and populate user-selection dropdowns
async function fetchUsersAndPopulateDropdown() {
  const assigneeSelect = document.getElementById('task-assignee');
  const photographerSelect = document.getElementById('shoot-photographer');
  const cinematographerSelect = document.getElementById('shoot-cinematographer');

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    
    // Clear select options, preserving placeholders
    if (assigneeSelect) assigneeSelect.innerHTML = '';
    
    if (photographerSelect) {
      photographerSelect.innerHTML = '<option value="">-- Select Photographer --</option>';
    }
    if (cinematographerSelect) {
      cinematographerSelect.innerHTML = '<option value="">-- Select Cinematographer --</option>';
    }

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      const name = userData.name || userData.email;
      if (name) {
        const optionVal = name.trim();

        // Populate Assignee select
        if (assigneeSelect) {
          const opt = document.createElement('option');
          opt.value = optionVal;
          opt.textContent = optionVal;
          assigneeSelect.appendChild(opt);
        }

        // Populate Photographer select
        if (photographerSelect) {
          const opt = document.createElement('option');
          opt.value = optionVal;
          opt.textContent = optionVal;
          photographerSelect.appendChild(opt);
        }

        // Populate Cinematographer select
        if (cinematographerSelect) {
          const opt = document.createElement('option');
          opt.value = optionVal;
          opt.textContent = optionVal;
          cinematographerSelect.appendChild(opt);
        }
      }
    });
    console.log("fetchUsersAndPopulateDropdown: Assignee, Photographer, and Cinematographer dropdowns successfully populated.");
  } catch (error) {
    console.error("fetchUsersAndPopulateDropdown Error:", error.message);
  }
}

// 6. DYNAMIC TASK CARD RENDER
function renderTaskGrid() {
  taskGridContainer.innerHTML = '';

  const userDisplayName = currentUser ? (currentUser.name || currentUser.email) : '';

  const filteredTasks = tasks.filter(task => {
    // Role-based rendering: admin sees all tasks, standard users see only their assigned tasks/roles
    const isAdmin = currentUser && currentUser.role === 'admin';
    if (!isAdmin) {
      const isShooting = task.extraData && task.extraData.category === 'shooting';
      if (isShooting) {
        const isPhoto = task.photographer === userDisplayName;
        const isCinema = task.cinematographer === userDisplayName;
        if (!isPhoto && !isCinema) return false;
      } else {
        if (task.assignee !== userDisplayName) return false;
      }
    }

    if (activeFilter === 'pending' && task.status === 'completed') return false;
    if (activeFilter === 'completed' && task.status !== 'completed') return false;

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchDesc = task.description.toLowerCase().includes(query);
      const matchAssignee = task.assignee.toLowerCase().includes(query);
      const matchTags = task.tags.toLowerCase().includes(query);
      const matchPriority = task.priority.toLowerCase().includes(query);
      const matchPhoto = task.photographer && task.photographer.toLowerCase().includes(query);
      const matchCinema = task.cinematographer && task.cinematographer.toLowerCase().includes(query);
      return matchTitle || matchDesc || matchAssignee || matchTags || matchPriority || matchPhoto || matchCinema;
    }

    return true;
  });

  filteredCountEl.textContent = `${filteredTasks.length} task${filteredTasks.length === 1 ? '' : 's'} matching active filters`;

  if (filteredTasks.length === 0) {
    taskGridContainer.innerHTML = `
      <div class="empty-state-card col-span-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        <p>No operational tasks match the criteria.</p>
        <span class="sub-empty">// Clear filters or add a new deployment to populate.</span>
      </div>
    `;
    return;
  }

  filteredTasks.forEach(task => {
    const isOverdue = task.status !== 'completed' && new Date(task.date) < new Date('2026-07-02');
    
    // Fallback initials for assignee or photographer
    const avatarName = task.assignee || task.photographer || 'U';
    const initials = avatarName.split(' ').map(name => name[0]).join('');

    // Determine user's specific role badge
    let userRoleInTask = '';
    const isAdmin = currentUser && currentUser.role === 'admin';
    const isShooting = task.extraData && task.extraData.category === 'shooting';

    if (isAdmin) {
      userRoleInTask = isShooting ? 'Admin (Shooting)' : 'Admin (Editing)';
    } else {
      if (isShooting) {
        const isPhoto = task.photographer === userDisplayName;
        const isCinema = task.cinematographer === userDisplayName;
        if (isPhoto && isCinema) {
          userRoleInTask = 'Photographer & Cinematographer';
        } else if (isPhoto) {
          userRoleInTask = 'Photographer';
        } else if (isCinema) {
          userRoleInTask = 'Cinematographer';
        } else {
          userRoleInTask = 'Operator';
        }
      } else {
        userRoleInTask = 'Editor';
      }
    }

    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} ${task.status === 'completed' ? 'completed' : ''} ${task.status === 'updating' ? 'updating' : ''}`;
    card.setAttribute('data-id', task.id);

    let badgeHtml = `<span class="p-badge">${task.priority}</span>`;
    if (task.status === 'updating') {
      badgeHtml += ` <span class="status-badge-updating">UPDATING</span>`;
    } else if (task.status === 'completed') {
      badgeHtml += ` <span class="status-badge-completed">COMPLETED</span>`;
    }

    let actionsHtml = '';
    if (currentUser && currentUser.role === 'admin') {
      actionsHtml = `
        <button class="task-action-btn complete-btn ${task.status === 'completed' ? 'active-completed' : ''}" title="${task.status === 'completed' ? 'Re-open task' : 'Mark Completed'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </button>
        <button class="task-action-btn delete-btn" title="Decommission Task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      `;
    } else if (currentUser && currentUser.role === 'user') {
      actionsHtml = `
        <button class="task-action-btn update-btn ${task.status === 'updating' ? 'active-updating' : ''}" title="${task.status === 'updating' ? 'Revert to Pending' : 'Mark as Updating'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
        </button>
      `;
    }

    let updatesSectionHtml = '';
    const hasUpdates = task.progressUpdates && task.progressUpdates.length > 0;

    // Editor UI: Form is only visible to the assigned editor/user
    const isAssignedEditor = currentUser && currentUser.role === 'user' && task.assignee === currentUser.name;

    if (hasUpdates || isAssignedEditor) {
      updatesSectionHtml = `
        <div class="task-updates-section">
          <span class="timeline-title">Progress Reports Timeline</span>
          ${hasUpdates ? `
            <div class="updates-list">
              ${task.progressUpdates.map(upd => {
        let statusBadge = '';
        let adminActions = '';

        if (upd.status === 'pending') {
          statusBadge = `<span class="upd-status-badge pending">PENDING APPROVAL</span>`;

          if (isAdmin) {
            adminActions = `
                      <div class="upd-admin-actions">
                        <button class="upd-action-btn approve-btn" data-timestamp="${upd.timestamp}">✓ Approve</button>
                        <button class="upd-action-btn reject-btn" data-timestamp="${upd.timestamp}">✗ Reject</button>
                      </div>
                    `;
          }
        } else if (upd.status === 'approved') {
          statusBadge = `<span class="upd-status-badge approved">✓ APPROVED</span>`;
        } else if (upd.status === 'rejected') {
          statusBadge = `<span class="upd-status-badge rejected">✗ REJECTED</span>`;
        }

        return `
                  <div class="update-item ${upd.status}">
                    <div class="update-meta">
                      <div class="meta-left">
                        <span class="update-author">${upd.editorName}</span>
                        ${statusBadge}
                      </div>
                      <span class="update-time">${new Date(upd.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="update-text">${upd.text}</div>
                    ${adminActions}
                  </div>
                `;
      }).join('')}
            </div>
          ` : ''}
          
          ${isAssignedEditor ? `
            <div class="add-update-form">
              <input type="text" placeholder="e.g., Rendered first draft, waiting for feedback..." class="update-input" data-task-id="${task.id}">
              <button class="btn-update-submit" data-task-id="${task.id}">Submit Daily Progress</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="task-card-header">
        <div class="task-meta-top" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class="task-classification">${task.tags.split(',')[0]}</span>
          ${badgeHtml}
          <span class="role-badge" style="padding: 2px 8px; font-size: 0.65rem; font-weight: 600; border-radius: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); text-transform: uppercase;">${userRoleInTask}</span>
        </div>
        <div class="task-actions">
          ${actionsHtml}
        </div>
      </div>
      
      <div class="task-body-main">
        <h4 class="task-title">${task.title}</h4>
        <p class="task-desc">${task.description}</p>
      </div>

      <div class="task-card-footer">
        <div class="task-date-info ${isOverdue ? 'overdue' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>${isOverdue ? 'OVERDUE: ' : ''}${task.date}</span>
        </div>

        <div class="task-assignee-badge">
          <div class="task-assignee-avatar">${initials}</div>
          <span class="task-assignee-name">${task.assignee}</span>
        </div>
      </div>

      ${updatesSectionHtml}
    `;

    // Bind event handlers
    if (currentUser && currentUser.role === 'admin') {
      const completeBtn = card.querySelector('.complete-btn');
      completeBtn.addEventListener('click', () => toggleTaskCompletion(task.id));

      const deleteBtn = card.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', () => deleteOldTask(task.id));

      // Admin Approvals buttons
      if (hasUpdates) {
        const approveBtns = card.querySelectorAll('.upd-action-btn.approve-btn');
        approveBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const timestamp = e.target.getAttribute('data-timestamp');
            approveProgressUpdate(task.id, timestamp);
          });
        });

        const rejectBtns = card.querySelectorAll('.upd-action-btn.reject-btn');
        rejectBtns.forEach(btn => {
          btn.addEventListener('click', (e) => {
            const timestamp = e.target.getAttribute('data-timestamp');
            rejectProgressUpdate(task.id, timestamp);
          });
        });
      }
    } else if (currentUser && currentUser.role === 'user') {
      const updateBtn = card.querySelector('.update-btn');
      if (updateBtn) {
        updateBtn.addEventListener('click', () => toggleTaskUpdating(task.id));
      }

      // Daily Progress submission
      if (isAssignedEditor) {
        const submitBtn = card.querySelector('.btn-update-submit');
        const inputEl = card.querySelector(`.update-input[data-task-id="${task.id}"]`);

        const handleReport = () => {
          const textVal = inputEl.value;
          if (textVal.trim()) {
            submitDailyProgress(task.id, textVal);
            inputEl.value = '';
          }
        };

        submitBtn.addEventListener('click', handleReport);
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleReport();
          }
        });
      }
    }

    card.addEventListener('click', (e) => {
      // Ignore clicks on interactive child controls
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.timeline-title') || e.target.closest('.updates-list') || e.target.closest('.add-update-form')) {
        return;
      }
      openDetailsModal(task);
    });

    taskGridContainer.appendChild(card);
  });
}

function updateDashboardStats(tasksList) {
  const userDisplayName = currentUser ? (currentUser.name || currentUser.email) : '';
  const isAdmin = currentUser && currentUser.role === 'admin';

  // Role-based stats: admin calculates on all tasks, standard users calculate on their assigned tasks/roles
  const filteredList = isAdmin 
    ? tasksList 
    : tasksList.filter(t => {
        const isShooting = t.extraData && t.extraData.category === 'shooting';
        if (isShooting) {
          return t.photographer === userDisplayName || t.cinematographer === userDisplayName;
        } else {
          return t.assignee === userDisplayName;
        }
      });

  const pendingCount = filteredList.filter(t => t.status === 'pending' || t.status === 'updating').length;
  const completedCount = filteredList.filter(t => t.status === 'completed').length;
  const totalCount = filteredList.length;

  if (pendingBadgeCount) {
    pendingBadgeCount.textContent = pendingCount;
    pendingBadgeCount.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
  
  if (statsPendingCount) {
    statsPendingCount.textContent = pendingCount;
  }
  
  if (statsCompletedCount) {
    statsCompletedCount.textContent = completedCount;
  }

  const totalWeight = totalCount || 1;
  const pendingPercent = Math.round((pendingCount / totalWeight) * 100);
  const completedPercent = Math.round((completedCount / totalWeight) * 100);

  if (pendingProgressBar) pendingProgressBar.style.width = `${pendingPercent}%`;
  if (completedProgressBar) completedProgressBar.style.width = `${completedPercent}%`;

  const velocity = Math.round((completedCount / totalWeight) * 100);
  if (statsVelocityValue) {
    statsVelocityValue.textContent = `${velocity}%`;
  }
  
  const velProgressBar = document.querySelector('#stat-velocity .progress-bar');
  if (velProgressBar) velProgressBar.style.width = `${velocity}%`;
}

// 7. GENERAL PORTAL EVENT LISTENERS
btnTriggerLogin.addEventListener('click', () => {
  if (currentUser) {
    deauthenticateAgent();
  } else {
    openModal();
  }
});

btnCloseModal.addEventListener('click', closeModal);

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal && currentUser) {
    closeModal();
  }
});

let activeAuthTab = 'login';
function switchAuthTab(tab) {
  activeAuthTab = tab;
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    signupExtraFields.style.display = 'none';
    btnAuthSubmit.textContent = 'Access Console';
  } else {
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    signupExtraFields.style.display = 'flex';
    btnAuthSubmit.textContent = 'Register Core Node';
  }
}

tabLogin.addEventListener('click', () => switchAuthTab('login'));
tabSignup.addEventListener('click', () => switchAuthTab('signup'));

authForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  if (activeAuthTab === 'login') {
    authenticateAgent(email, password);
  } else {
    const displayName = document.getElementById('auth-name').value;
    registerNewAgent(email, password, displayName);
  }
});

// Admin add task form submit
addTaskForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const activeBranch = sessionStorage.getItem('selectedBranch');
  const activeCard = document.querySelector('.category-select-card.active');
  const category = activeCard ? activeCard.getAttribute('data-category') : 'editing';

  let title, description, date, assignee, priority, tags, extraData = null;

  if (activeBranch === 'jadukor' && category === 'shooting') {
    // Collect shooting-specific data
    const clientNameVal = document.getElementById('client-name').value.trim();
    const shootPlaceVal = document.getElementById('shoot-place').value.trim();
    const shootDateVal = document.getElementById('shoot-date').value;

    title = `Shoot: ${clientNameVal} - ${shootPlaceVal || 'TBD'}`;
    description = document.getElementById('shoot-description').value.trim() || 'No instructions provided.';
    date = shootDateVal;
    
    // Default system values for shooting assignee/priority/tags
    assignee = document.getElementById('shoot-photographer').value || 'Unassigned';
    priority = 'medium'; // Shooting default priority
    tags = 'Shooting Operation';

    extraData = {
      category: 'shooting',
      shootDate: shootDateVal || '',
      shootTime: document.getElementById('shoot-time').value || '',
      photographer: document.getElementById('shoot-photographer').value || '',
      cinematographer: document.getElementById('shoot-cinematographer').value || '',
      clientName: clientNameVal,
      clientPhone: document.getElementById('client-phone').value.trim() || '',
      shootPlace: shootPlaceVal
    };
  } else {
    // Collect standard editing data
    title = document.getElementById('task-title').value.trim();
    description = document.getElementById('task-description').value.trim();
    date = document.getElementById('task-date').value;
    assignee = document.getElementById('task-assignee').value;
    tags = document.getElementById('task-tags').value;
    priority = document.getElementById('task-priority').value;

    if (activeBranch === 'jadukor') {
      extraData = { category: 'editing' };
    }
  }

  if (!title || !date || !description) return;

  addTask(title, description, date, assignee, priority, tags, extraData);
  addTaskForm.reset();
  adjustDynamicFormForBranch();

  document.querySelector('.task-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

btnNewTaskShortcut.addEventListener('click', () => {
  if (!currentUser) {
    openModal();
    return;
  }
  if (currentUser.role !== 'admin') return;

  adminTaskFormContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('task-title').focus();
});

btnCancelForm.addEventListener('click', () => {
  addTaskForm.reset();
});

// Search and tab filters
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderTaskGrid();
});

const tabButtons = document.querySelectorAll('.tab-btn');
tabButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    tabButtons.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeFilter = e.target.getAttribute('data-filter');
    renderTaskGrid();
  });
});

// Tab selection state and helpers

function switchTab(tabId, updateUrl = true) {
  activeTab = tabId;

  // Toggle active class on sidebar menu items
  navMyWorkspace.classList.remove('active');
  navTeamWorkload.classList.remove('active');
  navMonthlyAnalytics.classList.remove('active');

  if (tabId === 'my-workspace') navMyWorkspace.classList.add('active');
  if (tabId === 'team-workload') navTeamWorkload.classList.add('active');
  if (tabId === 'monthly-analytics') navMonthlyAnalytics.classList.add('active');

  // Show/Hide main panels
  const panelWorkspace = document.getElementById('panel-my-workspace');
  const panelTeamWorkload = document.getElementById('panel-team-workload');
  const panelMonthlyAnalytics = document.getElementById('panel-monthly-analytics');

  if (panelWorkspace) panelWorkspace.style.display = tabId === 'my-workspace' ? 'block' : 'none';
  if (panelTeamWorkload) panelTeamWorkload.style.display = tabId === 'team-workload' ? 'block' : 'none';
  if (panelMonthlyAnalytics) panelMonthlyAnalytics.style.display = tabId === 'monthly-analytics' ? 'block' : 'none';

  // Run tab-specific rendering logic
  if (tabId === 'my-workspace') {
    renderTaskGrid();
    updateDashboardStats(tasks);
  } else if (tabId === 'team-workload') {
    renderTeamWorkload();
  } else if (tabId === 'monthly-analytics') {
    renderMonthlyAnalytics();
  }

  if (updateUrl) {
    const activeBranch = sessionStorage.getItem('selectedBranch') || 'moveon';
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?branch=${activeBranch}&tab=${tabId}`;
    window.history.pushState({ tab: tabId, branch: activeBranch }, '', newUrl);
  }
}

navMyWorkspace.addEventListener('click', (e) => {
  e.preventDefault();
  switchTab('my-workspace');
});

navTeamWorkload.addEventListener('click', (e) => {
  e.preventDefault();
  switchTab('team-workload');
});

navMonthlyAnalytics.addEventListener('click', (e) => {
  e.preventDefault();
  if (currentUser && currentUser.role === 'admin') {
    switchTab('monthly-analytics');
  } else {
    alert("Access Denied: Administrative credentials required.");
  }
});

navAdmin.addEventListener('click', (e) => {
  e.preventDefault();
  if (!currentUser) {
    openModal();
  } else if (currentUser.role !== 'admin') {
    alert("Administrative panel locked. Requires elevated access clearance.");
  } else {
    if (activeTab !== 'my-workspace') {
      switchTab('my-workspace');
    }
    adminTaskFormContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

roleSelect.addEventListener('change', (e) => {
  if (!currentUser) {
    alert("Please log in first to authorize access switches.");
    roleSelect.value = "user";
    return;
  }
});

function openModal() {
  loginModal.classList.add('open');
}

function closeModal() {
  loginModal.classList.remove('open');
}

// 9. FIREBASE CLOUD MESSAGING (FCM) SETUP

// Register service worker for FCM background notifications
function registerMessagingServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  }
}

// Request permission and retrieve/save token to current user's profile
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');

      // Get registration token from FCM
      const token = await getToken(messaging, {
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
        vapidKey: 'BL3TkwCRsdP0LPqylBPO1CmtBTA4Oa7bRSjsZ8Wgu3GREWiUir0XHOsXHIEY2jHbvs8HgWBUA-fRCAQvbMnsyWg' // Placeholder VAPID key
      });

      if (token) {
        console.log('FCM token generated:', token);
        if (currentUser) {
          await updateDoc(doc(db, "users", currentUser.uid), {
            fcmToken: token
          });
          console.log('FCM token saved successfully to Firestore users collection.');
        }
      } else {
        console.warn('No FCM registration token available.');
      }
    } else {
      console.warn('Unable to get permission to send push notifications.');
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

// Send push notification using FCM v1 API via the Cloud Function
async function sendFCMNotification(targetToken, taskTitle, taskDescription) {
  const functionUrl = "https://us-central1-move-on-data.cloudfunctions.net/sendFCMNotification";

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: targetToken,
        title: "New Operation Assigned",
        body: `You have been assigned to: ${taskTitle}`
      })
    });

    if (response.ok) {
      console.log("FCM Notification sent successfully via Cloud Function.");
    } else {
      console.warn("FCM Notification relay failed:", await response.text());
    }
  } catch (error) {
    console.error("Error invoking FCM Notification Cloud Function:", error);
  }
}

// Foreground message handler
onMessage(messaging, (payload) => {
  console.log('FCM Message received in foreground:', payload);
  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationBody = payload.notification?.body || '';

  showLocalNotificationToast(notificationTitle, notificationBody);
});

// Helper to show an elegant local toast notification
function showLocalNotificationToast(title, body) {
  const toast = document.createElement('div');
  toast.className = 'local-toast-notification';
  toast.innerHTML = `
    <div class="toast-header">
      <span class="toast-pulse"></span>
      <strong>${title}</strong>
      <button class="toast-close-btn">&times;</button>
    </div>
    <div class="toast-body">${body}</div>
  `;
  document.body.appendChild(toast);

  // Animate toast entry
  setTimeout(() => toast.classList.add('show'), 10);

  const closeBtn = toast.querySelector('.toast-close-btn');
  const dismissToast = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  };

  closeBtn.addEventListener('click', dismissToast);
  setTimeout(dismissToast, 6000); // Auto-dismiss after 6 seconds
}

// Helper to check if a date string is in the current month
function isCurrentMonth(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

// Team Workload Distribution Leaderboard logic
async function renderTeamWorkload() {
  const container = document.getElementById('leaderboard-container');
  if (!container) return;

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const userTaskCounts = {};
    const usersList = [];

    querySnapshot.forEach((docSnap) => {
      const userData = docSnap.data();
      const displayName = userData.name || userData.email || 'Unknown Agent';
      usersList.push(displayName);
      userTaskCounts[displayName] = 0;
    });

    tasks.forEach(task => {
      if (task.status === 'pending' || task.status === 'updating') {
        const assignee = task.assignee;
        if (userTaskCounts[assignee] !== undefined) {
          userTaskCounts[assignee]++;
        } else {
          userTaskCounts[assignee] = 1;
          usersList.push(assignee);
        }
      }
    });

    container.innerHTML = '';
    const leaderboardList = document.createElement('div');
    leaderboardList.className = 'leaderboard-list';

    const sortedUsers = Object.keys(userTaskCounts).map(name => ({
      name,
      count: userTaskCounts[name]
    })).sort((a, b) => b.count - a.count);

    sortedUsers.forEach(user => {
      const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      const isHighLoad = user.count >= 3;

      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      item.innerHTML = `
        <div class="leaderboard-user-info">
          <div class="leaderboard-avatar">${initials}</div>
          <span class="leaderboard-name">${user.name}</span>
        </div>
        <span class="leaderboard-count-badge ${isHighLoad ? 'high-load' : ''}">
          ${user.count} Active Project${user.count === 1 ? '' : 's'}
        </span>
      `;
      leaderboardList.appendChild(item);
    });

    container.appendChild(leaderboardList);
  } catch (error) {
    console.error("Error rendering team workload:", error);
    container.innerHTML = `<p class="error-msg">Error loading workload leaderboard: ${error.message}</p>`;
  }
}

// Admin Monthly Analytics logic
async function renderMonthlyAnalytics() {
  const statsGrid = document.getElementById('analytics-stats-grid');
  const breakdownList = document.getElementById('editor-breakdown-list');
  if (!statsGrid || !breakdownList) return;

  const currentMonthCompletedTasks = tasks.filter(task => {
    if (task.status !== 'completed') return false;
    const dateToCheck = task.completedAt || task.date;
    return isCurrentMonth(dateToCheck);
  });

  const totalCompleted = currentMonthCompletedTasks.length;

  const editorCounts = {};
  currentMonthCompletedTasks.forEach(task => {
    const editor = task.assignee || 'Unassigned';
    editorCounts[editor] = (editorCounts[editor] || 0) + 1;
  });

  let mostActiveEditor = 'None';
  let maxCompleted = 0;
  Object.keys(editorCounts).forEach(editor => {
    if (editorCounts[editor] > maxCompleted) {
      maxCompleted = editorCounts[editor];
      mostActiveEditor = editor;
    }
  });

  const tasksCreatedThisMonth = tasks.filter(task => isCurrentMonth(task.createdAt));
  const createdCount = tasksCreatedThisMonth.length || 1;
  const monthlyCompletionRate = Math.round((totalCompleted / createdCount) * 100);

  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="stat-glow green"></div>
      <div class="stat-header">
        <span class="stat-title">Monthly Completions</span>
        <div class="stat-icon-wrapper green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
      </div>
      <div class="stat-body">
        <span class="stat-value">${totalCompleted}</span>
        <span class="stat-trend green">✓ Operations</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-glow blue"></div>
      <div class="stat-header">
        <span class="stat-title">Top Performer</span>
        <div class="stat-icon-wrapper blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </div>
      </div>
      <div class="stat-body">
        <span class="stat-value" style="font-size: 1.2rem; line-height: 2.2rem; font-weight: 700;">${mostActiveEditor}</span>
        <span class="stat-trend blue">${maxCompleted > 0 ? `${maxCompleted} task${maxCompleted === 1 ? '' : 's'} completed` : 'No completions'}</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-glow purple"></div>
      <div class="stat-header">
        <span class="stat-title">Monthly Efficiency</span>
        <div class="stat-icon-wrapper purple">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        </div>
      </div>
      <div class="stat-body">
        <span class="stat-value">${monthlyCompletionRate}%</span>
        <span class="stat-trend purple">▲ Completed vs Created</span>
      </div>
    </div>
  `;

  breakdownList.innerHTML = '';
  if (Object.keys(editorCounts).length === 0) {
    breakdownList.innerHTML = `<div class="empty-state" style="color: var(--text-muted); font-size: 0.8rem; font-style: italic; padding: 12px 0;">// No task completions recorded in the current month.</div>`;
    return;
  }

  const sortedBreakdown = Object.keys(editorCounts).map(editor => ({
    name: editor,
    count: editorCounts[editor]
  })).sort((a, b) => b.count - a.count);

  sortedBreakdown.forEach(item => {
    const row = document.createElement('div');
    row.className = 'editor-breakdown-item';
    row.innerHTML = `
      <span class="editor-breakdown-name">${item.name}</span>
      <span class="editor-breakdown-count">${item.count} task${item.count === 1 ? '' : 's'}</span>
    `;
    breakdownList.appendChild(row);
  });
}

// 8. DIAGNOSTIC SYSTEM BANNER SETUP
function setupSystemBanner() {
  const banner = document.createElement('div');
  banner.className = 'system-banner live';
  banner.innerHTML = `
    <span class="banner-pulse green"></span>
    <span class="banner-text">FIREBASE OPS ACTIVE // SESSION SECURED</span>
  `;
  document.body.appendChild(banner);
}

// 11. BRANCH SELECTION GATEWAY LOGIC
let currentBranch = sessionStorage.getItem('selectedBranch') || null;

function applyBranchSettings(branch) {
  currentBranch = branch;
  sessionStorage.setItem('selectedBranch', branch);

  // Sync active branch to URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab') || activeTab || 'my-workspace';
  if (urlParams.get('branch') !== branch || urlParams.get('tab') !== tabParam) {
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + `?branch=${branch}&tab=${tabParam}`;
    window.history.pushState({ path: newUrl, tab: tabParam, branch: branch }, '', newUrl);
  }

  const agencyLogoImg = document.querySelector('.agency-logo');
  const gatewayScreen = document.getElementById('branch-gateway');
  const appLayout = document.querySelector('.app-layout');

  if (branch === 'jadukor') {
    document.title = "Jadukor Studio // Task Workspace";
    if (agencyLogoImg) {
      agencyLogoImg.src = "jadukor-logo.png";
      agencyLogoImg.alt = "Jadukor Logo";
    }
  } else if (branch === 'moveon') {
    document.title = "Move On Studio // Task Workspace";
    if (agencyLogoImg) {
      agencyLogoImg.src = "logo.png";
      agencyLogoImg.alt = "Move On Logo";
    }
  }

  // Fade out and hide gateway screen
  if (gatewayScreen) {
    gatewayScreen.classList.add('fade-out');
    setTimeout(() => {
      if (currentBranch === branch) {
        gatewayScreen.classList.add('hidden');
      }
    }, 500);
  }

  // Reveal the main dashboard
  if (appLayout) {
    appLayout.classList.remove('hidden');
  }

  // Update category and details visibility for task form
  adjustDynamicFormForBranch();

  // Load branch specific task database
  loadTasks();
}

function showBranchGateway() {
  const appLayout = document.querySelector('.app-layout');
  const gatewayScreen = document.getElementById('branch-gateway');

  currentBranch = null;
  sessionStorage.removeItem('selectedBranch');

  // Clean URL parameter
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.pushState({ path: newUrl }, '', newUrl);

  if (appLayout) {
    appLayout.classList.add('hidden');
  }
  if (gatewayScreen) {
    gatewayScreen.classList.remove('hidden');
    gatewayScreen.classList.remove('fade-out');
  }
}

function toggleFormValidation(category) {
  const taskTitle = document.getElementById('task-title');
  const taskDate = document.getElementById('task-date');
  const taskDesc = document.getElementById('task-description');
  
  const clientName = document.getElementById('client-name');
  const shootDate = document.getElementById('shoot-date');
  const shootDesc = document.getElementById('shoot-description');

  if (category === 'shooting') {
    if (taskTitle) taskTitle.required = false;
    if (taskDate) taskDate.required = false;
    if (taskDesc) taskDesc.required = false;

    if (clientName) clientName.required = true;
    if (shootDate) shootDate.required = true;
    if (shootDesc) shootDesc.required = true;
  } else {
    if (taskTitle) taskTitle.required = true;
    if (taskDate) taskDate.required = true;
    if (taskDesc) taskDesc.required = true;

    if (clientName) clientName.required = false;
    if (shootDate) shootDate.required = false;
    if (shootDesc) shootDesc.required = false;
  }
}

function adjustDynamicFormForBranch() {
  const activeBranch = sessionStorage.getItem('selectedBranch');
  const catGroup = document.getElementById('task-category-group');
  const editingView = document.getElementById('form-editing-view');
  const shootingView = document.getElementById('form-shooting-view');

  if (!catGroup || !editingView || !shootingView) return;

  if (activeBranch === 'jadukor') {
    catGroup.classList.remove('hidden');
    
    const activeCard = document.querySelector('.category-select-card.active');
    const category = activeCard ? activeCard.getAttribute('data-category') : 'editing';
    
    if (category === 'shooting') {
      editingView.style.display = 'none';
      shootingView.style.display = 'block';
      toggleFormValidation('shooting');
    } else {
      editingView.style.display = 'block';
      shootingView.style.display = 'none';
      toggleFormValidation('editing');
    }
  } else {
    catGroup.classList.add('hidden');
    editingView.style.display = 'block';
    shootingView.style.display = 'none';
    toggleFormValidation('editing');
    
    const editingCard = document.getElementById('cat-card-editing');
    const shootingCard = document.getElementById('cat-card-shooting');
    if (editingCard) editingCard.classList.add('active');
    if (shootingCard) shootingCard.classList.remove('active');

    const shootDate = document.getElementById('shoot-date');
    const shootTime = document.getElementById('shoot-time');
    const photographer = document.getElementById('shoot-photographer');
    const cinematographer = document.getElementById('shoot-cinematographer');
    const clientName = document.getElementById('client-name');
    const clientPhone = document.getElementById('client-phone');
    const shootPlace = document.getElementById('shoot-place');
    const shootDescription = document.getElementById('shoot-description');

    if (shootDate) shootDate.value = '';
    if (shootTime) shootTime.value = '';
    if (photographer) photographer.value = '';
    if (cinematographer) cinematographer.value = '';
    if (clientName) clientName.value = '';
    if (clientPhone) clientPhone.value = '';
    if (shootPlace) shootPlace.value = '';
    if (shootDescription) shootDescription.value = '';
  }
}

// Bind click handlers to cards
const jadukorCard = document.getElementById('gateway-branch-jadukor');
const moveonCard = document.getElementById('gateway-branch-moveon');

if (jadukorCard) {
  jadukorCard.addEventListener('click', () => {
    applyBranchSettings('jadukor');
  });
}

if (moveonCard) {
  moveonCard.addEventListener('click', () => {
    applyBranchSettings('moveon');
  });
}

// Bind Switch Branch sidebar button
const btnSwitchBranch = document.getElementById('nav-switch-branch');
if (btnSwitchBranch) {
  btnSwitchBranch.addEventListener('click', (e) => {
    e.preventDefault();
    showBranchGateway();
  });
}

// Bind click listeners for category select cards
const catCardEditing = document.getElementById('cat-card-editing');
const catCardShooting = document.getElementById('cat-card-shooting');
const editingView = document.getElementById('form-editing-view');
const shootingView = document.getElementById('form-shooting-view');

if (catCardEditing && catCardShooting) {
  catCardEditing.addEventListener('click', () => {
    catCardEditing.classList.add('active');
    catCardShooting.classList.remove('active');
    if (editingView) editingView.style.display = 'block';
    if (shootingView) shootingView.style.display = 'none';
    toggleFormValidation('editing');
  });

  catCardShooting.addEventListener('click', () => {
    catCardShooting.classList.add('active');
    catCardEditing.classList.remove('active');
    if (editingView) editingView.style.display = 'none';
    if (shootingView) shootingView.style.display = 'block';
    toggleFormValidation('shooting');
  });
}

// Back/Forward native browser navigation support
window.addEventListener('popstate', (e) => {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab') || 'my-workspace';
  const branchParam = urlParams.get('branch');

  if (branchParam && branchParam !== currentBranch) {
    applyBranchSettings(branchParam);
  }

  switchTab(tabParam, false);
});

// 12. TASK DETAILS MODAL INTERACTION
let activeDetailsTask = null;

function openDetailsModal(task) {
  activeDetailsTask = task;
  const modal = document.getElementById('task-details-modal');
  const title = document.getElementById('details-title');
  const branchTag = document.getElementById('details-branch-tag');
  const category = document.getElementById('details-category');
  const priority = document.getElementById('details-priority');
  const date = document.getElementById('details-date');
  const assignee = document.getElementById('details-assignee');
  const tag = document.getElementById('details-tag');
  const clientName = document.getElementById('details-client-name');
  const clientPhone = document.getElementById('details-client-phone');
  const place = document.getElementById('details-place');
  const shootTime = document.getElementById('details-shoot-time');
  const photographer = document.getElementById('details-photographer');
  const cinematographer = document.getElementById('details-cinematographer');
  const description = document.getElementById('details-description');
  const statusPulse = document.getElementById('details-status-pulse');

  if (!modal) return;

  // Pulse color indicator
  if (statusPulse) {
    statusPulse.className = 'indicator-pulse ' + (task.status === 'completed' ? 'blue' : (task.status === 'updating' ? 'orange' : 'green'));
  }

  if (title) title.textContent = task.title;
  if (branchTag) branchTag.textContent = 'BRANCH // ' + (task.branch ? task.branch.toUpperCase() : 'MOVEON');
  
  if (priority) {
    priority.textContent = (task.priority || 'medium').toUpperCase();
    priority.className = 'badge badge-' + (task.priority || 'medium');
  }
  
  if (date) date.textContent = task.date || '-';
  if (assignee) assignee.textContent = task.assignee || 'Unassigned';
  if (description) description.textContent = task.description || 'No objectives provided.';

  // Render extraData branch category fields
  const clientRow = document.getElementById('row-details-client-name');
  const phoneRow = document.getElementById('row-details-client-phone');
  const placeRow = document.getElementById('row-details-place');
  const shootTimeRow = document.getElementById('row-details-shoot-time');
  const photoRow = document.getElementById('row-details-photographer');
  const cinemaRow = document.getElementById('row-details-cinematographer');
  const tagRow = document.getElementById('row-details-tag');

  const hasExtra = task.extraData && task.extraData.category === 'shooting';

  if (hasExtra) {
    if (category) category.textContent = "Shooting Operation";
    if (clientRow) clientRow.style.display = 'flex';
    if (phoneRow) phoneRow.style.display = 'flex';
    if (placeRow) placeRow.style.display = 'flex';
    if (shootTimeRow) shootTimeRow.style.display = 'flex';
    if (photoRow) photoRow.style.display = 'flex';
    if (cinemaRow) cinemaRow.style.display = 'flex';
    if (tagRow) tagRow.style.display = 'none';

    if (clientName) clientName.textContent = task.extraData.clientName || '-';
    if (clientPhone) clientPhone.textContent = task.extraData.clientPhone || '-';
    if (place) place.textContent = task.extraData.shootPlace || '-';
    if (shootTime) shootTime.textContent = (task.extraData.shootDate || '') + ' @ ' + (task.extraData.shootTime || 'TBD');
    if (photographer) photographer.textContent = task.extraData.photographer || 'Unassigned';
    if (cinematographer) cinematographer.textContent = task.extraData.cinematographer || 'Unassigned';
  } else {
    if (category) category.textContent = "Editing Operation";
    if (clientRow) clientRow.style.display = 'none';
    if (phoneRow) phoneRow.style.display = 'none';
    if (placeRow) placeRow.style.display = 'none';
    if (shootTimeRow) shootTimeRow.style.display = 'none';
    if (photoRow) photoRow.style.display = 'none';
    if (cinemaRow) cinemaRow.style.display = 'none';
    if (tagRow) tagRow.style.display = 'flex';
    if (tag) tag.textContent = task.tags || '-';
  }

  // Load Progress and Deliverables values
  const shootSec = document.getElementById('shooting-progress-section');
  const editSec = document.getElementById('editing-progress-section');

  if (shootSec && editSec) {
    if (hasExtra) {
      shootSec.style.display = 'flex';
      editSec.style.display = 'none';

      // Load shooting progress
      const chkShootCompleted = document.getElementById('chk-shoot-completed');
      const txtShootNotes = document.getElementById('txt-shoot-notes');
      
      if (chkShootCompleted) {
        chkShootCompleted.checked = !!(task.progressData && task.progressData.shootCompleted);
      }
      if (txtShootNotes) {
        txtShootNotes.value = (task.progressData && task.progressData.shootNotes) || '';
      }
    } else {
      shootSec.style.display = 'none';
      editSec.style.display = 'flex';

      // Load editing progress
      const chkRoughCut = document.getElementById('chk-rough-cut');
      const txtRoughCutLink = document.getElementById('txt-rough-cut-link');
      const chkColorGrading = document.getElementById('chk-color-grading');
      const txtColorGradingLink = document.getElementById('txt-color-grading-link');
      const chkFinalPreview = document.getElementById('chk-final-preview');
      const txtFinalPreviewLink = document.getElementById('txt-final-preview-link');

      if (chkRoughCut) chkRoughCut.checked = !!(task.progressData && task.progressData.roughCut);
      if (txtRoughCutLink) txtRoughCutLink.value = (task.progressData && task.progressData.roughCutLink) || '';
      if (chkColorGrading) chkColorGrading.checked = !!(task.progressData && task.progressData.colorGrading);
      if (txtColorGradingLink) txtColorGradingLink.value = (task.progressData && task.progressData.colorGradingLink) || '';
      if (chkFinalPreview) chkFinalPreview.checked = !!(task.progressData && task.progressData.finalPreview);
      if (txtFinalPreviewLink) txtFinalPreviewLink.value = (task.progressData && task.progressData.finalPreviewLink) || '';
    }
  }

  // Open overlay
  modal.style.opacity = '1';
  modal.style.visibility = 'visible';
  modal.style.pointerEvents = 'auto';
}

const detailsModal = document.getElementById('task-details-modal');
const btnCloseDetails = document.getElementById('btn-close-details');
const btnSaveProgress = document.getElementById('btn-save-progress');

function closeDetailsModal() {
  if (detailsModal) {
    detailsModal.style.opacity = '0';
    detailsModal.style.visibility = 'hidden';
    detailsModal.style.pointerEvents = 'none';
  }
}

if (btnCloseDetails) {
  btnCloseDetails.addEventListener('click', closeDetailsModal);
}

if (detailsModal) {
  detailsModal.addEventListener('click', (e) => {
    if (e.target === detailsModal) {
      closeDetailsModal();
    }
  });
}

if (btnSaveProgress) {
  btnSaveProgress.addEventListener('click', async () => {
    if (!activeDetailsTask) return;

    const isShooting = activeDetailsTask.extraData && activeDetailsTask.extraData.category === 'shooting';
    let newProgressData = {};

    try {
      if (isShooting) {
        const shootCompleted = document.getElementById('chk-shoot-completed').checked;
        const shootNotes = document.getElementById('txt-shoot-notes').value.trim();
        newProgressData = {
          category: 'shooting',
          shootCompleted,
          shootNotes
        };
      } else {
        const roughCut = document.getElementById('chk-rough-cut').checked;
        const roughCutLink = document.getElementById('txt-rough-cut-link').value.trim();
        const colorGrading = document.getElementById('chk-color-grading').checked;
        const colorGradingLink = document.getElementById('txt-color-grading-link').value.trim();
        const finalPreview = document.getElementById('chk-final-preview').checked;
        const finalPreviewLink = document.getElementById('txt-final-preview-link').value.trim();
        
        newProgressData = {
          category: 'editing',
          roughCut,
          roughCutLink,
          colorGrading,
          colorGradingLink,
          finalPreview,
          finalPreviewLink
        };
      }

      await updateDoc(doc(db, "tasks", activeDetailsTask.id), { progressData: newProgressData });
      activeDetailsTask.progressData = newProgressData; // update local cached task details reference
      alert("Progress Saved Successfully!");
    } catch (error) {
      console.error("Error saving task progress data:", error);
      alert("Error saving progress: " + error.message);
    }
  });
}

// Initial Boot setup
setupSystemBanner();
updateUIElements();
loadTasks();
fetchUsersAndPopulateDropdown();
registerMessagingServiceWorker();
