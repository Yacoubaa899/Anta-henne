import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  FaChevronLeft, FaChevronRight, FaFacebookF, FaHeart, FaInstagram, FaMapMarkerAlt,
  FaRegHeart, FaTiktok, FaTimes, FaWhatsapp, FaYoutube,
} from 'react-icons/fa'
import { useSite } from './site.jsx'
import { supabase } from './supabase'
import Admin from './Admin.jsx'

const PRESTATIONS = ['Henné de mariée', 'Henné de fête', 'Henné mains', 'Henné pieds', 'Autre']
const RESEAUX = [
  ['instagram', FaInstagram, 'Instagram'],
  ['tiktok', FaTiktok, 'TikTok'],
  ['facebook', FaFacebookF, 'Facebook'],
  ['youtube', FaYoutube, 'YouTube'],
]
const HELLO = 'Bonjour Anta henné, '
const lien = (u) => (/^https?:\/\//.test(u) ? u : 'https://' + u)

function Socials() {
  const { reg, wa } = useSite()
  return (
    <div className="socials">
      <a href={wa(HELLO)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><FaWhatsapp /></a>
      {RESEAUX.filter(([k]) => reg[k]).map(([k, Icon, nom]) => (
        <a key={k} href={lien(reg[k])} target="_blank" rel="noreferrer" aria-label={nom}><Icon /></a>
      ))}
    </div>
  )
}

function Layout({ children }) {
  const { favs, wa } = useSite()
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  const liens = [['/', 'Accueil'], ['/modeles', 'Modèles'], ['/reservation', 'Réservation'], ['/apropos', 'À propos'], ['/contact', 'Contact']]
  return (
    <>
      <header className="top">
        <Link to="/" className="brand"><img src="/logo.jpg" alt="" />Anta henné</Link>
        <Link to="/selection" className="heart" aria-label="Ma sélection"><FaHeart /> {favs.length}</Link>
        <a className="btn wa sm" href={wa(HELLO)} target="_blank" rel="noreferrer"><FaWhatsapp /> WhatsApp</a>
        <nav>
          {liens.map(([to, nom]) => <NavLink key={to} to={to} end>{nom}</NavLink>)}
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <p className="fname">Anta henné</p>
        <p className="ftag">L’élégance au naturel</p>
        <Socials />
        <p className="small">© {new Date().getFullYear()} Anta henné · <Link to="/admin">Espace Anta</Link></p>
      </footer>
      <a className="float" href={wa(HELLO)} target="_blank" rel="noreferrer" aria-label="Écrire sur WhatsApp"><FaWhatsapp /></a>
    </>
  )
}

function Home() {
  const { cats, photos, mix, wa } = useSite()
  const ref = useRef(null)
  const [n, setN] = useState(12)
  useEffect(() => {
    const t = setInterval(() => {
      const el = ref.current
      if (!el) return
      const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      el.scrollTo({ left: fin ? 0 : el.scrollLeft + 212, behavior: 'smooth' })
    }, 4000)
    return () => clearInterval(t)
  }, [])
  const aller = (d) => ref.current?.scrollBy({ left: d * 212, behavior: 'smooth' })
  return (
    <>
      <div className="hero">
        <img src="/couverture.jpg" alt="Anta henné, l’élégance au naturel" />
        <div className="herobtns">
          <Link className="btn dark" to="/modeles">Nos modèles</Link>
          <a className="btn wa" href={wa(HELLO)} target="_blank" rel="noreferrer"><FaWhatsapp /> Nous contacter</a>
        </div>
      </div>
      <div className="hero2">
        <div className="heroL">
          <h1>Anta <span>henné</span></h1>
          <p className="tag">L’élégance au naturel</p>
          <p className="sub">Sublimez votre mariage avec nos créations uniques et raffinées.</p>
          <div className="heroact">
            <Link className="btn dark" to="/modeles">Découvrir nos modèles</Link>
            <a className="btn wa" href={wa(HELLO)} target="_blank" rel="noreferrer"><FaWhatsapp /> Nous contacter</a>
          </div>
        </div>
        <div className="heroR"><img src="/mariee.jpg" alt="Mariée avec du henné" /></div>
      </div>
      <h2 className="t">Nos catégories</h2>
      {cats.length === 0 && <p className="pad">Les modèles arrivent bientôt.</p>}
      {cats.length > 0 && (
        <div className="carwrap">
          <button className="arr l" onClick={() => aller(-1)} aria-label="Précédent"><FaChevronLeft /></button>
          <div className="car" ref={ref}>
            {cats.map((c) => {
              const img = c.couverture || photos.find((x) => x.category_id === c.id)?.url
              return (
                <Link key={c.id} to={`/modeles?cat=${c.id}`} className="cat">
                  {img && <img src={img} alt="" loading="lazy" />}
                  <span>{c.nom}</span>
                </Link>
              )
            })}
          </div>
          <button className="arr r" onClick={() => aller(1)} aria-label="Suivant"><FaChevronRight /></button>
        </div>
      )}
      {mix.length > 0 && (
        <>
          <h2 className="t">Nos modèles</h2>
          <div className="grid">
            {mix.slice(0, n).map((p) => (
              <Link key={p.id} to={`/modele/${p.id}`} className="tile">
                <img src={p.url} alt={p.titre || ''} loading="lazy" />
                {p.titre && <span className="cap">{p.titre}</span>}
              </Link>
            ))}
          </div>
          {n < mix.length && (
            <div className="btns"><button className="btn dark" onClick={() => setN(n + 12)}>Voir plus</button></div>
          )}
        </>
      )}
      <Temoignages />
    </>
  )
}

async function petitePhoto(file) {
  const bmp = await createImageBitmap(file)
  const t = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = c.height = 160
  c.getContext('2d').drawImage(bmp, (bmp.width - t) / 2, (bmp.height - t) / 2, t, t, 0, 0, 160, 160)
  return c.toDataURL('image/jpeg', 0.8)
}

function Avatar({ nom, photo }) {
  return photo ? <img className="av" src={photo} alt="" /> : <span className="av">{(nom || '?').trim().charAt(0).toUpperCase()}</span>
}

function Temoignages() {
  const { avis, reload } = useSite()
  const [ouvert, setOuvert] = useState(false)
  const [f, setF] = useState({ nom: '', email: '', texte: '', etoiles: 5, photo: '', site: '' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const maj = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const choisirPhoto = async (e) => {
    const fichier = e.target.files[0]
    if (!fichier) return
    const photo = await petitePhoto(fichier)
    setF((x) => ({ ...x, photo }))
  }
  const envoyer = async (e) => {
    e.preventDefault()
    if (f.site) { setOk(true); return }
    if (Date.now() - Number(localStorage.getItem('avisEnvoye') || 0) < 86400000) {
      setErr('Vous avez déjà envoyé un avis aujourd’hui. Merci !')
      return
    }
    if (!f.nom.trim() || !/^\S+@\S+\.\S+$/.test(f.email.trim()) || f.texte.trim().length < 3) {
      setErr('Merci d’indiquer votre nom, un email valide et votre avis.')
      return
    }
    setEnvoi(true)
    setErr('')
    const { error } = await supabase.from('avis').insert({
      nom: f.nom.trim(), email: f.email.trim(), texte: f.texte.trim(), etoiles: f.etoiles, photo: f.photo || null,
    })
    setEnvoi(false)
    if (error) { setErr('Envoi impossible pour le moment. Réessayez plus tard.'); return }
    localStorage.setItem('avisEnvoye', String(Date.now()))
    setOk(true)
    reload()
  }
  return (
    <>
      <h2 className="t">Témoignages</h2>
      {avis.length === 0 && <p className="pad">Soyez la première à donner votre avis !</p>}
      <div className="avis">
        {avis.slice(0, 12).map((v) => (
          <div key={v.id} className="avi">
            <Avatar nom={v.nom} photo={v.photo} />
            <strong>{v.nom}</strong>
            <div className="stars">{'★'.repeat(v.etoiles)}{'☆'.repeat(5 - v.etoiles)}</div>
            <p>« {v.texte} »</p>
          </div>
        ))}
      </div>
      {ok && <p className="pad">Merci pour votre avis ! Il est maintenant publié.</p>}
      {!ouvert && !ok && (
        <div className="btns"><button className="btn dark" onClick={() => setOuvert(true)}>Donner mon avis</button></div>
      )}
      {ouvert && !ok && (
        <form className="form" onSubmit={envoyer}>
          <label>Votre nom<input value={f.nom} onChange={maj('nom')} maxLength={60} /></label>
          <label>Votre email (il ne sera pas affiché)<input type="email" value={f.email} onChange={maj('email')} maxLength={120} /></label>
          <label>Votre photo (facultatif)<input type="file" accept="image/*" onChange={choisirPhoto} /></label>
          {f.photo && <Avatar nom={f.nom} photo={f.photo} />}
          <div>
            <strong>Votre note</strong>
            <div className="pick">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} className={n <= f.etoiles ? 'on' : ''} aria-label={`${n} étoiles`}
                  onClick={() => setF((x) => ({ ...x, etoiles: n }))}>★</button>
              ))}
            </div>
          </div>
          <label>Votre avis<textarea rows="4" value={f.texte} onChange={maj('texte')} maxLength={600} /></label>
          <input className="hp" tabIndex="-1" autoComplete="off" aria-hidden="true" value={f.site} onChange={maj('site')} />
          {err && <p className="err">{err}</p>}
          <button className="btn dark" type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Publier mon avis'}</button>
        </form>
      )}
    </>
  )
}

