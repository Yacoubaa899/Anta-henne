import { useCallback, useEffect, useState } from 'react'
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

const VIDE = { titre: '', texte: '', duree: '', prix: '', lieu: '', date_debut: '', niveau: '', places: '', programme: '' }
const CH_FORM = [
  ['duree', 'Durée', 'Ex : 2 semaines'],
  ['prix', 'Prix', 'Ex : 50 000 FCFA'],
  ['lieu', 'Lieu', 'Ex : Ouagadougou, quartier…'],
  ['date_debut', 'Prochaine session', 'Ex : à partir du 15 décembre'],
  ['niveau', 'Niveau', 'Ex : débutante'],
  ['places', 'Nombre de places', 'Ex : 10'],
]

function ChampsFormation({ v, set }) {
  return (
    <>
      <label>Titre<input value={v.titre} onChange={(e) => set({ ...v, titre: e.target.value })} /></label>
      <label>Description (facultatif)<textarea rows="3" value={v.texte} onChange={(e) => set({ ...v, texte: e.target.value })} /></label>
      {CH_FORM.map(([k, l, p]) => (
        <label key={k}>{l} (facultatif)<input value={v[k]} placeholder={p} onChange={(e) => set({ ...v, [k]: e.target.value })} /></label>
      ))}
      <label>Au programme (facultatif, un point par ligne)
        <textarea rows="4" value={v.programme} onChange={(e) => set({ ...v, programme: e.target.value })} />
      </label>
    </>
  )
}

