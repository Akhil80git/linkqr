const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 5000;
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

  const mainToken = "t_" + [...Array(45)].map(() => Math.random().toString(36)[2]).join("");
  const qrToken = "QR_" + Math.random().toString(36).substring(2, 8);
  const baseURL = getBaseURL(req);

  const newUser = {
    name,
    password,
    mainToken,
    qrToken,
    qrUsed: false,
    loginUsed: false, // New flag for direct login
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
// Password verification page
// -------------------
app.get("/sunrise/:token", (req, res) => {
  const { token } = req.params;
  const { qr } = req.query;

  const user = users.find(u => u.mainToken === token);
  if (!user) return res.send("Invalid link");

  const baseURL = getBaseURL(req);
  
  // If QR parameter exists - QR access
  if (qr) {
    if (qr !== user.qrToken) return res.send("Invalid QR");
    if (user.qrUsed) return res.send("QR already used");

    user.qrUsed = true;
    user.loginUsed = true; // Mark as used
    
    // Record in history
    const timestamp = new Date().toLocaleString();
    user.history.push(`QR USED: ${timestamp} from ${req.ip}`);
    
    return res.send(`
      <html>
        <head>
          <title>QR Access Successful</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #121212; color: white; }
            .success { background: #4CAF50; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
            .info { background: #2196F3; padding: 15px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h1>✅ QR Access Successful!</h1>
            <h2>Welcome ${user.name}</h2>
            <p>This QR code can now only be used by you.</p>
          </div>
          <div class="info">
            <h3>Your Dashboard</h3>
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Access Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Access Type:</strong> QR Code Scan</p>
          </div>
          <p><a href="${baseURL}" style="color: #4CAF50;">Create New QR</a></p>
        </body>
      </html>
    `);
  }
  
  // No QR parameter - Direct link access
  if (user.loginUsed) {
    return res.send(`
      <html>
        <head>
          <title>Link Already Used</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #121212; color: white; }
            .error { background: #f44336; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 500px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Link Already Used</h1>
            <p>This link has already been accessed via QR code.</p>
            <p>Only the device that scanned the QR can use this link now.</p>
          </div>
          <p><a href="${baseURL}" style="color: #4CAF50;">Create New QR</a></p>
        </body>
      </html>
    `);
  }
  
  // First time access - Show password form
  res.send(`
    <html>
      <head>
        <title>Password Required</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #121212; color: white; }
          .form-container { background: #333; padding: 30px; border-radius: 10px; margin: 20px auto; max-width: 400px; }
          input { padding: 10px; margin: 10px; width: 80%; border-radius: 5px; border: none; }
          button { padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
          button:hover { background: #45a049; }
        </style>
      </head>
      <body>
        <h1>🔒 Password Required</h1>
        <div class="form-container">
          <h2>Access for ${user.name}</h2>
          <form id="passwordForm">
            <input type="password" id="password" placeholder="Enter Password" required />
            <input type="hidden" id="token" value="${token}" />
            <button type="submit">Submit</button>
          </form>
          <p id="error" style="color: red; display: none;">Incorrect password!</p>
        </div>
        
        <script>
          document.getElementById('passwordForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const token = document.getElementById('token').value;
            
            fetch('/verify-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, password })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                window.location.href = '/dashboard/' + token;
              } else {
                document.getElementById('error').style.display = 'block';
              }
            });
          });
        </script>
      </body>
    </html>
  `);
});

// -------------------
// Verify Password
// -------------------
app.post("/verify-password", (req, res) => {
  const { token, password } = req.body;
  const user = users.find(u => u.mainToken === token);
  
  if (!user || user.password !== password) {
    return res.json({ success: false });
  }
  
  user.loginUsed = true;
  const timestamp = new Date().toLocaleString();
  user.history.push(`DIRECT LOGIN: ${timestamp} from ${req.ip}`);
  
  res.json({ success: true });
});

// -------------------
// Dashboard after password verification
// -------------------
app.get("/dashboard/:token", (req, res) => {
  const { token } = req.params;
  const user = users.find(u => u.mainToken === token);
  
  if (!user) return res.send("Invalid access");
  
  const baseURL = getBaseURL(req);
  
  res.send(`
    <html>
      <head>
        <title>Dashboard</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #121212; color: white; }
          .dashboard { background: #333; padding: 30px; border-radius: 10px; margin: 20px auto; max-width: 600px; }
          .history { background: #444; padding: 15px; border-radius: 5px; margin: 10px; text-align: left; }
        </style>
      </head>
      <body>
        <h1>📊 Dashboard</h1>
        <div class="dashboard">
          <h2>Welcome ${user.name}</h2>
          <p><strong>Access Type:</strong> Password Login</p>
          <p><strong>Access Time:</strong> ${new Date().toLocaleString()}</p>
          
          <h3>Access History:</h3>
          <div class="history">
            ${user.history.map(item => `<p>${item}</p>`).join('')}
          </div>
        </div>
        <p><a href="${baseURL}" style="color: #4CAF50;">Create New QR</a></p>
      </body>
    </html>
  `);
});

// -------------------
// Refresh QR (no token input, just auto-refresh latest user)
// -------------------
app.post("/refresh-qr", (req, res) => {
  if (users.length === 0) return res.send("No users to refresh");

  const user = users[users.length - 1];

  const newQr = "QR_" + Math.random().toString(36).substring(2, 8);
  user.qrToken = newQr;
  user.qrUsed = false;

  const baseURL = getBaseURL(req);
  const newQrLink = `${baseURL}/sunrise/${user.mainToken}?qr=${newQr}`;
  user.history.push(`QR REFRESHED: ${new Date().toLocaleString()} - New QR: ${newQrLink}`);

  res.json({
    message: `QR refreshed for ${user.name}`,
    qrLink: newQrLink,
    history: user.history
  });
});

// -------------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
