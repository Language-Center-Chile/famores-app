(() => {
  function initDeliveryCards() {
    const select = document.getElementById('courier');
    if (!(select instanceof HTMLSelectElement)) return;
    if (document.getElementById('delivery-method-cards')) return;

    const labels = {
      retiro: {
        icon: '🏠',
        title: 'Retiro en local',
        description: 'Avenida Egaña 1638 B, Peñalolén · Metro Grecia',
      },
      blue: {
        icon: '🚚',
        title: 'Envío a domicilio',
        description: 'Despacho a domicilio dentro de Chile',
      },
      chilexpress: {
        icon: '📦',
        title: 'Sucursal Chilexpress',
        description: 'Retiro en la sucursal que elijas',
      },
      starken: {
        icon: '📦',
        title: 'Sucursal Starken',
        description: 'Retiro en la sucursal que elijas',
      },
      international: {
        icon: '🌎',
        title: 'Envío internacional',
        description: 'El despacho se cotiza posteriormente',
      },
    };

    const group = document.createElement('div');
    group.id = 'delivery-method-cards';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Forma de entrega');
    group.className = 'grid gap-3 sm:grid-cols-2';

    const buttons = [];

    Array.from(select.options).forEach((option) => {
      const meta = labels[option.value] || {
        icon: '•',
        title: option.textContent || option.value,
        description: '',
      };

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.deliveryValue = option.value;
      button.setAttribute('role', 'radio');
      button.className = [
        'delivery-method-card',
        'relative',
        'min-h-[92px]',
        'rounded-2xl',
        'border-2',
        'border-stone-200',
        'bg-white',
        'p-4',
        'text-left',
        'transition-all',
        'duration-200',
        'hover:border-terapia-sage',
        'hover:shadow-sm',
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-terapia-sage',
        'focus:ring-offset-2',
      ].join(' ');

      button.innerHTML = `
        <span class="flex items-start gap-3">
          <span class="text-2xl leading-none" aria-hidden="true">${meta.icon}</span>
          <span class="min-w-0 flex-1">
            <span class="block font-bold text-terapia-text">${meta.title}</span>
            <span class="mt-1 block text-xs leading-relaxed text-gray-600">${meta.description}</span>
          </span>
          <span class="delivery-check hidden shrink-0 rounded-full bg-terapia-sageDark px-2 py-1 text-xs font-bold text-white">✓</span>
        </span>`;

      button.addEventListener('click', () => {
        if (select.value === option.value) {
          syncSelectedState();
          return;
        }
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncSelectedState();
      });

      group.appendChild(button);
      buttons.push(button);
    });

    function syncSelectedState() {
      buttons.forEach((button) => {
        const selected = button.dataset.deliveryValue === select.value;
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
        button.classList.toggle('border-terapia-sageDark', selected);
        button.classList.toggle('bg-terapia-bg', selected);
        button.classList.toggle('shadow-md', selected);
        button.classList.toggle('border-stone-200', !selected);
        const check = button.querySelector('.delivery-check');
        if (check) check.classList.toggle('hidden', !selected);
      });
    }

    select.classList.add('sr-only');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.insertAdjacentElement('afterend', group);
    select.addEventListener('change', syncSelectedState);
    syncSelectedState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeliveryCards, { once: true });
  } else {
    initDeliveryCards();
  }
})();
