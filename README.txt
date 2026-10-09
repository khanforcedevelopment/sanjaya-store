SANJAYA TRADING FZE - Premium fresh produce website (static, Netlify-ready)

ONLINE STORE & PAYMENTS: read SETUP-PAYMENTS.txt first.

QUICK PREVIEW (no online payments)
1. Go to https://app.netlify.com/drop
2. Drag and drop this ZIP file (or the unzipped folder).
3. Done - your site is live.

EDIT
- Brand name, text, phone, email: index.html (search "Sanjaya", "admin@sanjayatrading.com", "971569110077")
- Products, prices, stock: data/products.json
- Delivery fee, minimum order, delivery areas: data/store-config.json
- REAL PHOTOS: put .jpg photos in images/photos/ with the names listed in images/photos/PUT-PHOTOS-HERE.txt
  (e.g. mango.jpg). They are used automatically; missing ones show the illustration.
- Colors: assets/style.css -> :root variables at the top
- WhatsApp number: assets/app.js -> WHATSAPP_NUMBER

CONTACT FORM
Uses Netlify Forms (built in, free). After deploy, messages appear in
Netlify dashboard -> your site -> Forms. Enable form notifications there to get emails.

WHOLESALE
From the cart, customers can also send a wholesale quote request to you on WhatsApp.

IMAGE CREDITS
Most product illustrations are from Noto Color Emoji by Google (Apache License 2.0).
