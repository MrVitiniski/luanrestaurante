const CONFIG = {
  restaurantName: "Marmita Express",
  deliveryFee: 5.00,
  whatsappNumber: "5511999999999",
  pixKey: "05674008914",
  draftKey: "marmita_draft_v3_multi"
};

const MARMITAS = [
  { id:"p", name:"Marmita P", desc:"Arroz, feijão, proteína + salada", price:18.90 },
  { id:"m", name:"Marmita M", desc:"Porção média reforçada", price:22.90 },
  { id:"g", name:"Marmita G", desc:"Porção grande completa", price:27.90 }
];

const DRINKS = [
  { id:"coca_lata", name:"Coca-Cola Lata", desc:"350ml", price:6.00 },
  { id:"coca_600", name:"Coca-Cola 600ml", desc:"Garrafa", price:9.00 },
  { id:"coca_2l", name:"Coca-Cola 2L", desc:"Garrafa família", price:14.00 },

  { id:"gua_lata", name:"Guaraná Lata", desc:"350ml", price:5.50 },
  { id:"gua_600", name:"Guaraná 600ml", desc:"Garrafa", price:8.50 },
  { id:"gua_2l", name:"Guaraná 2L", desc:"Garrafa família", price:13.00 },

  { id:"suk_lata", name:"Sukita Laranja Lata", desc:"350ml", price:5.50 },
  { id:"suk_600", name:"Sukita Laranja 600ml", desc:"Garrafa", price:8.50 },
  { id:"suk_2l", name:"Sukita Laranja 2L", desc:"Garrafa família", price:12.00 },

  { id:"agua_sem_gas", name:"Água 500ml sem gás", desc:"Garrafa", price:3.50 },
  { id:"agua_com_gas", name:"Água 500ml com gás", desc:"Garrafa", price:4.00 }
];

let currentStep = 1;
let selectedMarmitas = {}; // {id: qty}
let selectedDrinks = {};   // {id: qty}

const $ = (s) => document.querySelector(s);
const money = (v) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function onlyDigits(v){ return (v||"").replace(/\D/g,""); }

function toast(msg){
  const el = $("#toast");
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
function maskCep(v){
  const d = onlyDigits(v).slice(0,8);
  if(d.length <= 5) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}

function itemCardTemplate(item, group, qty){
  return `
    <article class="choice">
      <div>
        <strong>${item.name}</strong><br/>
        <small>${item.desc}</small>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
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
  $("#marmitaChoices").innerHTML = MARMITAS
    .map(item => itemCardTemplate(item, "marmita", selectedMarmitas[item.id] || 0))
    .join("");
}

function renderDrinks(){
  $("#drinkChoices").innerHTML = DRINKS
    .map(item => itemCardTemplate(item, "drink", selectedDrinks[item.id] || 0))
    .join("");
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
      $(`#qty-${group}-${id}`).textContent = next;

      clearInvalidById("marmitaChoices");
      renderSummary();
      saveDraft();
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
        name: item.name,
        qty,
        unit: item.price,
        total: item.price * qty
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
  const delivery = subtotal > 0 ? CONFIG.deliveryFee : 0;
  const total = subtotal + delivery;
  return { lines, subtotal, delivery, total };
}

function renderSummary(){
  const { lines, subtotal, delivery, total } = calcTotal();

  let itemsHtml = "";
  if(!lines.length){
    itemsHtml = `<div class="row"><span>Itens</span><strong>Nenhum selecionado</strong></div>`;
  } else {
    itemsHtml = lines.map(l => `
      <div class="row">
        <span>${l.name} x${l.qty}</span>
        <strong>${money(l.total)}</strong>
      </div>
    `).join("");
  }

  $("#summaryBox").innerHTML = `
    ${itemsHtml}
    <div class="row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
    <div class="row"><span>Entrega</span><strong>${money(delivery)}</strong></div>
    <div class="row total"><span>Total</span><strong>${money(total)}</strong></div>
  `;
}

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

/* validação visual */
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
      ["addressZip","Informe o CEP."],
      ["addressDistrict","Informe o bairro."],
      ["addressStreet","Informe a rua."],
      ["addressNumber","Informe o número."],
      ["addressComplement","Informe o complemento/referência."]
    ];

    required.forEach(([id,msg])=>{
      const input = $("#"+id);
      if(!input.value.trim()){ setInvalid(input, msg); ok = false; }
      else clearInvalid(input);
    });

    if(onlyDigits($("#customerPhone").value).length < 10){
      setInvalid($("#customerPhone"), "WhatsApp inválido."); ok = false;
    }
    if(onlyDigits($("#addressZip").value).length !== 8){
      setInvalid($("#addressZip"), "CEP inválido."); ok = false;
    }

    if(!ok){ toast("Preencha os campos obrigatórios."); return false; }
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

    if(!ok){ toast("Revise os dados de pagamento."); return false; }
    return true;
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
      zip: $("#addressZip").value.trim(),
      district: $("#addressDistrict").value.trim(),
      street: $("#addressStreet").value.trim(),
      number: $("#addressNumber").value.trim(),
      complement: $("#addressComplement").value.trim()
    },
    items: {
      lines,
      observacao: $("#notes").value.trim()
    },
    payment: {
      method: $("#paymentMethod").value,
      changeFor: Number($("#changeFor").value || 0)
    },
    totals: { subtotal, delivery, total }
  };
}

