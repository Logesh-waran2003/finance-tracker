'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

/**
 * Wires next-themes to the `.dark` class used by `@custom-variant dark` in
 * globals.css. Without this nothing ever sets the class and every `dark:`
 * utility in the app is dead.
 */
function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
