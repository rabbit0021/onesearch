// #region Element References
const emailInput = document.getElementById('email');
const companyInput = document.getElementById('companyInput');
const techTeamGroup = document.querySelector('.form-group.tech-team-group');
const tagContainer = document.getElementById('selected-techteams');
const hiddenInput = document.getElementById('categories-hidden');
const form = document.getElementById("subscribe-form");
const companyDropdown = document.getElementById('companyDropdown');
const topicInput = document.getElementById('topicInput');
const topicDropdown = document.getElementById('topicDropdown');
const notifyCheckboxes = document.querySelectorAll('input[name="notify_from"]');
const subscription_status = document.getElementById("already-subscribed");
const icon = document.getElementById('notification-icon');
const panel = document.getElementById('right-panel');
const dot = document.getElementById("notification-dot");
const chatMessage = document.getElementById("chat-message");
const chatContainer = document.getElementById("chat-message");
const interestedButton = document.getElementById("interested-button");
const feedbackButton = document.getElementById("feedback-button");
const feedbackContainer = document.getElementById("feedback-form-container");

// #endregion

// #region State
let selectedTechTeams = [];
let allCompanies = [];
let allCategories = [];
// #endregion

// #region Form Submit
form.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = emailInput.value;
    const techteams = selectedTechTeams;
    const individuals = [];
    const communities = [];
    const topic = topicInput.value.trim();

    if (!email || !topic || (techteams.length === 0 && individuals.length === 0 && communities.length === 0)) {
        alert("Please enter your email, topic, and select at least one publisher.");
        return;
    }

    const data = new URLSearchParams({
        email: email,
        techteams: techteams.join(","),
        topic: topicInput.value,
    });

    fetch("/subscribe", {
        method: "POST",
        body: data,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    })
    .then((res) => res.json())
    .then((result) => {
        if (result.status === "success") {
            showToast("Subscription Updated!", 3000);
            form.reset();
            selectedTechTeams = [];
            renderTags();
            displaySubscriptionStatus("");
            companyInput.disabled = true; // show

        } else {
            alert(result.message);
        }
    });
});
// #endregion

