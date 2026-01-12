const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 5000;

// Use data.js as "database"
const users = require("./data.js");

// -------------------
// Serve frontend
// -------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// -------------------
// Helper to get dynamic host URL
// -------------------
function getBaseURL(req) {
  return `${req.protocol}://${req.headers.host}`;
}

// -------------------
// Create new user
// -------------------
app.post("/create-user", (req, res) => {
  const { name, password } = req.body;

  // Generate main token (45 chars)
  const mainToken = "t_" + [...Array(45)].map(() => Math.random().toString(36)[2]).join("");

  // Initial QR token
  const qrToken = "QR_" + Math.random().toString(36).substring(2, 8);

  const baseURL = getBaseURL(req);

  const newUser = {
    name,
    password,
    mainToken,
    qrToken,
    qrUsed: false,
    history: [`QR Link: ${baseURL}/sunrise/${mainToken}?qr=${qrToken}`]
  };

  users.push(newUser);

  res.json({
    message: "User created",
    mainLink: `${baseURL}/sunrise/${mainToken}`,
    qrLink: `${baseURL}/sunrise/${mainToken}?qr=${qrToken}`,
    history: newUser.history
  });
});

// -------------------
// Access via link
// -------------------
app.get("/sunrise/:token", (req, res) => {
  const { token } = req.params;
  const { qr } = req.query;

  const user = users.find(u => u.mainToken === token);
  if (!user) return res.send("Invalid link");

  if (qr) {
    if (qr !== user.qrToken) return res.send("Invalid QR");
    if (user.qrUsed) return res.send("QR already used");

    user.qrUsed = true;
  }

  res.send(`
    <h1>Welcome ${user.name}</h1>
    <p>Main Token: ${user.mainToken}</p>
    <p>Password: ${user.password}</p>
    <p>QR Used: ${user.qrUsed}</p>
  `);
});

// -------------------
// Refresh QR
// -------------------
app.post("/refresh-qr", (req, res) => {
  const { mainToken } = req.body;
  const user = users.find(u => u.mainToken === mainToken);
  if (!user) return res.send("Invalid user");

  const newQr = "QR_" + Math.random().toString(36).substring(2, 8);
  user.qrToken = newQr;
  user.qrUsed = false;

  const baseURL = getBaseURL(req);
  const newQrLink = `${baseURL}/sunrise/${user.mainToken}?qr=${newQr}`;

  user.history.push(`QR Link: ${newQrLink}`);

  res.json({
    message: "QR refreshed",
    qrLink: newQrLink,
    history: user.history
  });
});

// -------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
