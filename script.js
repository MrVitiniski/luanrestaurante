const CONFIG = {
  restaurantName: "Marmita Express",
  deliveryFee: 5,
  freeDeliveryMinimum: 24.99,
  whatsappNumber: "5548991998998",
  pixKey: "05674008914",
  draftKey: "marmita_v42_ok"
};

const DEFAULT_MAP_CENTER = { lat: -28.6736, lng: -49.3697, zoom: 16 };

const MARMITAS = [
  { id: "p", name: "Marmita P", desc: "Arroz, feijão, proteína + salada", price: 9.99, img: "./img/marmitex.png" },
  { id: "m", name: "Marmita M", desc: "Porção média reforçada", price: 14.99, img: "./img/marmitex.png" },
  { id: "g", name: "Marmita G", desc: "Porção grande completa", price: 19.99, img: "./img/marmitex.png" }
];

const DRINKS = [
  { id: "none", name: "Sem bebida", price: 0, img: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=60" },

  { id: "coca_lata", name: "Coca-Cola Lata 350ml", price: 6.0, img: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=300&q=60" },
  { id: "coca_2l", name: "Coca-Cola 2L", price: 14.0, img: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=300&q=60" },

  { id: "guarana_lata", name: "Guaraná Lata 350ml", price: 6.0, img: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=60" },
  { id: "guarana_2l", name: "Guaraná 2L", price: 14.0, img: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=60" },

  { id: "agua_com_gas", name: "Água com gás 500ml", price: 4.0, img: "https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=300&q=60" },
  { id: "agua_sem_gas", name: "Água sem gás 500ml", price: 3.5, img: "https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=300&q=60" }
];
let currentStep = 1;
let addressType = "Casa";
let cartItems = [];
let selectedPayment = "";

let map = null;
let marker = null;
let selectedCoords = null;
let autoLocatedOnce = false;

let modalMode = "create";
let editingItemId = null;
let currentMarmita = null;

// sem limite de bebidas
let selectedDrinkIds = ["none"];

const $ = (s) => document.querySelector(s);
const money = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const onlyDigits = (v) => (v || "").replace(/\D/g, "");
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1700);
}

function pulseCartBar() {
  const btn = $("#btnCartAction");
  if (!btn) return;
  btn.classList.remove("pulse");
  void btn.offsetWidth;
  btn.classList.add("pulse");
}

function animateFlyToCart(fromEl) {
  const cart = $("#btnCartAction");
  if (!fromEl || !cart) return;

  const a = fromEl.getBoundingClientRect();
  const b = cart.getBoundingClientRect();

  const dot = document.createElement("div");
  dot.className = "fly-dot";
  dot.style.left = `${a.left + a.width / 2}px`;
  dot.style.top = `${a.top + a.height / 2}px`;
  document.body.appendChild(dot);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);

  dot.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: 0.55 }
    ],
    { duration: 540, easing: "cubic-bezier(.2,.8,.2,1)" }
  ).onfinish = () => dot.remove();
}

function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/* MAPA */
function initMap() {
  if (map || !document.getElementById("map")) return;

  map = L.map("map").setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_CENTER.zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], { draggable: true }).addTo(map);
  selectedCoords = { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };

  marker.on("dragend", () => {
    const p = marker.getLatLng();
    selectedCoords = { lat: p.lat, lng: p.lng };
    saveDraft();
  });

  map.on("click", (e) => {
    marker.setLatLng(e.latlng);
    selectedCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    saveDraft();
  });

  setTimeout(() => map.invalidateSize(), 260);
}

function setMapLocation(lat, lng, zoom = 17) {
  if (!map || !marker) return;
  map.setView([lat, lng], zoom);
  marker.setLatLng([lat, lng]);
  selectedCoords = { lat, lng };
}

function autoLocateOnStep2() {
  if (autoLocatedOnce) return;
  autoLocatedOnce = true;
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    initMap();
    setMapLocation(latitude, longitude, 18);
    saveDraft();
  });
}

function useMyLocation() {
  if (!navigator.geolocation) {
    toast("Geolocalização não suportada.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      initMap();
      setMapLocation(latitude, longitude, 18);
      saveDraft();
      toast("Localização capturada.");
    },
    () => toast("Você negou a localização.")
  );
}

