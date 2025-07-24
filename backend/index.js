import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "notesApp",
  password: "pass1",
  port: 5432,
});
db.connect();

// 🔧 Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ✅ PASSPORT STRATEGY
passport.use(
  new LocalStrategy(
    { usernameField: "email" }, 
    async (email, password, cb) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (result.rows.length === 0) {
          return cb(null, false, { message: "User not found" });
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          return cb(null, false, { message: "Invalid password" });
        }

        return cb(null, user);
      } catch (err) {
        return cb(err);
      }
    }
  )
);

// ✅ SERIALIZACJA
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

// ✅ REGISTER
app.post("/register", async (req, res) => {
  const email = req.body.emailReg;
  const password = req.body.passwordReg;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      "INSERT INTO users (email, password) VALUES ($1, $2)",
      [email, hashedPassword]
    );

    console.log("✅ Użytkownik dodany:", result.rowCount);
    return res.status(201).json({ message: "User registered!" });
  } catch (err) {
    console.error("❌ Błąd przy rejestracji:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ LOGIN 
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info.message });

    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.status(200).json({ message: "Login successful", user });
    });
  })(req, res, next);
});

// ✅ Sprawdzenie czy użytkownik zalogowany (do testów)
app.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});


app.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "Logout failed" });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ message: "Could not destroy session" });
      }

      res.clearCookie("connect.sid"); // 👈 usuwa ciasteczko sesji
      return res.status(200).json({ message: "Logged out" });
    });
  });
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