// #region Prefill Subscription Info
emailInput.addEventListener("blur", () => {
    const email = emailInput.value.trim();
    if (!email){
        return
    }

    fetch(`/subscriptions_for_email?email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(data => {
            displaySubscriptionStatus(data);
        });
});

function displaySubscriptionStatus(data) {
    subscription_status.innerHTML = "";

    if (!Object.keys(data).length) return;

    const heading = document.createElement("div");
    heading.textContent = "Already Subscribed To:";
    heading.style.marginTop = "1.5em";
    heading.style.fontWeight = "600";
    heading.style.fontSize = "16px";
    heading.style.color = "#444";
    subscription_status.appendChild(heading);

    const list = document.createElement("ul");
    list.style.listStyle = "none";
    list.style.padding = "0";
    list.style.marginTop = "0.5em";

    for (const [topic, publishers] of Object.entries(data)) {
        const item = document.createElement("li");
        item.style.marginBottom = "6px";
        item.style.color = "#333";
        item.style.fontSize = "14px";
        item.style.lineHeight = "1.4";
        item.innerHTML = `<strong style="color: #2a2a2a;">${topic}</strong>: ${
            publishers.map(pub => pub.charAt(0).toUpperCase() + pub.slice(1)).join(", ")
        }`;
        list.appendChild(item);
    }

    subscription_status.appendChild(list);
}
// #endregion

// #region Fetch Companies and Categories
fetch('/techteams')
  .then(res => res.json())
  .then(companies => {
    allCompanies = companies.map(c => 
      c.charAt(0).toUpperCase() + c.slice(1)
    );
  });

allTopics = [
  "Software Engineering",
  "Data Science",
  "Data Analytics",
  "Software Testing",
  "Product Management"
];

topicInput.addEventListener('input', handleTopicSelect);
topicInput.addEventListener('focus', handleTopicSelect);

notifyCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener('change', (event) => {
    const value = event.target.value;   // "tech_teams", "individuals", etc.
    const checked = event.target.checked;

    if (checked) {
      // Perform your action for selected checkbox
      handleCheckboxSelect(value);
    } else {
      // Perform your action for deselected checkbox
      handleCheckboxDeselect(value);
    }
  });
});

// Example action functions
function handleCheckboxSelect(value) {
  if (value === 'tech_teams') {
    companyInput.disabled = false; // show
  }
}

function handleCheckboxDeselect(value) {
  if (value === 'tech_teams') {
    companyInput.disabled = true; // show
  }
}

function handleTopicSelect() {
  showDropdown(topicInput, topicDropdown, allTopics, selected => {
    topicInput.value = selected;
    topicDropdown.style.display = 'none';
  });
}

// #endregion

//#region Category Dropdown
companyInput.addEventListener('focus', () => {
  showDropdown(companyInput, companyDropdown, allCompanies, selected => {
    companyInput.value = '';
    companyDropdown.style.display = 'none';
    if (!selectedTechTeams.includes(selected)) {
      selectedTechTeams.push(selected);
      addTechTeamTag(selected);
      companyInput.value = '';
    }
  });
});

companyInput.addEventListener('input', () => {
  showDropdown(companyInput, companyDropdown, allCompanies, selected => {
    companyInput.value = '';
    companyDropdown.style.display = 'none';
    if (!selectedTechTeams.includes(selected)) {
      selectedTechTeams.push(selected);
      addTechTeamTag(selected);
      companyInput.value = '';
    }
  });
});

companyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const value = companyInput.value.trim();
    if (value && !selectedTechTeams.includes(value)) {
      selectedTechTeams.push(value);
      addTechTeamTag(value);
      companyInput.value = '';
    }
  }
});
// #endregion

// #region Dropdown Handling
function showDropdown(inputEl, dropdownEl, items, onSelect) {
  const value = inputEl.value.toLowerCase();
  const filtered = items.filter(item => item.toLowerCase().includes(value));
  dropdownEl.innerHTML = '';
  if (filtered.length > 0) {
    dropdownEl.style.display = 'block';
    filtered.forEach(item => {
      const option = document.createElement('div');
      option.textContent = item;
      option.onclick = () => onSelect(item);
      dropdownEl.appendChild(option);
    });
    const rect = inputEl.getBoundingClientRect();
    dropdownEl.style.top = `${rect.bottom + window.scrollY}px`;
    dropdownEl.style.left = `${rect.left + window.scrollX}px`;
  } else {
    dropdownEl.style.display = 'none';
  }
}
// #endregion

// #region Tag Handling
function addTechTeamTag(techteam) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = techteam;

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'x';
  removeBtn.onclick = () => {
    tag.remove();
    selectedTechTeams = selectedTechTeams.filter(c => c !== techteam);
  };

  tag.appendChild(removeBtn);
  tagContainer.appendChild(tag);
}

function renderTags() {
  tagContainer.innerHTML = '';
}
// #endregion

// #region Validation
function handleSubmit() {
    if (selectedCategories.length === 0) {
        alert("Please select at least one category.");
        return false;
    }
    return true;
}

document.addEventListener('click', (e) => {

  if (!panel.contains(e.target) && e.target !== icon) {
    panel.classList.remove("active");
  }

  if (!companyDropdown.contains(e.target) && e.target !== companyInput) {
    companyDropdown.style.display = 'none';
  }

  if (!topicDropdown.contains(e.target) && e.target !== topicInput) {
    topicDropdown.style.display = 'none';
  }
});

function showToast(message, duration = 3000) {
  let toast = document.querySelector('.subscription-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'subscription-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

icon.addEventListener("click", () => {
  // Toggle panel visibility
  panel.classList.toggle("active");

  // Hide the red dot when clicked
  if (dot.style.display !== "none") {
    dot.style.display = "none";
  }

 const clearContent = (e) => {
      if (e.propertyName === "right" && !panel.classList.contains("active")) {
        chatContainer.innerHTML = ""; 
        panel.removeEventListener("transitionend", clearContent);
      }
    };
    panel.addEventListener("transitionend", clearContent);
});

interestedButton.addEventListener("click", () => {
  // call backend server to log interest
  fetch("/interested", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: emailInput.value.trim() }),
  })
  .then(response => {
    if (response.ok) {
       showToast("Thank you for your interest! We'll keep you updated.");
    }
    else {
      alert("Something went wrong. Please try again later.");
    }
  })
});

feedbackButton.addEventListener("click", () => {
  // Only create one form
  if (feedbackContainer.children.length > 0) return;

  // Create simple feedback card
  const card = document.createElement("div");
  card.className = "feedback-form-card";
  card.innerHTML = `
    <textarea placeholder="Type your feedback here..."></textarea>
    <button>Send</button>
  `;
  feedbackContainer.appendChild(card);

  // Show the card
  card.style.display = "block";

  // Handle Send button
  card.querySelector("button").addEventListener("click", () => {
    const message = card.querySelector("textarea").value.trim();
    if (!message) return alert("Please enter feedback");

    const data = new URLSearchParams({
        feedback: message,
    });
    // Here you would typically send the feedback to your server
    // Send JSON to Flask
    fetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: message })  // <-- JSON.stringify needed
    })
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        showToast("Feedback sent successfully");
      } else {
        alert(data.message || "Error sending feedback");
      }
    })

    // Remove the card after sending
    feedbackContainer.removeChild(card);
  });
});
