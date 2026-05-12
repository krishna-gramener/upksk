// LLM configuration will be stored in localStorage
const LLM_MODEL = "gpt-5.4-mini";
const USERS_JSON_PATH = "users.json";
const QUESTIONS_JSON_PATH = "questions.json";
/* Embedded user data */
const EMBEDDED_USERS = [
  {
    "name": "Dr. Vivek Mishra",
    "email": "vivek.mishra@uphealth.abc.com",
    "password": "abc@123",
    "role": "Chief Medical Officer",
    "district": "",
    "facility_name": "",
    "role_description": "Responsible for monitoring healthcare services, reviewing district-wide health program performance, supervising public health initiatives, and coordinating with district administration across Uttar Pradesh."
  },
  {
    "name": "Pooja Srivastava",
    "email": "pooja.srivastava@uphealth.abc.com",
    "password": "abc@123",
    "role": "Facility Incharge",
    "district": "Lucknow",
    "facility_name": "Community Health Center Gomti Nagar",
    "role_description": "Handles day-to-day operations of the healthcare facility including patient management, staff coordination, medicine availability, reporting, and ensuring smooth execution of health services."
  },
  {
    "name": "Amit Tiwari",
    "email": "amit.tiwari@uphealth.abc.com",
    "password": "abc@123",
    "role": "District Health Officer",
    "district": "Mirzapur",
    "facility_name": "",
    "role_description": "Oversees implementation of district health programs, monitors healthcare indicators, coordinates with healthcare facilities, and supports administrative and operational health activities at the district level."
  }
];

let users = [];
let currentUser = null;
let ORIGINAL_SUGGESTIONS = [];
let isWaitingForResponse = false;
let remainingSuggestions = [];
let usedSuggestionIds = [];

document.addEventListener("DOMContentLoaded", () => {
  initUsers().then(()=>initQuestions()).then(() => {
    // initLLMConfigModal();
    // initSystemPromptModal();
    // checkLLMConfig();
    checkExistingSession();
    initLogin();
    initChatUI();
    initProfilePageNav();
  });
});

async function initUsers() {
  try {
    const res = await fetch(USERS_JSON_PATH);
    if (!res.ok) throw new Error("Failed to load users.json");
    users = await res.json();
  } catch (err) {
    console.error("Error loading users:", err);
    users = EMBEDDED_USERS;
  }
}

async function initQuestions() {
  try {
    const res = await fetch(QUESTIONS_JSON_PATH);
    if (!res.ok) throw new Error("Failed to load questions.json");
    ORIGINAL_SUGGESTIONS = await res.json();
  } catch (err) {
    console.error("Error loading questions:", err);
    ORIGINAL_SUGGESTIONS = EMBEDDED_QUESTIONS;
  }
}

function checkExistingSession() {
  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      
      // Recreate session prompt if it doesn't exist (e.g., after page refresh)
      if (!sessionStorage.getItem("session_system_prompt")) {
        createSessionSystemPrompt(currentUser);
      }
      
      showChatPage();
    } catch (err) {
      console.error("Error loading saved session:", err);
      localStorage.removeItem("currentUser");
    }
  }
}

function initLogin() {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    loginError.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!user) {
      loginError.textContent = "Invalid email or password.";
      return;
    }

    currentUser = user;
    // Save user to localStorage
    localStorage.setItem("currentUser", JSON.stringify(user));
    
    // Create session-based system prompt
    createSessionSystemPrompt(user);
    
    showChatPage();
  });
}

// Create session-based system prompt on login
function createSessionSystemPrompt(user) {
  let sessionPrompt = `You are an AI assistant to the ${user.role} of the UP Government Health Monitoring System.`;
  
  if (user.district) {
    sessionPrompt += `\nDistrict: ${user.district}`;
  }
  
  if (user.facility_name) {
    sessionPrompt += `\nFacility: ${user.facility_name}`;
  }
  
  sessionPrompt += `\n\n${getDefaultSystemPrompt()}`;
  
  // Store as session prompt (will be cleared on logout)
  sessionStorage.setItem("session_system_prompt", sessionPrompt);
}

