import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const STORAGE_KEY = 'mard-demo-v1';
const initialData = { goal: 7, sessions: [], reminderTime: '20:00', reminderEnabled: false, telegramLinked: false, voiceEnabled: true };
const weekdays = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function loadDemoData() {
  try { return { ...initialData, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return { ...initialData }; }
}

function dateKey(date = new Date()) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function getProgress(sessions, goal) {
  const days = new Set(sessions.map((session) => session.date));
  let cursor = new Date();
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { streak, goalProgress: Math.min(streak, goal) };
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat('uz-UZ', options).format(date);
}

function Avatar({ name }) {
  return <div className="avatar">{(name || 'S').slice(0, 1).toUpperCase()}</div>;
}

function SideBar({ view, onNavigate, user, onAccount }) {
  const links = [
    ['home', '◫', 'Umumiy'], ['workout', '↗', 'Mashq'], ['gyms', '⌖', 'Zallar'], ['goals', '◎', 'Maqsadlar'], ['reminders', '◷', 'Eslatmalar'],
  ];
  return <aside className="sidebar">
    <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); onNavigate('home'); }} aria-label="GritMODE bosh sahifa"><span className="brand-mark">G</span><span>Grit<span className="brand-dot">MODE</span></span></a>
    <div className="side-label">MENYU</div>
    <nav className="nav" aria-label="Asosiy menyu">
      {links.map(([key, icon, label]) => <button key={key} className={`nav-item ${view === key ? 'active' : ''}`} onClick={() => onNavigate(key)}><span className="nav-icon">{icon}</span>{label}</button>)}
    </nav>
    <div className="side-bottom">
      <div className="coach-card"><div className="coach-glyph">✳</div><div><b>Harakat qil.</b><small>Bugun ham o‘zing uchun.</small></div></div>
      <div className="profile"><Avatar name={user?.displayName} /><div className="profile-name"><b>{user?.displayName || 'Sportchi'}</b><small>{user ? 'Akkaunt ulangan' : 'Demo rejimi'}</small></div><button className="more" onClick={onAccount}>{user ? 'Chiqish' : 'Kirish'}</button></div>
    </div>
  </aside>;
}