/* RENDER MARMITAS */
function renderMarmitas() {
  const list = $("#marmitaChoices");
  if (!list) return;

  list.innerHTML = MARMITAS.map((item) => `
    <article class="choice">
      <img class="item-thumb" src="${item.img}" alt="${item.name}" loading="lazy" />
      <div class="choice-main">
        <div class="choice-head">
          <div>
            <strong>${item.name}</strong><br/>
            <small>${item.desc}</small>
          </div>
          <span class="price">${money(item.price)}</span>
        </div>
        <div class="choice-actions">
          
          <button type="button" class="quick-add" data-open-modal="${item.id}">Adicionar</button>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const marmita = MARMITAS.find((m) => m.id === btn.dataset.openModal);
      openItemModalForCreate(marmita);
    });
  });
}

/* MODAL MARMITA */
function renderDrinkGrid(selected = []) {
  const wrap = $("#drinkGrid");
  if (!wrap) return;

  wrap.innerHTML = DRINKS.map((d) => `
    <button type="button" class="drink-card ${selected.includes(d.id) ? "selected" : ""}" data-drink="${d.id}">
      <img src="${d.img}" alt="${d.name}" loading="lazy" />
      <span class="d-name">${d.name}</span>
      <span class="d-price">${d.price > 0 ? money(d.price) : "Sem custo"}</span>
    </button>
  `).join("");

  wrap.querySelectorAll("[data-drink]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.drink;

      if (id === "none") {
        selectedDrinkIds = ["none"];
      } else {
        selectedDrinkIds = selectedDrinkIds.filter((x) => x !== "none");

        if (selectedDrinkIds.includes(id)) {
          selectedDrinkIds = selectedDrinkIds.filter((x) => x !== id);
        } else {
          selectedDrinkIds.push(id); // sem limite
        }

        if (selectedDrinkIds.length === 0) selectedDrinkIds = ["none"];
      }

      renderDrinkGrid(selectedDrinkIds);
    });
  });
}

function clearItemModalFields() {
  const note = $("#comboNote");
  if (note) note.value = "";
  selectedDrinkIds = ["none"];
  renderDrinkGrid(selectedDrinkIds);
}

function openItemModal() {
  const m = $("#itemModal");
  if (!m) return;
  m.classList.add("show");
  m.setAttribute("aria-hidden", "false");
}

function closeItemModal() {
  const m = $("#itemModal");
  if (!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden", "true");
}

function openItemModalForCreate(marmita) {
  if (!marmita) return;
  modalMode = "create";
  editingItemId = null;
  currentMarmita = marmita;

  $("#itemModalTitle").textContent = `Configurar ${marmita.name}`;
  $("#itemModalBasePrice").textContent = `Preço base: ${money(marmita.price)}`;
  $("#btnSaveItemModal").textContent = "Adicionar à sacola";

  clearItemModalFields();
  openItemModal();
}

function openItemModalForEdit(item) {
  modalMode = "edit";
  editingItemId = item.uid;
  currentMarmita = MARMITAS.find((m) => m.id === item.marmitaId);

  $("#itemModalTitle").textContent = `Editar ${item.marmitaName}`;
  $("#itemModalBasePrice").textContent = `Preço base: ${money(item.basePrice)}`;
  $("#btnSaveItemModal").textContent = "Salvar alterações";

  $("#comboNote").value = item.note || "";
  selectedDrinkIds = (item.drinks && item.drinks.length) ? item.drinks.map((d) => d.id) : ["none"];

  renderDrinkGrid(selectedDrinkIds);
  openItemModal();
}

function collectModalItemData() {
  const drinks = selectedDrinkIds
    .map((id) => DRINKS.find((d) => d.id === id))
    .filter(Boolean);

  const note = $("#comboNote").value.trim();
  const drinksTotal = drinks.reduce((acc, d) => acc + d.price, 0);

  return {
    uid: modalMode === "edit" ? editingItemId : uid(),
    marmitaId: currentMarmita.id,
    marmitaName: currentMarmita.name,
    basePrice: currentMarmita.price,
    drinks,
    note,
    total: currentMarmita.price + drinksTotal
  };
}

function saveModalItem() {
  if (!currentMarmita) return;
  const item = collectModalItemData();

  if (modalMode === "create") {
    cartItems.push(item);
    toast("Item adicionado à sacola.");
    animateFlyToCart($("#btnSaveItemModal"));
  } else {
    const idx = cartItems.findIndex((i) => i.uid === editingItemId);
    if (idx >= 0) cartItems[idx] = item;
    toast("Item atualizado.");
  }

  pulseCartBar();
  closeItemModal();
  renderBag();
  renderSummary();
  updateCartBar();
  saveDraft();
}

/* SACOLA */
function bagItemMetaText(item) {
  const drinkNames = (item.drinks && item.drinks.length)
    ? item.drinks.map((d) => d.name).join(", ")
    : "Sem bebida";

  const parts = [`Bebidas: ${drinkNames}`];
  if (item.note) parts.push(`Obs: ${item.note}`);
  return parts.join(" | ");
}

function renderBag() {
  const box = $("#bagList");
  if (!box) return;

  if (!cartItems.length) {
    box.innerHTML = `<div class="muted">Sua sacola está vazia.</div>`;
    return;
  }

  box.innerHTML = cartItems.map((item, idx) => `
    <article class="bag-item">
      <div class="bag-title">
        <strong>${idx + 1}. ${item.marmitaName}</strong>
        <strong>${money(item.total)}</strong>
      </div>
      <div class="bag-meta">${bagItemMetaText(item)}</div>
      <div class="bag-actions">
        <button type="button" class="bag-btn" data-edit="${item.uid}">Editar</button>
        <button type="button" class="bag-btn" data-dup="${item.uid}">Duplicar</button>
        <button type="button" class="bag-btn danger" data-del="${item.uid}">Remover</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const it = cartItems.find((i) => i.uid === btn.dataset.edit);
      if (it) openItemModalForEdit(it);
    });
  });

  document.querySelectorAll("[data-dup]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const it = cartItems.find((i) => i.uid === btn.dataset.dup);
      if (!it) return;
      const clone = JSON.parse(JSON.stringify(it));
      clone.uid = uid();
      cartItems.push(clone);
      renderBag();
      renderSummary();
      updateCartBar();
      pulseCartBar();
      saveDraft();
      toast("Item duplicado.");
    });
  });

  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cartItems = cartItems.filter((i) => i.uid !== btn.dataset.del);
      renderBag();
      renderSummary();
      updateCartBar();
      pulseCartBar();
      saveDraft();
      toast("Item removido.");
    });
  });
}

