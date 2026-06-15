import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SessionWindowApp } from './App'
import '../src/assets/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionWindowApp />
  </StrictMode>
)