function Dashboard({ data, user, progress, onNavigate }) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sessionsByDate = useMemo(() => new Set(data.sessions.map((session) => session.date)), [data.sessions]);
  const percent = Math.min(100, Math.round((progress.goalProgress / Math.max(data.goal, 1)) * 100));

  return <section className="view active">
    <div className="greeting-row"><div><p className="eyebrow">SENING MAYDONING</p><h1>Salom, {user?.displayName || 'sportchi'}<span className="accent">.</span></h1><p className="subhead">Kichik qadamlar. Katta o‘zgarishlar.</p></div><div className="date-pill">{formatDate(today, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</div></div>
    <div className="hero-card"><div className="hero-copy"><span className="tag"><span className="live-dot" /> BUGUNGI REJA</span><h2>Bugun o‘zingni<br />bir pog‘ona oshir.</h2><p>Bir mashg‘ulot. Bir qadam. Shu yetarli.</p><button className="primary-button" onClick={() => onNavigate('workout')}>Mashqni boshlash <span>↗</span></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="sun" /><div className="art-caption">01 / 07 <span>BUGUNGI QADAM</span></div></div></div>
    <div className="section-heading"><div><p className="eyebrow">SENING NATIJANG</p><h2>Davom etyapsan.</h2></div><button className="text-button" onClick={() => onNavigate('goals')}>Maqsadlarim <span>→</span></button></div>
    <div className="stats-grid">
      <article className="stat-card streak-card"><div className="stat-top"><span className="stat-icon flame">✳</span><span className="stat-label">KETMA-KET KUN</span></div><div className="stat-number"><span>{progress.streak}</span><small>kun</small></div><div className="week-dots">{weekdays.map((day, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return <span className="week-day" key={day}><i className={sessionsByDate.has(dateKey(date)) ? 'done' : ''} />{day}</span>; })}</div><div className="stat-foot">Har bir kun hisob.</div></article>
      <article className="stat-card goal-card"><div className="stat-top"><span className="stat-icon target">◎</span><span className="stat-label">{data.goal} KUNLIK MAQSAD</span></div><div className="progress-head"><b>{progress.goalProgress} / {data.goal}</b><span>{percent}%</span></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="stat-foot">{progress.goalProgress >= data.goal ? 'Maqsad bajarildi. O‘zing bilan faxrlan!' : progress.goalProgress ? 'Yaxshi ketayapsan. Shu ritmni saqla.' : 'Bugun birinchi qadamingni qo‘y.'}</div></article>
      <article className="stat-card session-card"><div className="stat-top"><span className="stat-icon bolt">↗</span><span className="stat-label">MASHG‘ULOTLAR</span></div><div className="stat-number"><span>{data.sessions.length}</span><small>marta</small></div><div className="stat-foot">{user ? 'Akkauntingda saqlanadi.' : 'Bu qurilmada saqlanadi.'}</div></article>
    </div>
    <div className="bottom-grid"><article className="quote-card"><span className="quote-mark">“</span><div><p>Intizom — kayfiyat bo‘lmagan kunda ham o‘zingga bergan va’dangni bajarish.</p><small>BUGUNGI ESLATMA</small></div><span className="quote-spark">✳</span></article><article className="next-card"><div><p className="eyebrow">KEYINGI QADAM</p><h3>Squat bilan<br />boshlaymiz.</h3><button className="text-button" onClick={() => onNavigate('workout')}>Mashq sahifasi <span>→</span></button></div><div className="squat-icon">↧</div></article></div>
    <footer className="footer-note">GritMODE — sening sur’ating, sening yo‘ling. <span>◉</span></footer>
  </section>;
}

function angle(a, b, c) {
  const ab = [a.x - b.x, a.y - b.y];
  const cb = [c.x - b.x, c.y - b.y];
  const magnitude = Math.hypot(...ab) * Math.hypot(...cb);
  if (!magnitude) return 180;
  const dot = ab[0] * cb[0] + ab[1] * cb[1];
  return Math.acos(Math.max(-1, Math.min(1, dot / magnitude))) * (180 / Math.PI);
}

function SquatCamera({ voiceEnabled, onComplete, onToast, onToggleVoice }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const frameRef = useRef(0);
  const lastFrameRef = useRef(-1);
  const isDownRef = useRef(false);
  const repsRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastCueRef = useRef(0);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reps, setReps] = useState(0);
  const [feedback, setFeedback] = useState('Tayyor bo‘lgach, kamerani yoq.');
  const feedbackRef = useRef('Tayyor bo‘lgach, kamerani yoq.');

  const updateFeedback = useCallback((message) => {
    if (feedbackRef.current === message) return;
    feedbackRef.current = message;
    setFeedback(message);
  }, []);

  const speak = useCallback((text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'uz-UZ';
    speech.rate = 0.92;
    window.speechSynthesis.speak(speech);
  }, [voiceEnabled]);

  const drawPose = useCallback((landmarks) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#d0f76a';
    context.lineWidth = Math.max(2, canvas.width / 240);
    context.lineCap = 'round';
    const bones = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32]];
    for (const [from, to] of bones) {
      const first = landmarks[from]; const second = landmarks[to];
      if (!first || !second || (first.visibility ?? 1) < 0.35 || (second.visibility ?? 1) < 0.35) continue;
      context.beginPath(); context.moveTo(first.x * canvas.width, first.y * canvas.height); context.lineTo(second.x * canvas.width, second.y * canvas.height); context.stroke();
    }
    context.fillStyle = '#fb895a';
    for (const index of [11,12,23,24,25,26,27,28]) {
      const point = landmarks[index];
      if (!point || (point.visibility ?? 1) < 0.35) continue;
      context.beginPath(); context.arc(point.x * canvas.width, point.y * canvas.height, Math.max(3, canvas.width / 150), 0, Math.PI * 2); context.fill();
    }
  }, []);

  const trackFrame = useCallback(() => {
    const video = videoRef.current;
    if (!modelRef.current || !video || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(trackFrame);
      return;
    }
    if (video.currentTime !== lastFrameRef.current) {
      lastFrameRef.current = video.currentTime;
      const detected = modelRef.current.detectForVideo(video, performance.now()).landmarks?.[0];
      if (!detected) updateFeedback('Tanani to‘liq ko‘rsatib, yon tomonga tur.');
      else {
        drawPose(detected);
        const legs = [[23,25,27],[24,26,28]].map(([hip, knee, ankle]) => [detected[hip], detected[knee], detected[ankle]])
          .filter((points) => points.every((point) => point && (point.visibility ?? 1) > 0.45));
        if (!legs.length) updateFeedback('Butun tanangni kameraga ko‘rsat.');
        else {
          const kneeAngle = Math.min(...legs.map((points) => angle(...points)));
          const now = performance.now();
          if (kneeAngle < 108 && !isDownRef.current) {
            isDownRef.current = true;
            updateFeedback('Yaxshi, endi sekin tur.');
            if (now - lastCueRef.current > 1700) { speak('Endi sekin turing'); lastCueRef.current = now; }
          } else if (kneeAngle > 155 && isDownRef.current) {
            isDownRef.current = false;
            repsRef.current += 1;
            setReps(repsRef.current);
            updateFeedback('Bir takror bajarildi. Yana davom et.');
            if (now - lastCueRef.current > 1700) { speak('Bir takror bajarildi'); lastCueRef.current = now; }
          } else if (!isDownRef.current && kneeAngle > 150) updateFeedback('Tayyor. Nazorat bilan pastga tush.');
        }
      }
    }
    frameRef.current = requestAnimationFrame(trackFrame);
  }, [drawPose, speak, updateFeedback]);

  const start = async () => {
    if (loading || running) return;
    setLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera uchun HTTPS yoki localhost kerak.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      if (!modelRef.current) {
        const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22');
        const files = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
        const options = { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task', delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.55, minPosePresenceConfidence: 0.55, minTrackingConfidence: 0.5 };
        try { modelRef.current = await vision.PoseLandmarker.createFromOptions(files, options); }
        catch { options.baseOptions.delegate = 'CPU'; modelRef.current = await vision.PoseLandmarker.createFromOptions(files, options); }
      }
      repsRef.current = 0;
      isDownRef.current = false;
      lastFrameRef.current = -1;
      startTimeRef.current = Date.now();
      setReps(0);
      updateFeedback('Yon tomondan turib, boshlashga tayyorlan.');
      setRunning(true);
      frameRef.current = requestAnimationFrame(trackFrame);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      onToast(error.message?.includes('Permission') ? 'Kamera ruxsatini berib, qayta urin.' : 'Kamera yoki AI modeliga ulanib bo‘lmadi. Internet va ruxsatni tekshir.');
    } finally { setLoading(false); }
  };

  const stop = async (save = true) => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (canvasRef.current) canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    if (save && repsRef.current > 0) {
      await onComplete({ reps: repsRef.current, durationSeconds: Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000)) });
      speak('Mashg‘ulot saqlandi. Barakalla!');
    } else if (save) onToast('Sessiya qayd etilmadi — kamida bitta takror bajar.');
    repsRef.current = 0;
    isDownRef.current = false;
  };

  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    modelRef.current?.close?.();
  }, []);

  return <section className="view active">
    <div className="page-heading"><p className="eyebrow">MASHG‘ULOT</p><h1>Bugun squat<span className="accent">.</span></h1><p className="subhead">Telefonni yon tomonga qo‘y. Butun tanang ko‘rinsin.</p></div>
    <div className="workout-layout"><div className="camera-card"><div className="camera-top"><span className="tag"><span className="live-dot" />{running ? 'TANA HOLATI KUZATILYAPTI' : 'KAMERA TAYYOR'}</span><span className="camera-hint">YON TOMONDAN</span></div><div className={`camera-stage ${running ? 'active' : ''}`}><video ref={videoRef} playsInline muted /><canvas ref={canvasRef} /><div className={`camera-placeholder ${running ? 'hidden' : ''}`}><div className="camera-ring">◎</div><b>Kamerani yoqish</b><small>Ruxsat faqat mashq paytida so‘raladi.<br />Video serverga yuborilmaydi.</small></div><div className="camera-overlay"><span>{feedback}</span><b>{String(reps).padStart(2, '0')}</b><small>TAKROR</small></div><div className="camera-guide">SQUAT · 01</div></div><div className="camera-actions">{running ? <button className="secondary-button" onClick={() => void stop(true)}>Tugatish</button> : <button className="primary-button" disabled={loading} onClick={() => void start()}>{loading ? 'Kamera tayyorlanmoqda…' : 'Kamerani yoqish'} <span>↗</span></button>}<button className="ghost-button" onClick={onToggleVoice}>Ovoz: {voiceEnabled ? 'yoqilgan' : 'o‘chiq'}</button></div><p className="camera-disclaimer">Bu demo mashqni to‘liq baholamaydi va tibbiy maslahat bermaydi.</p></div>
      <div className="workout-side"><article className="instruction-card"><p className="eyebrow">QANDAY BAJARISH</p><h3>Squat uchun<br />3 eslatma.</h3><div className="instruction"><span>01</span><p>Oyoqlar yelka kengligida.</p></div><div className="instruction"><span>02</span><p>O‘tirganda gavdani nazorat qil.</p></div><div className="instruction"><span>03</span><p>Shoshilmay boshlang‘ich holatga qayt.</p></div></article><article className="session-card-small"><div className="small-icon">✳</div><div><b>Bugungi sessiya</b><small>{reps ? `${reps} ta takror qayd etildi` : 'Hali boshlanmadi'}</small></div><span className={`session-check ${reps ? 'done' : ''}`}>{reps ? '✓' : '○'}</span></article><button className="secondary-button full" onClick={() => window.dispatchEvent(new CustomEvent('mard:navigate', { detail: 'goals' }))}>Maqsad progressini ko‘rish <span>→</span></button></div>
    </div>
  </section>;
}

