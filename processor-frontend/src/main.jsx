import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import App from './App'
import { ThemeProvider } from './components/theme-provider'
import { createQueryClient } from './lib/queryClient'
import './styles/index.css'

const queryClient = createQueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="bjj-theme">
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster richColors theme="dark" position="bottom-right" />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
