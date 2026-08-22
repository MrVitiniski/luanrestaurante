const CONFIG = {
  restaurantName: "Pedido Express",
  deliveryFee: 5,
  freeDeliveryMinimum: 24.99,
  whatsappNumber: "5548999689856",
  pixKey: "05674008914",
  draftKey: "pedido_v9_sync_duplo_confirmacao"
};

const DEFAULT_MAP_CENTER = { lat: -28.6736, lng: -49.3697, zoom: 16 };

const ITEMS = [
  { id: "p", name: "Marmita P", desc: "Arroz, feijão, proteína + salada", price: 18.9, img: "./img/marmitex.png" },
  { id: "m", name: "Marmita M", desc: "Porção média reforçada", price: 22.9, img: "./img/marmitex.png" },
  { id: "g", name: "Marmita G", desc: "Porção grande completa", price: 27.9, img: "./img/marmitex.png" }
];

const DRINKS = [
  { id: "coca_lata", name: "Coca-Cola Lata", price: 6.0, imgLocal: "./img/bebidas/coca-lata.png", imgFallback: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=120&q=60" },
  { id: "coca_2l", name: "Coca-Cola 2L", price: 14.0, imgLocal: "./img/bebidas/coca-2l.png", imgFallback: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=120&q=60" },
  { id: "guarana_lata", name: "Guaraná Lata", price: 5.5, imgLocal: "./img/bebidas/guarana-lata.png", imgFallback: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=120&q=60" },
  { id: "guarana_2l", name: "Guaraná 2L", price: 13.0, imgLocal: "./img/bebidas/guarana-2l.png", imgFallback: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=120&q=60" },
  { id: "agua_com_gas", name: "Água com gás", price: 4.0, imgLocal: "./img/bebidas/agua-com-gas.png", imgFallback: "https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=120&q=60" },
  { id: "agua_sem_gas", name: "Água sem gás", price: 3.5, imgLocal: "./img/bebidas/agua-sem-gas.png", imgFallback: "https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=120&q=60" }
];

let currentStep = 1;
let addressType = "Casa";
let orderType = "Entrega";
let cartItems = [];
let orderDrinks = [];
let selectedPayment = "";
let selectedCoords = null;
let autoLocatedOnce = false;
let map = null;
let marker = null;
let editingNoteItemUid = null;
let orderCode = "PD-----";

let suppressAddressToMap = false;
let suppressMapToAddress = false;
let geocodeDebounce = null;
let lastGeocodeQuery = "";

const geocodeCache = new Map();
const reverseCache = new Map();

const $ = (s) => document.querySelector(s);
const money = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const onlyDigits = (v) => (v || "").replace(/\D/g, "");
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function toast(msg){
  const el = $("#toast"); if(!el) return;
  el.textContent = msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 1700);
}
function maskPhone(v){
  const d = onlyDigits(v).slice(0,11);
  if(d.length<=2) return d;
  if(d.length<=7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
function maskCep(v){
  const d = onlyDigits(v).slice(0,8);
  if(d.length<=5) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}
function animateCartBump(){
  const btn = $("#btnCartAction");
  if(!btn) return;
  btn.classList.remove("bump");
  void btn.offsetWidth;
  btn.classList.add("bump");
}

/* ORDER CODE */
function generateOrderCodeFromPhone(phoneValue){
  const d = onlyDigits(phoneValue);
  if (d.length < 4) return "PD-----";
  return `PD-${d.slice(-4)}`;
}
function refreshOrderCode(){
  orderCode = generateOrderCodeFromPhone($("#customerPhone")?.value || "");
  if($("#orderCodeBox")) $("#orderCodeBox").textContent = orderCode;
  if($("#orderCodePay")) $("#orderCodePay").textContent = orderCode;
  if($("#orderCodePix")) $("#orderCodePix").textContent = orderCode;
  saveDraft();
}

/* MAP + GEO */
function initMap(){
  if(map || !document.getElementById("map")) return;
  map = L.map("map").setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_CENTER.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);

  marker = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], {draggable:true}).addTo(map);
  selectedCoords = { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };

  marker.on("dragend", async ()=> {
    const p = marker.getLatLng();
    selectedCoords = { lat:p.lat, lng:p.lng };
    saveDraft();
    if(orderType === "Entrega"){
      await syncAddressFromMap(p.lat, p.lng);
    }
  });

  map.on("click", async (e)=>{
    marker.setLatLng(e.latlng);
    selectedCoords = { lat:e.latlng.lat, lng:e.latlng.lng };
    saveDraft();
    if(orderType === "Entrega"){
      await syncAddressFromMap(e.latlng.lat, e.latlng.lng);
    }
  });
}

function setMapLocation(lat,lng,zoom=17){
  if(!map || !marker) return;
  map.setView([lat,lng],zoom);
  marker.setLatLng([lat,lng]);
  selectedCoords = {lat,lng};
}
function autoLocateOnStep2(){
  if(autoLocatedOnce || orderType !== "Entrega") return;
  autoLocatedOnce = true;
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async (p)=>{
    setMapLocation(p.coords.latitude, p.coords.longitude, 18);
    saveDraft();
    await syncAddressFromMap(p.coords.latitude, p.coords.longitude);
  });
}

async function geocodeAddress(query){
  if(!query) return null;
  if(geocodeCache.has(query)) return geocodeCache.get(query);

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  const arr = await res.json();
  if(!Array.isArray(arr) || !arr.length) return null;

  const best = arr[0];
  const data = {
    lat: Number(best.lat),
    lng: Number(best.lon),
    display_name: best.display_name,
    address: best.address || {}
  };
  geocodeCache.set(query, data);
  return data;
}

async function reverseGeocode(lat,lng){
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if(reverseCache.has(key)) return reverseCache.get(key);

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  const data = await res.json();
  if(!data || !data.address) return null;
  reverseCache.set(key, data);
  return data;
}

function buildAddressQueryFromInputs(){
  const street = ($("#addressStreet")?.value || "").trim();
  const number = ($("#addressNumber")?.value || "").trim();
  const district = ($("#addressDistrict")?.value || "").trim();
  const zip = onlyDigits($("#addressZip")?.value || "");
  const parts = [
    street && number ? `${street}, ${number}` : street,
    district,
    zip ? `CEP ${zip}` : "",
    "Brasil"
  ].filter(Boolean);
  return parts.join(", ");
}

async function syncMapFromAddress(){
  if(suppressAddressToMap || suppressMapToAddress) return;
  if(orderType !== "Entrega") return;

  const query = buildAddressQueryFromInputs();
  if(!query || query.length < 6) return;
  if(query === lastGeocodeQuery) return;

  lastGeocodeQuery = query;
  try{
    const g = await geocodeAddress(query);
    if(!g) return;
    setMapLocation(g.lat, g.lng, 18);
    saveDraft();
  }catch{}
}

async function syncAddressFromMap(lat,lng){
  if(suppressMapToAddress || suppressAddressToMap) return;
  if(orderType !== "Entrega") return;

  try{
    suppressAddressToMap = true;
    const r = await reverseGeocode(lat,lng);
    if(!r || !r.address) return;

    const a = r.address;
    const road = a.road || a.pedestrian || a.cycleway || a.footway || "";
    const district = a.suburb || a.neighbourhood || a.city_district || a.quarter || "";

    if($("#addressStreet")) $("#addressStreet").value = road;
    if($("#addressNumber")) $("#addressNumber").value = a.house_number || $("#addressNumber").value || "";
    if($("#addressDistrict")) $("#addressDistrict").value = district;
    if($("#addressZip") && a.postcode){
      const cepDigits = onlyDigits(a.postcode).slice(0,8);
      $("#addressZip").value = maskCep(cepDigits);
    }

    if($("#zipStatus")) $("#zipStatus").textContent = "📍 Endereço sincronizado com mapa";
    saveDraft();
  }catch{
  }finally{
    setTimeout(()=>{ suppressAddressToMap = false; }, 150);
  }
}

/* CEP */
async function lookupCep(){
  const zip = onlyDigits($("#addressZip").value);
  const status = $("#zipStatus");
  if(zip.length !== 8){
    if(status) status.textContent = "";
    return;
  }

  try{
    if(status) status.textContent = "Buscando CEP...";
    const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
    const data = await res.json();

    if(data.erro){
      if(status) status.textContent = "CEP não encontrado.";
      return;
    }

    suppressMapToAddress = true;
    if($("#addressStreet")) $("#addressStreet").value = data.logradouro || $("#addressStreet").value || "";
    if($("#addressDistrict")) $("#addressDistrict").value = data.bairro || $("#addressDistrict").value || "";
    if(status) status.textContent = `✅ ${data.localidade || ""} - ${data.uf || ""}`;
    saveDraft();

    if(orderType === "Entrega"){
      await syncMapFromAddress();
    }
  }catch{
    if(status) status.textContent = "Falha ao buscar CEP.";
  }finally{
    setTimeout(()=>{ suppressMapToAddress = false; }, 150);
  }
}

/* ORDER TYPE */
function updateOrderTypeUI(){
  const isPickup = orderType === "Retirada no balcão";
  const deliveryFields = $("#deliveryFields");
  if(deliveryFields) deliveryFields.style.display = isPickup ? "none" : "block";
  renderSummary();
}
function initOrderTypeChips(){
  document.querySelectorAll("#orderTypeChips .chip").forEach(chip=>{
    chip.onclick = ()=>{
      document.querySelectorAll("#orderTypeChips .chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      orderType = chip.dataset.orderType;
      updateOrderTypeUI();
      saveDraft();
    };
  });
}

/* COMIDA */
function addFood(itemTypeId){
  const t = ITEMS.find(x=>x.id===itemTypeId);
  if(!t) return;
  cartItems.push({ uid: uid(), itemTypeId:t.id, itemName:t.name, basePrice:t.price, note:"", total:t.price });
  rerenderAll();
  animateCartBump();
  toast(`${t.name} adicionada`);
}
function addMoreFoodSameType(itemTypeId){ addFood(itemTypeId); }
function removeOneFoodSameType(itemTypeId){
  const idx = cartItems.findIndex(i=>i.itemTypeId===itemTypeId);
  if(idx>=0){ cartItems.splice(idx,1); rerenderAll(); }
}
function renderItems(){
  const box = $("#marmitaChoices"); if(!box) return;
  box.innerHTML = ITEMS.map(item=>`
    <article class="choice click-card" data-add-food="${item.id}">
      <img class="item-thumb" src="${item.img}" alt="${item.name}" />
      <div>
        <div class="choice-head">
          <div><strong>${item.name}</strong><br><small>${item.desc}</small></div>
          <span class="price">${money(item.price)}</span>
        </div>
        <div class="choice-actions"><small>Toque para adicionar</small><span class="badge-add">+ adicionar</span></div>
      </div>
    </article>
  `).join("");
  box.querySelectorAll("[data-add-food]").forEach(card=> card.onclick=()=>addFood(card.dataset.addFood));
}

/* BEBIDAS */
function addDrink(id){
  const d = DRINKS.find(x=>x.id===id); if(!d) return;
  const idx = orderDrinks.findIndex(x=>x.id===id);
  if(idx>=0) orderDrinks[idx].qty += 1;
  else orderDrinks.push({id:d.id,name:d.name,price:d.price,qty:1});
  rerenderAll(); animateCartBump(); toast(`${d.name} adicionada`);
}
function removeDrink(id){
  const it = orderDrinks.find(x=>x.id===id); if(!it) return;
  it.qty -= 1;
  if(it.qty<=0) orderDrinks = orderDrinks.filter(x=>x.id!==id);
  rerenderAll();
}
function renderOrderDrinks(){
  const box = $("#orderDrinksList"); if(!box) return;
  box.innerHTML = `
    <div class="drinks-grid">
      ${DRINKS.map(d=>`
        <article class="drink-tile click-card" data-add-drink="${d.id}">
          <img class="drink-thumb" src="${d.imgLocal}" alt="${d.name}" onerror="this.onerror=null;this.src='${d.imgFallback}'" />
          <strong class="drink-name">${d.name}</strong>
          <small class="drink-price">${money(d.price)}</small>
          <small class="muted">Toque para adicionar</small>
        </article>
      `).join("")}
    </div>
  `;
  box.querySelectorAll("[data-add-drink]").forEach(card=> card.onclick=()=>addDrink(card.dataset.addDrink));
}

/* SACOLA */
function foodGroups(){
  const mapG = new Map();
  cartItems.forEach(i=>{
    if(!mapG.has(i.itemTypeId)){
      mapG.set(i.itemTypeId, { itemTypeId:i.itemTypeId, itemName:i.itemName, basePrice:i.basePrice, qty:0, subtotal:0 });
    }
    const g = mapG.get(i.itemTypeId);
    g.qty += 1; g.subtotal += i.total;
  });
  return Array.from(mapG.values());
}
function renderBag(){
  const box = $("#bagList"); if(!box) return;

  const groups = foodGroups();
  const foodsHtml = groups.length
    ? groups.map(g=>`
      <article class="bag-item">
        <div class="bag-title"><strong>${g.itemName}</strong><strong>${money(g.subtotal)}</strong></div>
        <div class="bag-meta">Qtd: ${g.qty} • ${money(g.basePrice)} cada</div>
        <div class="bag-actions">
          <div class="qty-inline">
            <button class="qty-btn" data-food-minus="${g.itemTypeId}">−</button>
            <span class="qty-num">${g.qty}</span>
            <button class="qty-btn" data-food-plus="${g.itemTypeId}">+</button>
          </div>
          <button class="bag-btn" data-food-note="${g.itemTypeId}">Obs</button>
        </div>
      </article>
    `).join("")
    : `<div class="muted">Nenhum item de comida.</div>`;

  const drinksHtml = orderDrinks.length
    ? orderDrinks.map(d=>`
      <article class="bag-item">
        <div class="bag-title"><strong>🥤 ${d.name}</strong><strong>${money(d.price*d.qty)}</strong></div>
        <div class="bag-meta">Qtd: ${d.qty} • ${money(d.price)} cada</div>
        <div class="bag-actions">
          <div class="qty-inline">
            <button class="qty-btn" data-drink-minus="${d.id}">−</button>
            <span class="qty-num">${d.qty}</span>
            <button class="qty-btn" data-drink-plus="${d.id}">+</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="muted">Nenhuma bebida adicionada.</div>`;

  box.innerHTML = foodsHtml + drinksHtml;

  box.querySelectorAll("[data-food-plus]").forEach(b=> b.onclick=()=>addMoreFoodSameType(b.dataset.foodPlus));
  box.querySelectorAll("[data-food-minus]").forEach(b=> b.onclick=()=>removeOneFoodSameType(b.dataset.foodMinus));
  box.querySelectorAll("[data-drink-plus]").forEach(b=> b.onclick=()=>addDrink(b.dataset.drinkPlus));
  box.querySelectorAll("[data-drink-minus]").forEach(b=> b.onclick=()=>removeDrink(b.dataset.drinkMinus));
  box.querySelectorAll("[data-food-note]").forEach(b=> b.onclick=()=>openNoteModalByType(b.dataset.foodNote));
}

/* OBS */
function openNoteModalByType(itemTypeId){
  const firstItem = cartItems.find(i=>i.itemTypeId===itemTypeId);
  if(!firstItem) return;
  editingNoteItemUid = firstItem.uid;
  $("#noteModalTitle").textContent = `Observação • ${firstItem.itemName}`;
  $("#noteInput").value = firstItem.note || "";
  $("#noteModal").classList.add("show");
}
function closeNoteModal(){ $("#noteModal").classList.remove("show"); editingNoteItemUid = null; }
function saveNoteModal(){
  const item = cartItems.find(i=>i.uid===editingNoteItemUid);
  if(item) item.note = $("#noteInput").value.trim();
  closeNoteModal();
  rerenderAll();
}
function clearNoteModal(){ $("#noteInput").value = ""; saveNoteModal(); }

/* Totais */
function drinksSubtotal(){ return orderDrinks.reduce((a,d)=>a+d.price*d.qty,0); }
function getDeliveryFee(subtotal){
  if(orderType === "Retirada no balcão") return 0;
  return subtotal>=CONFIG.freeDeliveryMinimum ? 0 : CONFIG.deliveryFee;
}
function calcTotal(){
  const itemsSubtotal = cartItems.reduce((a,b)=>a+b.total,0);
  const drinksSub = drinksSubtotal();
  const subtotal = itemsSubtotal + drinksSub;
  const delivery = getDeliveryFee(subtotal);
  return {itemsSubtotal,drinksSub,subtotal,delivery,total:subtotal+delivery};
}
function renderSummary(){
  const box = $("#summaryBox"); if(!box) return;
  const {itemsSubtotal,drinksSub,subtotal,delivery,total} = calcTotal();
  box.innerHTML = `
    <div class="row"><span>Código do pedido</span><strong>${orderCode}</strong></div>
    <div class="row"><span>Subtotal comida</span><strong>${money(itemsSubtotal)}</strong></div>
    <div class="row"><span>Subtotal bebidas</span><strong>${money(drinksSub)}</strong></div>
    <div class="row"><span>Subtotal pedido</span><strong>${money(subtotal)}</strong></div>
    <div class="row"><span>Frete</span><strong>${money(delivery)}</strong></div>
    <div class="row total"><span>Total</span><strong>${money(total)}</strong></div>
  `;
  if(orderType === "Retirada no balcão"){
    $("#minimumRuleBox").innerHTML = `✅ Retirada no balcão selecionada (sem frete).`;
  }else{
    $("#minimumRuleBox").innerHTML = subtotal>=CONFIG.freeDeliveryMinimum
      ? `✅ Frete grátis liberado (mínimo ${money(CONFIG.freeDeliveryMinimum)}).`
      : `🚚 Frete R$ 5,00. Faltam ${money(CONFIG.freeDeliveryMinimum-subtotal)} para frete grátis.`;
  }
}
function updateCartBar(){
  const {total} = calcTotal();
  const qty = cartItems.length + orderDrinks.reduce((a,d)=>a+d.qty,0);
  $("#cartBarMeta").textContent = `${qty} item${qty===1?"":"s"} • ${money(total)}`;
}

/* Modal Sacola */
function renderCartModal(){
  const list = $("#cartModalList"); if(!list) return;
  const groups = foodGroups();

  const foodsHtml = groups.length
    ? groups.map(g=>`<article class="bag-item"><div class="bag-title"><strong>${g.itemName}</strong><strong>${money(g.subtotal)}</strong></div><div class="bag-meta">Qtd: ${g.qty}</div></article>`).join("")
    : `<div class="muted">Nenhum item de comida.</div>`;

  const drinksHtml = orderDrinks.length
    ? orderDrinks.map(d=>`<article class="bag-item"><div class="bag-title"><strong>🥤 ${d.name} x${d.qty}</strong><strong>${money(d.price*d.qty)}</strong></div></article>`).join("")
    : `<div class="muted">Nenhuma bebida.</div>`;

  list.innerHTML = foodsHtml + drinksHtml;

  const t = calcTotal();
  $("#cmFood").textContent = money(t.itemsSubtotal);
  $("#cmDrink").textContent = money(t.drinksSub);
  $("#cmDelivery").textContent = money(t.delivery);
  $("#cmTotal").textContent = money(t.total);
  $("#btnGoCheckoutFromCart").textContent = `Ir para pagamento (${money(t.total)})`;
}
function openCartModal(){ renderCartModal(); $("#cartModal").classList.add("show"); }
function closeCartModal(){ $("#cartModal").classList.remove("show"); }

/* Confirmar endereço */
function openConfirmAddressModal(){
  const modal = $("#confirmAddressModal");
  const box = $("#confirmAddressContent");
  if(!modal || !box) return;

  box.innerHTML = `
    <div><strong>CEP:</strong> ${$("#addressZip")?.value || "-"}</div>
    <div><strong>Bairro:</strong> ${$("#addressDistrict")?.value || "-"}</div>
    <div><strong>Rua:</strong> ${$("#addressStreet")?.value || "-"}</div>
    <div><strong>Número:</strong> ${$("#addressNumber")?.value || "-"}</div>
    <div><strong>Referência:</strong> ${$("#addressReference")?.value || "-"}</div>
  `;
  modal.classList.add("show");
}
function closeConfirmAddressModal(){
  const modal = $("#confirmAddressModal");
  if(modal) modal.classList.remove("show");
}

/* Steps e validação */
function updateStepUI(){
  [1,2,3].forEach(i=>$("#stepIndicator"+i).classList.toggle("active", i===currentStep));
  $("#btnPrev").disabled = currentStep===1;
  $("#btnNext").textContent = currentStep===3 ? "Finalizar pedido" : "Próximo";
  $("#stepsTrack").style.transform = `translateX(-${(currentStep-1)*33.3333}%)`;
  const pct = currentStep===1?33:currentStep===2?66:100;
  $("#progressBar").style.width = pct+"%";
  $("#progressLabel").textContent = pct+"%";
}
function validateStep(step){
  if(step===1){
    if(!cartItems.length){ toast("Adicione pelo menos 1 comida."); return false; }
    return true;
  }

  if(step===2){
    if(!$("#customerName").value.trim()){ toast("Informe o nome."); return false; }
    if(onlyDigits($("#customerPhone").value).length<10){ toast("WhatsApp inválido."); return false; }
    if(orderCode === "PD-----"){ toast("Código do pedido inválido."); return false; }

    if(orderType === "Entrega"){
      const req = ["addressZip","addressDistrict","addressStreet","addressNumber","addressReference"];
      for(const id of req){
        if(!$("#"+id).value.trim()){
          toast("Preencha os dados de entrega.");
          return false;
        }
      }
      if(onlyDigits($("#addressZip").value).length !== 8){
        toast("CEP inválido.");
        return false;
      }
    }

    return true;
  }

  if(step===3){
    if(!$("#paymentMethod").value){ toast("Selecione a forma de pagamento."); return false; }
    if($("#paymentMethod").value==="Dinheiro" && !$("#changeFor").value){ toast("Informe o troco."); return false; }
    return true;
  }
  return true;
}

/* Pedido */
function buildOrder(){
  const totals = calcTotal();
  return {
    orderCode,
    orderType,
    customer:{ name:$("#customerName").value.trim(), phone:$("#customerPhone").value.trim() },
    address: orderType === "Entrega" ? {
      type:addressType,
      zip: $("#addressZip").value.trim(),
      district:$("#addressDistrict").value.trim(),
      street:$("#addressStreet").value.trim(),
      number:$("#addressNumber").value.trim(),
      reference:$("#addressReference").value.trim()
    } : null,
    location: orderType === "Entrega" ? selectedCoords : null,
    items:cartItems,
    drinks:orderDrinks,
    payment:{ method:$("#paymentMethod").value, changeFor:Number($("#changeFor").value||0) },
    totals
  };
}
function orderMessage(order, includePix=false){
  const foodLines = order.items.length
    ? order.items.map((i,idx)=>`${idx+1}) ${i.itemName}${i.note?` | Obs: ${i.note}`:""} = *${money(i.total)}*`).join("\n")
    : "-";
  const drinkLines = order.drinks.length
    ? order.drinks.map((d,idx)=>`${idx+1}) ${d.name} x${d.qty} = *${money(d.price*d.qty)}*`).join("\n")
    : "-";

  const lines = [
    `*Pedido - ${CONFIG.restaurantName}*`,
    `*Código do pedido:* #${order.orderCode}`,
    ``,
    `*Tipo:* ${order.orderType}`,
    `*Cliente:* ${order.customer.name}`,
    `*WhatsApp:* ${order.customer.phone}`,
    ``,
    `*Comidas:*`, foodLines,
    ``,
    `*Bebidas:*`, drinkLines,
    ``,
    `*Subtotal comida:* ${money(order.totals.itemsSubtotal)}`,
    `*Subtotal bebidas:* ${money(order.totals.drinksSub)}`,
    `*Subtotal pedido:* ${money(order.totals.subtotal)}`,
    `*Frete:* ${money(order.totals.delivery)}`,
    `*Total:* ${money(order.totals.total)}`
  ];

  if(order.orderType === "Entrega" && order.address){
    lines.push(``,
      `*Endereço (${order.address.type}):* ${order.address.street}, ${order.address.number} - ${order.address.district}`,
      `*CEP:* ${order.address.zip}`,
      `*Referência:* ${order.address.reference}`
    );
    if(order.location){
      lines.push(`*Mapa:* https://maps.google.com/?q=${order.location.lat},${order.location.lng}`);
    }
  }else{
    lines.push(``, `*Retirada no balcão*`);
  }

  lines.push(``, `*Pagamento:* ${order.payment.method}`);
  if(order.payment.method==="Dinheiro"){
    lines.push(`*Troco para:* ${money(order.payment.changeFor)}`);
  }

  if(includePix){
    lines.push(``,
      `*Ao enviar o comprovante, informar código:* #${order.orderCode}`,
      `*Dados PIX:*`,
      `- CPF: 05674008914`,
      `- Nome: THOMAZ VITINISKI`,
      `- Banco: Efí`
    );
  }

  return lines.filter(Boolean).join("\n");
}

/* Draft */
function saveDraft(){
  localStorage.setItem(CONFIG.draftKey, JSON.stringify({
    currentStep,addressType,orderType,orderCode,cartItems,orderDrinks,selectedPayment,selectedCoords,autoLocatedOnce,
    customerName:$("#customerName")?.value||"", customerPhone:$("#customerPhone")?.value||"",
    addressZip:$("#addressZip")?.value||"", addressDistrict:$("#addressDistrict")?.value||"",
    addressStreet:$("#addressStreet")?.value||"", addressNumber:$("#addressNumber")?.value||"",
    addressReference:$("#addressReference")?.value||"", changeFor:$("#changeFor")?.value||""
  }));
}
function loadDraft(){
  const raw = localStorage.getItem(CONFIG.draftKey); if(!raw) return;
  try{
    const d = JSON.parse(raw);
    currentStep=d.currentStep||1;
    addressType=d.addressType||"Casa";
    orderType=d.orderType||"Entrega";
    orderCode=d.orderCode||"PD-----";
    cartItems=d.cartItems||[];
    orderDrinks=d.orderDrinks||[];
    selectedPayment=d.selectedPayment||"";
    selectedCoords=d.selectedCoords||null;
    autoLocatedOnce=d.autoLocatedOnce||false;

    $("#customerName").value=d.customerName||"";
    $("#customerPhone").value=d.customerPhone||"";
    $("#addressZip").value=d.addressZip||"";
    $("#addressDistrict").value=d.addressDistrict||"";
    $("#addressStreet").value=d.addressStreet||"";
    $("#addressNumber").value=d.addressNumber||"";
    $("#addressReference").value=d.addressReference||"";
    $("#changeFor").value=d.changeFor||"";
  }catch{}
}
function clearDraft(){ localStorage.removeItem(CONFIG.draftKey); }

function rerenderAll(){
  renderItems();
  renderOrderDrinks();
  renderBag();
  renderSummary();
  updateCartBar();
  renderCartModal();
  refreshOrderCode();
  saveDraft();
}

/* Init */
function init(){
  loadDraft();

  $("#customerPhone").value = maskPhone($("#customerPhone").value);
  $("#addressZip").value = maskCep($("#addressZip").value);

  rerenderAll();
  updateStepUI();
  updateOrderTypeUI();

  initMap();
  if(selectedCoords && map) setMapLocation(selectedCoords.lat, selectedCoords.lng, 17);

  $("#customerPhone").addEventListener("input",(e)=>{
    e.target.value = maskPhone(e.target.value);
    refreshOrderCode();
  });

  $("#addressZip").addEventListener("input",(e)=>{
    e.target.value = maskCep(e.target.value);
    saveDraft();

    clearTimeout(geocodeDebounce);
    geocodeDebounce = setTimeout(async ()=>{
      if(orderType === "Entrega") await syncMapFromAddress();
    }, 600);
  });
  $("#addressZip").addEventListener("blur", lookupCep);

  ["customerName","addressDistrict","addressStreet","addressNumber","addressReference","changeFor"].forEach(id=>{
    const el=$("#"+id);
    if(!el) return;

    el.addEventListener("input", async ()=>{
      saveDraft();
      if(orderType !== "Entrega") return;
      if(["addressDistrict","addressStreet","addressNumber"].includes(id)){
        clearTimeout(geocodeDebounce);
        geocodeDebounce = setTimeout(async ()=>{
          await syncMapFromAddress();
        }, 700);
      }
    });
  });

  initOrderTypeChips();

  document.querySelectorAll("#addressTypeChips .chip").forEach(chip=>{
    chip.onclick=()=>{
      document.querySelectorAll("#addressTypeChips .chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      addressType = chip.dataset.type;
      saveDraft();
    };
  });

  document.querySelectorAll("#orderTypeChips .chip").forEach(c=>c.classList.toggle("active", c.dataset.orderType===orderType));
  document.querySelectorAll("#addressTypeChips .chip").forEach(c=>c.classList.toggle("active", c.dataset.type===addressType));

  document.querySelectorAll(".pay-card").forEach(card=>{
    card.onclick=()=>{
      document.querySelectorAll(".pay-card").forEach(c=>c.classList.remove("active"));
      card.classList.add("active");
      selectedPayment = card.dataset.pay;
      $("#paymentMethod").value = selectedPayment;
      $("#changeField").style.display = selectedPayment==="Dinheiro" ? "block":"none";
      saveDraft();
    };
  });
  if(selectedPayment){
    $("#paymentMethod").value = selectedPayment;
    document.querySelectorAll(".pay-card").forEach(c=>c.classList.toggle("active", c.dataset.pay===selectedPayment));
    $("#changeField").style.display = selectedPayment==="Dinheiro" ? "block":"none";
  }

  $("#btnUseLocation").onclick=()=>{
    if(!navigator.geolocation) return toast("Geolocalização não suportada.");
    navigator.geolocation.getCurrentPosition(async (p)=>{
      setMapLocation(p.coords.latitude,p.coords.longitude,18);
      saveDraft();
      toast("Localização capturada.");
      if(orderType === "Entrega") await syncAddressFromMap(p.coords.latitude,p.coords.longitude);
    },()=>toast("Você negou a localização."));
  };

  $("#btnPrev").onclick=()=>{
    if(currentStep>1){ currentStep--; updateStepUI(); saveDraft(); }
  };

  $("#btnNext").onclick=async ()=>{
    if(!validateStep(currentStep)) return;

    if(currentStep===2 && orderType==="Entrega"){
      openConfirmAddressModal();
      return;
    }

    if(currentStep<3){
      currentStep++;
      updateStepUI();
      saveDraft();
      if(currentStep===2) autoLocateOnStep2();
      return;
    }

    const order = buildOrder();
    if(order.payment.method==="PIX"){
      $("#orderCodePix").textContent = order.orderCode;
      $("#pixModal").classList.add("show");
      return;
    }
    const text = encodeURIComponent(orderMessage(order,false));
    window.open(`https://wa.me/${onlyDigits(CONFIG.whatsappNumber)}?text=${text}`, "_blank");
  };

  // confirmação de endereço
  $("#btnEditAddress").onclick=()=>closeConfirmAddressModal();
  $("#btnConfirmAddressGoPay").onclick=()=>{
    closeConfirmAddressModal();
    currentStep = 3;
    updateStepUI();
    saveDraft();
  };
  $("#confirmAddressModal").addEventListener("click",(e)=>{
    if(e.target.id==="confirmAddressModal") closeConfirmAddressModal();
  });

  $("#btnCartAction").onclick=openCartModal;
  $("#btnCloseCartModal").onclick=closeCartModal;

  $("#btnGoCheckoutFromCart").onclick=()=>{
    closeCartModal();
    currentStep = 2;
    updateStepUI();
    if(!validateStep(2)){
      toast("Preencha os dados para continuar.");
      return;
    }
    if(orderType === "Entrega"){
      openConfirmAddressModal();
    }else{
      currentStep = 3;
      updateStepUI();
      saveDraft();
    }
  };

  $("#cartModal").addEventListener("click",(e)=>{ if(e.target.id==="cartModal") closeCartModal(); });

  $("#btnClearCart").onclick=()=>{
    cartItems=[]; orderDrinks=[];
    rerenderAll();
    clearDraft();
  };

  $("#btnCancelNote").onclick=closeNoteModal;
  $("#btnSaveNote").onclick=saveNoteModal;
  $("#btnClearNote").onclick=clearNoteModal;
  $("#noteModal").addEventListener("click",(e)=>{ if(e.target.id==="noteModal") closeNoteModal(); });

  $("#btnClosePix").onclick=()=>$("#pixModal").classList.remove("show");
  $("#pixModal").addEventListener("click",(e)=>{ if(e.target.id==="pixModal") $("#btnClosePix").click(); });

  $("#btnCopyPix").onclick=async()=>{
    try{
      await navigator.clipboard.writeText(CONFIG.pixKey);
      const order = buildOrder();
      const text = encodeURIComponent(orderMessage(order,true));
      window.open(`https://wa.me/${onlyDigits(CONFIG.whatsappNumber)}?text=${text}`, "_blank");
      toast("Chave PIX copiada!");
    }catch{
      toast("Não foi possível copiar.");
    }
  };
}

document.addEventListener("DOMContentLoaded", init);
