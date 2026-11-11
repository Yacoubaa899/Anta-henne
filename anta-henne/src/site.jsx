import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const Ctx = createContext(null)

const melanger = (t) => {
  const a = [...t]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// eslint-disable-next-line react-refresh/only-export-components
export const useSite = () => useContext(Ctx)

const lireFavs = () => {
  try {
    return JSON.parse(localStorage.getItem('favs') || '[]')
  } catch {
    return []
  }
}

export function SiteProvider({ children }) {
  const [cats, setCats] = useState([])
  const [photos, setPhotos] = useState([])
  const [avis, setAvis] = useState([])
  const [mix, setMix] = useState([])
  const [reg, setReg] = useState({})
  const [loading, setLoading] = useState(true)
  const [favs, setFavs] = useState(lireFavs)

  const reload = useCallback(async () => {
    const [c, p, r, a] = await Promise.all([
      supabase.from('categories').select('*').order('ordre').order('created_at'),
      supabase.from('photos').select('*').order('created_at', { ascending: false }),
      supabase.from('reglages').select('*'),
      supabase.from('avis_publics').select('*').order('created_at', { ascending: false }),
    ])
    setCats(c.data || [])
    setPhotos(p.data || [])
    setAvis(a.data || [])
    setMix(melanger(p.data || []))
    setReg(Object.fromEntries((r.data || []).map((x) => [x.cle, x.valeur])))
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const jour = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('vuJour') === jour) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) return
      supabase.from('visites').insert({ jour }).then(({ error }) => {
        if (!error) localStorage.setItem('vuJour', jour)
      })
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('favs', JSON.stringify(favs))
  }, [favs])

  const toggleFav = (id) =>
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))

  const wa = (texte) =>
    `https://wa.me/${(reg.whatsapp || '22605655170').replace(/\D/g, '')}?text=${encodeURIComponent(texte)}`

  const mesFavs = loading ? favs : favs.filter((id) => photos.some((p) => p.id === id))

  return (
    <Ctx.Provider value={{ cats, photos, avis, mix, reg, loading, reload, favs: mesFavs, toggleFav, wa }}>
      {children}
    </Ctx.Provider>
  )
}