function showChatPage() {
  document.getElementById("login-page").classList.add("hidden");
  document.getElementById("chat-page").classList.remove("hidden");
  document.getElementById("profile-page").classList.add("hidden");

  const navName = document.getElementById("nav-profile-name");
  const navAvatar = document.getElementById("nav-avatar");

  navName.textContent = currentUser.name || "User";
  navAvatar.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U";

  resetChatSession();
}

function logout() {
  currentUser = null;
  // Clear user from localStorage
  localStorage.removeItem("currentUser");
  
  // Clear session system prompt
  sessionStorage.removeItem("session_system_prompt");

  document.getElementById("chat-page").classList.add("hidden");
  document.getElementById("profile-page").classList.add("hidden");
  document.getElementById("login-page").classList.remove("hidden");

  document.getElementById("login-form").reset();
}

function initChatUI() {
  const navProfileBtn = document.getElementById("nav-profile-btn");
  const chatInput = document.getElementById("chat-input");
  const logoutTopBtn = document.getElementById("logout-top-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const systemPromptBtn = document.getElementById("system-prompt-btn");
  const homeBtn = document.getElementById("home-btn");

  // Disable chat input - it's only for display
  chatInput.disabled = true;
  chatInput.placeholder = "Click on a suggested question to ask";

  // Home button - reset chat and show suggestions
  homeBtn.addEventListener("click", () => {
    resetChatSession();
  });

  // System Prompt button (if it exists)
  if (systemPromptBtn) {
    systemPromptBtn.addEventListener("click", () => {
      showSystemPromptModal();
    });
  }

  // Settings button (if it exists)
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      showLLMConfigModal();
    });
  }

  // Top-nav logout
  logoutTopBtn.addEventListener("click", () => {
    logout();
  });

  // Build initial suggestion cards
  resetSuggestions();

  // Profile open
  navProfileBtn.addEventListener("click", () => {
    if (!currentUser) return;
    showProfilePage(currentUser);
  });

}

function initProfilePageNav() {
  const backBtn = document.getElementById("profile-back-to-chat-btn");
  const logoutBtn = document.getElementById("profile-logout-btn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      document.getElementById("profile-page").classList.add("hidden");
      document.getElementById("chat-page").classList.remove("hidden");
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      logout();
    });
  }
}


function resetChatSession() {
  const messagesEl = document.getElementById("messages");
  messagesEl.innerHTML = "";

  const statusLine = document.getElementById("status-line");
  setStatusThinking(statusLine, false);

  // Show suggestions card again
  const suggestionsCard = document.getElementById("suggestions-card-main");
  if (suggestionsCard) {
    suggestionsCard.classList.remove("hidden");
  }

  resetSuggestions();
  updateRecommendation();
}


function resetSuggestions() {
  remainingSuggestions = ORIGINAL_SUGGESTIONS.map(q => ({ ...q }));
  usedSuggestionIds = [];
  const grid = document.getElementById("suggestion-grid");
  grid.innerHTML = "";

  remainingSuggestions.forEach((item) => {
    const card = document.createElement("div");
    card.className = "suggestion-card";
    card.dataset.id = item.id;
    card.dataset.question = item.question;

    card.innerHTML = `
      <div class="suggestion-text">
        <div class="suggestion-keyword">${item.keyword}</div>
        <div class="suggestion-question">${item.question}</div>
      </div>
    `;

    card.addEventListener("click", () => {
      handleSuggestionClick(item.id, item.question);
    });

    grid.appendChild(card);
  });

  // Hide recommendation card initially (only show after first question)
  const recCard = document.getElementById("recommendation-card");
  recCard.classList.add("hidden");
  recCard.textContent = "";
}

