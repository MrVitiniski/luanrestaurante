const CONFIG = {
  restaurantName: "Marmita Express",
  deliveryFee: 5.00,
  freeDeliveryMinimum: 25.00,
  whatsappNumber: "5548991998998",
  pixKey: "05674008914",
  draftKey: "marmita_draft_v12_confirm_entrega"
};

// Local inicial: Av. Universitária, 4380 - Criciúma/SC (aproximado)
const DEFAULT_MAP_CENTER = { lat: -28.6736, lng: -49.3697, zoom: 16 };

const MARMITAS = [
  { id:"p", name:"Marmita P", desc:"Arroz, feijão, proteína + salada", price:9.99 },
  { id:"m", name:"Marmita M", desc:"Porção média reforçada", price:14.99 },
  { id:"g", name:"Marmita G", desc:"Porção grande completa", price:19.99 }
];

const DRINKS = [
  { id:"coca_lata", name:"Coca-Cola Lata", desc:"350ml", price:6.00 },
  { id:"coca_600", name:"Coca-Cola 600ml", desc:"Garrafa", price:9.00 },
  { id:"coca_2l", name:"Coca-Cola 2L", desc:"Garrafa família", price:14.00 },
  { id:"gua_lata", name:"Guaraná Lata", desc:"350ml", price:6.00 },
  { id:"gua_600", name:"Guaraná 600ml", desc:"Garrafa", price:9.00 },
  { id:"gua_2l", name:"Guaraná 2L", desc:"Garrafa família", price:14.00 },
  { id:"suk_lata", name:"Sukita Laranja Lata", desc:"350ml", price:6.00 },
  { id:"suk_600", name:"Sukita Laranja 600ml", desc:"Garrafa", price:9.00 },
  { id:"suk_2l", name:"Sukita Laranja 2L", desc:"Garrafa família", price:14.00 },
  { id:"agua_sem_gas", name:"Água 500ml sem gás", desc:"Garrafa", price:3.50 },
  { id:"agua_com_gas", name:"Água 500ml com gás", desc:"Garrafa", price:4.00 }
];

let currentStep = 1;
let selectedMarmitas = {};
let selectedDrinks = {};
let marmitaNotes = {};

let map = null;
let marker = null;
let selectedCoords = null;
let autoLocatedOnce = false;

const $ = (s) => document.querySelector(s);
const money = (v) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const onlyDigits = (v) => (v||"").replace(/\D/g,"");

function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 1800);
}

function maskPhone(v){
  const d = onlyDigits(v).slice(0,11);
  if(d.length <= 2) return d;
  if(d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function getDeliveryFee(subtotal){
  return subtotal >= CONFIG.freeDeliveryMinimum ? 0 : CONFIG.deliveryFee;
}

/* ===== MAPA ===== */
function initMap(){
  if(map || !document.getElementById("map")) return;

  map = L.map("map").setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_CENTER.zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], { draggable: true }).addTo(map);
  selectedCoords = { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };

  marker.on("dragend", async () => {
    const pos = marker.getLatLng();
    selectedCoords = { lat: pos.lat, lng: pos.lng };
    await fillAddressFromCoords(pos.lat, pos.lng, false);
    saveDraft();
  });

  map.on("click", async (e) => {
    marker.setLatLng(e.latlng);
    selectedCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    await fillAddressFromCoords(e.latlng.lat, e.latlng.lng, false);
    saveDraft();
  });

  setTimeout(()=> map.invalidateSize(), 300);
}

function setMapLocation(lat, lng, zoom = 17){
  if(!map || !marker) return;
  map.setView([lat, lng], zoom);
  marker.setLatLng([lat, lng]);
  selectedCoords = { lat, lng };
}

async function reverseGeocode(lat, lon){
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if(!res.ok) throw new Error("Falha geocoding");
  return res.json();
}