/* ENDEREÇO */
function initAddressTypeChips() {
  document.querySelectorAll("#addressTypeChips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#addressTypeChips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      addressType = chip.dataset.type;
      saveDraft();
    });
  });
}

function restoreAddressTypeChip() {
  document.querySelectorAll("#addressTypeChips .chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.type === addressType);
  });
}

/* PAGAMENTO */
function initPaymentCards() {
  const hidden = $("#paymentMethod");
  document.querySelectorAll(".pay-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".pay-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      selectedPayment = card.dataset.pay;
      hidden.value = selectedPayment;
      $("#changeField").style.display = selectedPayment === "Dinheiro" ? "block" : "none";
      saveDraft();
    });
  });
}

function restorePaymentCard() {
  if (!selectedPayment) return;
  $("#paymentMethod").value = selectedPayment;
  document.querySelectorAll(".pay-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.pay === selectedPayment);
  });
  $("#changeField").style.display = selectedPayment === "Dinheiro" ? "block" : "none";
}

/* TOTAIS */
function getDeliveryFee(subtotal) {
  return subtotal >= CONFIG.freeDeliveryMinimum ? 0 : CONFIG.deliveryFee;
}

function calcTotal() {
  const subtotal = cartItems.reduce((a, b) => a + b.total, 0);
  const delivery = getDeliveryFee(subtotal);
  return { subtotal, delivery, total: subtotal + delivery };
}

function renderMinimumRule(subtotal) {
  const box = $("#minimumRuleBox");
  if (!box) return;

  const missing = Math.max(0, CONFIG.freeDeliveryMinimum - subtotal);

  if (subtotal >= CONFIG.freeDeliveryMinimum) {
    box.style.borderColor = "#86efac";
    box.style.background = "#f0fdf4";
    box.style.color = "#166534";
    box.innerHTML = `✅ Frete grátis liberado! Valor mínimo de ${money(CONFIG.freeDeliveryMinimum)} atingido.`;
  } else {
    box.style.borderColor = "#ffd699";
    box.style.background = "#fff8e8";
    box.style.color = "#92400e";
    box.innerHTML = `🚚 Frete R$ 5,00. Faltam ${money(missing)} para frete grátis.`;
  }
}

