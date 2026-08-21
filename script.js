const CONFIG = {
  restaurantName: "Pedido Express",
  deliveryFee: 5,
  freeDeliveryMinimum: 24.99,
  whatsappNumber: "5511999999999",
  pixKey: "05674008914",
  draftKey: "pedido_v4_cart_modal"
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
let cartItems = [];
let orderDrinks = [];
let selectedPayment = "";
let selectedCoords = null;
let autoLocatedOnce = false;
let map = null;
let marker = null;
let editingNoteItemUid = null;

const $ = (s) => document.querySelector(s);
const money = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const onlyDigits = (v) => (v || "").replace(/\D/g, "");
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function toast(msg){
  const el = $("#toast"); if(!el) return;
  el.textContent = msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 1600);
}
function maskPhone(v){
  const d = onlyDigits(v).slice(0,11);
  if(d.length<=2) return d;
  if(d.length<=7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

/* MAP */
function initMap(){
  if(map || !document.getElementById("map")) return;
  map = L.map("map").setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_CENTER.zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
  marker = L.marker([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], {draggable:true}).addTo(map);
  selectedCoords = { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };

  marker.on("dragend", ()=> {
    const p = marker.getLatLng();
    selectedCoords = { lat:p.lat, lng:p.lng };
    saveDraft();
  });
  map.on("click",(e)=>{
    marker.setLatLng(e.latlng);
    selectedCoords = { lat:e.latlng.lat, lng:e.latlng.lng };
    saveDraft();
  });
}
function setMapLocation(lat,lng,zoom=17){
  if(!map || !marker) return;
  map.setView([lat,lng],zoom); marker.setLatLng([lat,lng]);
  selectedCoords = {lat,lng};
}
function autoLocateOnStep2(){
  if(autoLocatedOnce) return;
  autoLocatedOnce = true;
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((p)=>{
    setMapLocation(p.coords.latitude, p.coords.longitude, 18);
    saveDraft();
  });
}

/* COMIDA */
function addFood(itemTypeId){
  const t = ITEMS.find(x=>x.id===itemTypeId);
  if(!t) return;
  cartItems.push({ uid: uid(), itemTypeId:t.id, itemName:t.name, basePrice:t.price, note:"", total:t.price });
  rerenderAll();
}
function removeFood(itemTypeId){
  const idx = cartItems.findIndex(i=>i.itemTypeId===itemTypeId);
  if(idx<0) return;
  cartItems.splice(idx,1);
  rerenderAll();
}
function qtyFood(itemTypeId){ return cartItems.filter(i=>i.itemTypeId===itemTypeId).length; }

function renderItems(){
  const box = $("#marmitaChoices"); if(!box) return;
  box.innerHTML = ITEMS.map(item=>`
    <article class="choice">
      <img class="item-thumb" src="${item.img}" alt="${item.name}" />
      <div>
        <div class="choice-head">
          <div><strong>${item.name}</strong><br><small>${item.desc}</small></div>
          <span class="price">${money(item.price)}</span>
        </div>
        <div class="choice-actions">
          <small>Quantidade</small>
          <div class="qty-inline">
            <button class="qty-btn" data-food-dec="${item.id}">−</button>
            <span class="qty-num">${qtyFood(item.id)}</span>
            <button class="qty-btn" data-food-inc="${item.id}">+</button>
          </div>
        </div>
      </div>
    </article>
  `).join("");

  box.querySelectorAll("[data-food-inc]").forEach(b=>b.onclick=()=>addFood(b.dataset.foodInc));
  box.querySelectorAll("[data-food-dec]").forEach(b=>b.onclick=()=>removeFood(b.dataset.foodDec));
}

/* BEBIDAS */
function qtyDrink(id){ const d = orderDrinks.find(x=>x.id===id); return d?d.qty:0; }
function addDrink(id){
  const d = DRINKS.find(x=>x.id===id); if(!d) return;
  const idx = orderDrinks.findIndex(x=>x.id===id);
  if(idx>=0) orderDrinks[idx].qty += 1;
  else orderDrinks.push({id:d.id,name:d.name,price:d.price,qty:1});
  rerenderAll();
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
        <article class="drink-tile">
          <img class="drink-thumb" src="${d.imgLocal}" alt="${d.name}" onerror="this.onerror=null;this.src='${d.imgFallback}'" />
          <strong class="drink-name">${d.name}</strong>
          <small class="drink-price">${money(d.price)}</small>
          <div class="qty-under">
            <button class="qty-btn" data-drink-dec="${d.id}">−</button>
            <span class="qty-num">${qtyDrink(d.id)}</span>
            <button class="qty-btn" data-drink-inc="${d.id}">+</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
  box.querySelectorAll("[data-drink-inc]").forEach(b=>b.onclick=()=>addDrink(b.dataset.drinkInc));
  box.querySelectorAll("[data-drink-dec]").forEach(b=>b.onclick=()=>removeDrink(b.dataset.drinkDec));
}

/* SACOLA */
function renderBag(){
  const box = $("#bagList"); if(!box) return;

  const foodsHtml = cartItems.length
    ? cartItems.map((i,idx)=>`
      <article class="bag-item">
        <div class="bag-title"><strong>${idx+1}. ${i.itemName}</strong><strong>${money(i.total)}</strong></div>
        <div class="bag-meta">${i.note ? "Obs: " + i.note : "Sem observações"}</div>
        <div class="bag-actions">
          <button class="bag-btn" data-note="${i.uid}">Adicionar/Editar obs</button>
          <button class="bag-btn danger" data-del-food="${i.uid}">Remover</button>
        </div>
      </article>
    `).join("")
    : `<div class="muted">Nenhum item de comida.</div>`;

  const drinksHtml = orderDrinks.length
    ? orderDrinks.map((d,idx)=>`
      <article class="bag-item">
        <div class="bag-title"><strong>🥤 ${idx+1}. ${d.name} x${d.qty}</strong><strong>${money(d.price*d.qty)}</strong></div>
        <div class="bag-meta">Bebida do pedido (sem observação)</div>
      </article>
    `).join("")
    : `<div class="muted">Nenhuma bebida adicionada.</div>`;

  box.innerHTML = foodsHtml + drinksHtml;

  box.querySelectorAll("[data-del-food]").forEach(b=>{
    b.onclick=()=>{
      cartItems = cartItems.filter(i=>i.uid!==b.dataset.delFood);
      rerenderAll();
    };
  });
  box.querySelectorAll("[data-note]").forEach(b=>{
    b.onclick=()=>openNoteModal(b.dataset.note);
  });
}

/* Modal OBS */
function openNoteModal(itemUid){
  editingNoteItemUid = itemUid;
  const it = cartItems.find(x=>x.uid===itemUid);
  if(!it) return;
  $("#noteModalTitle").textContent = `Observação • ${it.itemName}`;
  $("#noteInput").value = it.note || "";
  $("#noteModal").classList.add("show");
  $("#noteModal").setAttribute("aria-hidden","false");
}
function closeNoteModal(){
  $("#noteModal").classList.remove("show");
  $("#noteModal").setAttribute("aria-hidden","true");
  editingNoteItemUid = null;
}
function saveNoteModal(){
  const it = cartItems.find(x=>x.uid===editingNoteItemUid);
  if(it) it.note = $("#noteInput").value.trim();
  closeNoteModal();
  rerenderAll();
}

/* Totais */
function drinksSubtotal(){ return orderDrinks.reduce((a,d)=>a+d.price*d.qty,0); }
function getDeliveryFee(subtotal){ return subtotal>=CONFIG.freeDeliveryMinimum ? 0 : CONFIG.deliveryFee; }
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
    <div class="row"><span>Subtotal comida</span><strong>${money(itemsSubtotal)}</strong></div>
    <div class="row"><span>Subtotal bebidas</span><strong>${money(drinksSub)}</strong></div>
    <div class="row"><span>Subtotal pedido</span><strong>${money(subtotal)}</strong></div>
    <div class="row"><span>Frete</span><strong>${money(delivery)}</strong></div>
    <div class="row total"><span>Total</span><strong>${money(total)}</strong></div>
  `;
  $("#minimumRuleBox").innerHTML = subtotal>=CONFIG.freeDeliveryMinimum
    ? `✅ Frete grátis liberado (mínimo ${money(CONFIG.freeDeliveryMinimum)}).`
    : `🚚 Frete R$ 5,00. Faltam ${money(CONFIG.freeDeliveryMinimum-subtotal)} para frete grátis.`;
}
function updateCartBar(){
  const {total} = calcTotal();
  const qty = cartItems.length + orderDrinks.reduce((a,d)=>a+d.qty,0);
  $("#cartBarMeta").textContent = `${qty} item${qty===1?"":"s"} • ${money(total)}`;
}

/* Modal SACOLA */
function renderCartModal(){
  const list = $("#cartModalList");
  if(!list) return;

  const foodsHtml = cartItems.length
    ? cartItems.map((i,idx)=>`
      <article class="bag-item">
        <div class="bag-title"><strong>${idx+1}. ${i.itemName}</strong><strong>${money(i.total)}</strong></div>
        <div class="bag-meta">${i.note ? "Obs: "+i.note : "Sem observações"}</div>
      </article>
    `).join("")
    : `<div class="muted">Nenhum item de comida.</div>`;

  const drinksHtml = orderDrinks.length
    ? orderDrinks.map((d,idx)=>`
      <article class="bag-item">
        <div class="bag-title"><strong>🥤 ${idx+1}. ${d.name} x${d.qty}</strong><strong>${money(d.price*d.qty)}</strong></div>
      </article>
    `).join("")
    : `<div class="muted">Nenhuma bebida.</div>`;

  list.innerHTML = foodsHtml + drinksHtml;

  const t = calcTotal();
  $("#cmFood").textContent = money(t.itemsSubtotal);
  $("#cmDrink").textContent = money(t.drinksSub);
  $("#cmDelivery").textContent = money(t.delivery);
  $("#cmTotal").textContent = money(t.total);
  $("#btnGoCheckoutFromCart").textContent = `Ir para pagamento (${money(t.total)})`;
}
function openCartModal(){
  renderCartModal();
  $("#cartModal").classList.add("show");
  $("#cartModal").setAttribute("aria-hidden","false");
}
function closeCartModal(){
  $("#cartModal").classList.remove("show");
  $("#cartModal").setAttribute("aria-hidden","true");
}

/* Steps */
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
    if(!cartItems.length){ toast("Adicione pelo menos 1 item de comida."); return false; }
    return true;
  }
  if(step===2){
    const req=["customerName","customerPhone","addressDistrict","addressStreet","addressNumber","addressReference"];
    for(const id of req){ if(!$("#"+id).value.trim()){ toast("Preencha os dados de entrega."); return false; } }
    if(onlyDigits($("#customerPhone").value).length<10){ toast("WhatsApp inválido."); return false; }
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
    customer:{ name:$("#customerName").value.trim(), phone:$("#customerPhone").value.trim() },
    address:{
      type:addressType, district:$("#addressDistrict").value.trim(), street:$("#addressStreet").value.trim(),
      number:$("#addressNumber").value.trim(), reference:$("#addressReference").value.trim()
    },
    location:selectedCoords,
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
    `*Pedido - ${CONFIG.restaurantName}*`,``,
    `*Cliente:* ${order.customer.name}`,
    `*WhatsApp:* ${order.customer.phone}`,``,
    `*Comidas:*`, foodLines,``,
    `*Bebidas:*`, drinkLines,``,
    `*Subtotal comida:* ${money(order.totals.itemsSubtotal)}`,
    `*Subtotal bebidas:* ${money(order.totals.drinksSub)}`,
    `*Subtotal pedido:* ${money(order.totals.subtotal)}`,
    `*Frete:* ${money(order.totals.delivery)}`,
    `*Total:* ${money(order.totals.total)}`,``,
    `*Endereço (${order.address.type}):* ${order.address.street}, ${order.address.number} - ${order.address.district}`,
    `*Referência:* ${order.address.reference}`,
    order.location ? `*Mapa:* https://maps.google.com/?q=${order.location.lat},${order.location.lng}` : "",
    ``,`*Pagamento:* ${order.payment.method}`,
    order.payment.method==="Dinheiro" ? `*Troco para:* ${money(order.payment.changeFor)}` : ""
  ].filter(Boolean);

  if(includePix){
    lines.push(``,`*Dados PIX:*`,`- CPF: 05674008914`,`- Nome: THOMAZ VITINISKI`,`- Banco: Efí`);
  }
  return lines.join("\n");
}