async function fillAddressFromCoords(lat, lng, showToast = true){
  try{
    const data = await reverseGeocode(lat, lng);
    const a = data.address || {};

    const road = a.road || a.pedestrian || a.cycleway || "";
    const suburb = a.suburb || a.neighbourhood || a.city_district || "";

    if(road && !$("#addressStreet")?.value.trim()) $("#addressStreet").value = road;
    if(suburb && !$("#addressDistrict")?.value.trim()) $("#addressDistrict").value = suburb;

    const locationHint = $("#locationHint");
    if(locationHint) locationHint.textContent = "Pin atualizado no mapa. Confira rua, número e referência.";
    renderSummary();
    if(showToast) toast("Localização atualizada no mapa.");
  }catch{
    if(showToast) toast("Não foi possível obter endereço pelo mapa.");
  }
}

function autoLocateOnStep2(){
  if(autoLocatedOnce) return;
  autoLocatedOnce = true;

  if(!navigator.geolocation){
    if($("#locationHint")) $("#locationHint").textContent = "Geolocalização não suportada neste dispositivo.";
    return;
  }

  if($("#locationHint")) $("#locationHint").textContent = "Detectando sua localização atual...";

  navigator.geolocation.getCurrentPosition(async (pos)=>{
    try{
      const { latitude, longitude } = pos.coords;
      initMap();
      setMapLocation(latitude, longitude, 18);
      await fillAddressFromCoords(latitude, longitude, false);
      if($("#locationHint")) $("#locationHint").textContent = "Localização detectada automaticamente.";
      saveDraft();
      renderSummary();
    }catch{
      if($("#locationHint")) $("#locationHint").textContent = "Não foi possível aplicar localização automática.";
    }
  }, ()=>{
    if($("#locationHint")) $("#locationHint").textContent = "Permissão negada. Use o botão 'Usar minha localização'.";
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  });
}

function useMyLocation(){
  if(!navigator.geolocation){
    toast("Geolocalização não suportada neste dispositivo.");
    return;
  }

  if($("#locationHint")) $("#locationHint").textContent = "Obtendo sua localização...";
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    try{
      const { latitude, longitude } = pos.coords;
      initMap();
      setMapLocation(latitude, longitude, 18);
      await fillAddressFromCoords(latitude, longitude, false);
      saveDraft();
      toast("Localização capturada com sucesso!");
    }catch{
      toast("Falha ao aplicar localização no mapa.");
    }
  }, ()=>{
    if($("#locationHint")) $("#locationHint").textContent = "Permissão de localização negada.";
    toast("Você negou a permissão de localização.");
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  });
}

/* ===== ITENS ===== */
function itemCardTemplate(item, group, qty){
  const hasObs = group === "marmita";
  const showObs = hasObs && qty > 0;
  const obsValue = hasObs ? (marmitaNotes[item.id] || "") : "";

  return `
    <article class="choice">
      <div style="width:100%">
        <strong>${item.name}</strong><br/>
        <small>${item.desc}</small>

        ${showObs ? `
          <div class="item-obs-wrap">
            <textarea
              class="item-obs"
              data-note-id="${item.id}"
              placeholder="Observação para ${item.name} (ex: sem feijão, sem salada)..."
            >${obsValue}</textarea>
          </div>
        ` : ""}
      </div>

      <div style="display:flex;align-items:center;gap:10px;min-width:max-content">
        <span class="price">${money(item.price)}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" data-group="${group}" data-id="${item.id}" data-action="dec" class="btn prev" style="padding:4px 10px;border-radius:10px">-</button>
          <strong id="qty-${group}-${item.id}" style="min-width:18px;text-align:center">${qty}</strong>
          <button type="button" data-group="${group}" data-id="${item.id}" data-action="inc" class="btn next" style="padding:4px 10px;border-radius:10px">+</button>
        </div>
      </div>
    </article>
  `;
}

function renderMarmitas(){
  $("#marmitaChoices").innerHTML = MARMITAS.map(item =>
    itemCardTemplate(item, "marmita", selectedMarmitas[item.id] || 0)
  ).join("");
}
function renderDrinks(){
  $("#drinkChoices").innerHTML = DRINKS.map(item =>
    itemCardTemplate(item, "drink", selectedDrinks[item.id] || 0)
  ).join("");
}
function rebindStep1Interactions(){
  attachQtyEvents();
  attachMarmitaObsEvents();
}

