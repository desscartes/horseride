import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { coupons, demoRaces, loadRaceProgram } from './data/raceData'
import './styles.css'

function App() {
  const [races, setRaces] = useState(demoRaces)
  const [selectedRace, setSelectedRace] = useState(0)
  const [activeDay, setActiveDay] = useState('Bugün')
  const [selectedCoupon, setSelectedCoupon] = useState(0)
  const [dataState, setDataState] = useState({ source: 'demo', message: 'Canlı API bağlı değil. Arayüz demo veriyle çalışıyor.' })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('12:42')
  const race = races[selectedRace]
  const coupon = coupons[selectedCoupon]

  async function refreshProgram() {
    setIsRefreshing(true)
    try {
      const result = await loadRaceProgram()
      setRaces(result.races)
      setDataState({ source: result.source, message: result.message })
      setSelectedRace(0)
      setLastUpdated(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch (error) {
      setDataState({ source: 'error', message: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => { refreshProgram() }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">H</span><span>Horse<span>Ride</span></span></div>
        <div className="workspace-label">ANALİZ MERKEZİ</div>
        <nav>
          <button className="nav-item active"><span>◈</span> Yarış panosu</button>
          <button className="nav-item"><span>⌁</span> Kupon laboratuvarı</button>
          <button className="nav-item"><span>◷</span> Geçmiş analizler</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="model-status"><span className="status-dot" /><div><strong>Model hazır</strong><small>Son güncelleme 12:42</small></div></div>
          <button className="settings"><span>⚙</span> Ayarlar</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">H</span> HorseRide</div>
          <div className="location"><span className="pin">⌖</span><div><small>AKTİF PROGRAM</small><strong>İstanbul · 25 Eylül 2026</strong></div></div>
          <div className={`data-state ${dataState.source}`}><span className="data-state-dot" /><div><strong>{dataState.source === 'live' ? 'Canlı veri' : dataState.source === 'error' ? 'Veri hatası' : 'Demo veri'}</strong><small>{lastUpdated} güncellendi</small></div></div>
          <div className="header-actions"><button className="icon-button" title="Bildirimler">♢<i /></button><button className="profile">CA</button></div>
        </header>

        <section className="intro-row">
          <div><p className="eyebrow">YARIŞ GÜNÜ / CUMA</p><h1>Bugünün yarış zekası</h1><p className="subhead">Veriyi oku, tempoyu gör, kuponunu bilinçle kur.</p></div>
          <button className="refresh-button" onClick={refreshProgram} disabled={isRefreshing}>{isRefreshing ? '…' : '↻'} <span>{isRefreshing ? 'Yükleniyor' : 'Verileri yenile'}</span></button>
        </section>

        <div className="day-tabs">{['Dün', 'Bugün', 'Yarın'].map(day => <button key={day} className={activeDay === day ? 'day-tab active' : 'day-tab'} onClick={() => setActiveDay(day)}>{day}<small>{day === 'Dün' ? '24 Eyl' : day === 'Bugün' ? '25 Eyl' : '26 Eyl'}</small></button>)}</div>

        <section className="stats-strip">
          <div><span>Toplam koşu</span><strong>8</strong><small>programda</small></div>
          <div><span>Analiz tamamlandı</span><strong>4<span className="muted">/8</span></strong><small>koşu</small></div>
          <div><span>Ortalama güven</span><strong className="green-text">68%</strong><small>model skoru</small></div>
          <div className="track-note"><span>Bugünün notu</span><strong>Sentetik pistte tempo yüksek.</strong><small>· Model bunu hesaba kattı</small></div>
        </section>

        <div className="content-grid">
          <section className="panel races-panel">
            <div className="panel-heading"><div><p className="eyebrow">PROGRAM</p><h2>İstanbul koşuları</h2></div><span className={`live-badge ${dataState.source}`}><i /> {dataState.source === 'live' ? 'CANLI API' : 'DEMO PROGRAM'}</span></div>
            <div className="race-list">{races.map((item, index) => <button key={item.no} onClick={() => setSelectedRace(index)} className={selectedRace === index ? 'race-row selected' : 'race-row'}><span className="race-number">{String(item.no).padStart(2, '0')}</span><span className="race-time">{item.time}</span><span className="race-info"><strong>{item.type}</strong><small>{item.distance} ·  {item.favorites.length + 7} at</small></span><span className="race-favorite"><small>MODEL FAVORİSİ</small><strong>{item.favorite}</strong></span><span className="confidence"><b>{item.confidence}%</b><small>güven</small></span><span className="chevron">›</span></button>)}</div>
            <button className="all-races">Tüm koşu programını gör <span>→</span></button>
          </section>

          <section className="panel analysis-panel">
            <div className="panel-heading"><div><p className="eyebrow">YAPAY ZEKA ANALİZİ</p><h2>{race.no}. koşu detayı</h2></div><span className="analysis-icon">✦</span></div>
            <div className="analysis-hero"><div className="horse-silhouette">♞</div><div><small>MODELİN ÖNE ÇIKARDIĞI</small><h3>{race.favorite}</h3><p>{race.note}</p></div><strong className="big-confidence">{race.confidence}%<small>kazanma<br />olasılığı</small></strong></div>
            <div className="probability"><div className="prob-head"><span>Olasılık dağılımı</span><small>Son form + derece + kilo · AGF hariç</small></div><div className="bar"><span style={{width: `${race.confidence}%`}} /></div><div className="prob-labels"><span><i className="dot green" /> {race.favorite} <b>{race.confidence}%</b></span><span><i className="dot orange" /> {race.favorites[1]} <b>{Math.max(9, race.confidence - 57)}%</b></span><span><i className="dot gray" /> Diğerleri <b>{Math.max(13, 100 - race.confidence - Math.max(9, race.confidence - 57))}%</b></span></div></div>
            <div className="horse-tags">{race.favorites.map((horse, i) => <span key={horse} className={i === 0 ? 'horse-tag preferred' : 'horse-tag'}><b>{i + 1}</b>{horse}</span>)}</div>
            <button className="detail-button">Detaylı analizi aç <span>↗</span></button>
          </section>
        </div>

        <section className="coupon-section"><div className="section-title"><div><p className="eyebrow">AKILLI KUPONLAR</p><h2>Bugün için hazır kombinasyonlar</h2></div><p>Modelin risk ve bütçe dengesine göre oluşturduğu seçenekler</p></div><div className="coupon-grid">{coupons.map((item, index) => <button key={item.name} onClick={() => setSelectedCoupon(index)} className={selectedCoupon === index ? 'coupon-card selected' : 'coupon-card'}><div className="coupon-top"><span className="coupon-tag">{item.tag}</span><span className="coupon-arrow">↗</span></div><h3>{item.name}</h3><p>{item.game} <span>·</span> {item.legs}</p><div className="coupon-bottom"><div><strong>{item.chance}%</strong><small>modelin tutma<br />olasılığı</small></div><span className="cost">{item.cost}</span></div></button>)}</div><div className="coupon-summary"><span className="summary-icon">✓</span><div><strong>{coupon.name} seçildi</strong><small>{coupon.game} · Tahmini kupon tutma olasılığı %{coupon.chance} · {coupon.cost}</small></div><button>Kuponu incele <span>→</span></button></div><div className="disclaimer"><span>ⓘ</span><p>{dataState.message} Bu oranlar geçmiş performans ve model tahminidir; kesin sonuç veya kazanç garantisi değildir.</p><button>Model metodolojisi →</button></div></section>
        <footer><span>HorseRide Intelligence v0.1</span><span>Veri kaynağı: {dataState.source === 'live' ? 'bağlı API' : 'demo veri'} · Sorumlu oyun</span></footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