function Modele() {
  const { id } = useParams()
  const { photos, cats, loading, favs, toggleFav, wa } = useSite()
  const p = photos.find((x) => x.id === id)
  if (loading) return <p className="pad">Chargement…</p>
  if (!p) return <p className="pad">Modèle introuvable. <Link to="/modeles">Voir les modèles</Link></p>
  const cat = cats.find((c) => c.id === p.category_id)
  const titre = p.titre || cat?.nom || 'Modèle'
  return (
    <div className="art">
      <img src={p.url} alt={titre} />
      <h1 className="t">{titre}</h1>
      {cat && p.titre && <p className="small">{cat.nom}</p>}
      {p.texte && <p className="corps">{p.texte}</p>}
      <div className="btns">
        <a className="btn wa" target="_blank" rel="noreferrer"
          href={wa(`${HELLO}je suis intéressée par ce modèle${cat ? ` (${cat.nom})` : ''} : ${p.url}`)}>
          <FaWhatsapp /> Demander ce modèle
        </a>
        <button className="btn line" onClick={() => toggleFav(p.id)}>
          {favs.includes(p.id) ? <><FaHeart /> Retirer de ma sélection</> : <><FaRegHeart /> Ajouter à ma sélection</>}
        </button>
        <Link className="btn dark" to="/reservation">Réserver</Link>
      </div>
      {cat && <p><Link to={`/modeles?cat=${cat.id}`}>‹ Retour à {cat.nom}</Link></p>}
    </div>
  )
}

