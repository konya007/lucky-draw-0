import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'
import { loadStageConfig } from './store/useStageConfig'
import { loadMedia } from './lib/mediaStore'

void loadStageConfig()
void loadMedia()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
