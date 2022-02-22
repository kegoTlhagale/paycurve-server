const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  message: { type: String, default: null },
  city: { type: String, require: true  }
});

module.exports = mongoose.model("alert", alertSchema);