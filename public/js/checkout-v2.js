(() => {
  const DOMESTIC = new Set(["blue", "starken", "chilexpress"]);
  const COURIER_LABELS = {
    blue: "Blue Express",
    starken: "Starken",
    chilexpress: "Chilexpress",
    retiro: "Retiro presencial",
    internacional: "Despacho internacional",
  };
  const SHEETS_URL =
    "https://script.google.com/macros/s/AKfycbwfot7dNP3mb2nGjSeNJ0iR616MaNGnNvO0EbtKube_xnqggzCPAcEPRtzzkJaHGi6H/exec";
  const WHATSAPP_NUMBER = "56962052499";

  const checkout = {
    product: null,
    productPrice: 0,
    pet: null,
    petPrice: 0,
    courier: null,
    quote: null,
    quoteSeq: 0,
    cache: new Map(),
  };

  const money = (value) => `$${Number(value || 0).toLocaleString("es-CL")}`;
  const byId = (id) => document.getElementById(id);

  function getStoredUtm() {
    try {
      const raw = sessionStorage.getItem("famores_utm");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function showError(message) {
    const el = byId("form-error-message");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearError() {
    byId("form-error-message")?.classList.add("hidden");
  }

  function destination() {
    return {
      region: byId("select-region")?.value?.trim() || "",
      commune: byId("input-comuna")?.value?.trim() || "",
    };
  }

  function ensureSummaryRows() {
    const boxRow = byId("resumen-caja-row");
    if (!boxRow) return;

    const label = boxRow.querySelector("span:first-child");
    if (label) label.textContent = "Caja de despacho";

    if (!byId("resumen-envio-row")) {
      const row = document.createElement("div");
      row.id = "resumen-envio-row";
      row.className = "hidden flex justify-between items-center mb-1";
      row.innerHTML =
        '<span class="text-gray-600">Despacho: <span id="resumen-envio-courier"></span></span>' +
        '<span id="resumen-envio-precio" class="font-medium"></span>';
      boxRow.parentNode?.insertBefore(row, boxRow);
    }
  }

  function setPaymentButtonLabel() {
    const button = byId("btn-submit-main");
    const payment = byId("select-pago")?.value || "";
    if (!button || button.disabled) return;

    if (checkout.courier === "internacional") {
      button.innerHTML = 'Cotizar despacho internacional <i class="fa-solid fa-arrow-right ml-2"></i>';
    } else if (payment === "Link de Pago (Flow)") {
      const total = checkout.quote?.total;
      button.innerHTML = total
        ? `Pagar pedido ${money(total)} <i class="fa-solid fa-credit-card ml-2"></i>`
        : 'Continuar a pago seguro <i class="fa-solid fa-credit-card ml-2"></i>';
    } else {
      const total = checkout.quote?.total;
      button.innerHTML = total
        ? `Confirmar transferencia ${money(total)} <i class="fa-solid fa-arrow-right ml-2"></i>`
        : 'Confirmar pedido <i class="fa-solid fa-arrow-right ml-2"></i>';
    }
  }

  async function fetchQuote(courier = checkout.courier) {
    if (!checkout.product || !courier || courier === "internacional") return null;
    const { region, commune } = destination();
    if (DOMESTIC.has(courier) && (!region || !commune)) return null;

    const key = [checkout.product, checkout.pet || "", courier, region, commune].join("|");
    if (checkout.cache.has(key)) return checkout.cache.get(key);

    const response = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: checkout.product,
        pet: checkout.pet,
        courier,
        region,
        commune,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "No fue posible calcular el despacho.");
    checkout.cache.set(key, data);
    return data;
  }

  async function renderSummary() {
    ensureSummaryRows();
    const seq = ++checkout.quoteSeq;
    checkout.quote = null;

    const productName = byId("resumen-producto");
    const productPrice = byId("resumen-precio");
    if (productName && checkout.product) productName.textContent = checkout.product;
    if (productPrice && checkout.product) productPrice.textContent = money(checkout.productPrice);

    const petRow = byId("resumen-mascota-row");
    if (petRow) {
      if (checkout.pet) {
        byId("resumen-mascota-nombre").textContent = checkout.pet;
        byId("resumen-mascota-precio").textContent = money(checkout.petPrice);
        petRow.classList.remove("hidden");
      } else {
        petRow.classList.add("hidden");
      }
    }

    const shippingRow = byId("resumen-envio-row");
    const boxRow = byId("resumen-caja-row");
    const note = byId("resumen-nota-envio");
    const paymentNote = byId("resumen-nota-pago");
    paymentNote?.classList.add("hidden");

    if (!checkout.product) {
      setPaymentButtonLabel();
      return;
    }

    if (!checkout.courier) {
      shippingRow?.classList.add("hidden");
      boxRow?.classList.add("hidden");
      if (note) note.textContent = "Selecciona una modalidad de entrega.";
      if (byId("resumen-total")) {
        byId("resumen-total").textContent = money(checkout.productPrice + checkout.petPrice);
      }
      setPaymentButtonLabel();
      return;
    }

    if (checkout.courier === "internacional") {
      shippingRow?.classList.add("hidden");
      boxRow?.classList.add("hidden");
      if (note) {
        note.textContent =
          "Despacho internacional pendiente de cotización. No se genera un pago Flow hasta conocer el total final.";
      }
      if (byId("resumen-total")) {
        byId("resumen-total").textContent = money(checkout.productPrice + checkout.petPrice);
      }
      setPaymentButtonLabel();
      return;
    }

    const { region, commune } = destination();
    if (DOMESTIC.has(checkout.courier) && (!region || !commune)) {
      shippingRow?.classList.add("hidden");
      boxRow?.classList.add("hidden");
      if (note) note.textContent = "Selecciona región y comuna para calcular el despacho.";
      if (byId("resumen-total")) {
        byId("resumen-total").textContent = money(checkout.productPrice + checkout.petPrice);
      }
      setPaymentButtonLabel();
      return;
    }

    try {
      const quote = await fetchQuote();
      if (seq !== checkout.quoteSeq || !quote) return;
      checkout.quote = quote;

      if (quote.shippingPrice > 0) {
        byId("resumen-envio-courier").textContent = quote.courierLabel;
        byId("resumen-envio-precio").textContent = money(quote.shippingPrice);
        shippingRow?.classList.remove("hidden");
      } else {
        shippingRow?.classList.add("hidden");
      }

      if (quote.boxPrice > 0) {
        const amount = boxRow?.querySelector("span:last-child");
        if (amount) amount.textContent = `+${money(quote.boxPrice)}`;
        boxRow?.classList.remove("hidden");
      } else {
        boxRow?.classList.add("hidden");
      }

      if (byId("resumen-total")) byId("resumen-total").textContent = money(quote.total);
      if (note) {
        note.textContent =
          checkout.courier === "retiro"
            ? "Retiro presencial sin costo de despacho ni caja."
            : `Tarifa fija Famores para ${quote.courierLabel}. El total ya incluye despacho y caja.`;
      }
    } catch (error) {
      if (seq !== checkout.quoteSeq) return;
      if (note) note.textContent = error instanceof Error ? error.message : "No fue posible calcular el despacho.";
    }

    setPaymentButtonLabel();
  }

  async function updateCourierCardPrices() {
    if (!checkout.product) return;
    const { region, commune } = destination();
    if (!region || !commune) return;

    await Promise.all(
      ["blue", "starken", "chilexpress"].map(async (courier) => {
        try {
          const quote = await fetchQuote(courier);
          const card = byId(`card-${courier}`);
          const description = card?.querySelector("p");
          if (description && quote) {
            description.textContent = `Envío ${money(quote.shippingPrice)} + caja ${money(quote.boxPrice)}`;
          }
        } catch {
          // El resumen principal mostrará el error si la opción seleccionada no puede cotizarse.
        }
      }),
    );
  }

  function collectForm() {
    const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked');
    return {
      name: byId("input-nombre")?.value?.trim() || "",
      lastName: byId("input-apellido")?.value?.trim() || "",
      rut: byId("input-rut")?.value?.trim() || "",
      email: byId("input-correo")?.value?.trim() || "",
      phone: byId("input-telefono")?.value?.trim() || "",
      region: byId("select-region")?.value?.trim() || "",
      commune: byId("input-comuna")?.value?.trim() || "",
      address: byId("input-direccion")?.value?.trim() || "",
      country: byId("input-pais")?.value?.trim() || "",
      city: byId("input-ciudad")?.value?.trim() || "",
      deliveryType: tipoEntrega?.value || "",
      deliveryLabel: tipoEntrega?.nextElementSibling?.textContent?.trim() || "",
      paymentMethod: byId("select-pago")?.value || "",
    };
  }

  function validateForm(form) {
    if (!checkout.product) return "Selecciona un producto.";
    if (!checkout.courier) return "Selecciona una modalidad de entrega.";
    if (!form.name || !form.lastName || !form.rut || !form.email || !form.phone) {
      return "Completa tus datos de contacto.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Ingresa un correo electrónico válido.";

    if (checkout.courier === "internacional") {
      if (!form.country || !form.city) return "Ingresa país y ciudad para cotizar el despacho internacional.";
      return "";
    }

    if (!form.deliveryType) {
      return checkout.courier === "retiro"
        ? "Selecciona una modalidad de retiro."
        : "Selecciona domicilio/oficina o sucursal del courier.";
    }

    if (DOMESTIC.has(checkout.courier)) {
      if (!form.region || !form.commune) return "Selecciona región y comuna.";
      if (form.deliveryType === "domicilio" && !form.address) return "Ingresa la dirección de entrega.";
    }

    return "";
  }

  function sendToSheets(form, quote, paymentLabel) {
    const data = new FormData();
    data.append("nombre", form.name);
    data.append("apellido", form.lastName);
    data.append("rut", form.rut);
    data.append("correo", form.email);
    data.append("telefono", form.phone);
    data.append("region", form.region || form.country || "");
    data.append("comuna", form.commune || form.city || "");
    data.append("direccion", form.address || "");
    data.append("metodo_pago", paymentLabel);
    data.append("tipo_set", checkout.pet ? `${checkout.product} + ${checkout.pet}` : checkout.product);
    data.append("metodo_envio", checkout.courier);
    data.append("total", String(quote?.total || checkout.productPrice + checkout.petPrice));

    const utm = getStoredUtm();
    Object.entries(utm).forEach(([key, value]) => {
      if (value) data.append(key, value);
    });

    fetch(SHEETS_URL, {
      method: "POST",
      body: data,
      mode: "no-cors",
      keepalive: true,
    }).catch((error) => console.warn("No se pudo enviar la copia del pedido a Sheets", error));
  }

  function whatsappUrl(form, quote, intro) {
    const petLine = checkout.pet ? `\n- Mascota: ${checkout.pet}` : "";
    const location = DOMESTIC.has(checkout.courier)
      ? `\n- Región: ${form.region}\n- Comuna: ${form.commune}${form.address ? `\n- Dirección: ${form.address}` : ""}`
      : checkout.courier === "internacional"
        ? `\n- País: ${form.country}\n- Ciudad: ${form.city}`
        : "";
    const shipping = quote
      ? `\n- Despacho ${quote.courierLabel}: ${money(quote.shippingPrice)}\n- Caja de despacho: ${money(quote.boxPrice)}`
      : "";
    const total = quote?.total || checkout.productPrice + checkout.petPrice;

    const message = `${intro}\n\nPedido Famores:\n- Producto: ${checkout.product}${petLine}${shipping}\n- Total: ${money(total)}\n- Entrega: ${COURIER_LABELS[checkout.courier] || checkout.courier}${location}\n- Modalidad: ${form.deliveryLabel || "No aplica"}\n\nDatos:\n- Nombre: ${form.name} ${form.lastName}\n- RUT: ${form.rut}\n- Correo: ${form.email}\n- Teléfono: ${form.phone}`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  function showTransfer(form, quote) {
    const formContent = byId("datos-form-content");
    const paymentScreen = byId("pantalla-pago");
    formContent?.classList.add("hidden");
    paymentScreen?.classList.remove("hidden");

    [
      "bloque-flow",
      "bloque-chilexpress",
      "bloque-coordinacion-whatsapp",
      "bloque-internacional",
    ].forEach((id) => byId(id)?.classList.add("hidden"));

    const transfer = byId("bloque-transferencia");
    transfer?.classList.remove("hidden");
    transfer?.classList.add("flex");

    const firstText = transfer?.querySelector("p");
    if (firstText) firstText.textContent = `Transfiere el total de ${money(quote.total)} a la siguiente cuenta:`;

    const link = byId("btn-whatsapp-transferencia");
    if (link) {
      link.href = whatsappUrl(
        form,
        quote,
        "¡Hola Famores! Ya realicé la transferencia del total indicado en el sitio y adjunto mi comprobante.",
      );
    }
  }

  async function submitOrder(originalGenerate) {
    clearError();
    const form = collectForm();
    const validation = validateForm(form);
    if (validation) return showError(validation);

    if (checkout.courier === "internacional") {
      return typeof originalGenerate === "function" ? originalGenerate() : showError("No está disponible la cotización internacional.");
    }

    let quote;
    try {
      quote = await fetchQuote();
      checkout.quote = quote;
      await renderSummary();
    } catch (error) {
      return showError(error instanceof Error ? error.message : "No fue posible calcular el total.");
    }

    const button = byId("btn-submit-main");
    if (!button) return;

    if (form.paymentMethod === "Link de Pago (Flow)") {
      const originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = 'Conectando con Flow… <i class="fa-solid fa-spinner fa-spin ml-2"></i>';

      try {
        const response = await fetch("/api/flow/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product: checkout.product,
            pet: checkout.pet,
            courier: checkout.courier,
            region: form.region,
            commune: form.commune,
            email: form.email,
            name: `${form.name} ${form.lastName}`.trim(),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.checkoutUrl) throw new Error(data?.error || "Flow no devolvió un checkout válido.");

        sendToSheets(form, data.breakdown || quote, "Flow - pago dinámico");
        window.location.assign(data.checkoutUrl);
      } catch (error) {
        button.disabled = false;
        button.innerHTML = originalHtml;
        showError(error instanceof Error ? error.message : "No fue posible iniciar el pago con Flow.");
      }
      return;
    }

    sendToSheets(form, quote, "Transferencia Bancaria");
    showTransfer(form, quote);
  }

  function install() {
    const originalSet = window.selectSet;
    const originalPet = window.selectMascota;
    const originalShipping = window.selectShipping;
    const originalGenerate = window.generarWhatsApp;

    if (typeof originalSet === "function") {
      window.selectSet = function (type, price) {
        originalSet(type, price);
        checkout.product = type;
        checkout.productPrice = Number(price) || 0;
        checkout.cache.clear();
        byId("section-envio")?.classList.remove("opacity-50", "pointer-events-none");
        renderSummary();
        updateCourierCardPrices();
      };
    }

    if (typeof originalPet === "function") {
      window.selectMascota = function (type, price) {
        const removing = checkout.pet === type;
        originalPet(type, price);
        checkout.pet = removing ? null : type;
        checkout.petPrice = removing ? 0 : Number(price) || 0;
        checkout.cache.clear();
        renderSummary();
        updateCourierCardPrices();
      };
    }

    if (typeof originalShipping === "function") {
      window.selectShipping = function (method) {
        originalShipping(method);
        checkout.courier = method;
        checkout.cache.clear();

        document.querySelectorAll(".shipping-card").forEach((card) => {
          card.classList.remove("selected");
          card.setAttribute("aria-pressed", "false");
        });
        const selected = byId(`card-${method}`);
        if (selected) {
          selected.classList.add("selected");
          selected.setAttribute("aria-pressed", "true");
        }

        queueMicrotask(() => {
          renderSummary();
          updateCourierCardPrices();
        });
      };
    }

    window.generarWhatsApp = () => submitOrder(originalGenerate);

    // El botón Flow antiguo queda fuera del flujo principal, pero si alguna
    // vista residual lo invoca, reutiliza el nuevo submit dinámico.
    window.iniciarPagoFlow = () => submitOrder(originalGenerate);
  }

  install();

  document.addEventListener("DOMContentLoaded", () => {
    ensureSummaryRows();

    const paymentSelect = byId("select-pago");
    if (paymentSelect) {
      const flowOption = Array.from(paymentSelect.options).find(
        (option) => option.value === "Link de Pago (Flow)",
      );
      if (flowOption) flowOption.textContent = "Webpay / Tarjetas (Flow)";
      paymentSelect.value = "Link de Pago (Flow)";
      paymentSelect.addEventListener("change", setPaymentButtonLabel);
    }

    const region = byId("select-region");
    const commune = byId("input-comuna");
    region?.addEventListener("change", () => {
      checkout.cache.clear();
      setTimeout(() => {
        renderSummary();
        updateCourierCardPrices();
      }, 0);
    });
    commune?.addEventListener("change", () => {
      checkout.cache.clear();
      renderSummary();
      updateCourierCardPrices();
    });

    document.querySelectorAll('input[name="tipo_entrega"]').forEach((radio) => {
      radio.addEventListener("change", renderSummary);
    });

    renderSummary();
    setPaymentButtonLabel();
  });
})();
