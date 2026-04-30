import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Detection from "./pages/Detection";
import Veterinary from "./pages/Veterinary";
import History from "./pages/History";
import Auth from "./pages/Auth";

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-background text-foreground transition-colors">
              <Navbar />
              <Routes>
                <Route path="/"           element={<Home />} />
                <Route path="/detect"     element={<Detection />} />
                <Route path="/veterinary" element={<Veterinary />} />
                <Route path="/history"    element={<History />} />
                <Route path="/auth"       element={<Auth />} />
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
