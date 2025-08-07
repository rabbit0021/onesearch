// #region Element References
const emailInput = document.getElementById('email');
const companyInput = document.getElementById('companyInput');
const categoryInput = document.getElementById('categoryInput');
const tagContainer = document.getElementById('selected-categories');
const hiddenInput = document.getElementById('categories-hidden');
const form = document.getElementById("subscribe-form");
const companyDropdown = document.getElementById('companyDropdown');
const categoryDropdown = document.getElementById('categoryDropdown');
// #endregion

// #region State
let selectedCategories = [];
let allCompanies = [];
let allCategories = [];
// #endregion

// #region Form Submit
form.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = emailInput.value;
    const company = companyInput.value;
    const categories = selectedCategories;

    if (!email || !company || categories.length === 0) {
        alert("Please fill all fields and select at least one category.");
        return;
    }

    const data = new URLSearchParams({
        email: email,
        company: company,
        categories: categories.join(","),
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
        const msgEl = document.getElementById("subscribe-message");

        if (result.status === "success") {
            msgEl.textContent = result.message;
            msgEl.style.display = "block";

            setTimeout(() => {
                msgEl.style.display = "none";
            }, 5000);

            form.reset();
            selectedCategories = [];
            renderTags();
        } else {
            alert("Subscription failed.");
        }
    });
});
// #endregion

// #region Prefill Subscription Info
emailInput.addEventListener("input", (e) => {
    const email = e.target.value.trim();
    if (!email) return;

    fetch(`/subscriptions_for_email?email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(data => {
            const section = document.getElementById("already-subscribed");
            section.innerHTML = "";

            if (Object.keys(data).length === 0) return;

            const heading = document.createElement("div");
            heading.textContent = "Already Subscribed To:";
            heading.style.marginTop = "1.5em";
            heading.style.fontWeight = "600";
            heading.style.fontSize = "16px";
            heading.style.color = "#444";
            section.appendChild(heading);

            const list = document.createElement("ul");
            list.style.listStyle = "none";
            list.style.padding = "0";
            list.style.marginTop = "0.5em";

            for (const [company, categories] of Object.entries(data)) {
                const item = document.createElement("li");
                item.style.marginBottom = "6px";
                item.style.color = "#333";
                item.style.fontSize = "14px";
                item.style.lineHeight = "1.4";
                item.innerHTML = `<strong style="color: #2a2a2a;">${company}</strong>: ${categories.join(", ")}`;
                list.appendChild(item);
            }

            section.appendChild(list);
        });
});
// #endregion

// #region Fetch Companies and Categories
fetch('/companies')
  .then(res => res.json())
  .then(companies => {
    allCompanies = companies.map(c => c.company);
  });

companyInput.addEventListener('input', handleCompanySelect);
companyInput.addEventListener('focus', handleCompanySelect);

function handleCompanySelect() {
  showDropdown(companyInput, companyDropdown, allCompanies, selected => {
    companyInput.value = selected;
    companyDropdown.style.display = 'none';

    fetch(`/categories?company=${encodeURIComponent(selected)}`)
      .then(res => res.json())
      .then(categories => {
        allCategories = categories;
        categoryInput.value = '';
        categoryDropdown.innerHTML = '';
      });
  });
}
// #endregion

// #region Category Dropdown
categoryInput.addEventListener('focus', () => {
  showDropdown(categoryInput, categoryDropdown, allCategories, selected => {
    categoryInput.value = '';
    categoryDropdown.style.display = 'none';
    if (!selectedCategories.includes(selected)) {
      selectedCategories.push(selected);
      addCategoryTag(selected);
      categoryInput.value = '';
    }
  });
});

categoryInput.addEventListener('input', () => {
  showDropdown(categoryInput, categoryDropdown, allCategories, selected => {
    categoryInput.value = '';
    categoryDropdown.style.display = 'none';
    if (!selectedCategories.includes(selected)) {
      selectedCategories.push(selected);
      addCategoryTag(selected);
      categoryInput.value = '';
    }
  });
});

categoryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const value = categoryInput.value.trim();
    if (value && !selectedCategories.includes(value)) {
      selectedCategories.push(value);
      addCategoryTag(value);
      categoryInput.value = '';
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

document.addEventListener('click', e => {
  if (!companyDropdown.contains(e.target) && e.target !== companyInput) {
    companyDropdown.style.display = 'none';
  }
  if (!categoryDropdown.contains(e.target) && e.target !== categoryInput) {
    categoryDropdown.style.display = 'none';
  }
});
// #endregion

// #region Tag Handling
function addCategoryTag(category) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = category;

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'x';
  removeBtn.onclick = () => {
    tag.remove();
    selectedCategories = selectedCategories.filter(c => c !== category);
  };

  tag.appendChild(removeBtn);
  tagContainer.appendChild(tag);
}

function renderTags() {
  tagContainer.innerHTML = '';
  selectedCategories.forEach(tag => addCategoryTag(tag));
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
// #endregion
