const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set('trust proxy', 1); // Trust the reverse proxy (like Cloudflare or NGINX)

// Session management with secure cookie and Cloudflare proxy handling
app.use(session({
    secret: 'secret-key',  // Use a strong, unique secret key
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false, // Set to true if using HTTPS (Cloudflare SSL Termination)
        maxAge: 60000   // 1 minute (for testing), extend if necessary
    }
}));

// Create a connection pool for MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost", // Use "db" since it's the service name in docker-compose
    user: process.env.DB_USER || "sqluser",
    password: process.env.DB_PASSWORD || "Ermfaohfioahfiohagonioojaheiofhiqefhiojaiof!",
    database: process.env.DB_NAME || "db",
    connectionLimit: 10 // Limit the number of connections in the pool
});

// Retry mechanism for MySQL connection
function connectToDatabase() {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error("Database connection failed:", err);
            setTimeout(connectToDatabase, 5000); // Retry after 5 seconds
        } else {
            console.log("Connected to MySQL Database");
            connection.release(); // Release the connection back to the pool
        }
    });
}

app.get("/session", (req, res) => {
    console.log("Session data:", req.session);
    res.send(req.session);
});

// Try connecting on initial start
connectToDatabase();

// Logout endpoint
app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send("Failed to logout.");
        }
        res.send("Logged out successfully!");
    });
});

// Admin Page with Debug Information
app.get("/admin", (req, res) => {
    if (req.session.user) {
        console.log(`User attempting to access /admin: ${req.session.user.username}`);
        
        if (req.session.user.username === 'admin') {
            res.send(`
                <h1>Welcome Admin! KEEP THE SECRET FLAVOR A SECRET (OR ELSE)</h1>
                <p>Your flag is: CCSO{cyber_crunch}</p>
            `);
        } else {
            console.warn(`Access denied: User '${req.session.user.username}' tried to access admin page.`);
            res.status(403).send(`Forbidden: You are logged in as '${req.session.user.username}', but only 'admin' can view this page.`);
        }
    } else {
        console.warn("Access denied: No user session found while trying to access /admin.");
        res.status(403).send("Forbidden: No active session. Please log in as admin to view this page.");
    }
});

// Login Endpoint with SQL Injection Vulnerability
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Directly inserting user input into query (vulnerable to SQL injection)
    const query = `SELECT * FROM creds WHERE username = '${username}' AND password = '${password}'`;

    console.log("Executing SQL Query:", query); // For debugging

    pool.query(query, (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).send("Database error");
        }

        if (results.length > 0) {
            // Set the user in the session after login
            req.session.user = { username: results[0].username, password: results[0].password };
        
            // Explicitly save the session before responding
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).send("Session save error.");
                }
                res.send(`Welcome, ${results[0].username}!`);
                console.log("Session after setting user:", req.session);
            });
        } else {
            res.status(401).send("Invalid credentials");
            console.log("Session after setting user:", req.session);
        }
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});