import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import env from "dotenv";
import validator from 'validator';

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

const db = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.query('SELECT NOW()').then(() => {
  console.log("✅ DB connected.");
}).catch(err => {
  console.error("❌ DB connection error:", err);
});


// 🔧 Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
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

// Passport Google Strategy
passport.use(
  "google",
  new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/notes",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
  }, async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);


// ✅ SERIALIZACJA
passport.serializeUser((user, done) => {
  console.log("serializeUser:", user);
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

// Middleware zabezpieczający endpointy
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Routes
// Google OAuth

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

app.get(
  "/auth/google/notes",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5173/login",
    successRedirect: "http://localhost:5173",
  })
);

function validateRegisterData(email, password) {
  const errors = [];
  
  if (!email || !validator.isEmail(email)) {
    errors.push("Nieprawidłowy format email");
  }
  
  if (!password || password.length < 8) {
    errors.push("Hasło musi mieć minimum 8 znaków");
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.push("Hasło musi zawierać małą literę, dużą literę i cyfrę");
  }
  
  return errors;
}


// ✅ REGISTER
app.post("/register", async (req, res) => {
  const email = req.body.emailReg;
  const password = req.body.passwordReg;

  // Walidacja danych wejściowych
  const validationErrors = validateRegisterData(email, password);
  if (validationErrors.length > 0) {
    return res.status(400).json({ 
      message: "Błędy walidacji", 
      errors: validationErrors 
    });
  }



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

// ✅ Sprawdzenie czy użytkownik zalogowany 
app.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

// Logout
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


// --- NOTES Endpoints ---

// Pobierz notatki użytkownika
app.get("/notes", ensureAuthenticated, async (req, res) => {
  try {
    // Dodatkowa walidacja user_id
    if (!req.user?.id || isNaN(parseInt(req.user.id))) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const result = await db.query(
      "SELECT id, title, content FROM notes WHERE user_id = $1 AND deleted = FALSE ORDER BY created_at DESC",
      [parseInt(req.user.id)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching notes:", err);
    res.status(500).json({ message: "Błąd pobierania notatek" });
  }
});

// Dodaj nową notatkę
app.post("/notes", ensureAuthenticated, async (req, res) => {
  const { title, content } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, title, content",
      [req.user.id, title, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding note:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Usuń notatkę (logiczne usunięcie)
app.delete("/notes/:id", ensureAuthenticated, async (req, res) => {
  const noteId = req.params.id;
  try {
    const result = await db.query(
      "UPDATE notes SET deleted = TRUE WHERE id = $1 AND user_id = $2",
      [noteId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Note not found or not authorized" });
    }

    res.status(200).json({ message: "Note deleted" });
  } catch (err) {
    console.error("Error deleting note:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Middleware obsługi błędów
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Coś poszło nie tak!' });
});

// Start serwera
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});


process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await db.end();
  process.exit(0);
});