function Models() {
  const { cats, photos } = useSite()
  const [sp, setSp] = useSearchParams()
  const cat = sp.get('cat') || ''
  const liste = cat ? photos.filter((p) => p.category_id === cat) : photos
  return (
    <>
      <h1 className="t">{cats.find((c) => c.id === cat)?.nom || 'Nos modèles'}</h1>
      <div className="chips">
        <button className={!cat ? 'on' : ''} onClick={() => setSp({})}>Tous</button>
        {cats.map((c) => (
          <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setSp({ cat: c.id })}>{c.nom}</button>
        ))}
      </div>
      {liste.length === 0 && <p className="pad">Aucune publication pour le moment.</p>}
      <div className="grid">
        {liste.map((x) => (
          <Link key={x.id} to={`/modele/${x.id}`} className="tile">
            <img src={x.url} alt={x.titre || ''} loading="lazy" />
            {x.titre && <span className="cap">{x.titre}</span>}
          </Link>
        ))}
      </div>
    </>
  )
}

function Selection() {
  const { photos, favs, toggleFav, wa } = useSite()
  const liste = photos.filter((p) => favs.includes(p.id))
  const msg = `${HELLO}voici les modèles qui m’intéressent :\n` + liste.map((p, i) => `${i + 1}. ${p.url}`).join('\n')
  return (
    <>
      <h1 className="t">Ma sélection</h1>
      {liste.length === 0 ? (
        <p className="pad">Vous n’avez pas encore de favoris. Touchez une photo dans <Link to="/modeles">Modèles</Link> puis « Ajouter à ma sélection ».</p>
      ) : (
        <>
          <div className="grid">
            {liste.map((p) => (
              <div key={p.id} className="th">
                <img src={p.url} alt="" />
                <button onClick={() => toggleFav(p.id)} aria-label="Retirer"><FaTimes /></button>
              </div>
            ))}
          </div>
          <div className="btns">
            <a className="btn wa" href={wa(msg)} target="_blank" rel="noreferrer"><FaWhatsapp /> Envoyer ma sélection à Anta</a>
          </div>
        </>
      )}
    </>
  )
}

