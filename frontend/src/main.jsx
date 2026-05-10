import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import SimulationLoader from './pages/SimulationLoader.jsx'
import SimulationList from './pages/SimulationList.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/sim/:shareToken" element={<SimulationLoader />} />
        <Route path="/simulations" element={<SimulationList />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
