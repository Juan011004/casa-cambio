'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

interface ThemeContextProps {
  isDark: boolean
  toggleDark: () => void
}

const ThemeContext = createContext<ThemeContextProps>({
  isDark: false,
  toggleDark: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

/** Modo claro por defecto; `dark` solo si el usuario lo guardó o el sistema prefiere oscuro. */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const dark = stored === 'dark'
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [])

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev
      localStorage.setItem('theme', next ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ isDark, toggleDark }), [isDark, toggleDark])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
