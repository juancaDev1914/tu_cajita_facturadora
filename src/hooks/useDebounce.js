import { useEffect, useState } from 'react'

// Retarda la actualización del valor hasta que el usuario deja de escribir.
// Reduce drásticamente el trabajo de filtrado/ordenado en listas grandes.
export default function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}