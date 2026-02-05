import { Link, useLocation } from 'react-router-dom'
import { Search, Shield, Database } from 'lucide-react'
import { clsx } from 'clsx'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', label: 'Search', icon: Search },
  { path: '/screener', label: 'Screener', icon: Shield },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">WireScreen</span>
            <span className="text-sm text-gray-500 ml-2">China Corporate Intelligence</span>
          </Link>
          <nav className="flex gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === path
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
