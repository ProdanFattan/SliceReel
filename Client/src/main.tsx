import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import '@/index.css'

async function enableApiMocking(): Promise<void> {
  if (!import.meta.env.DEV || import.meta.env.VITE_API_MOCKING === 'off') return
  const { startMockApi } = await import('@/mocks/browser')
  await startMockApi()
}

function renderApp(): void {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element #root is missing from index.html')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

enableApiMocking()
  .catch((error: unknown) => console.error('The mock API failed to start.', error))
  .finally(renderApp)
