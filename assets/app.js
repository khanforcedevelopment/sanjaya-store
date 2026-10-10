// =====================================================================
//  SANJAYA TRADING FZE – STORE SCRIPT
//  Prices, units & stock:  /data/products.json
//  Delivery fee, minimum order, areas:  /data/store-config.json
// =====================================================================
const WHATSAPP_NUMBER = "971569110077"; // country code + number, no + or spaces

const $ = (s) => document.querySelector(s);
let PRODUCTS = [];
let CONFIG = { currency: "AED", minOrder: 0, deliveryFee: 0, freeDeliveryOver: 0, deliveryAreas: [] };
let cart = loadCart(); // { productId: quantity }
let filter = "All";
let search = "";

// ---------- helpers ----------
const money = (n) => `${CONFIG.currency} ${Number(n).toFixed(2)}`;
const fmtQty = (q) => (Number.isInteger(q) ? q : q.toFixed(1));
const findP = (id) => PRODUCTS.find((p) => p.id == id);

function loadCart() {
  try { const c = JSON.parse(localStorage.getItem("sanjaya_cart")); return c && typeof c === "object" ? c : {}; }
  catch { return {}; }
}
function saveCart() { try { localStorage.setItem("sanjaya_cart", JSON.stringify(cart)); } catch {} }

function cartLines() {
  return Object.keys(cart)
    .map((id) => ({ p: findP(id), qty: cart[id] }))
    .filter((l) => l.p && l.p.inStock !== false && l.qty > 0);
}
function cartTotals() {
  const subtotal = cartLines().reduce((s, l) => s + l.p.price * l.qty, 0);
  const delivery = subtotal === 0 || (CONFIG.freeDeliveryOver && subtotal >= CONFIG.freeDeliveryOver) ? 0 : CONFIG.deliveryFee;
  return { subtotal, delivery, total: subtotal + delivery };
}

// ---------- real photos (optional) ----------
// Put a photo in /images/photos/ with the same name as the illustration
// (e.g. images/photos/mango.jpg). It is used automatically.
function photoPath(p) { return p.image.replace("/images/products/", "/images/photos/").replace(".webp", ".jpg"); }
function photoLoaded(img) {
  if (img.dataset.fallback && !img.dataset.failed) {
    img.parentElement.classList.add("has-photo");
    const p = PRODUCTS.find((x) => x.name === img.alt); if (p) p.hasPhoto = true;
  }
}
function photoFailed(img) {
  if (img.dataset.failed) return;
  img.dataset.failed = "1";
  img.src = img.dataset.fallback;
}
const thumb = (p) => (p.hasPhoto ? photoPath(p) : p.image);

// ---------- rendering ----------
function renderFilters() {
  if (!$("#filters")) return;
  const cats = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
  $("#filters").innerHTML = cats
    .map((c) => `<button class="chip ${c === filter ? "active" : ""}" data-cat="${c}">${c}</button>`)
    .join("");
}

function renderProducts() {
  if (!$("#productGrid")) return;
  const q = search.trim().toLowerCase();
  const list = PRODUCTS.filter((p) => (filter === "All" || p.category === filter) && (!q || p.name.toLowerCase().includes(q)));
  $("#productGrid").innerHTML = list.length
    ? list.map((p) => {
        const qty = cart[p.id] || 0;
        const out = p.inStock === false;
        return `
    <article class="card ${out ? "out" : ""}">
      <div class="card-img ${p.category === "Fresh Fruits" ? "fruit" : "veg"}">
        <span class="badge">${out ? "Out of stock" : p.category === "Fresh Fruits" ? "Fruit" : "Vegetable"}</span>
        <img src="${photoPath(p)}" data-fallback="${p.image}" alt="${p.name}" loading="lazy" width="400" height="400" onload="photoLoaded(this)" onerror="photoFailed(this)">
      </div>
      <div class="card-body">
        <h3>${p.name}</h3>
        <div class="price-row"><span class="price">${money(p.price)}</span><span class="per">/ ${p.unit}</span></div>
        ${out ? `<button class="add-btn" disabled>Out of stock</button>`
          : qty
          ? `<div class="stepper"><button data-dec="${p.id}" aria-label="Less">−</button><span>${fmtQty(qty)} ${p.unit === "kg" ? "kg" : ""}</span><button data-inc="${p.id}" aria-label="More">+</button></div>`
          : `<button class="add-btn" data-add="${p.id}">Add to cart</button>`}
      </div>
    </article>`;
      }).join("")
    : `<p class="empty">No products match "${search.replace(/</g, "&lt;")}".</p>`;
}

