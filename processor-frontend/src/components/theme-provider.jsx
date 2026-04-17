import { createContext, useContext, useEffect, useState } from "react"

const ThemeProviderContext = createContext({ theme: "dark", setTheme: () => {} })

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "bjj-theme",
}) {
  const [theme, setTheme] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(storageKey)) || defaultTheme
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    const applied =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme
    root.classList.add(applied)
  }, [theme])

  const value = {
    theme,
    setTheme: (t) => {
      localStorage.setItem(storageKey, t)
      setTheme(t)
    },
  }

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = () => useContext(ThemeProviderContext)
