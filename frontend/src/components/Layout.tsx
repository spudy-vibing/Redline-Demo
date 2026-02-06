import { Link, useLocation } from 'react-router-dom'
import { Search, Shield, MessageSquare, AlertTriangle, Activity } from 'lucide-react'
import { clsx } from 'clsx'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', label: 'Search', icon: Search },
  { path: '/screener', label: 'Screener', icon: Shield },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/50 px-6 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              {/* Logo Mark - The Red Line */}
              <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden group-hover:border-redline-500/50 transition-colors">
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Horizontal red line */}
                  <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-redline-500 to-transparent" />
                  {/* Vertical red line */}
                  <div className="absolute w-0.5 h-full bg-gradient-to-b from-transparent via-redline-500/50 to-transparent" />
                  {/* Center dot */}
                  <div className="w-1.5 h-1.5 rounded-full bg-redline-500 z-10" />
                </div>
              </div>
              {/* Status indicator */}
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-neutral-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-neutral-100 tracking-tight group-hover:text-redline-400 transition-colors">
                REDLINE
              </span>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                Intel Platform
              </span>
            </div>
          </Link>

          {/* Center - Status Bar */}
          <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 bg-neutral-900/50 rounded-full border border-neutral-800/50">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-neutral-400">LIVE</span>
            </div>
            <div className="h-3 w-px bg-neutral-700" />
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-neutral-500">Entities:</span>
              <span className="text-redline-400">15K+</span>
            </div>
            <div className="h-3 w-px bg-neutral-700" />
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <AlertTriangle className="w-3 h-3 text-gold-500" />
              <span className="text-neutral-500">High Risk:</span>
              <span className="text-gold-400">8K+</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-redline-500/10 text-redline-400 border border-redline-500/30'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                  )}
                >
                  <Icon className={clsx('w-4 h-4', isActive && 'text-redline-400')} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* The Redline - Signature bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-redline-500/50 to-transparent" />
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800/50 py-4 px-6 bg-neutral-950/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-redline-500 rounded-full" />
              <span className="font-mono text-neutral-500 uppercase tracking-wider">
                Redline v0.1.0
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-neutral-600">
            <span className="font-mono">CSL + OFAC SDN + OpenCorp</span>
            <div className="h-3 w-px bg-neutral-800" />
            <span className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-redline-500" />
              <span className="font-mono text-neutral-500">Demo Build</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