function Goals({ data, progress, onSaveGoal }) {
  const [selectedGoal, setSelectedGoal] = useState(data.goal);
  useEffect(() => setSelectedGoal(data.goal), [data.goal]);
  const percent = Math.min(100, Math.round((progress.goalProgress / Math.max(data.goal, 1)) * 100));
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = new Set(data.sessions.map((session) => session.date));

  return <section className="view active"><div className="page-heading"><p className="eyebrow">SENING VA’DANG</p><h1>Maqsadingni belgilagin<span className="accent">.</span></h1><p className="subhead">O‘zingga mos marrani tanla. Qadam-baqadam boramiz.</p></div>
    <div className="goals-layout"><article className="goal-editor"><div className="goal-editor-head"><span className="goal-big-icon">◎</span><div><p className="eyebrow">SHAXSIY MAQSAD</p><h2>Ketma-ket mashq kunlari</h2></div></div><p className="goal-description">Har kuni bajarilgan mashg‘ulot alohida qayd qilinadi. Dam olish kerak bo‘lsa, tanangni tingla — maqsadni o‘zing o‘zgartira olasan.</p><div className="goal-choice-label">NECHA KUNLIK MAQSAD?</div><div className="goal-choices">{[3,7,14,30].map((daysCount) => <button key={daysCount} className={selectedGoal === daysCount ? 'selected' : ''} onClick={() => setSelectedGoal(daysCount)}>{daysCount} kun</button>)}</div><button className="primary-button" onClick={() => void onSaveGoal(selectedGoal)}>Maqsadni saqlash <span>↗</span></button><div className="save-message" aria-live="polite" /></article>
      <article className="goal-progress-card"><div className="progress-ring" style={{ '--progress': `${percent}%` }}><div><b>{progress.goalProgress}</b><small>/ <span>{data.goal}</span> KUN</small></div></div><h3>{progress.goalProgress >= data.goal ? 'Marraga yetding!' : progress.goalProgress ? 'Davom etyapsan.' : 'Boshlashga tayyormisan?'}</h3><p>{progress.goalProgress >= data.goal ? 'Yangi maqsad qo‘yib, davom etishing mumkin.' : 'Birinchi mashg‘uloting progressni boshlaydi.'}</p><div className="calendar-strip">{weekdays.map((day, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return <span key={day} className={`calendar-day ${days.has(dateKey(date)) ? 'done' : ''}`}>{days.has(dateKey(date)) ? '✓' : day}</span>; })}</div></article>
    </div></section>;
}

