import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TolinPage from './TolinPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TolinPage />
  </StrictMode>,
)
