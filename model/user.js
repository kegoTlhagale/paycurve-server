const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  user_name: { type: String, default: null },
  email: { type: String, unique: true },
  password: { type: String, require: true },
  token: { type: String, require: true },
  role: {
    type: String,
    default: 'user',
    enum: ["user", "admin"],
    required: true
   },
});

module.exports = mongoose.model("user", userSchema);