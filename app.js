// app.js — 할 일 관리 앱: 데이터 / 렌더링 / 이벤트 / 초기화

// ---------- 상수 & 상태 ----------

const STORAGE_KEY = "todos";

const CATEGORY_LABELS = {
    work: "업무",
    personal: "개인",
    study: "공부",
};

// 자동 분류용 키워드 — 텍스트에 포함된 키워드 수가 가장 많은 카테고리로 분류한다.
const CATEGORY_KEYWORDS = {
    work: [
        "회의", "미팅", "보고서", "보고", "이메일", "메일", "발표", "프로젝트",
        "클라이언트", "고객", "업무", "출장", "결재", "기획", "마감", "회사",
        "팀", "거래처", "계약",
    ],
    study: [
        "공부", "강의", "수업", "시험", "과제", "숙제", "학습", "독서", "책",
        "영어", "수학", "국어", "인강", "복습", "예습", "학원", "자격증",
        "토익", "토플", "코딩", "논문",
    ],
    personal: [
        "운동", "헬스", "요가", "산책", "조깅", "쇼핑", "장보기", "약속", "친구",
        "가족", "영화", "여행", "식사", "점심", "저녁", "아침", "병원", "청소",
        "빨래", "은행", "미용실",
    ],
};

const CATEGORY_KEYWORDS_LOWER = Object.fromEntries(
    Object.entries(CATEGORY_KEYWORDS).map(([cat, kws]) => [cat, kws.map((kw) => kw.toLowerCase())])
);

const AUTO_FALLBACK_CATEGORY = "personal";

let currentFilter = "all";

let todoListEl;
let todoInputEl;
let categorySelectEl;
let addButtonEl;
let progressBarFillEl;
let progressTextEl;
let filterButtonEls;
let autoHintEl;

// ---------- 자동 카테고리 분류 ----------

function classifyByKeywords(text) {
    if (!text) return AUTO_FALLBACK_CATEGORY;
    const lower = text.toLowerCase();
    let best = AUTO_FALLBACK_CATEGORY;
    let bestScore = 0;
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS_LOWER)) {
        let score = 0;
        for (const kw of keywords) {
            if (lower.includes(kw)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            best = category;
        }
    }
    return best;
}

function resolveCategory(selectValue, text) {
    return selectValue === "auto" ? classifyByKeywords(text) : selectValue;
}

// ---------- 데이터 계층 ----------

function loadTodos() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveTodos(todos) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
        console.error("할 일 저장 실패 (localStorage 용량 초과 등):", e);
    }
}

function addTodo(text, category) {
    const todos = loadTodos();
    const todo = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        category,
        completed: false,
        createdAt: new Date().toISOString(),
    };
    todos.push(todo);
    saveTodos(todos);
    return todo;
}

function updateTodo(id, newText, newCategory) {
    const todos = loadTodos();
    const todo = todos.find((t) => t.id === id);
    if (!todo) return null;
    todo.text = newText;
    todo.category = newCategory;
    saveTodos(todos);
    return todo;
}

function deleteTodo(id) {
    const todos = loadTodos();
    const next = todos.filter((t) => t.id !== id);
    saveTodos(next);
}

function toggleTodo(id) {
    const todos = loadTodos();
    const todo = todos.find((t) => t.id === id);
    if (!todo) return null;
    todo.completed = !todo.completed;
    saveTodos(todos);
    return todo;
}

// ---------- 렌더링 ----------

function renderTodos() {
    const all = loadTodos();
    const visible = currentFilter === "all"
        ? all
        : all.filter((t) => t.category === currentFilter);

    todoListEl.innerHTML = "";

    const fragment = document.createDocumentFragment();
    if (visible.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = all.length === 0
            ? "아직 할 일이 없어요. 위에서 추가해보세요!"
            : "이 카테고리에는 할 일이 없어요.";
        fragment.appendChild(empty);
    } else {
        for (const todo of visible) {
            fragment.appendChild(buildTodoItem(todo));
        }
    }
    todoListEl.appendChild(fragment);

    updateProgress(all);
}

function buildTodoItem(todo) {
    const li = document.createElement("li");
    li.className = "todo-item";
    li.dataset.id = todo.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.completed;

    const categoryEl = document.createElement("span");
    categoryEl.className = `category-label category-${todo.category}`;
    categoryEl.textContent = CATEGORY_LABELS[todo.category] ?? todo.category;

    const textEl = document.createElement("span");
    textEl.className = "todo-text";
    if (todo.completed) textEl.classList.add("completed");
    textEl.textContent = todo.text;

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "edit-button";
    editBtn.textContent = "수정";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-button";
    deleteBtn.textContent = "삭제";

    li.append(checkbox, categoryEl, textEl, editBtn, deleteBtn);
    return li;
}

