import React, { useState, useEffect } from "react";
import Header from "./partials/Header";
import Footer from "./partials/Footer";
import Note from "./note/Note";
import CreateArea from "./note/CreateArea";
import Auth from "./auth/Auth";

function App() {
  const [notes, setNotes] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

   useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const res = await fetch("http://localhost:3000/me", {
          credentials: "include", // 👈 ważne!
        });

        if (res.ok) {
          const data = await res.json();
          console.log("✅ Użytkownik zalogowany:", data.user);
          setIsLoggedIn(true);
        } else {
          console.log("⛔ Użytkownik NIEzalogowany");
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("❌ Błąd przy sprawdzaniu sesji:", err);
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };

    checkLoginStatus();

    window.addEventListener("focus", checkLoginStatus);
    return () => {
    window.removeEventListener("focus", checkLoginStatus);
  };

  }, []);

  function addNote(newNote) {
    setNotes(prevNotes => {
      return [...prevNotes, newNote];
    });
  }

  function deleteNote(id) {
    setNotes(prevNotes => {
      return prevNotes.filter((noteItem, index) => {
        return index !== id;
      });
    });
  }

  function handleLogin() {
    setIsLoggedIn(true);
  }

function handleLogout() {
  fetch("http://localhost:3000/logout", {
    method: "POST",
    credentials: "include",
  })
    .then((res) => {
      if (res.ok) {
        setIsLoggedIn(false);
      } else {
        alert("Logout failed");
      }
    })
    .catch((err) => {
      console.error("Logout error:", err);
    });
}

  if (loading) return <p>Loading...</p>;

  if (!isLoggedIn) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div>
      <Header onLogout={handleLogout}  />
      <CreateArea onAdd={addNote} />
      {notes.map((noteItem, index) => {
        return (
          <Note
            key={index}
            id={index}
            title={noteItem.title}
            content={noteItem.content}
            onDelete={deleteNote}
          />
        );
      })}
      <Footer />
    </div>
  );
}

export default App;