function Reservation() {
  const { cats, wa } = useSite()
  const [f, setF] = useState({ prestation: '', categorie: '', date: '', heure: '', lieu: '', nom: '', besoins: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const envoyer = (e) => {
    e.preventDefault()
    if (!f.prestation || !f.date || !f.nom.trim()) {
      setErr('Merci de choisir une prestation, une date et d’indiquer votre nom.')
      return
    }
    setErr('')
    const d = new Date(f.date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const lignes = [
      HELLO + 'je souhaite réserver :',
      `• Prestation : ${f.prestation}`,
      f.categorie && `• Catégorie de modèle : ${f.categorie}`,
      `• Date : ${d}`,
      f.heure && `• Heure : ${f.heure}`,
      f.lieu && `• Lieu : ${f.lieu}`,
      `• Nom : ${f.nom}`,
      f.besoins && `• Besoins : ${f.besoins}`,
    ]
    window.open(wa(lignes.filter(Boolean).join('\n')), '_blank')
  }
  return (
    <>
      <h1 className="t">Réservation</h1>
      <form className="form" onSubmit={envoyer}>
        <label>Prestation
          <select value={f.prestation} onChange={set('prestation')}>
            <option value="">Sélectionnez…</option>
            {PRESTATIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label>Catégorie de modèle (facultatif)
          <select value={f.categorie} onChange={set('categorie')}>
            <option value="">—</option>
            {cats.map((c) => <option key={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label>Date souhaitée<input type="date" value={f.date} onChange={set('date')} /></label>
        <label>Heure (facultatif)<input type="time" value={f.heure} onChange={set('heure')} /></label>
        <label>Lieu (facultatif)<input value={f.lieu} onChange={set('lieu')} placeholder="Quartier, salle, domicile…" /></label>
        <label>Votre nom<input value={f.nom} onChange={set('nom')} placeholder="Entrez votre nom" /></label>
        <label>Vos besoins (facultatif)<textarea rows="3" value={f.besoins} onChange={set('besoins')} placeholder="Décrivez vos attentes…" /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn wa" type="submit"><FaWhatsapp /> Envoyer sur WhatsApp</button>
      </form>
    </>
  )
}

function About() {
  return (
    <>
      <h1 className="t">À propos</h1>
      <div className="pad apropos">
        <h3>Une passion, un savoir-faire</h3>
        <p>
          Chez Anta henné, chaque motif est dessiné à la main, un trait après l’autre, avec patience et précision,
          pour sublimer vos mains et vos pieds le jour qui compte.
        </p>
        <p>
          Mariage, fêtes, cérémonies : nous mêlons motifs traditionnels et touches modernes pour créer un henné
          qui vous ressemble. Élégant, raffiné, unique.
        </p>
        <p className="valeurs">Mariage · Beauté · Tradition</p>
        <ul>
          <li>✔ Des motifs dessinés à la main, un par un</li>
          <li>✔ Des modèles pour chaque occasion</li>
          <li>✔ Un accompagnement personnalisé, de la réservation jusqu’au grand jour</li>
        </ul>
        <p>Choisissez votre modèle, réservez votre date, et laissez-nous sublimer votre moment.</p>
        <div className="btns">
          <Link className="btn dark" to="/modeles">Voir les modèles</Link>
          <Link className="btn wa" to="/reservation">Réserver</Link>
        </div>
      </div>
    </>
  )
}

function Contact() {
  const { reg } = useSite()
  const adresse = reg.adresse || 'Ouagadougou, Burkina Faso'
  return (
    <>
      <h1 className="t">Contact</h1>
      <div className="pad">
        <p><FaWhatsapp /> WhatsApp : <strong>+{reg.whatsapp || '226 05 65 51 70'}</strong></p>
        <p><FaMapMarkerAlt /> Adresse : {adresse}</p>
        <Socials />
        <p>
          <a className="btn dark" target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`}>Voir sur Google Maps</a>
        </p>
      </div>
    </>
  )
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/modeles" element={<Models />} />
        <Route path="/selection" element={<Selection />} />
        <Route path="/modele/:id" element={<Modele />} />
        <Route path="/reservation" element={<Reservation />} />
        <Route path="/apropos" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  )
}