/* Draft */
function saveDraft(){
  localStorage.setItem(CONFIG.draftKey, JSON.stringify({
    currentStep,addressType,cartItems,orderDrinks,selectedPayment,selectedCoords,autoLocatedOnce,
    customerName:$("#customerName")?.value||"", customerPhone:$("#customerPhone")?.value||"",
    addressDistrict:$("#addressDistrict")?.value||"", addressStreet:$("#addressStreet")?.value||"",
    addressNumber:$("#addressNumber")?.value||"", addressReference:$("#addressReference")?.value||"",
    changeFor:$("#changeFor")?.value||""
  }));
}
function loadDraft(){
  const raw = localStorage.getItem(CONFIG.draftKey); if(!raw) return;
  try{
    const d = JSON.parse(raw);
    currentStep=d.currentStep||1; addressType=d.addressType||"Casa"; cartItems=d.cartItems||[];
    orderDrinks=d.orderDrinks||[]; selectedPayment=d.selectedPayment||""; selectedCoords=d.selectedCoords||null;
    autoLocatedOnce=d.autoLocatedOnce||false;
    $("#customerName").value=d.customerName||""; $("#customerPhone").value=d.customerPhone||"";
    $("#addressDistrict").value=d.addressDistrict||""; $("#addressStreet").value=d.addressStreet||"";
    $("#addressNumber").value=d.addressNumber||""; $("#addressReference").value=d.addressReference||"";
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
  saveDraft();
}

/* Init */
function init(){
  loadDraft();
  renderItems(); renderOrderDrinks(); renderBag(); renderSummary(); updateCartBar(); updateStepUI(); renderCartModal();
  initMap();
  if(selectedCoords && map) setMapLocation(selectedCoords.lat, selectedCoords.lng, 17);

  $("#customerPhone").value = maskPhone($("#customerPhone").value);
  $("#customerPhone").addEventListener("input",(e)=>{e.target.value=maskPhone(e.target.value);saveDraft();});
  ["customerName","addressDistrict","addressStreet","addressNumber","addressReference","changeFor"].forEach(id=>{
    const el=$("#"+id); if(el) el.addEventListener("input",saveDraft);
  });

  $("#btnUseLocation").onclick=()=>{
    if(!navigator.geolocation) return toast("Geolocalização não suportada.");
    navigator.geolocation.getCurrentPosition((p)=>{
      setMapLocation(p.coords.latitude,p.coords.longitude,18); saveDraft(); toast("Localização capturada.");
    },()=>toast("Você negou a localização."));
  };

  document.querySelectorAll("#addressTypeChips .chip").forEach(chip=>{
    chip.onclick=()=>{
      document.querySelectorAll("#addressTypeChips .chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      addressType = chip.dataset.type; saveDraft();
    };
  });

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

  $("#btnPrev").onclick=()=>{
    if(currentStep>1){ currentStep--; updateStepUI(); saveDraft(); }
  };
  $("#btnNext").onclick=()=>{
    if(!validateStep(currentStep)) return;
    if(currentStep<3){
      currentStep++; updateStepUI(); saveDraft();
      if(currentStep===2) autoLocateOnStep2();
      return;
    }
    const order = buildOrder();
    if(order.payment.method==="PIX"){
      $("#pixModal").classList.add("show");
      $("#pixModal").setAttribute("aria-hidden","false");
      return;
    }
    const text = encodeURIComponent(orderMessage(order,false));
    window.open(`https://wa.me/${onlyDigits(CONFIG.whatsappNumber)}?text=${text}`, "_blank");
  };

  // Barra preta abre modal da sacola
  $("#btnCartAction").onclick=openCartModal;

  $("#btnCloseCartModal").onclick=closeCartModal;
  $("#btnGoCheckoutFromCart").onclick=()=>{
    closeCartModal();
    currentStep = 3;
    updateStepUI();
    saveDraft();
  };
  $("#cartModal").addEventListener("click",(e)=>{ if(e.target.id==="cartModal") closeCartModal(); });

  $("#btnClearCart").onclick=()=>{
    cartItems=[]; orderDrinks=[];
    rerenderAll();
    clearDraft();
  };

  $("#btnCancelNote").onclick=closeNoteModal;
  $("#btnSaveNote").onclick=saveNoteModal;
  $("#noteModal").addEventListener("click",(e)=>{ if(e.target.id==="noteModal") closeNoteModal(); });

  $("#btnClosePix").onclick=()=>{ $("#pixModal").classList.remove("show"); $("#pixModal").setAttribute("aria-hidden","true"); };
  $("#pixModal").addEventListener("click",(e)=>{ if(e.target.id==="pixModal") $("#btnClosePix").click(); });

  $("#btnCopyPix").onclick=async()=>{
    try{
      await navigator.clipboard.writeText(CONFIG.pixKey);
      const order = buildOrder();
      const text = encodeURIComponent(orderMessage(order,true));
      window.open(`https://wa.me/${onlyDigits(CONFIG.whatsappNumber)}?text=${text}`, "_blank");
      toast("Chave PIX copiada!");
    }catch{ toast("Não foi possível copiar.");}
  };
}
document.addEventListener("DOMContentLoaded", init);