function renderSummary() {
  const box = $("#summaryBox");
  if (!box) return;

  const { subtotal, delivery, total } = calcTotal();

  const itemsHtml = cartItems.length
    ? cartItems.map((item, idx) => `
      <div>
        <div class="row">
          <span>${idx + 1}. ${item.marmitaName}</span>
          <strong>${money(item.total)}</strong>
        </div>
        <small style="color:#4e6a6f">${bagItemMetaText(item)}</small>
      </div>
    `).join("")
    : `<div class="row"><span>Itens</span><strong>Nenhum selecionado</strong></div>`;

  box.innerHTML = `
    ${itemsHtml}
    <div class="row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <div class="row"><span>Frete</span><strong>${money(delivery)}</strong></div>
    <div class="row total"><span>Total</span><strong>${money(total)}</strong></div>
  `;

  renderMinimumRule(subtotal);
}

function updateCartBar() {
  const meta = $("#cartBarMeta");
  if (!meta) return;
  const { total } = calcTotal();
  const qty = cartItems.length;
  meta.textContent = `${qty} item${qty === 1 ? "" : "s"} • ${money(total)}`;
}

/* STEPS */
function updateProgress() {
  const pct = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;
  $("#progressBar").style.width = pct + "%";
  $("#progressLabel").textContent = pct + "%";
}

function updateStepUI() {
  [1, 2, 3].forEach((i) => {
    const el = $("#stepIndicator" + i);
    if (el) el.classList.toggle("active", i === currentStep);
  });

  $("#btnPrev").disabled = currentStep === 1;
  $("#btnNext").textContent = currentStep === 3 ? "Finalizar pedido" : "Próximo";

  const cartLabel = $("#cartBarLabel");
  if (cartLabel) {
    cartLabel.textContent =
      currentStep === 1 ? "Ver sacola" :
      currentStep === 2 ? "Ir para pagamento" :
      "Revisar pedido";
  }

  const track = $("#stepsTrack");
  if (track) track.style.transform = `translateX(-${(currentStep - 1) * 33.3333}%)`;
  updateProgress();
}

/* VALIDAÇÃO */
function validateStep(step) {
  if (step === 1) {
    if (!cartItems.length) {
      toast("Adicione pelo menos 1 marmita.");
      return false;
    }
    return true;
  }

  if (step === 2) {
    const req = ["customerName", "customerPhone", "addressDistrict", "addressStreet", "addressNumber", "addressReference"];
    for (const id of req) {
      if (!$("#" + id).value.trim()) {
        toast("Preencha os dados de entrega.");
        return false;
      }
    }
    if (onlyDigits($("#customerPhone").value).length < 10) {
      toast("WhatsApp inválido.");
      return false;
    }
    return confirm("Confira seus dados de entrega.\n\nDeseja continuar?");
  }

  if (step === 3) {
    if (!$("#paymentMethod").value) {
      toast("Selecione a forma de pagamento.");
      return false;
    }
    if ($("#paymentMethod").value === "Dinheiro" && !$("#changeFor").value) {
      toast("Informe o troco para quanto.");
      return false;
    }
    return true;
  }

  return true;
}

/* PEDIDO */
function buildOrder() {
  const { subtotal, delivery, total } = calcTotal();

  return {
    customer: {
      name: $("#customerName").value.trim(),
      phone: $("#customerPhone").value.trim()
    },
    address: {
      type: addressType,
      district: $("#addressDistrict").value.trim(),
      street: $("#addressStreet").value.trim(),
      number: $("#addressNumber").value.trim(),
      reference: $("#addressReference").value.trim()
    },
    location: selectedCoords ? { lat: selectedCoords.lat, lng: selectedCoords.lng } : null,
    items: cartItems,
    payment: {
      method: $("#paymentMethod").value,
      changeFor: Number($("#changeFor").value || 0)
    },
    totals: { subtotal, delivery, total }
  };
}

function itemLineForWhatsapp(item, idx) {
  const drinksTxt = (item.drinks && item.drinks.length)
    ? item.drinks.map((d) => `${d.name} (${money(d.price)})`).join(", ")
    : "Sem bebida";

  const noteTxt = item.note ? ` | Obs: ${item.note}` : "";
  return `${idx + 1}) ${item.marmitaName} (${money(item.basePrice)}) | Bebidas: ${drinksTxt}${noteTxt} = *${money(item.total)}*`;
}

