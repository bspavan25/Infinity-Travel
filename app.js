const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");

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
  db.get(
    "SELECT id, name, email, role FROM users WHERE id = ?",
    id,
    (err, row) => {
      if (err) return done(err);
      return done(null, {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
      });
    }
  );
});
// Static files
app.use(express.static("public"));

// Routes
app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.user.id;
    // Query to get user destinations
    const destinationsQuery =
      "SELECT DISTINCT flights.destination_airport AS name FROM bookings INNER JOIN flights ON bookings.flight_id = flights.id WHERE bookings.user_id = ?";
    // Query to calculate reward points
    const rewardsQuery =
      "SELECT SUM(number_of_travelers) AS totalTravelers FROM bookings WHERE user_id = ?";

    db.all(destinationsQuery, userId, (err, userDestinations) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .send("An error occurred while retrieving userDestinations");
      }
      // If no error, proceed to get reward points
      db.get(rewardsQuery, userId, (err, rewardsResult) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .send("An error occurred while calculating reward points");
        }
        // Calculate reward points (assuming 100 points per traveler)
        const rewardPoints = (rewardsResult.totalTravelers || 0) * 100;

        res.render("index", {
          isAuthenticated: req.isAuthenticated(),
          username: req.user.name,
          user: req.user,
          userDestinations: userDestinations,
          rewardPoints: rewardPoints, // Pass reward points to the view
        });
      });
    });
  } else {
    res.render("index", {
      isAuthenticated: req.isAuthenticated(),
      username: "",
      user: null,
      userDestinations: null,
      rewardPoints: 0,
    });
  }
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
  const {
    departure,
    destination,
    date,
    travelers,
    sort,
    airlineFilter,
    coupon,
  } = req.body;

  let query = `
    SELECT * FROM flights 
    WHERE departure_airport = ? 
      AND destination_airport = ? 
      AND departure_date = ? 
      AND available_seats >= ?
  `;

  if (airlineFilter && airlineFilter !== "all") {
    query += ` AND airline = '${airlineFilter}' `;
  }

  if (sort === "asc") {
    query += " ORDER BY price ASC";
  } else if (sort === "desc") {
    query += " ORDER BY price DESC";
  } else if (sort === "stopsAsc") {
    query += " ORDER BY number_of_stops ASC";
  } else if (sort === "stopsDesc") {
    query += " ORDER BY number_of_stops DESC";
  }

  db.all(query, [departure, destination, date, travelers], (err, flights) => {
    if (err) throw err;

    // Check if the coupon code exists in the coupons table
    const couponQuery =
      "SELECT discount_amount FROM coupons WHERE coupon_text = ?";
    db.get(couponQuery, [coupon], (err, row) => {
      if (err) throw err;

      // If coupon is found, use the discount_amount, else use 1 (no discount)
      const discount = row ? 1 - row.discount_amount / 100 : 1;
      console.log(discount);

      res.render("flight-results", {
        flights,
        departure,
        destination,
        date,
        travelers,
        discount,
        coupon,
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.name : "",
      });
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

app.post("/save-favorite", (req, res) => {
  if (req.isAuthenticated()) {
    const { departure, destination, date, travelers } = req.body;

    const query =
      "INSERT INTO favorite_places (user_id, place_name, departure, date, travelers) VALUES (?, ?, ?, ?, ?)";
    db.run(
      query,
      [req.user.id, destination, departure, date, travelers],
      (err) => {
        if (err) throw err;
        res.redirect("/favorites");
      }
    );
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

//sharing trip part
let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "2017076@iiitdmj.ac.in", // replace with your email
    pass: "bsp9493518359", // replace with your password
  },
});

// POST route for sending emails
app.post("/send-email", (req, res) => {
  const { toEmail, subject, text } = req.body;

  const mailOptions = {
    from: "2017076@iiitdmj.ac.in", // replace with your email
    to: toEmail,
    subject: subject,
    text: text,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      res.status(500).send("Failed to send email.");
    } else {
      res.send("Email sent successfully.");
    }
  });
});

app.get("/notifications", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  res.render("notifications", {
    isAuthenticated: true,
    username: req.user.username,
  });
});

// Admin Panel Route
app.get("/admin", (req, res) => {
  if (req.isAuthenticated() && req.user.role === "admin") {
    res.render("admin-panel", { username: req.user.name });
  } else {
    res.status(403).send("Unauthorized");
  }
});

// Add Coupon Route
app.post("/admin/add-coupon", (req, res) => {
  if (req.isAuthenticated() && req.user.role === "admin") {
    const {
      discountAmount,
      expirationDate,
      couponText,
      applicableUsers,
      specificUserEmail,
    } = req.body;
    let applicableTo = applicableUsers === "all" ? "all" : specificUserEmail;
    db.run(
      "INSERT INTO coupons (discount_amount, expiration_date, coupon_text, applicable_users) VALUES (?, ?, ?, ?)",
      [discountAmount, expirationDate, couponText, applicableTo],
      (err) => {
        if (err) {
          console.error(err.message);
          res.status(500).send("Failed to add coupon");
        } else {
          res.redirect("/admin");
        }
      }
    );
  } else {
    res.status(403).send("Unauthorized");
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
