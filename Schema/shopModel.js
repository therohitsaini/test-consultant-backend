const mongoose = require("mongoose")
const ShopSchema = new mongoose.Schema({
    shop: { type: String, unique: true },
    accessToken: String,
    scopes: String,
    installedAt: { type: Date, default: Date.now },
});
export default mongoose.model("Shop", ShopSchema);