function attachQtyEvents(){
  document.querySelectorAll("button[data-group]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const group = btn.dataset.group;
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      const stateObj = group === "marmita" ? selectedMarmitas : selectedDrinks;
      const cur = stateObj[id] || 0;
      const next = action === "inc" ? cur + 1 : Math.max(0, cur - 1);
      stateObj[id] = next;

      renderMarmitas();
      renderDrinks();
      rebindStep1Interactions();
      clearInvalidById("marmitaChoices");
      renderSummary();
      saveDraft();
    });
  });
}

function attachMarmitaObsEvents(){
  document.querySelectorAll("textarea[data-note-id]").forEach(textarea=>{
    textarea.addEventListener("input", ()=>{
      const id = textarea.dataset.noteId;
      marmitaNotes[id] = textarea.value;
      saveDraft();
      renderSummary();
    });
  });
}

function getSelectedMarmitaLines(){
  const lines = [];
  for(const item of MARMITAS){
    const qty = selectedMarmitas[item.id] || 0;
    if(qty > 0){
      lines.push({
        type: "marmita",
        id: item.id,
        name: item.name,
        qty,
        unit: item.price,
        total: item.price * qty,
        note: (marmitaNotes[item.id] || "").trim()
      });
    }
  }
  return lines;
}
function getSelectedDrinkLines(){
  const lines = [];
  for(const item of DRINKS){
    const qty = selectedDrinks[item.id] || 0;
    if(qty > 0){
      lines.push({
        type: "bebida",
        id: item.id,
        name: item.name,
        qty,
        unit: item.price,
        total: item.price * qty
      });
    }
  }
  return lines;
}
function getAllSelectedLines(){
  return [...getSelectedMarmitaLines(), ...getSelectedDrinkLines()];
}

function calcTotal(){
  const lines = getAllSelectedLines();
  const subtotal = lines.reduce((acc, l) => acc + l.total, 0);
  const delivery = getDeliveryFee(subtotal);
  const total = subtotal + delivery;
  return { lines, subtotal, delivery, total };
}

function renderMinimumRule(subtotal){
  const box = $("#minimumRuleBox");
  if(!box) return;

  const missing = Math.max(0, CONFIG.freeDeliveryMinimum - subtotal);
  const deliveryNow = getDeliveryFee(subtotal);

  if(subtotal >= CONFIG.freeDeliveryMinimum){
    box.style.borderColor = "#86efac";
    box.style.background = "#f0fdf4";
    box.style.color = "#166534";
    box.innerHTML = `✅ Frete grátis liberado! Valor mínimo de ${money(CONFIG.freeDeliveryMinimum)} atingido.`;
  } else {
    box.style.borderColor = "#fde68a";
    box.style.background = "#fffbeb";
    box.style.color = "#92400e";
    box.innerHTML = `🚚 Frete atual: ${money(deliveryNow)}. Adicione mais ${money(missing)} em itens para ganhar frete grátis.`;
  }
}

function renderSummary(){
  const { lines, subtotal, delivery, total } = calcTotal();

  let itemsHtml = "";
  if(!lines.length){
    itemsHtml = `<div class="row"><span>Itens</span><strong>Nenhum selecionado</strong></div>`;
  } else {
    itemsHtml = lines.map(l => `
      <div>
        <div class="row">
          <span>${l.name} x${l.qty}</span>
          <strong>${money(l.total)}</strong>
        </div>
        ${l.type === "marmita" && l.note ? `<small style="color:#64748b">Obs: ${l.note}</small>` : ""}
      </div>
    `).join("");
  }

  $("#summaryBox").innerHTML = `
    ${itemsHtml}
    <div class="row"><span>Subtotal (itens)</span><strong>${money(subtotal)}</strong></div>
    <div class="row"><span>Frete</span><strong>${money(delivery)}</strong></div>
    <div class="row total"><span>Total</span><strong>${money(total)}</strong></div>
  `;

  renderMinimumRule(subtotal);
}

/* ===== UI ===== */
function updateProgress(){
  const pct = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;
  $("#progressBar").style.width = pct + "%";
  $("#progressLabel").textContent = pct + "%";
}
function updateStepUI(){
  [1,2,3].forEach(i => {
    $("#step"+i).classList.toggle("active", i===currentStep);
    $("#stepIndicator"+i).classList.toggle("active", i===currentStep);
  });
  $("#btnPrev").disabled = currentStep === 1;
  $("#btnNext").textContent = currentStep === 3 ? "Finalizar pedido" : "Próximo";
  updateProgress();
}