function Formations({ faire, setMsg }) {
  const { formations } = useSite()
  const [nv, setNv] = useState(VIDE)
  const [couv, setCouv] = useState(null)
  const [fichiers, setFichiers] = useState([])
  const [cle, setCle] = useState(0)
  const [edit, setEdit] = useState(null)
  const [nvCouv, setNvCouv] = useState(null)
  const [plus, setPlus] = useState([])
  const [cle2, setCle2] = useState(0)

  const champs = (v) => Object.fromEntries(Object.keys(VIDE).map((k) => [k, v[k].trim() || null]))
  const televerser = async (files) => {
    const res = []
    for (const [i, f] of files.entries()) {
      setMsg(`Envoi ${i + 1}/${files.length}…`)
      res.push(await envoyerImage(f, 'formations'))
    }
    return res
  }

  const creer = () =>
    nv.titre.trim() &&
    faire('Création…', async () => {
      const [c] = couv ? await televerser([couv]) : [{}]
      const images = await televerser(fichiers)
      const { error } = await supabase.from('formations').insert({
        ...champs(nv), titre: nv.titre.trim(), couverture: c.url || null, couverture_chemin: c.chemin || null, images,
      })
      if (error) throw error
      setNv(VIDE)
      setCouv(null)
      setFichiers([])
      setCle((n) => n + 1)
    })

  const enregistrer = () =>
    faire('Enregistrement…', async () => {
      if (!edit.titre.trim()) throw new Error('Le titre est obligatoire.')
      const f = formations.find((x) => x.id === edit.id)
      const patch = { ...champs(edit), titre: edit.titre.trim() }
      if (nvCouv) {
        const [c] = await televerser([nvCouv])
        if (f.couverture_chemin) await supabase.storage.from('photos').remove([f.couverture_chemin])
        patch.couverture = c.url
        patch.couverture_chemin = c.chemin
      }
      if (plus.length) patch.images = [...(f.images || []), ...(await televerser(plus))]
      const { error } = await supabase.from('formations').update(patch).eq('id', edit.id)
      if (error) throw error
      setNvCouv(null)
      setPlus([])
      setCle2((n) => n + 1)
    })

  const retirerImage = (f, img) => {
    if (!window.confirm('Supprimer cette photo ?')) return
    faire('Suppression…', async () => {
      if (img.chemin) await supabase.storage.from('photos').remove([img.chemin])
      const { error } = await supabase.from('formations').update({ images: (f.images || []).filter((x) => x.url !== img.url) }).eq('id', f.id)
      if (error) throw error
    })
  }

  const supprimer = (f) => {
    if (!window.confirm(`Supprimer la formation « ${f.titre} » ?`)) return
    faire('Suppression…', async () => {
      const chemins = [f.couverture_chemin, ...(f.images || []).map((x) => x.chemin)].filter(Boolean)
      if (chemins.length) await supabase.storage.from('photos').remove(chemins)
      const { error } = await supabase.from('formations').delete().eq('id', f.id)
      if (error) throw error
      if (edit?.id === f.id) setEdit(null)
    })
  }

  const fEdit = edit ? formations.find((x) => x.id === edit.id) : null

  return (
    <section>
      <h3>Formations</h3>
      <ChampsFormation v={nv} set={setNv} />
      <label>Photo de couverture (facultatif)
        <input key={'c' + cle} type="file" accept="image/*" onChange={(e) => setCouv(e.target.files[0] || null)} />
      </label>
      <label>Autres photos (facultatif)
        <input key={'p' + cle} type="file" accept="image/*" multiple onChange={(e) => setFichiers([...e.target.files])} />
      </label>
      <button className="btn dark" onClick={creer}>Publier la formation</button>

      {edit && fEdit && (
        <div className="edit">
          <h4>Modifier la formation</h4>
          <ChampsFormation v={edit} set={setEdit} />
          <label>Changer la photo de couverture
            <input key={'nc' + cle2} type="file" accept="image/*" onChange={(e) => setNvCouv(e.target.files[0] || null)} />
          </label>
          <div className="minis">
            {(fEdit.images || []).map((img) => (
              <div key={img.url} className="th">
                <img src={img.url} alt="" />
                <button type="button" onClick={() => retirerImage(fEdit, img)} aria-label="Supprimer">✕</button>
              </div>
            ))}
          </div>
          <label>Ajouter des photos
            <input key={'np' + cle2} type="file" accept="image/*" multiple onChange={(e) => setPlus([...e.target.files])} />
          </label>
          <div className="row">
            <button className="btn dark sm" onClick={enregistrer}>Enregistrer</button>
            <button className="btn line sm" onClick={() => setEdit(null)}>Fermer</button>
          </div>
        </div>
      )}

      <ul className="liste">
        {formations.map((f) => (
          <li key={f.id} className="catli">
            {f.couverture || f.images?.[0] ? <img className="mini" src={f.couverture || f.images[0].url} alt="" /> : <span className="mini">Pas de photo</span>}
            <div>
              <strong>{f.titre}</strong>
              <br />
              <span className="small">{[f.duree, f.prix].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="acts">
              <button className="btn line sm" onClick={() => setEdit({ id: f.id, ...Object.fromEntries(Object.keys(VIDE).map((k) => [k, f[k] || ''])) })}>Modifier</button>
              <button className="btn line sm" onClick={() => supprimer(f)}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const GUIDE = [
  {
    t: '1. Créer une catégorie', e: [
      'Va dans **Catégories**.',
      'Écris le **nom** de la catégorie (par exemple : Mariées).',
      'Choisis une **photo de couverture** : c’est l’image que les clientes voient sur l’accueil.',
      'Clique sur **Créer la catégorie**.',
      'Pour changer le nom, la photo ou la supprimer, utilise **Renommer**, **Changer la couverture** ou **Supprimer** sur sa ligne. Attention : supprimer une catégorie supprime aussi ses publications.',
    ]
  },
  {
    t: '2. Publier un modèle', e: [
      'Dans **Publier des modèles**, choisis la **catégorie**.',
      'Écris un **titre**, une **description** et un **prix** si tu veux (tout est facultatif).',
      'Clique sur **Photos** et choisis une ou plusieurs photos de ton téléphone.',
      'Clique sur **Publier** et attends « Terminé ✔ ».',
      'Ouvre l’accueil du site pour vérifier. Si tu as choisi plusieurs photos, chacune devient une publication avec le même titre et le même prix.',
    ]
  },
  {
    t: '3. Modifier ou supprimer une publication', e: [
      'Va dans **Mes publications**. Choisis une catégorie pour filtrer, ou garde « Toutes ».',
      'Pour changer le titre, la description, le prix ou la catégorie : clique sur **Modifier**, change ce que tu veux, puis clique sur **Enregistrer**.',
      'Pour retirer une publication : clique sur **Supprimer**, puis confirme.',
      'Pour changer la photo : supprime la publication et publie-la de nouveau.',
    ]
  },
  {
    t: '4. Publier une réalisation', e: [
      'Dans **Réalisations**, écris un **titre** (par exemple : Mariage de Fatou) et une description.',
      'Choisis plusieurs **photos et vidéos**. La première photo sert de couverture.',
      'Une vidéo doit peser moins de 50 Mo (environ 40 secondes, filmée en 720p). Pour une vidéo plus longue, colle un **lien TikTok, YouTube ou Facebook**.',
      'Clique sur **Publier la réalisation**.',
      'Pour changer la couverture ou retirer un élément : clique sur **Modifier**, puis sur ★ (couverture) ou ✕ (supprimer), puis sur **Enregistrer**.',
    ]
  },
  {
    t: '5. Publier une formation', e: [
      'Dans **Formations**, écris le **titre**. Les autres champs (durée, prix, lieu, prochaine session, niveau, places, programme) sont facultatifs.',
      'Dans **Au programme**, écris un point par ligne.',
      'Ajoute une **photo de couverture** et d’autres photos si tu veux.',
      'Clique sur **Publier la formation**.',
      'Les clientes verront un bouton **S’inscrire** qui t’écrit sur WhatsApp.',
    ]
  },
  {
    t: '6. Valider ou refuser un avis', e: [
      'Les avis des clientes n’apparaissent pas tout de suite : ils attendent ton accord.',
      'Quand un avis est en attente, un bandeau 🔔 s’affiche en haut. Clique sur **Voir**.',
      'Dans **À valider**, lis l’avis, puis clique sur **Publier** (il apparaît sur le site) ou sur **Refuser** (il est supprimé).',
      'Pour retirer un avis déjà publié : clique sur **Supprimer** dans la liste **Publiés**.',
    ]
  },
  {
    t: '7. Changer ses contacts, ses réseaux et la carte', e: [
      'Va dans **Contacts et réseaux**.',
      'Remplis le **numéro WhatsApp** (au format 226XXXXXXXX, sans le +), les liens de tes réseaux et ton **adresse**.',
      'Un réseau n’apparaît sur le site que si son lien est rempli.',
      'Colle le **lien Google Maps** de la boutique.',
      'Clique sur **Enregistrer**.',
    ]
  },
  {
    t: '8. Voir les visites du site', e: [
      'Tout en haut de cette page, la section **Visites du site** montre combien d’appareils sont venus aujourd’hui, sur 7 jours, sur 30 jours et depuis le début.',
      'Une visite compte un appareil par jour. Tes propres visites, quand tu es connectée, ne sont pas comptées.',
    ]
  },
  {
    t: '9. Conseils importants', e: [
      'Garde toujours les **photos originales** sur ton téléphone : le site n’a pas de sauvegarde automatique.',
      'Filme les vidéos courtes et en **720p**.',
      'Attends « Terminé ✔ » avant de quitter la page.',
      'Quand tu as fini, clique sur **Se déconnecter** (surtout sur un téléphone prêté).',
      'Ne donne jamais ton mot de passe à personne.',
    ]
  },
]

const Gras = ({ t }) => t.split('**').map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))

function Guide() {
  return (
    <details className="guide">
      <summary>📖 Guide : comment ça marche ?</summary>
      {GUIDE.map((s) => (
        <details key={s.t} className="sujet">
          <summary>{s.t}</summary>
          <ol>{s.e.map((x, i) => <li key={i}><Gras t={x} /></li>)}</ol>
        </details>
      ))}
      <p className="small">10. Un problème ou une question ? Écris à Yacouba.</p>
      <a className="btn wa sm" target="_blank" rel="noreferrer"
        href="https://wa.me/22656067179?text=Bonjour%20Yacouba%2C%20j%E2%80%99ai%20un%20probl%C3%A8me%20avec%20l%E2%80%99espace%20d%E2%80%99administration%20du%20site%20Anta%20henn%C3%A9.">
        💬 Écrire à Yacouba
      </a>
    </details>
  )
}

function Panel() {
  const { cats, photos, reg, reload } = useSite()
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
  const [tous, setTous] = useState([])

  const chargerAvis = useCallback(async () => {
    const { data } = await supabase.from('avis').select('*').order('created_at', { ascending: false })
    setTous(data || [])
  }, [])

  useEffect(() => {
    chargerAvis()
  }, [chargerAvis])

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
      await chargerAvis()
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

  const approuverAvis = (v) =>
    faire('Publication de l’avis…', async () => {
      const { error } = await supabase.from('avis').update({ approuve: true }).eq('id', v.id)
      if (error) throw error
    })

  const supprimerAvis = (v) => {
    if (!window.confirm('Supprimer cet avis ? Cette action est définitive.')) return
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

  const enAttente = tous.filter((v) => !v.approuve)
  const publies = tous.filter((v) => v.approuve)
  const liste = filtre ? photos.filter((p) => p.category_id === filtre) : photos
  const nomCat = (id) => cats.find((c) => c.id === id)?.nom || ''

  return (
    <div className="adm">
      <h1 className="t">Espace Anta</h1>
      {msg && <p className="msg">{msg}</p>}
      {enAttente.length > 0 && (
        <p className="msg alerte">
          🔔 {enAttente.length} avis en attente de ta validation.{' '}
          <button className="lienbtn sombre" onClick={() => document.getElementById('avis')?.scrollIntoView({ behavior: 'smooth' })}>Voir</button>
        </p>
      )}

      <Guide />

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

      <Formations faire={faire} setMsg={setMsg} />

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

      <section id="avis">
        <h3>Avis des clientes {enAttente.length > 0 && <span className="badge">{enAttente.length} en attente</span>}</h3>
        <p className="small">Un avis n’apparaît sur le site qu’après ton accord.</p>
        {enAttente.length > 0 && <h4>À valider</h4>}
        <ul className="liste">
          {enAttente.map((v) => (
            <li key={v.id} className="avli">
              <div>
                {v.photo && <img className="mini" src={v.photo} alt="" />}
                <div>{'★'.repeat(v.etoiles)} <strong>{v.nom}</strong> <span className="small">{v.email}</span></div>
                <div>{v.texte}</div>
              </div>
              <div className="acts">
                <button className="btn dark sm" onClick={() => approuverAvis(v)}>Publier</button>
                <button className="btn line sm" onClick={() => supprimerAvis(v)}>Refuser</button>
              </div>
            </li>
          ))}
        </ul>
        <h4>Publiés ({publies.length})</h4>
        <ul className="liste">
          {publies.map((v) => (
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