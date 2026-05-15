import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Auth from './pages/Auth/Auth';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import MainLayout from './components/layout/MainLayout'; 
import Accueil from './pages/Dashboard/Accueil/Accueil';
import Agents from './pages/Dashboard/Gestions/GestionAgents';
import Inventaires from './pages/Dashboard/Gestions/Inventaires';
import Historique from './pages/Dashboard/Gestions/Historique';
import StockActifs from './pages/Dashboard/Gestions/StockActifs';
import Parametres from './pages/Dashboard/Parametres/Parametres';
import { ThemeProvider } from './hooks/useTheme';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<MainLayout />}>
              <Route path="accueil" element={<Accueil />} />
              <Route path="inventaires" element={<Inventaires />} />
              <Route path="historique" element={<Historique />} />
              <Route path="stock-actifs" element={<StockActifs />} />
              <Route path="agents" element={<Agents />} />  
              <Route path="parametres" element={<Parametres />} />
            </Route>
         </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App