function setInvalid(input, message){
  input.classList.add("is-invalid");
  let err = input.parentElement.querySelector(".error-text");
  if(!err){
    err = document.createElement("small");
    err.className = "error-text";
    input.parentElement.appendChild(err);
  }
  err.textContent = message;
}
function clearInvalid(input){
  input.classList.remove("is-invalid");
  const err = input.parentElement.querySelector(".error-text");
  if(err) err.remove();
}
function setInvalidById(id){ const el=$("#"+id); if(el) el.classList.add("is-invalid"); }
function clearInvalidById(id){ const el=$("#"+id); if(el) el.classList.remove("is-invalid"); }

function confirmDeliveryDataBeforeStep3(){
  const message =
`Confira seus dados de entrega antes de continuar.

Se a entrega for em prédio/condomínio, informe BLOCO e APTO no campo de referência.

Deseja continuar?`;
  return window.confirm(message);
}

function validateStep(step){
  if(step === 1){
    const totalMarmitas = Object.values(selectedMarmitas).reduce((a,b)=>a+b,0);
    if(totalMarmitas <= 0){
      setInvalidById("marmitaChoices");
      toast("Adicione pelo menos 1 marmita.");
      return false;
    }
    return true;
  }

  if(step === 2){
    let ok = true;
    const required = [
      ["customerName","Informe seu nome."],
      ["customerPhone","Informe seu WhatsApp."],
      ["addressDistrict","Informe o bairro."],
      ["addressStreet","Informe a rua."],
      ["addressNumber","Informe o número."],
      ["addressReference","Informe um ponto de referência."]
    ];

    required.forEach(([id,msg])=>{
      const input = $("#"+id);
      if(!input || !input.value.trim()){ if(input) setInvalid(input, msg); ok = false; }
      else clearInvalid(input);
    });

    if(onlyDigits($("#customerPhone").value).length < 10){
      setInvalid($("#customerPhone"), "WhatsApp inválido."); ok = false;
    }

    if(!ok){
      toast("Preencha os campos obrigatórios.");
      return false;
    }

    // popup de conferência antes de ir ao passo 3
    if(!confirmDeliveryDataBeforeStep3()){
      return false;
    }

    return true;
  }

  if(step === 3){
    let ok = true;
    const method = $("#paymentMethod");
    if(!method.value){ setInvalid(method, "Selecione a forma de pagamento."); ok = false; }
    else clearInvalid(method);

    if(method.value === "Dinheiro"){
      const troco = $("#changeFor");
      if(!troco.value){ setInvalid(troco, "Informe o troco para quanto."); ok = false; }
      else clearInvalid(troco);
    } else clearInvalid($("#changeFor"));

    return ok;
  }

  return true;
}

function buildOrder(){
  const { lines, subtotal, delivery, total } = calcTotal();
  return {
    customer: {
      name: $("#customerName").value.trim(),
      phone: $("#customerPhone").value.trim()
    },
    address: {
      district: $("#addressDistrict").value.trim(),
      street: $("#addressStreet").value.trim(),
      number: $("#addressNumber").value.trim(),
      reference: $("#addressReference").value.trim()
    },
    location: selectedCoords ? { lat: selectedCoords.lat, lng: selectedCoords.lng } : null,
    items: { lines },
    payment: {
      method: $("#paymentMethod").value,
      changeFor: Number($("#changeFor").value || 0)
    },
    totals: { subtotal, delivery, total }
  };
}

