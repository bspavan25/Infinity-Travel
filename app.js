const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
app.set("view engine", "ejs");
const db = new sqlite3.Database("./database.db");

// Middleware to parse POST requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session handling
app.use(
  session({
    secret: "your-secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Create tables if they don't exist yet
db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, password TEXT)"
  );
});

// Passport setup
passport.use(
  new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
    db.get(
      "SELECT id, email, password FROM users WHERE email = ?",
      email,
      (err, row) => {
        if (err) return done(err);
        if (!row) return done(null, false);

        bcrypt.compare(password, row.password, (err, res) => {
          if (res) return done(null, { id: row.id, email: row.email });
          return done(null, false);
        });
      }
    );
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.get("SELECT id, name, email FROM users WHERE id = ?", id, (err, row) => {
    // Updated to include name
    if (err) return done(err);
    return done(null, { id: row.id, name: row.name, email: row.email }); // Updated to include name
  });
});

// Static files
app.use(express.static("public"));

// Routes

app.get("/", (req, res) => {
  res.render("index", {
    isAuthenticated: req.isAuthenticated(),
    username: req.isAuthenticated() ? req.user.name : "", // Updated to use name
  });
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/favorites", (req, res) => {
  if (req.isAuthenticated()) {
    res.sendFile(__dirname + "/views/favorites.html");
  } else {
    res.redirect("/login");
  }
});

app.post("/register", (req, res) => {
  bcrypt.hash(req.body.password, 10, (err, hash) => {
    if (err) return console.error(err);

    db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [req.body.name, req.body.email, hash],
      function (err) {
        if (err) return console.error(err);

        return res.redirect("/login");
      }
    );
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    loginError: req.query.error,
  });
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login?error=true",
  })
);

app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
