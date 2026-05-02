import { createContext, useContext, useState } from "react";

const AuthContext = createContext();
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem("cc_user") || "null")
  );

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("cc_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("cc_user");
  };

  // Login existing user by phone
  const loginUser = async (phone) => {
    const res  = await fetch(`${API}/login-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (res.ok) login({ ...data, role: "owner" });
    return { ok: res.ok, data };
  };

  // Register new user
  const registerUser = async ({ phone, location, name }) => {
    const res  = await fetch(`${API}/register-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, location, name }),
    });
    const data = await res.json();
    if (res.ok) login({ id: data.user_id, phone, location, name, role: "owner" });
    return { ok: res.ok, data };
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loginUser, registerUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