function orderMessage(order, includePix = false){
  const itemLines = order.items.lines.map(i => {
    const obs = (i.type === "marmita" && i.note) ? ` | Obs: ${i.note}` : "";
    return `- ${i.name} x${i.qty} (${money(i.total)})${obs}`;
  }).join("\n");

  const lines = [
    `*Pedido - ${CONFIG.restaurantName}*`,
    ``,
    `*Cliente:* ${order.customer.name}`,
    `*WhatsApp:* ${order.customer.phone}`,
    ``,
    `*Itens:*`,
    itemLines || "-",
    ``,
    `*Subtotal (itens):* ${money(order.totals.subtotal)}`,
    `*Frete:* ${money(order.totals.delivery)}`,
    `*Total:* ${money(order.totals.total)}`,
    ``,
    `*Endereço:* ${order.address.street}, ${order.address.number} - ${order.address.district}`,
    `*Referência:* ${order.address.reference}`,
    order.location ? `*Mapa:* https://maps.google.com/?q=${order.location.lat},${order.location.lng}` : "",
    ``,
    `*Pagamento:* ${order.payment.method}`,
    order.payment.method === "Dinheiro" ? `*Troco para:* ${money(order.payment.changeFor)}` : ""
  ].filter(Boolean);

  if(includePix){
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

function openPixModal(){ $("#pixModal").classList.add("show"); $("#pixModal").setAttribute("aria-hidden","false"); }
function closePixModal(){ $("#pixModal").classList.remove("show"); $("#pixModal").setAttribute("aria-hidden","true"); }

function saveDraft(){
  const draft = {
    currentStep,
    selectedMarmitas,
    selectedDrinks,
    marmitaNotes,
    selectedCoords,
    autoLocatedOnce,
    customerName: $("#customerName")?.value || "",
    customerPhone: $("#customerPhone")?.value || "",
    addressDistrict: $("#addressDistrict")?.value || "",
    addressStreet: $("#addressStreet")?.value || "",
    addressNumber: $("#addressNumber")?.value || "",
    addressReference: $("#addressReference")?.value || "",
    paymentMethod: $("#paymentMethod")?.value || "",
    changeFor: $("#changeFor")?.value || ""
  };
  localStorage.setItem(CONFIG.draftKey, JSON.stringify(draft));
}

function loadDraft(){
  const raw = localStorage.getItem(CONFIG.draftKey);
  if(!raw) return;
  try{
    const d = JSON.parse(raw);
    currentStep = d.currentStep || 1;
    selectedMarmitas = d.selectedMarmitas || {};
    selectedDrinks = d.selectedDrinks || {};
    marmitaNotes = d.marmitaNotes || {};
    selectedCoords = d.selectedCoords || null;
    autoLocatedOnce = d.autoLocatedOnce || false;

    if($("#customerName")) $("#customerName").value = d.customerName || "";
    if($("#customerPhone")) $("#customerPhone").value = d.customerPhone || "";
    if($("#addressDistrict")) $("#addressDistrict").value = d.addressDistrict || "";
    if($("#addressStreet")) $("#addressStreet").value = d.addressStreet || "";
    if($("#addressNumber")) $("#addressNumber").value = d.addressNumber || "";
    if($("#addressReference")) $("#addressReference").value = d.addressReference || "";
    if($("#paymentMethod")) $("#paymentMethod").value = d.paymentMethod || "";
    if($("#changeFor")) $("#changeFor").value = d.changeFor || "";
    if($("#changeField")) $("#changeField").style.display = ($("#paymentMethod")?.value === "Dinheiro") ? "block" : "none";
  }catch{
    localStorage.removeItem(CONFIG.draftKey);
  }
}
function clearDraft(){ localStorage.removeItem(CONFIG.draftKey); }

function clearCartOnly(){
  selectedMarmitas = {};
  selectedDrinks = {};
  marmitaNotes = {};
  renderMarmitas();
  renderDrinks();
  rebindStep1Interactions();
  renderSummary();
  saveDraft();
  toast("Carrinho limpo.");
}

function resetAll(){
  selectedMarmitas = {};
  selectedDrinks = {};
  marmitaNotes = {};
  selectedCoords = { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };
  autoLocatedOnce = false;
  currentStep = 1;

  ["customerName","customerPhone","addressDistrict","addressStreet","addressNumber","addressReference","changeFor"]
    .forEach(id => { if($("#"+id)) $("#"+id).value = ""; });

  if($("#paymentMethod")) $("#paymentMethod").value = "";
  if($("#changeField")) $("#changeField").style.display = "none";
  if($("#districtHint")) $("#districtHint").textContent = "Frete R$ 5,00 para pedidos abaixo de R$ 25,00. Acima disso, frete grátis.";
  if($("#locationHint")) $("#locationHint").textContent = "Permita localização para preencher endereço aproximado.";

  document.querySelectorAll(".is-invalid").forEach(el=>el.classList.remove("is-invalid"));
  document.querySelectorAll(".error-text").forEach(el=>el.remove());

  renderMarmitas();
  renderDrinks();
  rebindStep1Interactions();
  renderSummary();
  updateStepUI();
  closePixModal();

  if(map && marker){
    setMapLocation(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.zoom);
    setTimeout(()=>map.invalidateSize(), 150);
  }

  clearDraft();
  window.scrollTo({top:0,behavior:"smooth"});
}

function init(){
  closePixModal();
  loadDraft();

  renderMarmitas();
  renderDrinks();
  rebindStep1Interactions();
  renderSummary();
  updateStepUI();

  initMap();
  if(selectedCoords && map){
    setMapLocation(selectedCoords.lat, selectedCoords.lng, 17);
  } else if(map){
    setMapLocation(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.zoom);
  }

  if($("#districtHint")) $("#districtHint").textContent = "Frete R$ 5,00 para pedidos abaixo de R$ 25,00. Acima disso, frete grátis.";

  if($("#customerPhone")) $("#customerPhone").value = maskPhone($("#customerPhone").value);

  [
    "customerName","customerPhone","addressDistrict","addressStreet",
    "addressNumber","addressReference","paymentMethod","changeFor"
  ].forEach(id=>{
    if(!$("#"+id)) return;
    $("#"+id).addEventListener("input", saveDraft);
    $("#"+id).addEventListener("change", saveDraft);
  });

  $("#customerPhone")?.addEventListener("input", (e)=>{
    e.target.value = maskPhone(e.target.value);
    clearInvalid(e.target);
    saveDraft();
  });

  ["customerName","addressDistrict","addressStreet","addressNumber","addressReference","changeFor"]
    .forEach(id => $("#"+id)?.addEventListener("input", (e)=>clearInvalid(e.target)));

  $("#paymentMethod")?.addEventListener("change", (e)=>{
    if($("#changeField")) $("#changeField").style.display = e.target.value === "Dinheiro" ? "block" : "none";
    clearInvalid(e.target);
    saveDraft();
  });

  $("#btnUseLocation")?.addEventListener("click", useMyLocation);

  $("#btnPrev")?.addEventListener("click", ()=>{
    if(currentStep > 1){
      currentStep--;
      updateStepUI();
      saveDraft();
      if(currentStep === 2 && map) setTimeout(()=>map.invalidateSize(), 150);
    }
  });

  $("#btnNext")?.addEventListener("click", ()=>{
    if(!validateStep(currentStep)) return;

    if(currentStep < 3){
      currentStep++;
      updateStepUI();

      if(currentStep === 2){
        if(map) setTimeout(()=>map.invalidateSize(), 150);
        autoLocateOnStep2();
      }

      if(currentStep === 3) renderSummary();
      saveDraft();
      return;
    }

    const order = buildOrder();

    if(order.payment.method === "PIX"){
      openPixModal();
      return;
    }

    const phone = onlyDigits(CONFIG.whatsappNumber);
    const text = encodeURIComponent(orderMessage(order,false));
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");

    toast("Pedido enviado com sucesso!");
    setTimeout(resetAll, 700);
  });

  $("#btnEditItems")?.addEventListener("click", ()=>{
    currentStep = 1;
    updateStepUI();
    saveDraft();
    toast("Você voltou para editar os itens.");
  });

  $("#btnClearCart")?.addEventListener("click", clearCartOnly);

  $("#btnCopyPix")?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(CONFIG.pixKey);
      toast("Chave PIX copiada! Abrindo WhatsApp...");
      const order = buildOrder();
      const phone = onlyDigits(CONFIG.whatsappNumber);
      const text = encodeURIComponent(orderMessage(order,true));
      setTimeout(()=>window.open(`https://wa.me/${phone}?text=${text}`, "_blank"),300);
    }catch{
      toast("Não foi possível copiar a chave.");
    }
  });

  $("#btnClosePix")?.addEventListener("click", closePixModal);
  $("#pixModal")?.addEventListener("click",(e)=>{ if(e.target.id === "pixModal") closePixModal(); });
}

init();
