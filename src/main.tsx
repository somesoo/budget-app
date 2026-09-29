import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { useLanguage } from './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 15_000,
    },
  },
})

/** A new language re-renders everything, so text outside React state (t() in lib/) follows too. */
function LanguageRoot() {
  const language = useLanguage()
  return <App key={language} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LanguageRoot />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
