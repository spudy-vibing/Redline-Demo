import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import SearchPage from './pages/SearchPage'
import EntityPage from './pages/EntityPage'
import ScreenerPage from './pages/ScreenerPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/entity/:id" element={<EntityPage />} />
        <Route path="/screener" element={<ScreenerPage />} />
      </Routes>
    </Layout>
  )
}

export default App
