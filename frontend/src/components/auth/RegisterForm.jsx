import React, { useState } from "react";

function RegisterForm({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== passwordCheck) {
      alert("Hasła muszą być takie same!");
      return;
    }

    try {
      const res = await fetch("http://localhost:3000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailReg: email,
          passwordReg: password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(data);

        alert("Rejestracja udana! Zaloguj się.");
        onSwitch(); // ⬅ przełącz na formularz logowania
      } else {
        const error = await res.json();
        alert("Błąd rejestracji: " + error.message);
      }
    } catch (err) {
      console.error("Rejestracja – błąd:", err);
      alert("Coś poszło nie tak. Spróbuj ponownie później.");
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h3>Create Your Account</h3>
      <p>Just enter your email address and your password to join.</p>
      <input
        type="email"
        name="emailReg"
        placeholder="Insert eMail"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        name="passwordReg"
        placeholder="Insert Password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        name="passwordRegCheck"
        placeholder="Verify Password"
        required
        value={passwordCheck}
        onChange={(e) => setPasswordCheck(e.target.value)}
      />
      <button type="submit">Sign Up</button>
      <div className="form-toggle">
        <button type="button" onClick={onSwitch}>
          Already have an account? Log In
        </button>
      </div>
    </form>
  );
}

export default RegisterForm;
