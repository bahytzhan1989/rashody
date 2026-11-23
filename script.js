(() => {
      const STORAGE_KEY = 'rashody.expenses.v1';
      const categoryIcons = { Еда: '🍽️', Транспорт: '🚗', Дом: '🏠', Другое: '✦' };
      const form = document.querySelector('#expense-form');
      const amountInput = document.querySelector('#amount');
      const categoryInput = document.querySelector('#category');
      const dateInput = document.querySelector('#date');
      const errorMessage = document.querySelector('#form-error');
      const entries = document.querySelector('#entries');
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
      let latestCreatedAt = expenses.reduce((latest, item) => Math.max(latest, item.createdAt), 0);

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
          row.append(icon, info, amount);
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
      for (const control of [amountInput, categoryInput, dateInput]) {
        control.addEventListener('input', clearError);
        control.addEventListener('change', clearError);
      }
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
        latestCreatedAt = Math.max(Date.now(), latestCreatedAt + 1);
        const expense = {
          id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          amount: Number(formData.get('amount')),
          category: String(formData.get('category')),
          date: String(formData.get('date')),
          comment: String(formData.get('comment') || '').trim(),
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

      render();
    })();
