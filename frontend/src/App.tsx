import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { AppProviders } from './components/providers'

function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

export default App
