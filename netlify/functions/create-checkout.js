// Secure server-side checkout. Prices are ALWAYS taken from /data/products.json
// here on the server, so customers cannot change prices in their browser.
// Requires the environment variable STRIPE_SECRET_KEY (set in Netlify).
const catalog = require("../../data/products.json");
const config = require("../../data/store-config.json");

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const clean = (v, max = 200) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(503, { error: "not_configured", message: "Online payment is not set up yet." });

  let data;
  try { data = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid request" }); }

  // ----- validate items & recalculate prices on the server -----
  const items = Array.isArray(data.items) ? data.items.slice(0, 60) : [];
  const lines = [];
  for (const it of items) {
    const p = catalog.products.find((x) => x.id === Number(it.id));
    if (!p || p.inStock === false) continue;
    const step = p.step || 1;
    let qty = Math.round(Number(it.qty) / step) * step;
    if (!isFinite(qty) || qty <= 0) continue;
    qty = Math.min(qty, 500);
    lines.push({ p, qty: Math.round(qty * 10) / 10 });
  }
  if (!lines.length) return json(400, { error: "Your cart is empty." });

  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  if (subtotal < (config.minOrder || 0)) return json(400, { error: `Minimum order is ${config.currency} ${config.minOrder}.` });
  const delivery = config.freeDeliveryOver && subtotal >= config.freeDeliveryOver ? 0 : config.deliveryFee || 0;

  // ----- validate customer -----
  const c = data.customer || {};
  const customer = {
    name: clean(c.name, 100), phone: clean(c.phone, 30), email: clean(c.email, 120),
    emirate: clean(c.emirate, 40), area: clean(c.area, 100), address: clean(c.address, 300),
    date: clean(c.date, 20), notes: clean(c.notes, 400),
  };
  if (!customer.name || !customer.phone || !customer.address || !customer.emirate)
    return json(400, { error: "Please fill in your name, phone, emirate and address." });
  if (config.deliveryAreas?.length && !config.deliveryAreas.includes(customer.emirate))
    return json(400, { error: "Sorry, we don't deliver to that area yet." });

  // ----- create Stripe Checkout Session -----
  const site = process.env.URL || `https://${event.headers.host}`;
  const f = new URLSearchParams();
  f.append("mode", "payment");
  f.append("success_url", `${site}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  f.append("cancel_url", `${site}/checkout.html?cancelled=1`);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) f.append("customer_email", customer.email);
  const cur = (config.currency || "AED").toLowerCase();
  const all = [...lines.map((l) => ({ name: `${l.p.name} – ${l.qty} ${l.p.unit}`, amount: l.p.price * l.qty })),
    ...(delivery ? [{ name: `Delivery – ${customer.emirate}`, amount: delivery }] : [])];
  all.forEach((l, i) => {
    f.append(`line_items[${i}][quantity]`, "1");
    f.append(`line_items[${i}][price_data][currency]`, cur);
    f.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.amount * 100)));
    f.append(`line_items[${i}][price_data][product_data][name]`, l.name);
  });
  const meta = { ...customer, items: lines.map((l) => `${l.p.name} x ${l.qty} ${l.p.unit}`).join("; ").slice(0, 490) };
  for (const [k, v] of Object.entries(meta)) if (v) {
    f.append(`metadata[${k}]`, v);
    f.append(`payment_intent_data[metadata][${k}]`, v);
  }
  f.append("payment_intent_data[description]", `Sanjaya Trading order – ${customer.name}`);

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: f.toString(),
    });
    const s = await r.json();
    if (!r.ok) { console.error("Stripe error", s.error); return json(502, { error: "Payment service error. Please try again." }); }
    return json(200, { url: s.url });
  } catch (e) {
    console.error(e);
    return json(502, { error: "Payment service unavailable. Please try again." });
  }
};
