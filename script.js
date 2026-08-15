// ======= CONFIG =======
const CONFIG = {
  restaurantName: "Marmita Express",
  deliveryFee: 5.0,
  whatsappNumber: "5511999999999", // troque para o número real com DDI+DDD
  apiEndpoint: "http://localhost:3000/orders" // backend futuro
};

// ======= MENU =======
const MENU = [
  { id: "m1", name: "Marmita P", description: "Arroz, feijão, proteína + salada", price: 18.9 },
  { id: "m2", name: "Marmita M", description: "Porção média reforçada", price: 22.9 },
  { id: "m3", name: "Marmita G", description: "Porção grande completa", price: 27.9 },
  { id: "m4", name: "Fit (Low Carb)", description: "Proteína + legumes + salada", price: 26.5 }
];

const DRINKS = [
  { id: "d1", name: "Coca-Cola Lata", price: 6.0 },
  { id: "d2", name: "Guaraná Lata", price: 5.5 },
  { id: "d3", name: "Água 500ml", price: 3.5 }
];

// ======= STATE =======
const state = {
  items: {},   // {id: qty}
  drinks: {},  // {id: qty}
  kitchenOrders: []
};

// ======= HELPERS =======
const $ = (sel) => document.querySelector(sel);
const currency = (value) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function normalizePhone(phone) {
  return phone.replace(/\D/g, "");
}

// ======= RENDER MENU =======
function renderMenu() {
  const menuContainer = $("#menuContainer");
  menuContainer.innerHTML = MENU.map(item => itemCard(item, "items")).join("");

  const drinksContainer = $("#drinksContainer");
  drinksContainer.innerHTML = DRINKS.map(item => itemCard(item, "drinks")).join("");

  attachQtyEvents();
}

function itemCard(item, group) {
  const qty = state[group][item.id] || 0;
  return `
    <article class="item-card">
      <h4>${item.name}</h4>
      ${item.description ? `<p class="desc">${item.description}</p>` : ""}
      <div class="price">${currency(item.price)}</div>
      <div class="qty">
        <button type="button" data-group="${group}" data-id="${item.id}" data-action="dec">-</button>
        <span id="qty-${group}-${item.id}">${qty}</span>
        <button type="button" data-group="${group}" data-id="${item.id}" data-action="inc">+</button>
      </div>
    </article>
  `;
}

function attachQtyEvents() {
  document.querySelectorAll(".qty button").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      const current = state[group][id] || 0;
      const next = action === "inc" ? current + 1 : Math.max(0, current - 1);

      state[group][id] = next;
      $(`#qty-${group}-${id}`).textContent = next;
      renderSummary();
    });
  });
}

// ======= SUMMARY =======
function getSelectedLines() {
  const lines = [];

  MENU.forEach(item => {
    const qty = state.items[item.id] || 0;
    if (qty > 0) {
      lines.push({
        label: `${item.name} x${qty}`,
        total: item.price * qty
      });
    }
  });

  DRINKS.forEach(item => {
    const qty = state.drinks[item.id] || 0;
    if (qty > 0) {
      lines.push({
        label: `${item.name} x${qty}`,
        total: item.price * qty
      });
    }
  });

  return lines;
}

function calculateTotals() {
  const lines = getSelectedLines();
  const subtotal = lines.reduce((acc, line) => acc + line.total, 0);
  const delivery = subtotal > 0 ? CONFIG.deliveryFee : 0;
  const total = subtotal + delivery;
  return { lines, subtotal, delivery, total };
}

function renderSummary() {
  const { lines, subtotal, delivery, total } = calculateTotals();
  const summary = $("#summaryItems");

  if (!lines.length) {
    summary.classList.add("empty");
    summary.textContent = "Nenhum item selecionado.";
  } else {
    summary.classList.remove("empty");
    summary.innerHTML = lines.map(line => `
      <div class="summary-row">
        <span>${line.label}</span>
        <strong>${currency(line.total)}</strong>
      </div>
    `).join("");
  }

  $("#subtotalValue").textContent = currency(subtotal);
  $("#deliveryValue").textContent = currency(delivery);
  $("#totalValue").textContent = currency(total);
}

// ======= ORDER DATA =======
function buildOrderPayload() {
  const form = $("#orderForm");
  const data = new FormData(form);

  const customerName = data.get("customerName")?.toString().trim();
  const customerPhone = data.get("customerPhone")?.toString().trim();
  const addressStreet = data.get("addressStreet")?.toString().trim();
  const addressNumber = data.get("addressNumber")?.toString().trim();
  const addressDistrict = data.get("addressDistrict")?.toString().trim();
  const addressComplement = data.get("addressComplement")?.toString().trim();
  const paymentMethod = data.get("paymentMethod")?.toString().trim();
  const changeFor = Number(data.get("changeFor") || 0);
  const notes = data.get("notes")?.toString().trim();

  const { lines, subtotal, delivery, total } = calculateTotals();

  return {
    restaurant: CONFIG.restaurantName,
    createdAt: new Date().toISOString(),
    customer: {
      name: customerName,
      phone: customerPhone
    },
    address: {
      street: addressStreet,
      number: addressNumber,
      district: addressDistrict,
      complement: addressComplement || ""
    },
    payment: {
      method: paymentMethod,
      changeFor: paymentMethod === "Dinheiro" ? changeFor : 0
    },
    notes: notes || "",
    items: lines,
    totals: { subtotal, delivery, total },
    status: "NOVO"
  };
}