function handleSuggestionClick(id, question) {
  // Don't remove the suggestion from the grid - keep it visible
  // Just mark it as used for recommendation purposes
  usedSuggestionIds.push(id);
  remainingSuggestions = remainingSuggestions.filter((q) => q.id !== id);

  // Hide the suggestions card for better readability
  const suggestionsCard = document.getElementById("suggestions-card-main");
  if (suggestionsCard) {
    suggestionsCard.classList.add("hidden");
  }

  // Pass the question ID along with the question text
  handleUserQuestion(question, id);
}

function updateRecommendation() {
  const recCard = document.getElementById("recommendation-card");

  if (!remainingSuggestions || remainingSuggestions.length === 0) {
    recCard.classList.add("hidden");
    recCard.textContent = "";
    return;
  }

  const randomIndex = Math.floor(Math.random() * remainingSuggestions.length);
  const suggestion = remainingSuggestions[randomIndex];

  recCard.innerHTML = `
    <span class="recommendation-label">Suggested:</span>
    <span class="recommendation-text">${suggestion.question}</span>
  `;

  recCard.onclick = () => {
    handleSuggestionClick(suggestion.id, suggestion.question);
  };

  recCard.classList.remove("hidden");
  recCard.style.animation = "none";
  recCard.offsetHeight;
  recCard.style.animation = "";
}

async function handleUserQuestion(question, questionId = null) {
  const statusLine = document.getElementById("status-line");

  appendMessage("user", question);

  isWaitingForResponse = true;
  setStatusThinking(statusLine, true);

  try {
    const answer = await getAnswerFromLLM(question, questionId);
    appendMessage("bot", answer);
    
    // Show recommendation only after answer is displayed
    updateRecommendation();
  } catch (err) {
    console.error(err);
    appendMessage("bot", "Sorry, I could not process your request at the moment.");
    statusLine.textContent = err.message || "Error while contacting AI service.";
  } finally {
    isWaitingForResponse = false;
    setStatusThinking(statusLine, false);
  }
}