function Reminders({ data, user, onReminderChange, onTelegram }) {
  return <section className="view active"><div className="page-heading"><p className="eyebrow">O‘Z VAQTIDA</p><h1>Eslatmalar<span className="accent">.</span></h1><p className="subhead">Kichik eslatma — katta va’dangni yodda tutish uchun.</p></div>
    <div className="reminder-layout"><article className="reminder-card"><div className="telegram-badge">➤</div><div className="reminder-copy"><p className="eyebrow">TELEGRAM BOT</p><h2>O‘zing tanlagan vaqtda eslatma ol.</h2><p>Bugun mashg‘ulot qayd etilmagan bo‘lsa, bot senga muloyim eslatadi.</p></div><div className="reminder-settings"><label htmlFor="reminder-time">ESLATMA VAQTI</label><div className="time-row"><input type="time" id="reminder-time" value={data.reminderTime} onChange={(event) => void onReminderChange({ reminderTime: event.target.value })} /><button className={`toggle ${data.reminderEnabled ? 'on' : ''}`} aria-pressed={data.reminderEnabled} onClick={() => void onReminderChange({ reminderEnabled: !data.reminderEnabled })}><span /></button></div><small>{data.reminderEnabled ? `Eslatma ${data.reminderTime} ga belgilandi${user ? '' : ' (demo)'}` : 'Eslatma o‘chiq'}</small></div><button className="primary-button" onClick={() => void onTelegram()}>{data.telegramLinked ? 'Telegram ulangan · uzish' : 'Telegram botni ulash'} <span>↗</span></button><p className="reminder-note">{data.telegramLinked ? 'Bot ulangan. Eslatma yoqilgan bo‘lsa, bugungi mashg‘ulot qayd etilmaganda xabar yuboriladi.' : user ? 'Botni ulab, eslatma ruxsatini bering.' : 'Telegram ulash uchun akkauntga kiring va backendni sozlang.'}</p></article>
      <article className="message-preview"><div className="preview-top"><span className="preview-avatar">G</span><div><b>GritMODE eslatma</b><small>bot · namuna</small></div><span className="preview-time">{data.reminderTime}</span></div><div className="chat-bubble">Bugungi mashg‘uloting hali qayd etilmadi. {data.goal || 7} kunlik maqsadingni davom ettirish uchun qisqa mashq qilishga ulgurasan. 💪<small>Qo‘llab-quvvatlovchi eslatma</small></div><p className="preview-caption">Xabar matni namuna sifatida ko‘rsatilgan.</p></article>
    </div></section>;
}