function validateOrder(order) {
  if (!order.customer.name) return "Informe seu nome.";
  if (!order.customer.phone) return "Informe seu WhatsApp.";
  if (!order.address.street || !order.address.number || !order.address.district) {
    return "Preencha o endereço completo.";
  }
  if (!order.payment.method) return "Selecione a forma de pagamento.";
  if (!order.items.length) return "Adicione ao menos um item.";
  return null;
}

// ======= API SIMULATION =======
async function submitOrderToApi(order) {
  // Simulação local: tenta enviar para API, se falhar mantém local
  try {
    const res = await fetch(CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });

    if (!res.ok) throw new Error("Falha na API");
    const result = await res.json();
    return { ok: true, data: result };
  } catch {
    // fallback local
    return {
      ok: true,
      data: { orderId: "LOCAL-" + Date.now(), ...order }
    };
  }
}

// ======= KITCHEN BOARD =======
function addKitchenOrder(orderData) {
  state.kitchenOrders.unshift(orderData);
  renderKitchenOrders();
}

function renderKitchenOrders() {
  const container = $("#kitchenOrders");

  if (!state.kitchenOrders.length) {
    container.classList.add("empty");
    container.textContent = "Ainda não há pedidos.";
    return;
  }

  container.classList.remove("empty");
  container.innerHTML = state.kitchenOrders.map(order => `
    <div class="kitchen-order">
      <div class="head">
        <strong>Pedido ${order.orderId || "(sem id)"}</strong>
        <span class="status">${order.status || "NOVO"}</span>
      </div>
      <div><b>Cliente:</b> ${order.customer?.name} (${order.customer?.phone})</div>
      <div><b>Endereço:</b> ${order.address?.street}, ${order.address?.number} - ${order.address?.district}</div>
      <div><b>Pagamento:</b> ${order.payment?.method}</div>
      <div><b>Total:</b> ${currency(order.totals?.total || 0)}</div>
      <div><b>Itens:</b> ${order.items?.map(i => i.label).join(", ")}</div>
    </div>
  `).join("");
}

// ======= WHATSAPP =======
function buildWhatsAppMessage(order) {
  const itemsText = order.items.map(i => `- ${i.label} (${currency(i.total)})`).join("\n");
  return [
    `*Novo Pedido - ${CONFIG.restaurantName}*`,
    ``,
    `*Cliente:* ${order.customer.name}`,
    `*Telefone:* ${order.customer.phone}`,
    ``,
    `*Itens:*`,
    itemsText,
    ``,
    `*Subtotal:* ${currency(order.totals.subtotal)}`,
    `*Entrega:* ${currency(order.totals.delivery)}`,
    `*Total:* ${currency(order.totals.total)}`,
    ``,
    `*Endereço:* ${order.address.street}, ${order.address.number} - ${order.address.district}`,
    order.address.complement ? `*Complemento:* ${order.address.complement}` : "",
    `*Pagamento:* ${order.payment.method}`,
    order.payment.method === "Dinheiro" && order.payment.changeFor > 0
      ? `*Troco para:* ${currency(order.payment.changeFor)}`
      : "",
    order.notes ? `*Obs:* ${order.notes}` : ""
  ].filter(Boolean).join("\n");
}

function openWhatsAppWithText(text) {
  const encoded = encodeURIComponent(text);
  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encoded}`;
  window.open(url, "_blank");
}

// ======= EVENTS =======
function setupEvents() {
  $("#btnSubmitOrder").addEventListener("click", async () => {
    const order = buildOrderPayload();
    const error = validateOrder(order);
    if (error) {
      alert(error);
      return;
    }

    const result = await submitOrderToApi(order);
    if (!result.ok) {
      alert("Não foi possível enviar o pedido.");
      return;
    }

    addKitchenOrder(result.data);
    alert(`Pedido enviado com sucesso! ID: ${result.data.orderId}`);
  });

  $("#btnSendWhatsApp").addEventListener("click", () => {
    const order = buildOrderPayload();
    const error = validateOrder(order);
    if (error) {
      alert(error);
      return;
    }

    const msg = buildWhatsAppMessage(order);
    openWhatsAppWithText(msg);
  });

  $("#btnClear").addEventListener("click", () => {
    state.items = {};
    state.drinks = {};
    renderMenu();
    renderSummary();
    $("#orderForm").reset();
  });

  $("#btnWhatsApp").setAttribute("href", `https://wa.me/${CONFIG.whatsappNumber}`);
}

// ======= INIT =======
(function init() {
  $("#year").textContent = new Date().getFullYear();
  renderMenu();
  renderSummary();
  setupEvents();
})();