function setStatusThinking(el, isThinking) {
  if (!isThinking) {
    el.textContent = "";
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    Thinking
    <span class="dot-pulse">
      <span></span><span></span><span></span>
    </span>
  `;
}

// function checkLLMConfig() {
//   const token = localStorage.getItem("llm_token");
//   const endpoint = localStorage.getItem("llm_endpoint");
//   
//   if (!token || !endpoint) {
//     // showLLMConfigModal();
//   }
// }

// function showLLMConfigModal() {
//   const modal = document.getElementById("llm-config-modal");
//   modal.classList.remove("hidden");
// }

// function hideLLMConfigModal() {
//   const modal = document.getElementById("llm-config-modal");
//   modal.classList.add("hidden");
// }

// function initLLMConfigModal() {
//   const form = document.getElementById("llm-config-form");
//   const cancelBtn = document.getElementById("llm-config-cancel");
//   
//   // Pre-fill if values exist
//   const savedToken = localStorage.getItem("llm_token");
//   const savedEndpoint = localStorage.getItem("llm_endpoint");
//   
//   if (savedToken) {
//     document.getElementById("llm-token").value = savedToken;
//   }
//   if (savedEndpoint) {
//     document.getElementById("llm-endpoint").value = savedEndpoint;
//   }
//   
//   form.addEventListener("submit", (e) => {
//     e.preventDefault();
//     
//     const token = document.getElementById("llm-token").value.trim();
//     const endpoint = document.getElementById("llm-endpoint").value.trim();
//     
//     if (!token || !endpoint) {
//       alert("Please provide both LLM token and endpoint.");
//       return;
//     }
//     
//     localStorage.setItem("llm_token", token);
//     localStorage.setItem("llm_endpoint", endpoint);
//     
//     hideLLMConfigModal();
//   });
//   
//   cancelBtn.addEventListener("click", () => {
//     const token = localStorage.getItem("llm_token");
//     const endpoint = localStorage.getItem("llm_endpoint");
//     
//     if (!token || !endpoint) {
//       alert("LLM configuration is required to use the application.");
//     } else {
//       hideLLMConfigModal();
//     }
//   });
// }

// Default system prompt template
function getDefaultSystemPrompt() {
  return `Based on the user's question and the provided healthcare data, provide a structured response in the following format:

## Overview
Provide a concise summary of the answer (2-3 sentences) with accurate data.

## Key Details
Provide detailed insights based on the data. Include:
- Specific findings from the data
- Relevant statistics or metrics
- Tables if needed (use markdown table format)
- Actionable recommendations

Use markdown formatting for better readability. If you don't have enough information, say so briefly.

Do not suggest any questions etc.`;
}

function showSystemPromptModal() {
  const modal = document.getElementById("system-prompt-modal");
  const textarea = document.getElementById("system-prompt-text");
  const subtitle = document.getElementById("system-prompt-subtitle");
  
  // Update subtitle to show current role
  subtitle.textContent = `Customize the system prompt for: ${currentUser.role}`;
  
  // Load session prompt (created on login)
  const sessionPrompt = sessionStorage.getItem("session_system_prompt");
  textarea.value = sessionPrompt || getDefaultSystemPrompt();
  
  modal.classList.remove("hidden");
}

function hideSystemPromptModal() {
  const modal = document.getElementById("system-prompt-modal");
  modal.classList.add("hidden");
}

function initSystemPromptModal() {
  const form = document.getElementById("system-prompt-form");
  const cancelBtn = document.getElementById("system-prompt-cancel");
  const resetBtn = document.getElementById("system-prompt-reset");
  
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const promptText = document.getElementById("system-prompt-text").value.trim();
    
    if (!promptText) {
      alert("System prompt cannot be empty.");
      return;
    }
    
    // Save to session storage (will be cleared on logout)
    sessionStorage.setItem("session_system_prompt", promptText);
    hideSystemPromptModal();
    alert("System prompt updated for this session!");
  });
  
  cancelBtn.addEventListener("click", () => {
    hideSystemPromptModal();
  });
  
  resetBtn.addEventListener("click", () => {
    if (!currentUser) return;
    
    // Reset to the default prompt created on login
    const textarea = document.getElementById("system-prompt-text");
    let resetPrompt = `You are an AI assistant to the ${currentUser.role} of the UP Government Health Monitoring System.`;
    
    if (currentUser.district) {
      resetPrompt += `\nDistrict: ${currentUser.district}`;
    }
    
    if (currentUser.facility_name) {
      resetPrompt += `\nFacility: ${currentUser.facility_name}`;
    }
    
    resetPrompt += `\n\n${getDefaultSystemPrompt()}`;
    textarea.value = resetPrompt;
  });
}

async function getAnswerFromLLM(question, questionId = null) {
  // Check if this is a predefined question with an answer
  if (questionId !== null) {
    const questionObj = ORIGINAL_SUGGESTIONS.find(item => item.id === questionId);
    
    // If the question has a pre-defined answer, use it
    if (questionObj && questionObj.answer && questionObj.answer.trim() !== "") {
      // Simulate 5 seconds of "thinking" time
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Return the pre-defined answer
      return questionObj.answer.trim();
    }
  }
  
  // If no pre-defined answer exists, fall back to LLM
  // // Get LLM configuration from localStorage
  // const llmToken = localStorage.getItem("llm_token");
  // const llmEndpoint = localStorage.getItem("llm_endpoint");
  
  // if (!llmToken || llmToken.trim() === "") {
  //   throw new Error("LLM token is not configured. Please configure it in settings.");
  // }
  
  // if (!llmEndpoint || llmEndpoint.trim() === "") {
  //   throw new Error("LLM endpoint is not configured. Please configure it in settings.");
  // }

  // // Get session system prompt (created on login, editable, cleared on logout)
  // let systemPrompt = sessionStorage.getItem("session_system_prompt");
  
  // // Fallback to default if session prompt doesn't exist
  // if (!systemPrompt) {
  //   systemPrompt = getDefaultSystemPrompt();
  // }
  
  // // Get data based on whether a specific question was clicked
  // let relevantData;
  // if (questionId !== null) {
  //   // Find the specific question and use only its data
  //   const questionObj = ORIGINAL_SUGGESTIONS.find(item => item.id === questionId);
  //   relevantData = questionObj ? (questionObj.data || []) : [];
  // } else {
  //   // For free-form questions, use all data
  //   relevantData = ORIGINAL_SUGGESTIONS.flatMap(item => item.data || []);
  // }
  
  // // Build user prompt with question and data
  // let userPrompt = `User question: "${question}"\n\n`;
  // userPrompt += `Healthcare Data:\n${JSON.stringify(relevantData, null, 2)}`;

  // const body = {
  //   model: LLM_MODEL,
  //   messages: [
  //     { role: "system", content: systemPrompt },
  //     { role: "user", content: userPrompt }
  //   ]
  // };

  // const headers = {
  //   "Content-Type": "application/json",
  //   "Authorization": `Bearer ${llmToken.trim()}:upksk`
  // };

  // const response = await fetch(llmEndpoint, {
  //   method: "POST",
  //   headers,
  //   body: JSON.stringify(body)
  // });

  // if (!response.ok) {
  //   const text = await response.text();
  //   console.error("LLM error:", response.status, text);

  //   if (response.status === 401) {
  //     throw new Error("Unauthorized (401). Check that your LLM token is correct and active.");
  //   }

  //   throw new Error("LLM request failed with status " + response.status);
  // }

  // const data = await response.json();
  // const answer = data.choices?.[0]?.message?.content || "No answer returned.";
  // console.log(answer);
  // return answer.trim();
}

function appendMessage(role, text) {
  const messagesEl = document.getElementById("messages");
  const msgEl = document.createElement("div");
  msgEl.classList.add("message", role);

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");
  
  // Use marked.parse for bot messages to render markdown
  if (role === "bot" && typeof marked !== "undefined") {
    bubble.innerHTML = marked.parse(text);
  } else {
    bubble.textContent = text;
  }

  const ts = document.createElement("div");
  ts.classList.add("timestamp");
  ts.textContent = new Date().toLocaleTimeString();

  msgEl.appendChild(bubble);
  msgEl.appendChild(ts);
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


function showProfilePage(user) {
  const profilePage = document.getElementById("profile-page");
  const chatPage = document.getElementById("chat-page");
  const content = document.getElementById("profile-page-content");

  const safeName = user.name || "User";
  const firstLetter = safeName.charAt(0).toUpperCase();

  const html = `
    <div class="profile-left-card">
      <div class="profile-header">
        <div class="profile-avatar">
          ${firstLetter}
        </div>
        <div class="profile-main-info">
          <div class="profile-name">${safeName}</div>
          ${user.email ? `<div class="profile-email">${user.email}</div>` : ""}
          ${user.role ? `<div class="profile-role-pill">${user.role}</div>` : ""}
        </div>
      </div>
    </div>

    <div class="profile-right-card">
      <div class="profile-section-title">Profile Details</div>
      <div class="profile-details-list">
        <div class="profile-detail-item">
          <div class="profile-detail-label">Name</div>
          <div class="profile-detail-value">${safeName}</div>
        </div>

        ${user.role ? `
        <div class="profile-detail-item">
          <div class="profile-detail-label">Role</div>
          <div class="profile-detail-value">${user.role}</div>
        </div>` : ""}

        ${user.email ? `
        <div class="profile-detail-item">
          <div class="profile-detail-label">Email</div>
          <div class="profile-detail-value">${user.email}</div>
        </div>` : ""}

        ${user.district ? `
        <div class="profile-detail-item">
          <div class="profile-detail-label">District</div>
          <div class="profile-detail-value">${user.district}</div>
        </div>` : ""}

        ${user.facility_name ? `
        <div class="profile-detail-item">
          <div class="profile-detail-label">Facility</div>
          <div class="profile-detail-value">${user.facility_name}</div>
        </div>` : ""}
      </div>
    </div>
  `;

  content.innerHTML = html;

  chatPage.classList.add("hidden");
  profilePage.classList.remove("hidden");
}