function orderMessage(order, includePix = false) {
  const itemLines = order.items.map(itemLineForWhatsapp).join("\n");

  const lines = [
    `*Pedido - ${CONFIG.restaurantName}*`,
    ``,
    `*Cliente:* ${order.customer.name}`,
    `*WhatsApp:* ${order.customer.phone}`,
    ``,
    `*Itens:*`,
    itemLines || "-",
    ``,
    `*Subtotal:* ${money(order.totals.subtotal)}`,
    `*Frete:* ${money(order.totals.delivery)}`,
    `*Total:* ${money(order.totals.total)}`,
    ``,
    `*Endereço (${order.address.type}):* ${order.address.street}, ${order.address.number} - ${order.address.district}`,
    `*Referência:* ${order.address.reference}`,
    order.location ? `*Mapa:* https://maps.google.com/?q=${order.location.lat},${order.location.lng}` : "",
    ``,
    `*Pagamento:* ${order.payment.method}`,
    order.payment.method === "Dinheiro" ? `*Troco para:* ${money(order.payment.changeFor)}` : ""
  ].filter(Boolean);

  if (includePix) {
    lines.push(
      ``,
      `*Dados PIX:*`,
      `- CPF: 05674008914`,
      `- Nome: THOMAZ VITINISKI`,
      `- Banco: Efí`,
      ``,
      `Acabei de realizar o pagamento PIX e vou enviar o comprovante.`
    );
  }

  return lines.join("\n");
}

/* MODAIS */
function openPixModal() {
  const m = $("#pixModal");
  if (!m) return;
  m.classList.add("show");
  m.setAttribute("aria-hidden", "false");
}

