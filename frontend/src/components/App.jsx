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

  // Sprawdź, czy użytkownik jest zalogowany + pobierz notatki
  useEffect(() => {
    const checkLoginAndFetchNotes = async () => {
      try {
        const res = await fetch("http://localhost:3000/me", {
          credentials: "include",
        });
        if (res.ok) {
          setIsLoggedIn(true);

          // Pobierz notatki
          const notesRes = await fetch("http://localhost:3000/notes", {
            credentials: "include",
          });
          if (notesRes.ok) {
            const data = await notesRes.json();
            setNotes(data);
          }
        } else {
          setIsLoggedIn(false);
          setNotes([]);
        }
      } catch (err) {
        console.error(err);
        setIsLoggedIn(false);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    checkLoginAndFetchNotes();

    window.addEventListener("focus", checkLoginAndFetchNotes);
    return () => window.removeEventListener("focus", checkLoginAndFetchNotes);
  }, []);

  // Dodaj notatkę w backend i lokalnie
  async function addNote(newNote) {
    try {
      const res = await fetch("http://localhost:3000/notes", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newNote),
      });

      if (res.ok) {
        const savedNote = await res.json();
        setNotes((prevNotes) => [...prevNotes, savedNote]);
      } else {
        alert("Failed to save note");
      }
    } catch (err) {
      console.error("Add note error:", err);
    }
  }

  // Usuń notatkę w backend i lokalnie
  async function deleteNote(id) {
    try {
      const res = await fetch(`http://localhost:3000/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
      } else {
        alert("Failed to delete note");
      }
    } catch (err) {
      console.error("Delete note error:", err);
    }
  }

  function handleLogin() {
    setIsLoggedIn(true);
  }

  async function handleLogout() {
    try {
      const res = await fetch("http://localhost:3000/logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setIsLoggedIn(false);
        setNotes([]);
      } else {
        alert("Logout failed");
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  if (loading) return <p>Loading...</p>;

  if (!isLoggedIn) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div>
      <Header onLogout={handleLogout} />
      <CreateArea onAdd={addNote} />
      {notes.length === 0 && <p>Brak notatek do wyświetlenia</p>}
      {notes.map((note) => (
        <Note
          key={note.id}
          id={note.id}
          title={note.title}
          content={note.content}
          onDelete={deleteNote}
        />
      ))}
      <Footer />
    </div>
  );
}

export default App;
