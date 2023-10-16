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
    const userId = req.user.id;
    const query = "SELECT * FROM favorite_places WHERE user_id = ?";

    db.all(query, userId, (err, favoritePlaces) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .send("An error occurred while retrieving favorite places");
      }

      res.render("favorites", {
        favoritePlaces,
        isAuthenticated: req.isAuthenticated(),
        username: req.user.name, // Ensure that 'name' is included here
      });
    });
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

app.get("/search-flights", (req, res) => {
  res.render("search-flights", {
    isAuthenticated: req.isAuthenticated(),
    username: req.user ? req.user.name : "", // Make sure you have 'name' in your user object
  });
});

app.post("/search-results", (req, res) => {
  const { departure, destination, date, travelers, sort } = req.body;

  let query = `
        SELECT * FROM flights 
        WHERE departure_airport = ? 
          AND destination_airport = ? 
          AND departure_date = ? 
          AND available_seats >= ?
    `;

  if (sort === "asc") {
    query += " ORDER BY price ASC";
  } else if (sort === "desc") {
    query += " ORDER BY price DESC";
  }

  db.all(query, [departure, destination, date, travelers], (err, flights) => {
    if (err) throw err;

    const discount = req.body.coupon === "VTSTUDENT" ? 0.5 : 1;

    res.render("flight-results", {
      flights,
      departure, // added
      destination, // added
      date, // added
      travelers,
      discount,
      coupon: req.body.coupon,
      isAuthenticated: req.isAuthenticated(),
      username: req.isAuthenticated() ? req.user.name : "",
    });
  });
});

app.post("/book-flight/:flightId", (req, res) => {
  if (req.isAuthenticated()) {
    const flightId = req.params.flightId;
    const userId = req.user.id;
    const numberOfTravelers = req.body.numberOfTravelers;

    const query =
      "INSERT INTO bookings (user_id, flight_id, number_of_travelers) VALUES (?, ?, ?)";
    db.run(query, [userId, flightId, numberOfTravelers], (err) => {
      if (err) throw err;
      res.redirect("/booking-success"); // You may need to create this success page or redirect to another existing page.
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/booking-success", (req, res) => {
  res.render("booking-success");
});

app.post("/save-favorite/:destination", (req, res) => {
  if (req.isAuthenticated()) {
    const placeName = req.params.destination;

    const query =
      "INSERT INTO favorite_places (user_id, place_name) VALUES (?, ?)";
    db.run(query, [req.user.id, placeName], (err) => {
      if (err) throw err;
      res.redirect("/search-flights");
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/favorites", (req, res) => {
  if (req.isAuthenticated()) {
    const query = "SELECT * FROM favorite_places WHERE user_id = ?";
    db.all(query, req.user.id, (err, favoritePlaces) => {
      if (err) throw err;
      res.render("favorites", { favoritePlaces });
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/customer-support", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("customer-support", {
      isAuthenticated: req.isAuthenticated(),
      username: req.user.name, // Ensure that 'name' is included here
    });
  } else {
    // Optional: Redirect to login if the user is not authenticated and trying to access the customer support page
    res.redirect("/login");
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
