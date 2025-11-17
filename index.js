// server.js (or auth.js)
const express = require("express");
const fetch = require("node-fetch");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const dotenv = require("dotenv");


dotenv.config();
const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, HOST, PORT } = process.env;
const app = express();
app.use(cookieParser());
app.use(express.json());

// --- Utility: create nonce
function generateNonce(length = 16) {
    return crypto.randomBytes(length).toString("hex");
}

// --- Step 1: Start OAuth (merchant clicks Install)
app.get("/auth", (req, res) => {
    const { shop } = req.query;
    if (!shop) return res.status(400).send("Missing shop param");
    const state = generateNonce();
    res.cookie("shopify_state", state, { httpOnly: true, sameSite: "lax" });

    const redirectUri = `${HOST}/auth/callback`;
    const installUrl =
        `https://${shop}/admin/oauth/authorize` +
        `?client_id=${SHOPIFY_API_KEY}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&state=${state}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.redirect(installUrl);
});

// --- Step 2: OAuth callback
app.get("/auth/callback", async (req, res) => {
    const { shop, hmac, code, state } = req.query;
    const cookieState = req.cookies.shopify_state;

    // 1) verify state
    if (!state || state !== cookieState) return res.status(403).send("Invalid state");

    // 2) verify hmac (security)
    const map = Object.assign({}, req.query);
    delete map["hmac"];
    const message = Object.keys(map).sort().map(k => `${k}=${map[k]}`).join("&");
    const generatedHash = crypto
        .createHmac("sha256", SHOPIFY_API_SECRET)
        .update(message)
        .digest("hex");

    if (generatedHash !== hmac) return res.status(400).send("HMAC validation failed");

    // 3) exchange code for access token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code,
        }),
    });
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("accessToken", accessToken)
    // 4) Save accessToken + shop in DB (example)
    // await ShopModel.upsert({ shop, accessToken });

    // 5) redirect into app UI (embedded or standalone)
    res.redirect(`${HOST}/?shop=${shop}`);
});

app.listen(PORT, () => console.log(`Listening ${PORT}`));