function orderMessage(order, includePix = false){
  const itemLines = order.items.lines.map(i => `- ${i.name} x${i.qty} (${money(i.total)})`).join("\n");

  const lines = [
    `*Pedido - ${CONFIG.restaurantName}*`,
    ``,
    `*Cliente:* ${order.customer.name}`,
    `*WhatsApp:* ${order.customer.phone}`,
    ``,
    `*Itens:*`,
    itemLines || "-",
    order.items.observacao ? `*Obs:* ${order.items.observacao}` : "",
    ``,
    `*Endereço:* ${order.address.street}, ${order.address.number} - ${order.address.district}`,
    `*CEP:* ${order.address.zip}`,
    `*Complemento:* ${order.address.complement}`,
    ``,
    `*Pagamento:* ${order.payment.method}`,
    order.payment.method === "Dinheiro" ? `*Troco para:* ${money(order.payment.changeFor)}` : "",
    ``,
    `*Total:* ${money(order.totals.total)}`
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
    notes: $("#notes").value,
    customerName: $("#customerName").value,
    customerPhone: $("#customerPhone").value,
    addressZip: $("#addressZip").value,
    addressDistrict: $("#addressDistrict").value,
    addressStreet: $("#addressStreet").value,
    addressNumber: $("#addressNumber").value,
    addressComplement: $("#addressComplement").value,
    paymentMethod: $("#paymentMethod").value,
    changeFor: $("#changeFor").value
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

    $("#notes").value = d.notes || "";
    $("#customerName").value = d.customerName || "";
    $("#customerPhone").value = d.customerPhone || "";
    $("#addressZip").value = d.addressZip || "";
    $("#addressDistrict").value = d.addressDistrict || "";
    $("#addressStreet").value = d.addressStreet || "";
    $("#addressNumber").value = d.addressNumber || "";
    $("#addressComplement").value = d.addressComplement || "";
    $("#paymentMethod").value = d.paymentMethod || "";
    $("#changeFor").value = d.changeFor || "";
    $("#changeField").style.display = $("#paymentMethod").value === "Dinheiro" ? "block" : "none";
  }catch{
    localStorage.removeItem(CONFIG.draftKey);
  }
}
function clearDraft(){ localStorage.removeItem(CONFIG.draftKey); }

function resetAll(){
  selectedMarmitas = {};
  selectedDrinks = {};
  currentStep = 1;

  $("#notes").value = "";
  ["customerName","customerPhone","addressZip","addressDistrict","addressStreet","addressNumber","addressComplement","changeFor"]
    .forEach(id => $("#"+id).value = "");
  $("#paymentMethod").value = "";
  $("#changeField").style.display = "none";

  document.querySelectorAll(".is-invalid").forEach(el=>el.classList.remove("is-invalid"));
  document.querySelectorAll(".error-text").forEach(el=>el.remove());

  renderMarmitas();
  renderDrinks();
  attachQtyEvents();
  renderSummary();
  updateStepUI();
  closePixModal();
  clearDraft();
  window.scrollTo({top:0,behavior:"smooth"});
}

function init(){
  closePixModal();
  loadDraft();

  renderMarmitas();
  renderDrinks();
  attachQtyEvents();
  renderSummary();
  updateStepUI();

  $("#customerPhone").value = maskPhone($("#customerPhone").value);
  $("#addressZip").value = maskCep($("#addressZip").value);

  ["notes","customerName","customerPhone","addressZip","addressDistrict","addressStreet","addressNumber","addressComplement","paymentMethod","changeFor"]
    .forEach(id=>{
      $("#"+id).addEventListener("input", saveDraft);
      $("#"+id).addEventListener("change", saveDraft);
    });

  $("#customerPhone").addEventListener("input", (e)=>{
    e.target.value = maskPhone(e.target.value);
    clearInvalid(e.target);
    saveDraft();
  });
  $("#addressZip").addEventListener("input", (e)=>{
    e.target.value = maskCep(e.target.value);
    clearInvalid(e.target);
    saveDraft();
  });

  ["customerName","addressDistrict","addressStreet","addressNumber","addressComplement","changeFor"]
    .forEach(id => $("#"+id).addEventListener("input", (e)=>clearInvalid(e.target)));

  $("#paymentMethod").addEventListener("change", (e)=>{
    $("#changeField").style.display = e.target.value === "Dinheiro" ? "block" : "none";
    clearInvalid(e.target);
    saveDraft();
  });

  $("#btnPrev").addEventListener("click", ()=>{
    if(currentStep > 1){ currentStep--; updateStepUI(); saveDraft(); }
  });

  $("#btnNext").addEventListener("click", ()=>{
    if(!validateStep(currentStep)) return;
    if(currentStep < 3){
      currentStep++;
      updateStepUI();
      if(currentStep === 3) renderSummary();
      saveDraft();
      return;
    }

    const order = buildOrder();
    if(order.payment.method === "PIX"){ openPixModal(); return; }

    const phone = onlyDigits(CONFIG.whatsappNumber);
    const text = encodeURIComponent(orderMessage(order,false));
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    toast("Pedido enviado com sucesso!");
    setTimeout(resetAll, 700);
  });

  $("#btnEditItems").addEventListener("click", ()=>{
    currentStep = 1;
    updateStepUI();
    saveDraft();
    toast("Você voltou para editar os itens.");
  });

  $("#btnCopyPix").addEventListener("click", async ()=>{
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

  $("#btnClosePix").addEventListener("click", closePixModal);
  $("#pixModal").addEventListener("click",(e)=>{ if(e.target.id === "pixModal") closePixModal(); });
}

init();
