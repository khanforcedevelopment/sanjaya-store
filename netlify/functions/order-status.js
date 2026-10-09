// Returns the status of a Stripe Checkout Session for the success page.
const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  const key = process.env.STRIPE_SECRET_KEY;
  const id = (event.queryStringParameters || {}).session_id || "";
  if (!key) return json(503, { error: "not_configured" });
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json(400, { error: "Invalid session" });
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    const s = await r.json();
    if (!r.ok) return json(404, { error: "Order not found" });
    return json(200, {
      paid: s.payment_status === "paid",
      amount: (s.amount_total || 0) / 100,
      currency: (s.currency || "aed").toUpperCase(),
      name: (s.metadata && s.metadata.name) || "",
      reference: id.slice(-8).toUpperCase(),
    });
  } catch {
    return json(502, { error: "Could not check order" });
  }
};
