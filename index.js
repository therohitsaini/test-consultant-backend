require("dotenv").config();
require("@shopify/shopify-api/adapters/node");

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");

const { shopifyApi, ApiVersion } = require("@shopify/shopify-api");
const { MongoDBSessionStorage } = require("@shopify/shopify-app-session-storage-mongodb");

const app = express();

// MONGO CONNECT
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("MongoDB Error:", err));

const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: ["read_products", " write_products"],
    hostName: process.env.HOST.replace(/https?:\/\//, ""),
    apiVersion: ApiVersion.July25,
    sessionStorage: new MongoDBSessionStorage(process.env.MONGO_URI, "shopify_sessions"),
});

// Step 1: OAuth Start
app.get("/auth", async (req, res) => {
    const shop = req.query.shop;
    console.log("shop", shop)
    const authUrl = await shopify.auth.begin({
        shop,
        callbackPath: "/auth/callback",
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
    });

    console.log("auth",authUrl)

    return res.redirect(authUrl);
});

// Step 2: OAuth Callback
app.get("/auth/callback", async (req, res) => {
    console.log("------ CALLBACK HIT ------");
    console.log("Query:", req.query);

    try {
        const callbackData = await shopify.auth.callback({
            rawRequest: req,
            rawResponse: res,
        });

        console.log("Callback Response:", callbackData);

        const sessionId = callbackData.session.id;
        console.log("SESSION ID:", sessionId);

        const session = await shopify.sessionStorage.loadSession(sessionId);
        console.log("LOADED SESSION:", session);

        if (!session) {
            console.log("❌ Session is NULL (not saved in DB)");
        }

        if (!session.accessToken) {
            console.log("❌ AccessToken missing in Session");
        } else {
            console.log("✅ ACCESS TOKEN:", session.accessToken);
        }

        res.redirect(`/app?shop=${callbackData.session.shop}`);

    } catch (error) {
        console.log("❌ CALLBACK ERROR:", error);
        res.send("OAuth Error: " + error);
    }
});

// App Home
app.get("/app", async (req, res) => {
    res.send("Shopify App Installed Successfully 🎉");
});

app.listen(3000, () => console.log("Server running on port 3000"));