function Gyms() {
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [radiusKm, setRadiusKm] = useState('5');
  const [sort, setSort] = useState('distance');
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [gymSource, setGymSource] = useState('OpenStreetMap');
  const [gymSearchState, setGymSearchState] = useState('idle');
  const [searchError, setSearchError] = useState('');
  const embedKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY?.trim();
  const googleSearchUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const center = searchedLocation || coordinates;
  const radius = Number(radiusKm);
  const deltaLat = radius / 111;
  const deltaLng = radius / (111 * Math.max(Math.cos((center?.latitude || 41) * Math.PI / 180), 0.2));
  const mapBounds = center ? [center.longitude - deltaLng, center.latitude - deltaLat, center.longitude + deltaLng, center.latitude + deltaLat] : null;
  const mapCenter = center || (gyms[0] ? { latitude: gyms[0].latitude, longitude: gyms[0].longitude } : null);
  const mapUrl = mapCenter && mapBounds
    ? embedKey
      ? `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(embedKey)}&q=${encodeURIComponent(`gyms near ${center.label || location}`)}&center=${mapCenter.latitude},${mapCenter.longitude}&zoom=14`
      : `https://www.openstreetmap.org/export/embed.html?bbox=${mapBounds.join('%2C')}&layer=mapnik&marker=${mapCenter.latitude}%2C${mapCenter.longitude}`
    : '';

  const searchGyms = async (event) => {
    event?.preventDefault();
    if (!location.trim() && !coordinates) {
      setSearchError('Manzilni kiriting yoki joriy lokatsiyani aniqlang.');
      return;
    }
    const controller = new AbortController();
    setGymSearchState('loading');
    setSearchError('');
    setGyms([]);
    try {
      const params = { location: location.trim(), radiusKm, sort };
      if (coordinates) { params.latitude = coordinates.latitude; params.longitude = coordinates.longitude; }
      const result = await api.nearbyGyms(params, controller.signal);
      setGyms(result.gyms || []);
      setGymSource(result.source || 'OpenStreetMap');
      setSearchedLocation(result.location);
      setGymSearchState('ready');
    } catch (error) {
      setSearchError(error.message || 'Qidiruv muvaffaqiyatsiz tugadi.');
      setGymSearchState('error');
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setSearchError('Bu qurilmada lokatsiyani aniqlab bo‘lmadi.'); return; }
    setSearchError('Lokatsiya aniqlanmoqda…');
    navigator.geolocation.getCurrentPosition(({ coords: position }) => {
      setCoordinates({ latitude: position.latitude, longitude: position.longitude, label: 'Joriy lokatsiya' });
      setSearchedLocation(null);
      setLocation('Joriy lokatsiya');
      setSearchError('');
    }, () => setSearchError('Lokatsiya ruxsati berilmadi. Manzilni qo‘lda kiriting.'), { enableHighAccuracy: true, timeout: 10000 });
  };

  return <section className="view active gyms-view">
    <div className="page-heading"><p className="eyebrow">SENGA YAQIN SPORT JOYLARI</p><h1>Yaqin sport zallari<span className="accent">.</span></h1><p className="subhead">Manzilingni kirit — masofa, reyting va zal tafsilotlarini ko‘r.</p></div>
    <div className="gym-finder-layout">
      <article className="gym-map-card">
        <div className="gym-map-head"><div><p className="eyebrow">ANIQ KO‘CHA XARITASI</p><b>{searchedLocation?.label || 'Manzilni kiriting'}</b></div><span className="gym-map-count">{gymSearchState === 'loading' ? 'QIDIRILMOQDA…' : searchedLocation ? `${gyms.length} TA ZAL` : 'LOKATSIYA KUTILMOQDA'}</span></div>
        {mapUrl ? <div className="street-map-stage">
          <iframe title="Yaqin sport zallari xaritasi" src={mapUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          <span className="map-provider-badge">{embedKey ? 'Google Maps' : 'OpenStreetMap'}</span>
          <a className="street-map-open" href={googleSearchUrl(`gyms near ${searchedLocation?.label || location}`)} target="_blank" rel="noreferrer">Google Maps’da ochish ↗</a>
        </div> : <div className="gym-map-empty"><span>⌖</span><b>Lokatsiyani tanlang</b><small>Manzil kiriting yoki joriy joylashuvingizni aniqlang — yaqin zallar xaritada chiqadi.</small></div>}
        <div className="map-legend"><span><i /> Ko‘cha xaritasi</span><span><i className="active-dot" /> Qidiruv markazi</span><span className="map-source">{embedKey ? 'Google Maps' : 'OpenStreetMap'}</span></div>
      </article>
      <aside className="gym-location-card">
        <p className="eyebrow">LOKATSIYA BO‘YICHA QIDIRUV</p>
        <h2>O‘zingga mos zalni top.</h2>
        <form onSubmit={searchGyms} className="gym-search-form">
          <label htmlFor="gym-location">MANZIL</label>
          <div className="gym-location-input"><input id="gym-location" value={location} onChange={(event) => { setLocation(event.target.value); setCoordinates(null); setSearchedLocation(null); }} placeholder="Masalan, Chilonzor, Toshkent" /><button type="button" onClick={useMyLocation} aria-label="Joriy lokatsiyam">⌖</button></div>
          <div className="gym-filter-row"><div><label htmlFor="gym-radius">MASOFA</label><select id="gym-radius" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)}>{['3','5','10','20'].map((km) => <option key={km} value={km}>{km} km</option>)}</select></div><div><label htmlFor="gym-sort">SARALASH</label><select id="gym-sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="distance">Eng yaqin</option><option value="rating">Reytingi yuqori</option></select></div></div>
          <button className="primary-button gym-search-button" disabled={gymSearchState === 'loading'}>{gymSearchState === 'loading' ? 'Qidirilmoqda…' : 'Zallarni qidirish'} <span>⌕</span></button>
        </form>
        {searchError && <p className="gym-search-message" role="status">{searchError}</p>}
        {gymSearchState !== 'idle' && <section className="gym-results" aria-live="polite">
          <div className="gym-results-head"><div><span className="eyebrow">{searchedLocation?.label?.toLocaleUpperCase('uz-UZ') || 'YAQIN ATROF'}</span><h3>{gymSearchState === 'loading' ? 'Zallar qidirilmoqda…' : `${gyms.length} ta zal topildi`}</h3></div><span className="gym-results-pin">⌖</span></div>
          <p className="gym-source-note">Manba: {gymSource}. Reyting Google ma’lumotida bo‘lsa ko‘rsatiladi.</p>
          {gymSearchState === 'loading' && <div className="gym-loading"><i /><i /><i /></div>}
          {gymSearchState === 'ready' && gyms.length === 0 && <p className="gym-search-message">Bu radiusda zal topilmadi. Masofani oshirib ko‘ring.</p>}
          {gyms.length > 0 && <div className="gym-results-list">{gyms.map((gym) => {
            const mapsUrl = gym.mapsUrl || googleSearchUrl(`${gym.name}${gym.address ? `, ${gym.address}` : ''}`);
            return <article className="gym-result" key={gym.id}><span className="gym-result-icon">↗</span><div className="gym-result-content"><div className="gym-result-title"><h4>{gym.name}</h4><span className="gym-rating">{gym.rating ? `★ ${gym.rating.toFixed(1)}` : 'Reyting yo‘q'}{gym.ratingCount ? <small> ({gym.ratingCount})</small> : null}</span></div><p>{gym.address || gym.category}</p><div className="gym-facts"><span>{gym.distanceKm} km</span>{gym.openingHours?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] && <span>{gym.openingHours[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}</span>}</div><div className="gym-links"><a href={mapsUrl} target="_blank" rel="noreferrer">Xaritada ko‘rish ↗</a>{gym.phone && <a href={`tel:${gym.phone}`}>Qo‘ng‘iroq</a>}{gym.website && <a href={gym.website} target="_blank" rel="noreferrer">Sayt</a>}</div></div></article>;
          })}</div>}
          {center && <a className="gym-google-search" href={googleSearchUrl(`gyms near ${searchedLocation?.label || location}`)} target="_blank" rel="noreferrer">Google Maps’da qidirishni ochish <span>↗</span></a>}
        </section>}
      </aside>
    </div>
    <p className="gym-data-note">Ma’lumotlar provayder qamroviga bog‘liq. Google kaliti sozlanmagan bo‘lsa, reyting va ayrim tafsilotlar mavjud bo‘lmasligi mumkin.</p>
  </section>;
}
function AuthDialog({ onClose, onSubmit, onDemo, error, busy }) {
  const [mode, setMode] = useState('login');
  const registering = mode === 'register';
  return <section className="auth-modal" aria-modal="true" role="dialog" aria-labelledby="auth-title"><div className="auth-card"><button className="auth-close" onClick={onClose} aria-label="Yopish">×</button><span className="brand-mark auth-mark">G</span><p className="eyebrow">GRITMODE AKKAUNTI</p><h2 id="auth-title">{registering ? 'Birinchi qadamingni qo‘y.' : 'Maqsadingni saqlab bor.'}</h2><p className="auth-copy">Kirsang, mashg‘ulot va progress boshqa qurilmada ham saqlanadi.</p>
    <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void onSubmit({ mode, displayName: form.get('displayName'), email: form.get('email'), password: form.get('password') }); }}>
      {registering && <><label htmlFor="auth-name">ISM</label><input id="auth-name" name="displayName" autoComplete="name" maxLength="60" placeholder="Ismingiz" required /></>}
      <label htmlFor="auth-email">EMAIL</label><input id="auth-email" name="email" type="email" autoComplete="email" required maxLength="254" placeholder="siz@example.com" />
      <label htmlFor="auth-password">PAROL</label><input id="auth-password" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength="8" maxLength="100" placeholder="Kamida 8 belgi" />
      <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Ulanmoqda…' : registering ? 'Akkaunt yaratish' : 'Kirish'} <span>↗</span></button>
    </form>
    <p className="auth-message" aria-live="polite">{error}</p><button className="auth-switch" onClick={() => setMode(registering ? 'login' : 'register')}>{registering ? 'Akkauntingiz bormi? Kirish' : 'Akkaunt yo‘qmi? Ro‘yxatdan o‘tish'}</button><button className="auth-demo" onClick={onDemo}>Demo rejimida davom etish</button>
  </div></section>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [data, setData] = useState(loadDemoData);
  const [authOpen, setAuthOpen] = useState(() => !getToken());
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [toast, setToast] = useState('');
  const progress = useMemo(() => data.serverProgress
    ? { streak: data.serverProgress.currentStreak, goalProgress: data.serverProgress.goalProgressDays }
    : getProgress(data.sessions, data.goal), [data.serverProgress, data.sessions, data.goal]);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 3000);
  }, []);

  const saveLocal = useCallback((next) => {
    setData((current) => typeof next === 'function' ? next(current) : { ...current, ...next });
  }, []);

  useEffect(() => {
    const { serverProgress: _serverProgress, ...stored } = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [data]);

  const syncFromServer = useCallback(async () => {
    const [profile, goalResult, progressResult, workoutResult, reminderResult] = await Promise.all([
      api.profile(), api.activeGoal(), api.progress(), api.workouts(), api.reminder(),
    ]);
    const sessions = workoutResult.workouts.map((workout) => ({
      date: dateKey(new Date(workout.completedAt)), reps: workout.reps, exercise: workout.exerciseKey, durationSeconds: workout.durationSeconds,
    }));
    setUser(profile);
    setData((current) => {
      const updated = {
        ...current,
        goal: goalResult.goal?.targetDays || 7,
        sessions,
        reminderTime: reminderResult.reminder?.reminderTime || '20:00',
        reminderEnabled: Boolean(reminderResult.reminder?.enabled),
        telegramLinked: Boolean(reminderResult.telegramLinked),
        serverProgress: progressResult,
      };
      const { serverProgress: _serverProgress, ...stored } = updated;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    syncFromServer().catch((error) => {
      setToken(null);
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
      setData({ ...initialData });
      setAuthOpen(true);
      setAuthError(`Akkaunt ma’lumotlari olinmadi: ${error.message}`);
    });
  }, []);

  useEffect(() => {
    const handleNavigation = (event) => setView(event.detail);
    window.addEventListener('mard:navigate', handleNavigation);
    return () => window.removeEventListener('mard:navigate', handleNavigation);
  }, []);

  useEffect(() => {
    const refreshTelegram = async () => {
      if (document.hidden || !getToken()) return;
      try {
        const result = await api.reminder();
        saveLocal({ telegramLinked: Boolean(result.telegramLinked) });
      } catch { /* Keep the current state if the API is temporarily offline. */ }
    };
    document.addEventListener('visibilitychange', refreshTelegram);
    return () => document.removeEventListener('visibilitychange', refreshTelegram);
  }, [saveLocal]);

  const authenticate = async ({ mode, displayName, email, password }) => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const result = mode === 'register'
        ? await api.register({ displayName, email, password })
        : await api.login({ email, password });
      setToken(result.token);
      await syncFromServer();
      setAuthOpen(false);
      notify('Akkauntga muvaffaqiyatli kirdingiz.');
    } catch (error) {
      setToken(null);
      setAuthError(error.message);
    } finally { setAuthBusy(false); }
  };

  const saveGoal = async (targetDays) => {
    if (getToken()) {
      try {
        await api.saveGoal({ targetDays, title: `${targetDays} kunlik maqsad` });
        await syncFromServer();
        notify(`${targetDays} kunlik maqsad saqlandi.`);
      } catch (error) { notify(error.message); }
      return;
    }
    saveLocal({ goal: targetDays });
    notify(`Demo rejimida ${targetDays} kunlik maqsad saqlandi.`);
  };

  const saveWorkout = async ({ reps, durationSeconds }) => {
    const session = { date: dateKey(), reps, durationSeconds, exercise: 'squat' };
    if (getToken()) {
      try {
        await api.saveWorkout({ exerciseKey: 'squat', reps, durationSeconds, source: 'camera' });
        await syncFromServer();
        notify(`${reps} ta squat serverga saqlandi. Barakalla!`);
      } catch (error) {
        saveLocal((current) => ({ ...current, sessions: [...current.sessions, session] }));
        notify(`Qurilmada saqlandi, serverga yuborilmadi: ${error.message}`);
      }
      return;
    }
    saveLocal((current) => ({ ...current, sessions: [...current.sessions, session] }));
    notify(`${reps} ta squat qayd etildi (demo). Barakalla!`);
  };

  const updateReminder = async (changes) => {
    const previous = data;
    const updated = { ...data, ...changes };
    saveLocal(updated);
    if (!getToken()) { notify('Demo rejimida saqlandi. Real eslatma uchun akkaunt kerak.'); return; }
    try {
      await api.saveReminder({
        enabled: updated.reminderEnabled,
        reminderTime: updated.reminderTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tashkent',
      });
      notify('Eslatma sozlamasi saqlandi.');
    } catch (error) {
      saveLocal(previous);
      notify(error.message);
    }
  };

  const connectTelegram = async () => {
    if (!getToken()) { setAuthOpen(true); return; }
    if (data.telegramLinked) {
      try { await api.unlinkTelegram(); saveLocal({ telegramLinked: false }); notify('Telegram akkauntdan uzildi.'); }
      catch (error) { notify(error.message); }
      return;
    }
    const telegramWindow = window.open('about:blank', '_blank');
    try {
      const result = await api.createTelegramLink();
      if (telegramWindow) telegramWindow.location.href = result.link;
      else window.location.assign(result.link);
      notify('Telegram’da Start tugmasini bosing, keyin GritMODE’ga qayting.');
    } catch (error) { telegramWindow?.close(); notify(error.message); }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setData({ ...initialData });
    setAuthOpen(true);
    notify('Akkauntdan chiqdingiz.');
  };

  const navigate = (nextView) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return <div className="shell">
    <SideBar view={view} onNavigate={navigate} user={user} onAccount={() => user ? logout() : setAuthOpen(true)} />
    <main className="main">
      <header className="topbar"><button className="mobile-brand" onClick={() => navigate('home')}><span className="brand-mark">G</span> Grit<span className="brand-dot">MODE</span></button><div className="top-date"><span className="live-dot" />{formatDate(new Date(), { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()}</div><button className="account-mobile" onClick={() => user ? logout() : setAuthOpen(true)}>{user ? 'Chiqish' : 'Kirish'}</button><button className="icon-button" onClick={() => navigate('reminders')} aria-label="Eslatmalar">♧<i className={data.reminderEnabled ? 'on' : ''} /></button></header>
      {view === 'home' && <Dashboard data={data} user={user} progress={progress} onNavigate={navigate} />}
      {view === 'workout' && <SquatCamera voiceEnabled={data.voiceEnabled} onToggleVoice={() => saveLocal({ voiceEnabled: !data.voiceEnabled })} onComplete={saveWorkout} onToast={notify} />}
      {view === 'goals' && <Goals data={data} progress={progress} onSaveGoal={saveGoal} />}
      {view === 'reminders' && <Reminders data={data} user={user} onReminderChange={updateReminder} onTelegram={connectTelegram} />}
      {view === 'gyms' && <Gyms />}
    </main>
    <nav className="mobile-nav" aria-label="Asosiy bo‘limlar">
      {[['home', '◫', 'Umumiy'], ['workout', '↗', 'Mashq'], ['gyms', '⌖', 'Zallar'], ['goals', '◎', 'Maqsad'], ['reminders', '◷', 'Eslatma']].map(([key, icon, label]) => <button key={key} className={view === key ? 'active' : ''} onClick={() => navigate(key)}><span>{icon}</span>{label}</button>)}
    </nav>
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onSubmit={authenticate} onDemo={() => setAuthOpen(false)} error={authError} busy={authBusy} />}
    <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{toast}</div>
  </div>;
}
