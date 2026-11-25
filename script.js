(() => {
      const STORAGE_KEY = 'rashody.expenses.v1';
      const LIMITS_STORAGE_KEY = 'rashody.budgets.v1';
      const categoryIcons = { Еда: '🍽️', Транспорт: '🚗', Дом: '🏠', Другое: '✦' };
      const form = document.querySelector('#expense-form');
      const amountInput = document.querySelector('#amount');
      const categoryInput = document.querySelector('#category');
      const dateInput = document.querySelector('#date');
      const errorMessage = document.querySelector('#form-error');
      const formTitle = document.querySelector('#form-title');
      const submitLabel = document.querySelector('#expense-submit-label');
      const cancelEditButton = document.querySelector('#cancel-edit');
      const entries = document.querySelector('#entries');
      const limitList = document.querySelector('#limit-list');
      const numberFormat = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 });
      const pad = value => String(value).padStart(2, '0');
      const localDateValue = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      dateInput.value = localDateValue();

      function loadExpenses() {
        try {
          const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
          if (!Array.isArray(data)) return [];
          return data.filter(item => item && Number.isSafeInteger(Number(item.amount)) && Number(item.amount) > 0 && categoryIcons[item.category] && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.createdAt));
        } catch { return []; }
      }
      let expenses = loadExpenses();
      let editingExpenseId = null;
      let latestCreatedAt = expenses.reduce((latest, item) => Math.max(latest, item.createdAt), 0);
      let limits = loadLimits();

      function loadLimits() {
        try {
          const data = JSON.parse(localStorage.getItem(LIMITS_STORAGE_KEY) || '{}');
          if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
          return Object.fromEntries(Object.entries(data).filter(([category, value]) =>
            categoryIcons[category] && Number.isSafeInteger(Number(value)) && Number(value) > 0
          ).map(([category, value]) => [category, Number(value)]));
        } catch { return {}; }
      }
      function persistLimits(nextLimits) {
        try {
          localStorage.setItem(LIMITS_STORAGE_KEY, JSON.stringify(nextLimits));
          return true;
        } catch { return false; }
      }
      function renderLimitForms() {
        limitList.replaceChildren();
        Object.entries(categoryIcons).forEach(([category, icon], index) => {
          const key = ['food', 'transport', 'home', 'other'][index];
          const form = document.createElement('form');
          form.className = 'limit-form';
          form.noValidate = true;
          const label = document.createElement('label');
          label.className = 'limit-category';
          label.htmlFor = `limit-${key}`;
          label.textContent = `${icon} ${category}`;
          const valueWrap = document.createElement('div');
          valueWrap.className = 'limit-input-wrap';
          const input = document.createElement('input');
          input.id = `limit-${key}`;
          input.name = 'limit';
          input.type = 'number';
          input.min = '1';
          input.step = '1';
          input.inputMode = 'numeric';
          input.placeholder = 'Сумма';
          input.required = true;
          input.setAttribute('aria-label', `Месячный лимит: ${category}`);
          input.setAttribute('aria-describedby', `limit-error-${key} limit-status-${key}`);
          if (limits[category] !== undefined) input.value = String(limits[category]);
          const currency = document.createElement('span');
          currency.className = 'limit-currency';
          currency.setAttribute('aria-hidden', 'true');
          currency.textContent = '₸';
          valueWrap.append(input, currency);
          const error = document.createElement('p');
          error.id = `limit-error-${key}`;
          error.className = 'limit-message limit-error';
          error.setAttribute('role', 'alert');
          error.hidden = true;
          const status = document.createElement('p');
          status.id = `limit-status-${key}`;
          status.className = 'limit-message limit-status';
          status.setAttribute('role', 'status');
          status.textContent = 'Лимит сохранён';
          status.hidden = true;
          const button = document.createElement('button');
          button.className = 'limit-save';
          button.type = 'submit';
          button.textContent = 'Сохранить';
          const summary = document.createElement('div');
          summary.id = `limit-summary-${key}`;
          summary.className = 'limit-summary';
          form.append(label, valueWrap, button, error, status, summary);
          form.addEventListener('input', () => { error.hidden = true; status.hidden = true; });
    
      form.addEventListener('submit', event => {
            event.preventDefault();
            error.hidden = true;
            status.hidden = true;
            const amount = Number(input.value);
            if (input.value === '' || !Number.isSafeInteger(amount) || amount <= 0) {
              error.textContent = 'Введите целый лимит больше нуля.';
              error.hidden = false;
              input.focus();
              return;
            }
            const nextLimits = { ...limits, [category]: amount };
            if (!persistLimits(nextLimits)) {
              error.textContent = 'Не удалось сохранить лимит в браузере. Повторите попытку.';
              error.hidden = false;
              input.focus();
              return;
            }
            limits = nextLimits;
            status.hidden = false;
            renderLimitSummaries();
          });
          limitList.append(form);
        });
      }
      function renderLimitSummaries() {
        const currentMonth = localDateValue().slice(0, 7);
        Object.keys(categoryIcons).forEach((category, index) => {
          const key = ['food', 'transport', 'home', 'other'][index];
          const summary = document.querySelector(`#limit-summary-${key}`);
          if (!summary) return;
          const spent = expenses.reduce((sum, item) =>
            item.category === category && item.date.startsWith(`${currentMonth}-`) ? sum + Number(item.amount) : sum, 0
          );
          summary.replaceChildren();
          const limitStat = document.createElement('div');
          limitStat.className = 'limit-stat';
          const limitLabel = document.createElement('span');
          limitLabel.textContent = 'Лимит';
          const limitValue = document.createElement('strong');
          limitValue.textContent = limits[category] === undefined ? 'Не задан' : numberFormat.format(limits[category]);
          limitStat.append(limitLabel, limitValue);
          summary.append(limitStat);
          const spentStat = document.createElement('div');
          spentStat.className = 'limit-stat';
          const spentLabel = document.createElement('span');
          spentLabel.textContent = 'Потрачено';
          const spentValue = document.createElement('strong');
          spentValue.textContent = numberFormat.format(spent);
          spentStat.append(spentLabel, spentValue);
          summary.append(spentStat);
          if (limits[category] === undefined) return;
          const remainingStat = document.createElement('div');
          remainingStat.className = 'limit-stat';
          const remainingLabel = document.createElement('span');
          remainingLabel.textContent = 'Осталось';
          const remainingValue = document.createElement('strong');
          remainingValue.textContent = numberFormat.format(limits[category] - spent);
          remainingStat.append(remainingLabel, remainingValue);
          summary.append(remainingStat);
        });
      }

      function persistExpenses() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
          return true;
        } catch {
          return false;
        }
      }
      function localDateFromISO(value) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      function formatDate(value) {
        return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(localDateFromISO(value));
      }
      function pluralRecords(value) {
        const n = value % 100;
        const last = n % 10;
        if (n >= 11 && n <= 19) return 'записей';
        if (last === 1) return 'запись';
        if (last >= 2 && last <= 4) return 'записи';
        return 'записей';
      }
      function renderEmpty() {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML = '<div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7.5h14M7 4.5h10M7 10.5v8A1.5 1.5 0 0 0 8.5 20h7a1.5 1.5 0 0 0 1.5-1.5v-8M10 13v4m4-4v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="empty-title">Пока нет трат</div><div class="empty-hint">Добавьте первую запись — она появится здесь</div>';
        entries.append(empty);
      }
      function render() {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
        document.querySelector('#month-name').textContent = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(now);
        const monthlyTotal = expenses.reduce((sum, item) => item.date.startsWith(`${yearMonth}-`) ? sum + Number(item.amount) : sum, 0);
        document.querySelector('#month-total').textContent = numberFormat.format(monthlyTotal);
        renderLimitSummaries();

        const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
        document.querySelector('#entry-count').textContent = `${sorted.length} ${pluralRecords(sorted.length)}`;
        entries.replaceChildren();
        if (sorted.length === 0) {
          renderEmpty();
          return;
        }
        for (const item of sorted) {
          const row = document.createElement('article');
          row.className = 'entry';
          const icon = document.createElement('div');
          icon.className = 'category-icon';
          icon.setAttribute('aria-hidden', 'true');
          icon.textContent = categoryIcons[item.category];
          const info = document.createElement('div');
          info.className = 'entry-info';
          const comment = document.createElement('div');
          comment.className = 'entry-comment';
          comment.textContent = item.comment || item.category;
          const details = document.createElement('div');
          details.className = 'entry-details';
          const category = document.createElement('span');
          category.textContent = item.category;
          const date = document.createElement('span');
          date.textContent = formatDate(item.date);
          details.append(category, date);
          info.append(comment, details);
          const amount = document.createElement('div');
          amount.className = 'entry-amount';
          amount.textContent = numberFormat.format(Number(item.amount));
          const side = document.createElement('div');
          side.className = 'entry-side';
          const editButton = document.createElement('button');
          editButton.type = 'button';
          editButton.className = 'entry-edit';
          editButton.textContent = 'Изменить';
          editButton.setAttribute('aria-label', `Изменить трату: ${numberFormat.format(Number(item.amount))}, ${item.category}, ${formatDate(item.date)}`);
          editButton.addEventListener('click', () => {
            editingExpenseId = item.id;
            amountInput.value = String(item.amount);
            categoryInput.value = item.category;
            dateInput.value = item.date;
            document.querySelector('#comment').value = item.comment || '';
            formTitle.textContent = 'Изменить трату';
            submitLabel.textContent = 'Сохранить изменения';
            cancelEditButton.hidden = false;
            clearError();
            amountInput.focus();
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
          side.append(amount, editButton);
          row.append(icon, info, side);
          entries.append(row);
        }
      }

      function showError(message, focusTarget) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
        focusTarget?.focus();
      }
      function clearError() {
        errorMessage.textContent = '';
        errorMessage.hidden = true;
      }
      function cancelEditing() {
        editingExpenseId = null;
        form.reset();
        dateInput.value = localDateValue();
        formTitle.textContent = 'Добавить трату';
        submitLabel.textContent = 'Добавить трату';
        cancelEditButton.hidden = true;
        clearError();
      }
      cancelEditButton.addEventListener('click', () => {
        cancelEditing();
        amountInput.focus();
      });
      for (const control of [amountInput, categoryInput, dateInput]) {
        control.addEventListener('input', clearError);
        control.addEventListener('change', clearError);
      }
      const TEMPLATES_STORAGE_KEY = 'rashody.templates.v1';
      const templateForm = document.querySelector('#template-form');
      const templateNameInput = document.querySelector('#template-name');
      const templateError = document.querySelector('#template-error');
      const templateList = document.querySelector('#template-list');
      const templateEmpty = document.querySelector('#template-empty');
      function loadTemplates() {
        try {
          const data = JSON.parse(localStorage.getItem(TEMPLATES_STORAGE_KEY) || '[]');
          if (!Array.isArray(data)) return [];
          return data.filter(item => item && typeof item.name === 'string' && item.name.trim() && Number.isSafeInteger(Number(item.amount)) && Number(item.amount) > 0 && categoryIcons[item.category] && typeof item.comment === 'string');
        } catch { return []; }
      }
      let templates = loadTemplates();
      function persistTemplates(nextTemplates) {
        try { localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(nextTemplates)); return true; }
        catch { return false; }
      }
      function renderTemplates() {
        templateList.replaceChildren();
        templateEmpty.hidden = templates.length > 0;
        templates.forEach((item, index) => {
          const row = document.createElement('div'); row.className = 'template-item';
          const select = document.createElement('button'); select.type = 'button'; select.className = 'template-select';
          const title = document.createElement('span'); title.className = 'template-title'; title.textContent = item.name;
          const details = document.createElement('span'); details.className = 'template-details';
          details.textContent = `${numberFormat.format(Number(item.amount))} · ${item.category}${item.comment ? ` · ${item.comment}` : ''}`;
          select.append(title, details); select.setAttribute('aria-label', `Выбрать шаблон ${item.name}: ${numberFormat.format(Number(item.amount))}, ${item.category}`);
          select.addEventListener('click', () => { amountInput.value = String(item.amount); categoryInput.value = item.category; dateInput.value = localDateValue(); document.querySelector('#comment').value = item.comment; clearError(); amountInput.focus(); });
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'template-delete'; remove.textContent = 'Удалить'; remove.setAttribute('aria-label', `Удалить шаблон ${item.name}`);
          remove.addEventListener('click', () => {
            const nextTemplates = templates.filter((_, itemIndex) => itemIndex !== index);
            if (!persistTemplates(nextTemplates)) { templateError.textContent = 'Не удалось удалить шаблон. Попробуйте ещё раз.'; templateError.hidden = false; return; }
            templates = nextTemplates; templateError.hidden = true; renderTemplates();
          });
          row.append(select, remove); templateList.append(row);
        });
      }
      templateForm.addEventListener('input', () => { templateError.hidden = true; });
      templateForm.addEventListener('submit', event => {
        event.preventDefault(); templateError.hidden = true; templateError.textContent = '';
        const amount = Number(amountInput.value); const name = templateNameInput.value.trim();
        if (amountInput.value === '' || !Number.isSafeInteger(amount) || amount <= 0) templateError.textContent = 'Введите целую сумму больше нуля.';
        else if (!categoryIcons[categoryInput.value]) templateError.textContent = 'Выберите категорию в форме выше.';
        else if (!name) templateError.textContent = 'Введите название шаблона.';
        else {
          const nextTemplates = [...templates, { name, amount, category: categoryInput.value, comment: document.querySelector('#comment').value.trim() }];
          if (!persistTemplates(nextTemplates)) templateError.textContent = 'Не удалось сохранить шаблон в браузере. Попробуйте ещё раз.';
          else { templates = nextTemplates; templateNameInput.value = ''; renderTemplates(); }
        }
        if (templateError.textContent) templateError.hidden = false;
      });

      form.addEventListener('submit', event => {
        event.preventDefault();
        clearError();
        if (amountInput.value === '' || !Number.isSafeInteger(Number(amountInput.value)) || Number(amountInput.value) <= 0) {
          showError('Введите целую сумму в тенге больше нуля.', amountInput);
          return;
        }
        if (!categoryIcons[categoryInput.value]) {
          showError('Выберите категорию траты.', categoryInput);
          return;
        }
        if (!dateInput.value || Number.isNaN(localDateFromISO(dateInput.value).getTime()) || localDateValue(localDateFromISO(dateInput.value)) !== dateInput.value) {
          showError('Укажите корректную дату.', dateInput);
          return;
        }
        const formData = new FormData(form);
        const updatedFields = {
          amount: Number(formData.get('amount')),
          category: String(formData.get('category')),
          date: String(formData.get('date')),
          comment: String(formData.get('comment') || '').trim()
        };
        if (editingExpenseId) {
          const index = expenses.findIndex(item => item.id === editingExpenseId);
          if (index < 0) {
            cancelEditing();
            render();
            return;
          }
          const previousExpenses = expenses;
          expenses = expenses.map(item => item.id === editingExpenseId ? { ...item, ...updatedFields } : item);
          if (!persistExpenses()) {
            expenses = previousExpenses;
            showError('Не удалось сохранить изменения в браузере. Проверьте доступное место и повторите попытку.', amountInput);
            return;
          }
          cancelEditing();
          render();
          amountInput.focus();
          return;
        }
        latestCreatedAt = Math.max(Date.now(), latestCreatedAt + 1);
        const expense = {
          id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          ...updatedFields,
          createdAt: latestCreatedAt
        };
        expenses.push(expense);
        if (!persistExpenses()) {
          expenses.pop();
          showError('Не удалось сохранить трату в браузере. Проверьте доступное место и повторите попытку.', amountInput);
          return;
        }
        form.reset();
        dateInput.value = localDateValue();
        render();
        amountInput.focus();
      });

      renderLimitForms();
      renderTemplates();
      render();
    })();