function closePixModal() {
  const m = $("#pixModal");
  if (!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden", "true");
}

function closeWelcomeModal() {
  const m = $("#welcomeModal");
  if (!m) return;
  m.classList.remove("show");
  m.setAttribute("aria-hidden", "true");
}

/* DRAFT */
function saveDraft() {
  const draft = {
    currentStep,
    addressType,
    cartItems,
    selectedCoords,
    autoLocatedOnce,
    selectedPayment,
    customerName: $("#customerName")?.value || "",
    customerPhone: $("#customerPhone")?.value || "",
    addressDistrict: $("#addressDistrict")?.value || "",
    addressStreet: $("#addressStreet")?.value || "",
    addressNumber: $("#addressNumber")?.value || "",
    addressReference: $("#addressReference")?.value || "",
    changeFor: $("#changeFor")?.value || ""
  };

  localStorage.setItem(CONFIG.draftKey, JSON.stringify(draft));
}

function loadDraft() {
  const raw = localStorage.getItem(CONFIG.draftKey);
  if (!raw) return;

  try {
    const d = JSON.parse(raw);

    currentStep = d.currentStep || 1;
    addressType = d.addressType || "Casa";
    cartItems = d.cartItems || [];
    selectedCoords = d.selectedCoords || null;
    autoLocatedOnce = d.autoLocatedOnce || false;
    selectedPayment = d.selectedPayment || "";

    if ($("#customerName")) $("#customerName").value = d.customerName || "";
    if ($("#customerPhone")) $("#customerPhone").value = d.customerPhone || "";
    if ($("#addressDistrict")) $("#addressDistrict").value = d.addressDistrict || "";
    if ($("#addressStreet")) $("#addressStreet").value = d.addressStreet || "";
    if ($("#addressNumber")) $("#addressNumber").value = d.addressNumber || "";
    if ($("#addressReference")) $("#addressReference").value = d.addressReference || "";
    if ($("#changeFor")) $("#changeFor").value = d.changeFor || "";
  } catch (e) {
    console.warn("Falha ao carregar draft:", e);
  }
}

function clearDraft() {
  localStorage.removeItem(CONFIG.draftKey);
}

/* AÇÕES */
function clearCartOnly() {
  cartItems = [];
  renderBag();
  renderSummary();
  updateCartBar();
  pulseCartBar();
  saveDraft();
  toast("Sacola limpa.");
}

function resetAll() {
  cartItems = [];
  addressType = "Casa";
  currentStep = 1;
  selectedPayment = "";
  selectedCoords = { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };
  autoLocatedOnce = false;
  selectedDrinkIds = ["none"];

  ["customerName", "customerPhone", "addressDistrict", "addressStreet", "addressNumber", "addressReference", "changeFor"].forEach((id) => {
    const el = $("#" + id);
    if (el) el.value = "";
  });

  if ($("#paymentMethod")) $("#paymentMethod").value = "";
  if ($("#changeField")) $("#changeField").style.display = "none";
  document.querySelectorAll(".pay-card").forEach((c) => c.classList.remove("active"));

  renderBag();
  renderSummary();
  updateCartBar();
  updateStepUI();
  restoreAddressTypeChip();
  closePixModal();
  closeItemModal();

  if (map && marker) {
    setMapLocation(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.zoom);
    setTimeout(() => map.invalidateSize(), 120);
  }

  clearDraft();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* INIT */
function init() {
  loadDraft();

  renderMarmitas();
  renderBag();
  renderSummary();
  updateCartBar();
  updateStepUI();

  initMap();
  if (selectedCoords && map) {
    setMapLocation(selectedCoords.lat, selectedCoords.lng, 17);
  }

  initAddressTypeChips();
  restoreAddressTypeChip();
  initPaymentCards();
  restorePaymentCard();

  if ($("#customerPhone")) {
    $("#customerPhone").value = maskPhone($("#customerPhone").value);
  }

  ["customerName", "customerPhone", "addressDistrict", "addressStreet", "addressNumber", "addressReference", "changeFor"].forEach((id) => {
    const el = $("#" + id);
    if (!el) return;
    el.addEventListener("input", saveDraft);
  });

  if ($("#customerPhone")) {
    $("#customerPhone").addEventListener("input", (e) => {
      e.target.value = maskPhone(e.target.value);
      saveDraft();
    });
  }

  if ($("#btnUseLocation")) $("#btnUseLocation").addEventListener("click", useMyLocation);

  if ($("#btnPrev")) {
    $("#btnPrev").addEventListener("click", () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepUI();
        saveDraft();
        if (currentStep === 2 && map) setTimeout(() => map.invalidateSize(), 120);
      }
    });
  }

  if ($("#btnNext")) {
    $("#btnNext").addEventListener("click", () => {
      if (!validateStep(currentStep)) return;

      if (currentStep < 3) {
        currentStep++;
        updateStepUI();

        if (currentStep === 2) {
          if (map) setTimeout(() => map.invalidateSize(), 120);
          autoLocateOnStep2();
        }

        if (currentStep === 3) renderSummary();
        saveDraft();
        return;
      }

      const order = buildOrder();

      if (order.payment.method === "PIX") {
        openPixModal();
        return;
      }

      const phone = onlyDigits(CONFIG.whatsappNumber);
      const text = encodeURIComponent(orderMessage(order, false));
      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
      toast("Pedido enviado com sucesso!");
      setTimeout(resetAll, 700);
    });
  }

  if ($("#btnCartAction")) {
    $("#btnCartAction").addEventListener("click", () => {
      if (currentStep === 1) {
        currentStep = 3;
        updateStepUI();
        renderSummary();
        saveDraft();
        return;
      }

      if (currentStep === 2) {
        if (validateStep(2)) {
          currentStep = 3;
          updateStepUI();
          renderSummary();
          saveDraft();
        }
        return;
      }

      currentStep = 1;
      updateStepUI();
      saveDraft();
    });
  }

  if ($("#btnEditItems")) {
    $("#btnEditItems").addEventListener("click", () => {
      currentStep = 1;
      updateStepUI();
      saveDraft();
    });
  }

  if ($("#btnClearCart")) $("#btnClearCart").addEventListener("click", clearCartOnly);

  if ($("#btnCopyPix")) {
    $("#btnCopyPix").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(CONFIG.pixKey);
        const order = buildOrder();
        const phone = onlyDigits(CONFIG.whatsappNumber);
        const text = encodeURIComponent(orderMessage(order, true));
        window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
        toast("Chave PIX copiada!");
      } catch {
        toast("Não foi possível copiar a chave.");
      }
    });
  }

  if ($("#btnClosePix")) $("#btnClosePix").addEventListener("click", closePixModal);
  if ($("#pixModal")) {
    $("#pixModal").addEventListener("click", (e) => {
      if (e.target.id === "pixModal") closePixModal();
    });
  }

  if ($("#btnCancelItemModal")) $("#btnCancelItemModal").addEventListener("click", closeItemModal);
  if ($("#btnSaveItemModal")) $("#btnSaveItemModal").addEventListener("click", saveModalItem);
  if ($("#itemModal")) {
    $("#itemModal").addEventListener("click", (e) => {
      if (e.target.id === "itemModal") closeItemModal();
    });
  }

  if ($("#btnCloseWelcome")) $("#btnCloseWelcome").addEventListener("click", closeWelcomeModal);
}

document.addEventListener("DOMContentLoaded", init);
