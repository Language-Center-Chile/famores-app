(() => {
  const byId = (id) => document.getElementById(id);
  let highlighted = null;

  function clearHighlight() {
    if (!highlighted) return;
    highlighted.classList.remove("ring-2", "ring-red-500", "ring-offset-2", "rounded-xl");
    highlighted = null;
  }

  function ensureToast() {
    let toast = byId("checkout-validation-alert");
    if (toast) return toast;

    toast = document.createElement("div");
    toast.id = "checkout-validation-alert";
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.className =
      "hidden fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-[calc(100%-2rem)] sm:max-w-lg bg-white border-2 border-red-500 text-red-700 shadow-xl rounded-xl px-4 py-3 font-semibold text-sm";
    document.body.appendChild(toast);
    return toast;
  }

  function focusTarget(target) {
    if (!target) return;
    clearHighlight();
    highlighted = target;
    target.classList.add("ring-2", "ring-red-500", "ring-offset-2", "rounded-xl");
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(() => {
      const focusable = target.matches("input, select, button, textarea, a[href]")
        ? target
        : target.querySelector("input:not([disabled]), select:not([disabled]), button, textarea, a[href]");
      focusable?.focus({ preventScroll: true });
    }, 450);
  }

  function showMissing(message, target) {
    const inline = byId("form-error-message");
    if (inline) {
      inline.textContent = message;
      inline.classList.remove("hidden");
    }

    const toast = ensureToast();
    toast.textContent = `⚠️ ${message}`;
    toast.classList.remove("hidden");
    focusTarget(target);

    window.clearTimeout(showMissing.timeoutId);
    showMissing.timeoutId = window.setTimeout(() => toast.classList.add("hidden"), 5000);
  }

  function selectedCourier() {
    const selected = document.querySelector(".shipping-card.selected");
    if (!selected?.id) return "";
    return selected.id.replace(/^card-/, "");
  }

  function firstProductSection() {
    return document.querySelector(".set-card")?.closest("section") || document.querySelector(".set-card");
  }

  function missingRequirement() {
    const hasSet = Boolean(document.querySelector(".set-card.selected"));
    const hasPet = Boolean(document.querySelector(".mascota-card.selected"));
    if (!hasSet && !hasPet) {
      return {
        message: "Elige al menos un producto: un set, una mascota o ambos.",
        target: firstProductSection(),
      };
    }

    const courier = selectedCourier();
    if (!courier) {
      return {
        message: "Selecciona una modalidad de entrega para continuar.",
        target: byId("section-envio"),
      };
    }

    const requiredContact = [
      ["input-nombre", "Ingresa tu nombre."],
      ["input-apellido", "Ingresa tu apellido."],
      ["input-rut", "Ingresa tu RUT."],
      ["input-correo", "Ingresa tu correo electrónico."],
      ["input-telefono", "Ingresa tu teléfono."],
    ];

    for (const [id, message] of requiredContact) {
      const field = byId(id);
      if (!field?.value?.trim()) return { message, target: field };
    }

    const email = byId("input-correo");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      return { message: "Ingresa un correo electrónico válido.", target: email };
    }

    if (courier === "internacional") {
      const country = byId("input-pais");
      const city = byId("input-ciudad");
      if (!country?.value?.trim()) {
        return { message: "Ingresa el país de destino.", target: country || byId("container-pais-ciudad") };
      }
      if (!city?.value?.trim()) {
        return { message: "Ingresa la ciudad de destino.", target: city || byId("container-pais-ciudad") };
      }
    } else {
      const delivery = document.querySelector('input[name="tipo_entrega"]:checked');
      if (!delivery) {
        const target = courier === "retiro" ? byId("opciones-retiro") : byId("opciones-courier");
        return {
          message:
            courier === "retiro"
              ? "Selecciona cómo quieres realizar el retiro."
              : "Selecciona si quieres recibir en domicilio/oficina o en sucursal.",
          target,
        };
      }

      if (["blue", "starken", "chilexpress"].includes(courier)) {
        const region = byId("select-region");
        const commune = byId("input-comuna");
        if (!region?.value?.trim()) {
          return { message: "Selecciona tu región.", target: region || byId("container-region-comuna") };
        }
        if (!commune?.value?.trim()) {
          return { message: "Selecciona tu comuna.", target: commune || byId("container-region-comuna") };
        }
        if (delivery.value === "domicilio") {
          const address = byId("input-direccion");
          if (!address?.value?.trim()) {
            return { message: "Ingresa la dirección exacta de entrega.", target: address || byId("bloque-direccion") };
          }
        }
      }
    }

    const payment = byId("select-pago");
    if (!payment?.value) {
      return { message: "Selecciona un método de pago.", target: payment };
    }

    return null;
  }

  function validateBeforeCheckout(event) {
    const button = event.target.closest?.("#btn-submit-main");
    if (!button) return;

    const missing = missingRequirement();
    if (!missing) {
      clearHighlight();
      byId("checkout-validation-alert")?.classList.add("hidden");
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    showMissing(missing.message, missing.target);
  }

  document.addEventListener("click", validateBeforeCheckout, true);

  document.addEventListener("input", (event) => {
    if (highlighted && (event.target === highlighted || highlighted.contains(event.target))) clearHighlight();
  });
  document.addEventListener("change", (event) => {
    if (highlighted && (event.target === highlighted || highlighted.contains(event.target))) clearHighlight();
  });
})();