function updateProgress(all) {
    const total = all.length;
    const done = all.filter((t) => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    progressBarFillEl.style.width = percent + "%";
    progressTextEl.textContent = `${done} / ${total} 완료 (${percent}%)`;
}

function setFilter(filter) {
    currentFilter = filter;
    for (const btn of filterButtonEls) {
        btn.classList.toggle("active", btn.dataset.filter === filter);
    }
    renderTodos();
}

// ---------- 이벤트 핸들러 ----------

function handleAdd() {
    const text = todoInputEl.value.trim();
    if (!text) return;
    const category = resolveCategory(categorySelectEl.value, text);
    addTodo(text, category);
    todoInputEl.value = "";
    updateAutoHint();
    renderTodos();
}

function updateAutoHint() {
    if (!autoHintEl) return;
    if (categorySelectEl.value !== "auto") {
        autoHintEl.hidden = true;
        return;
    }
    const text = todoInputEl.value.trim();
    if (!text) {
        autoHintEl.hidden = true;
        return;
    }
    const category = classifyByKeywords(text);
    autoHintEl.hidden = false;
    autoHintEl.textContent = `자동 분류: ${CATEGORY_LABELS[category]}`;
}

function startEdit(li, todo) {
    li.innerHTML = "";
    li.classList.add("editing");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit-input";
    input.value = todo.text;

    const select = document.createElement("select");
    select.className = "edit-category";
    const autoOpt = document.createElement("option");
    autoOpt.value = "auto";
    autoOpt.textContent = "자동";
    select.appendChild(autoOpt);
    for (const [value, label] of Object.entries(CATEGORY_LABELS)) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (value === todo.category) opt.selected = true;
        select.appendChild(opt);
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "저장";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "취소";

    const commit = () => {
        const newText = input.value.trim();
        if (!newText) {
            input.classList.add("error");
            setTimeout(() => input.classList.remove("error"), 1000);
            return;
        }
        const newCategory = resolveCategory(select.value, newText);
        updateTodo(todo.id, newText, newCategory);
        renderTodos();
    };

    const cancel = () => renderTodos();

    saveBtn.addEventListener("click", commit);
    cancelBtn.addEventListener("click", cancel);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) commit();
        else if (e.key === "Escape") cancel();
    });

    li.append(input, select, saveBtn, cancelBtn);
    input.focus();
    input.select();
}

// ---------- 초기화 ----------

document.addEventListener("DOMContentLoaded", () => {
    todoListEl = document.getElementById("todo-list");
    todoInputEl = document.getElementById("todo-input");
    categorySelectEl = document.getElementById("category-select");
    addButtonEl = document.getElementById("add-button");
    progressBarFillEl = document.getElementById("progress-bar-fill");
    progressTextEl = document.getElementById("progress-text");
    filterButtonEls = document.querySelectorAll(".filter-button");
    autoHintEl = document.getElementById("auto-hint");

    todoListEl.addEventListener("change", (e) => {
        if (!e.target.classList.contains("todo-checkbox")) return;
        const li = e.target.closest("li[data-id]");
        if (!li) return;
        toggleTodo(li.dataset.id);
        renderTodos();
    });

    todoListEl.addEventListener("click", (e) => {
        const li = e.target.closest("li[data-id]");
        if (!li) return;
        if (e.target.classList.contains("edit-button")) {
            const todos = loadTodos();
            const todo = todos.find((t) => t.id === li.dataset.id);
            if (todo) startEdit(li, todo);
        } else if (e.target.classList.contains("delete-button")) {
            deleteTodo(li.dataset.id);
            renderTodos();
        }
    });

    addButtonEl.addEventListener("click", handleAdd);
    todoInputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) handleAdd();
    });

    let autoHintTimer = null;
    todoInputEl.addEventListener("input", () => {
        clearTimeout(autoHintTimer);
        autoHintTimer = setTimeout(updateAutoHint, 150);
    });
    categorySelectEl.addEventListener("change", updateAutoHint);
    updateAutoHint();

    for (const btn of filterButtonEls) {
        btn.addEventListener("click", () => setFilter(btn.dataset.filter));
    }

    setFilter(currentFilter);
});