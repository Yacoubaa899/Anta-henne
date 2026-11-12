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
  ['maps', 'Lien Google Maps de la boutique'],
  ['maps_embed', 'Code d’intégration de la carte (HTML Google Maps)'],
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

const TAILLE_MAX = 50 * 1024 * 1024
const https = (u) => (/^https?:\/\//.test(u) ? u : 'https://' + u)

async function envoyerFichier(file, dossier) {
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')
  const chemin = `${dossier}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(chemin, file, { contentType: file.type })
  if (error) throw error
  return { chemin, url: supabase.storage.from('photos').getPublicUrl(chemin).data.publicUrl }
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

function Realisations({ faire, setMsg }) {
  const { reals, medias } = useSite()
  const [nv, setNv] = useState({ titre: '', texte: '', lien: '' })
  const [fichiers, setFichiers] = useState([])
  const [cle, setCle] = useState(0)
  const [edit, setEdit] = useState(null)
  const [plus, setPlus] = useState([])
  const [cle2, setCle2] = useState(0)

  const verifier = (files) => {
    const trop = files.find((f) => f.type.startsWith('video/') && f.size > TAILLE_MAX)
    if (trop) throw new Error(`La vidéo « ${trop.name} » dépasse 50 Mo. Filme en 720p, plus court, ou colle un lien TikTok ou YouTube.`)
  }

  const ajouterMedias = async (id, files, lien) => {
    let premiere = null
    const ins = async (row) => {
      const { error } = await supabase.from('realisation_medias').insert({ realisation_id: id, ...row })
      if (error) throw error
    }
    for (const [i, f] of files.entries()) {
      setMsg(`Envoi ${i + 1}/${files.length}…`)
      if (f.type.startsWith('video/')) {
        const { chemin, url } = await envoyerFichier(f, `realisations/${id}`)
        await ins({ type: 'video', url, chemin })
      } else {
        const { chemin, url } = await envoyerImage(f, `realisations/${id}`)
        await ins({ type: 'photo', url, chemin })
        if (!premiere) premiere = url
      }
    }
    if (lien.trim()) await ins({ type: 'lien', url: https(lien.trim()) })
    return premiere
  }

  const creer = () =>
    nv.titre.trim() &&
    (fichiers.length > 0 || nv.lien.trim()) &&
    faire('Création…', async () => {
      verifier(fichiers)
      const { data, error } = await supabase.from('realisations').insert({ titre: nv.titre.trim(), texte: nv.texte.trim() || null }).select().single()
      if (error) throw error
      const premiere = await ajouterMedias(data.id, fichiers, nv.lien)
      if (premiere) {
        const { error: e2 } = await supabase.from('realisations').update({ couverture: premiere }).eq('id', data.id)
        if (e2) throw e2
      }
      setNv({ titre: '', texte: '', lien: '' })
      setFichiers([])
      setCle((n) => n + 1)
    })

  const enregistrer = () =>
    faire('Enregistrement…', async () => {
      if (!edit.titre.trim()) throw new Error('Le titre est obligatoire.')
      verifier(plus)
      const { error } = await supabase.from('realisations').update({ titre: edit.titre.trim(), texte: edit.texte.trim() || null }).eq('id', edit.id)
      if (error) throw error
      const premiere = await ajouterMedias(edit.id, plus, edit.lien || '')
      const r = reals.find((x) => x.id === edit.id)
      if (premiere && !r?.couverture) {
        const { error: e2 } = await supabase.from('realisations').update({ couverture: premiere }).eq('id', edit.id)
        if (e2) throw e2
      }
      setPlus([])
      setCle2((n) => n + 1)
      setEdit({ ...edit, lien: '' })
    })

  const supprimerMedia = (m) => {
    if (!window.confirm('Supprimer cet élément ?')) return
    faire('Suppression…', async () => {
      if (m.chemin) await supabase.storage.from('photos').remove([m.chemin])
      const { error } = await supabase.from('realisation_medias').delete().eq('id', m.id)
      if (error) throw error
      const r = reals.find((x) => x.id === m.realisation_id)
      if (r && r.couverture === m.url) {
        const autre = medias.find((x) => x.realisation_id === r.id && x.type === 'photo' && x.id !== m.id)
        await supabase.from('realisations').update({ couverture: autre?.url || null }).eq('id', r.id)
      }
    })
  }

  const definirCouverture = (m) =>
    faire('Couverture…', async () => {
      const { error } = await supabase.from('realisations').update({ couverture: m.url }).eq('id', m.realisation_id)
      if (error) throw error
    })

  const supprimerReal = (r) => {
    if (!window.confirm(`Supprimer la réalisation « ${r.titre} » et tout son contenu ?`)) return
    faire('Suppression…', async () => {
      const chemins = medias.filter((m) => m.realisation_id === r.id && m.chemin).map((m) => m.chemin)
      if (chemins.length) await supabase.storage.from('photos').remove(chemins)
      const { error } = await supabase.from('realisations').delete().eq('id', r.id)
      if (error) throw error
      if (edit?.id === r.id) setEdit(null)
    })
  }

  const rEdit = edit ? reals.find((x) => x.id === edit.id) : null

  return (
    <section>
      <h3>Réalisations</h3>
      <label>Titre<input value={nv.titre} onChange={(e) => setNv({ ...nv, titre: e.target.value })} placeholder="Ex : Mariage de Fatou" /></label>
      <label>Description (facultatif)<textarea rows="3" value={nv.texte} onChange={(e) => setNv({ ...nv, texte: e.target.value })} /></label>
      <label>Photos et vidéos
        <input key={cle} type="file" accept="image/*,video/*" multiple onChange={(e) => setFichiers([...e.target.files])} />
      </label>
      <p className="small">La première photo sert de couverture. Vidéo : moins de 50 Mo (environ 40 secondes en 720p), de préférence en MP4. Pour une vidéo plus longue, colle un lien.</p>
      <label>Lien vidéo TikTok, YouTube ou Facebook (facultatif)
        <input value={nv.lien} onChange={(e) => setNv({ ...nv, lien: e.target.value })} />
      </label>
      <button className="btn dark" onClick={creer}>Publier la réalisation</button>

      {edit && (
        <div className="edit">
          <h4>Modifier la réalisation</h4>
          <label>Titre<input value={edit.titre} onChange={(e) => setEdit({ ...edit, titre: e.target.value })} /></label>
          <label>Description<textarea rows="3" value={edit.texte} onChange={(e) => setEdit({ ...edit, texte: e.target.value })} /></label>
          <div className="minis">
            {medias.filter((m) => m.realisation_id === edit.id).map((m) => (
              <div key={m.id} className={'th' + (rEdit?.couverture === m.url ? ' iscov' : '')}>
                {m.type === 'photo' ? <img src={m.url} alt="" /> : <span className="mini">{m.type === 'video' ? '▶ vidéo' : '🔗 lien'}</span>}
                <button type="button" onClick={() => supprimerMedia(m)} aria-label="Supprimer">✕</button>
                {m.type === 'photo' && <button type="button" className="cov" onClick={() => definirCouverture(m)} aria-label="Définir comme couverture">★</button>}
              </div>
            ))}
          </div>
          <p className="small">★ = photo de couverture, ✕ = supprimer l’élément.</p>
          <label>Ajouter des photos ou vidéos
            <input key={cle2} type="file" accept="image/*,video/*" multiple onChange={(e) => setPlus([...e.target.files])} />
          </label>
          <label>Ajouter un lien vidéo<input value={edit.lien} onChange={(e) => setEdit({ ...edit, lien: e.target.value })} /></label>
          <div className="row">
            <button className="btn dark sm" onClick={enregistrer}>Enregistrer</button>
            <button className="btn line sm" onClick={() => setEdit(null)}>Fermer</button>
          </div>
        </div>
      )}

      <ul className="liste">
        {reals.map((r) => (
          <li key={r.id} className="catli">
            {r.couverture ? <img className="mini" src={r.couverture} alt="" /> : <span className="mini">Pas de photo</span>}
            <div>
              <strong>{r.titre}</strong>
              <br />
              <span className="small">{medias.filter((m) => m.realisation_id === r.id).length} élément(s)</span>
            </div>
            <div className="acts">
              <button className="btn line sm" onClick={() => setEdit({ id: r.id, titre: r.titre, texte: r.texte || '', lien: '' })}>Modifier</button>
              <button className="btn line sm" onClick={() => supprimerReal(r)}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Panel() {
  const { cats, photos, avis, reg, reload } = useSite()
  const [nom, setNom] = useState('')
  const [couv, setCouv] = useState(null)
  const [cle, setCle] = useState(0)
  const [catId, setCatId] = useState(cats[0]?.id || '')
  const [pub, setPub] = useState({ titre: '', texte: '', prix: '' })
  const [fichiers, setFichiers] = useState([])
  const [cle2, setCle2] = useState(0)
  const [edit, setEdit] = useState(null)
  const [filtre, setFiltre] = useState('')
  const [form, setForm] = useState(() => Object.fromEntries(CHAMPS.map(([k]) => [k, reg[k] || ''])))
  const [msg, setMsg] = useState('')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const j = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
    const q = (f) => f(supabase.from('visites').select('*', { count: 'exact', head: true })).then((r) => r.count ?? 0)
    Promise.all([q((x) => x.eq('jour', j(0))), q((x) => x.gte('jour', j(6))), q((x) => x.gte('jour', j(29))), q((x) => x)])
      .then(([auj, sem, mois, total]) => setStats({ auj, sem, mois, total }))
  }, [])

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
          category_id: catId, url, chemin, titre: pub.titre.trim() || null, texte: pub.texte.trim() || null, prix: pub.prix.trim() || null,
        })
        if (error) throw error
      }
      setPub({ titre: '', texte: '', prix: '' })
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

  const enregistrerEdit = () =>
    faire('Enregistrement…', async () => {
      const { error } = await supabase
        .from('photos')
        .update({ titre: edit.titre.trim() || null, texte: edit.texte.trim() || null, prix: edit.prix.trim() || null, category_id: edit.category_id })
        .eq('id', edit.id)
      if (error) throw error
      setEdit(null)
    })

  const renommerCat = (c) => {
    const n = window.prompt('Nouveau nom de la catégorie', c.nom)
    if (!n || !n.trim() || n.trim() === c.nom) return
    faire('Renommage…', async () => {
      const { error } = await supabase.from('categories').update({ nom: n.trim() }).eq('id', c.id)
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

  const liste = filtre ? photos.filter((p) => p.category_id === filtre) : photos
  const nomCat = (id) => cats.find((c) => c.id === id)?.nom || ''

  return (
    <div className="adm">
      <h1 className="t">Espace Anta</h1>
      {msg && <p className="msg">{msg}</p>}

      <section>
        <h3>Visites du site</h3>
        {stats ? (
          <div className="stats">
            {[['Aujourd’hui', stats.auj], ['7 derniers jours', stats.sem], ['30 derniers jours', stats.mois], ['Depuis le début', stats.total]].map(([l, n]) => (
              <div key={l}><strong>{n}</strong><span>{l}</span></div>
            ))}
          </div>
        ) : <p className="small">Chargement…</p>}
        <p className="small">Une visite = un appareil par jour. Tes propres visites connectée ne sont pas comptées.</p>
      </section>

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
              <div className="acts">
                <button className="btn line sm" onClick={() => renommerCat(c)}>Renommer</button>
                <button className="btn line sm" onClick={() => supprimerCat(c)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Publier des modèles</h3>
        <label>Catégorie
          <select value={catId} onChange={(e) => { setCatId(e.target.value); setEdit(null) }}>
            <option value="">Choisir…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        {catId && (
          <>
            <label>Titre (facultatif)<input value={pub.titre} onChange={(e) => setPub({ ...pub, titre: e.target.value })} /></label>
            <label>Description (facultatif)<textarea rows="3" value={pub.texte} onChange={(e) => setPub({ ...pub, texte: e.target.value })} /></label>
            <label>Prix (facultatif)<input value={pub.prix} onChange={(e) => setPub({ ...pub, prix: e.target.value })} placeholder="Ex : 5 000 FCFA" /></label>
            <label>Photos<input key={cle2} type="file" accept="image/*" multiple onChange={(e) => setFichiers([...e.target.files])} /></label>
            <p className="small">Le titre et la description sont mis sur chaque photo choisie. Pour des titres différents, publie les photos une par une.</p>
            <button className="btn dark" onClick={publier}>Publier</button>
          </>
        )}
      </section>

      <section>
        <h3>Mes publications</h3>
        <label>Catégorie
          <select value={filtre} onChange={(e) => { setFiltre(e.target.value); setEdit(null) }}>
            <option value="">Toutes</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        {edit && (
          <div className="edit">
            <h4>Modifier la publication</h4>
            <label>Catégorie
              <select value={edit.category_id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </label>
            <label>Titre<input value={edit.titre} onChange={(e) => setEdit({ ...edit, titre: e.target.value })} /></label>
            <label>Description<textarea rows="3" value={edit.texte} onChange={(e) => setEdit({ ...edit, texte: e.target.value })} /></label>
            <label>Prix<input value={edit.prix} onChange={(e) => setEdit({ ...edit, prix: e.target.value })} /></label>
            <div className="row">
              <button className="btn dark sm" onClick={enregistrerEdit}>Enregistrer</button>
              <button className="btn line sm" onClick={() => setEdit(null)}>Annuler</button>
            </div>
          </div>
        )}
        {liste.length === 0 && <p className="small">Aucune publication.</p>}
        <ul className="liste">
          {liste.map((p) => (
            <li key={p.id} className="catli">
              <img className="mini" src={p.url} alt="" loading="lazy" />
              <div>
                <strong>{p.titre || 'Sans titre'}</strong>
                <br />
                <span className="small">{nomCat(p.category_id)}{p.prix ? ' · ' + p.prix : ''}</span>
              </div>
              <div className="acts">
                <button className="btn line sm"
                  onClick={() => setEdit({ id: p.id, titre: p.titre || '', texte: p.texte || '', prix: p.prix || '', category_id: p.category_id })}>Modifier</button>
                <button className="btn line sm" onClick={() => supprimerPhoto(p)}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Realisations faire={faire} setMsg={setMsg} />

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