function renderCart() {
  const lines = cartLines();
  const { subtotal, delivery, total } = cartTotals();
  const count = lines.length;
  document.querySelectorAll(".cart-count").forEach((el) => (el.textContent = count));
  if (!$("#cartItems")) return;
  $("#cartItems").innerHTML = count
    ? lines.map(({ p, qty }) => `
      <div class="cart-item">
        <img class="ci-img" src="${thumb(p)}" alt="">
        <div class="ci-info"><b>${p.name}</b><small>${money(p.price)} / ${p.unit}</small>
          <div class="stepper sm"><button data-dec="${p.id}" aria-label="Less">−</button><span>${fmtQty(qty)}</span><button data-inc="${p.id}" aria-label="More">+</button></div>
        </div>
        <div class="ci-right"><b>${money(p.price * qty)}</b><button class="remove" data-remove="${p.id}" aria-label="Remove">✕</button></div>
      </div>`).join("")
    : `<p class="empty">Your cart is empty.</p>`;
  $("#cartSummary").innerHTML = count ? `
    <div class="sum-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="sum-row"><span>Delivery</span><span>${delivery ? money(delivery) : "Free"}</span></div>
    ${CONFIG.freeDeliveryOver && subtotal < CONFIG.freeDeliveryOver ? `<p class="hint">Add ${money(CONFIG.freeDeliveryOver - subtotal)} more for free delivery</p>` : ""}
    <div class="sum-row total"><span>Total <small>(incl. VAT)</small></span><span>${money(total)}</span></div>` : "";
  const below = subtotal < CONFIG.minOrder;
  const btn = $("#goCheckout");
  btn.classList.toggle("disabled", !count || below);
  btn.textContent = below && count ? `Minimum order ${money(CONFIG.minOrder)}` : "Checkout & pay securely";
  saveCart();
}

function rerender() { renderProducts(); renderCart(); }

function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800);
}
function openCart(open) {
  $("#cart")?.classList.toggle("open", open);
  $("#overlay")?.classList.toggle("show", open);
}

function changeQty(id, dir) {
  const p = findP(id); if (!p) return;
  const step = p.step || 1;
  const next = Math.round(((cart[id] || 0) + dir * step) * 10) / 10;
  if (next <= 0) delete cart[id]; else cart[id] = next;
  rerender();
}

function whatsappQuote() {
  const lines = cartLines();
  if (!lines.length) return toast("Your cart is empty");
  const text = `Hello Sanjaya Trading FZE! I'd like a wholesale quote for:\n${lines.map(({ p, qty }) => `• ${p.name} – ${fmtQty(qty)} ${p.unit}`).join("\n")}\n\nThank you.`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank");
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-cat],[data-add],[data-inc],[data-dec],[data-remove],[data-jump]");
  if (!t) return;
  if (t.dataset.jump) {
    filter = t.dataset.jump; renderFilters(); renderProducts();
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  } else if (t.dataset.cat) { filter = t.dataset.cat; renderFilters(); renderProducts(); }
  else if (t.dataset.add) {
    const p = findP(t.dataset.add);
    cart[p.id] = p.unit === "kg" ? 1 : p.step || 1;
    rerender(); toast(`${p.name} added to cart`);
  }
  else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
  else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
  else if (t.dataset.remove) { delete cart[t.dataset.remove]; rerender(); }
});

