import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useSite } from './site.jsx'

const CHAMPS = [
  ['whatsapp', 'Numéro WhatsApp (ex : 22605655170)'],
  ['instagram', 'Lien Instagram'],
  ['tiktok', 'Lien TikTok'],
  ['facebook', 'Lien Facebook'],
  ['youtube', 'Lien YouTube'],
  ['adresse', 'Adresse'],
]

async function compresser(file, max) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82))
}

async function envoyerImage(file, dossier, max = 1600) {
  const blob = await compresser(file, max)
  const chemin = `${dossier}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
  const { error } = await supabase.storage.from('photos').upload(chemin, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return { chemin, url: supabase.storage.from('photos').getPublicUrl(chemin).data.publicUrl }
}

function Login() {
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [err, setErr] = useState('')
  const entrer = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp })
    setErr(error ? 'Email ou mot de passe incorrect.' : '')
  }
  return (
    <>
      <h1 className="t">Espace Anta</h1>
      <form className="form" onSubmit={entrer}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Mot de passe<input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn dark" type="submit">Se connecter</button>
      </form>
    </>
  )
}

function Panel() {
  const { cats, photos, avis, reg, reload } = useSite()
  const [nom, setNom] = useState('')
  const [couv, setCouv] = useState(null)
  const [cle, setCle] = useState(0)
  const [catId, setCatId] = useState(cats[0]?.id || '')
  const [pub, setPub] = useState({ titre: '', texte: '' })
  const [fichiers, setFichiers] = useState([])
  const [cle2, setCle2] = useState(0)
  const [form, setForm] = useState(() => Object.fromEntries(CHAMPS.map(([k]) => [k, reg[k] || ''])))
  const [msg, setMsg] = useState('')

  const faire = async (texte, action) => {
    setMsg(texte)
    try {
      await action()
      await reload()
      setMsg('Terminé ✔')
    } catch (e) {
      setMsg('Erreur : ' + (e.message || e))
    }
  }

  const ajouterCat = () =>
    nom.trim() &&
    faire('Création…', async () => {
      const img = couv ? await envoyerImage(couv, 'categories') : {}
      const { data, error } = await supabase
        .from('categories')
        .insert({ nom: nom.trim(), ordre: cats.length, couverture: img.url || null, couverture_chemin: img.chemin || null })
        .select()
        .single()
      if (error) throw error
      setNom('')
      setCouv(null)
      setCle((n) => n + 1)
      setCatId(data.id)
    })

  const changerCouv = (c, f) =>
    f &&
    faire('Envoi de la photo…', async () => {
      const img = await envoyerImage(f, 'categories')
      if (c.couverture_chemin) await supabase.storage.from('photos').remove([c.couverture_chemin])
      const { error } = await supabase.from('categories').update({ couverture: img.url, couverture_chemin: img.chemin }).eq('id', c.id)
      if (error) throw error
    })

  const supprimerCat = (c) => {
    if (!window.confirm(`Supprimer la catégorie « ${c.nom} » et toutes ses publications ?`)) return
    faire('Suppression…', async () => {
      const chemins = photos.filter((p) => p.category_id === c.id && p.chemin).map((p) => p.chemin)
      if (c.couverture_chemin) chemins.push(c.couverture_chemin)
      if (chemins.length) await supabase.storage.from('photos').remove(chemins)
      const { error } = await supabase.from('categories').delete().eq('id', c.id)
      if (error) throw error
      if (catId === c.id) setCatId('')
    })
  }

  const publier = () =>
    catId &&
    fichiers.length > 0 &&
    faire('Publication…', async () => {
      for (const [i, f] of fichiers.entries()) {
        setMsg(`Publication ${i + 1}/${fichiers.length}…`)
        const { chemin, url } = await envoyerImage(f, catId)
        const { error } = await supabase.from('photos').insert({
          category_id: catId, url, chemin, titre: pub.titre.trim() || null, texte: pub.texte.trim() || null,
        })
        if (error) throw error
      }
      setPub({ titre: '', texte: '' })
      setFichiers([])
      setCle2((n) => n + 1)
    })

  const supprimerPhoto = (p) => {
    if (!window.confirm('Supprimer cette publication ?')) return
    faire('Suppression…', async () => {
      if (p.chemin) await supabase.storage.from('photos').remove([p.chemin])
      const { error } = await supabase.from('photos').delete().eq('id', p.id)
      if (error) throw error
    })
  }

  const supprimerAvis = (v) => {
    if (!window.confirm('Supprimer cet avis ?')) return
    faire('Suppression…', async () => {
      const { error } = await supabase.from('avis').delete().eq('id', v.id)
      if (error) throw error
    })
  }

  const enregistrer = () =>
    faire('Enregistrement…', async () => {
      const lignes = CHAMPS.map(([k]) => ({ cle: k, valeur: form[k].trim() }))
      const { error } = await supabase.from('reglages').upsert(lignes)
      if (error) throw error
    })

  const dansCat = photos.filter((p) => p.category_id === catId)

  return (
    <div className="adm">
      <h1 className="t">Espace Anta</h1>
      {msg && <p className="msg">{msg}</p>}

      <section>
        <h3>Catégories</h3>
        <label>Nom de la catégorie<input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Mariées" /></label>
        <label>Photo de couverture<input key={cle} type="file" accept="image/*" onChange={(e) => setCouv(e.target.files[0] || null)} /></label>
        <button className="btn dark" onClick={ajouterCat}>Créer la catégorie</button>
        <ul className="liste">
          {cats.map((c) => (
            <li key={c.id} className="catli">
              {c.couverture ? <img className="mini" src={c.couverture} alt="" /> : <span className="mini">Pas de photo</span>}
              <div>
                <strong>{c.nom}</strong>
                <label>Changer la couverture
                  <input type="file" accept="image/*" onChange={(e) => { changerCouv(c, e.target.files[0]); e.target.value = '' }} />
                </label>
              </div>
              <button className="btn line sm" onClick={() => supprimerCat(c)}>Supprimer</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Publier des modèles</h3>
        <label>Catégorie
          <select value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Choisir…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        {catId && (
          <>
            <label>Titre (facultatif)<input value={pub.titre} onChange={(e) => setPub({ ...pub, titre: e.target.value })} /></label>
            <label>Description (facultatif)<textarea rows="3" value={pub.texte} onChange={(e) => setPub({ ...pub, texte: e.target.value })} /></label>
            <label>Photos<input key={cle2} type="file" accept="image/*" multiple onChange={(e) => setFichiers([...e.target.files])} /></label>
            <p className="small">Le titre et la description sont mis sur chaque photo choisie. Pour des titres différents, publie les photos une par une.</p>
            <button className="btn dark" onClick={publier}>Publier</button>
            <div className="grid2">
              {dansCat.map((p) => (
                <div key={p.id} className="th" title={p.titre || ''}>
                  <img src={p.url} alt="" loading="lazy" />
                  <button onClick={() => supprimerPhoto(p)} aria-label="Supprimer">✕</button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h3>Contacts et réseaux</h3>
        <p className="small">Un réseau s’affiche sur le site seulement si son lien est rempli.</p>
        {CHAMPS.map(([k, label]) => (
          <label key={k}>{label}
            <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <button className="btn dark" onClick={enregistrer}>Enregistrer</button>
      </section>

      <section>
        <h3>Avis des clientes</h3>
        <p className="small">Les clientes publient leur avis elles-mêmes. Tu peux supprimer un avis inapproprié.</p>
        <ul className="liste">
          {avis.map((v) => (
            <li key={v.id}>
              <span>{'★'.repeat(v.etoiles)} <strong>{v.nom}</strong> : {v.texte.slice(0, 60)}</span>
              <button className="btn line sm" onClick={() => supprimerAvis(v)}>Supprimer</button>
            </li>
          ))}
        </ul>
      </section>

      <button className="btn line" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
    </div>
  )
}

export default function Admin() {
  const { loading } = useSite()
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (loading || session === undefined) return <p className="pad">Chargement…</p>
  return session ? <Panel /> : <Login />
}