function bindUI() {
  $("#search")?.addEventListener("input", (e) => { search = e.target.value; renderProducts(); });
  $("#cartOpen") && ($("#cartOpen").onclick = () => openCart(true));
  $("#cartClose") && ($("#cartClose").onclick = () => openCart(false));
  $("#overlay") && ($("#overlay").onclick = () => openCart(false));
  $("#quoteWA") && ($("#quoteWA").onclick = whatsappQuote);
  $("#goCheckout")?.addEventListener("click", (e) => { if (e.currentTarget.classList.contains("disabled")) e.preventDefault(); });
  if ($("#burger")) {
    $("#burger").onclick = () => setMenu(!$("#menu").classList.contains("open"));
    document.querySelectorAll("#menu a").forEach((a) => (a.onclick = () => setMenu(false)));
    $("#cartOpen")?.addEventListener("click", () => setMenu(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setMenu(false); openCart(false); } });
  }
  $("#tabCart") && ($("#tabCart").onclick = () => openCart(true));
  trackActiveSection();
  initVip3D();
  if ($("#nav")) window.addEventListener("scroll", () => $("#nav").classList.toggle("scrolled", window.scrollY > 10), { passive: true });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  } else document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  if ($("#year")) $("#year").textContent = new Date().getFullYear();
}

// ---------- menu ----------
function setMenu(open) {
  $("#menu")?.classList.toggle("open", open);
  $("#burger")?.classList.toggle("open", open);
  $("#burger")?.setAttribute("aria-expanded", open);
  $("#nav")?.classList.toggle("menu-open", open);
  document.body.classList.toggle("menu-open", open);
}

// Highlight the menu / tab bar link of the section on screen
function trackActiveSection() {
  const links = [...document.querySelectorAll('#menu a[href^="#"], #tabbar a[href^="#"]')];
  const ids = [...new Set(links.map((a) => a.getAttribute("href").slice(1)))];
  const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
  if (!sections.length) return;
  const update = () => {
    const y = window.scrollY + window.innerHeight * 0.35;
    let current = sections[0].id, best = -Infinity;
    sections.forEach((s) => { const top = s.getBoundingClientRect().top + window.scrollY; if (top <= y && top > best) { best = top; current = s.id; } });
    links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + current));
  };
  let ticking = false;
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false; }); } }, { passive: true });
  update();
}

// ---------- VIP 3D effects ----------
function initVip3D() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // gold sparkles in the hero
  const sp = $("#sparkles");
  if (sp && !reduce) {
    sp.innerHTML = Array.from({ length: 26 }, () => {
      const size = 2 + Math.random() * 4;
      return `<i style="left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${7 + Math.random() * 9}s;animation-delay:${-Math.random() * 14}s"></i>`;
    }).join("");
  }
  if (reduce) return;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  // hero scene follows the mouse
  const scene = $("#heroScene");
  if (scene && fine) {
    const hero = scene.closest(".hero");
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      scene.style.setProperty("--ry", `${x * 22}deg`);
      scene.style.setProperty("--rx", `${-y * 16}deg`);
    });
    hero.addEventListener("pointerleave", () => { scene.style.setProperty("--ry", "0deg"); scene.style.setProperty("--rx", "0deg"); });
    scene.classList.add("interactive");
  }
  // 3D tilt + glare on product cards and category tiles
  if (fine) {
    let active = null;
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest(".card, .cat-tile");
      if (active && active !== el) { active.style.transform = ""; active.classList.remove("tilting"); }
      active = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const max = el.classList.contains("card") ? 10 : 6;
      el.classList.add("tilting");
      el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-6px)`;
      el.style.setProperty("--gx", `${x * 100}%`);
      el.style.setProperty("--gy", `${y * 100}%`);
    }, { passive: true });
  }
}

// ---------- payment badges: use official logo files if you add them ----------
// Put official SVGs in /images/payments/ (visa.svg, mastercard.svg, amex.svg,
// apple-pay.svg, google-pay.svg). Until then, a neat text badge is shown.
function loadPaymentLogos() {
  document.querySelectorAll(".pay-badge[data-logo]").forEach((b) => {
    const img = new Image();
    img.onload = () => { b.innerHTML = ""; b.appendChild(img); b.classList.add("has-logo"); };
    img.alt = b.textContent.trim();
    img.src = `/images/payments/${b.dataset.logo}.svg`;
  });
}

async function initStore() {
  bindUI();
  loadPaymentLogos();
  try {
    const [p, c] = await Promise.all([fetch("/data/products.json").then((r) => r.json()), fetch("/data/store-config.json").then((r) => r.json())]);
    PRODUCTS = p.products; CONFIG = { ...CONFIG, ...c };
  } catch (e) { console.error("Could not load products", e); }
  renderFilters(); rerender();
  document.dispatchEvent(new Event("store:ready"));
}
initStore();
