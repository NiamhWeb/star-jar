import { useState, useEffect, useRef } from 'react';
import './App.css';
import Jar from './Jar';
import SmallJar from './SmallJar';
import { StarIcon, REF_W } from './Star';

const BASE = import.meta.env.BASE_URL; 

const BIG_LEFT = [
  [0.170, 0.078],
  [0.085, 0.144],
  [0.011, 0.277],
  [0.013, 0.646],
  [0.030, 0.889],
  [0.235, 0.984],
  [0.502, 0.995],
];

//if change to small jar to a boundry one
// const SMALL_LEFT = [
//   [0.084, 0.071],
//   [0.072, 0.147],
//   [0.020, 0.257],
//   [0.018, 0.807],
//   [0.100, 0.930],
//   [0.263, 0.973],
//   [0.482, 0.983],
// ];

const STORAGE_KEY = 'starV1'

const fmt = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;

function inside(el, x, y) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { total: 0, log : [], stars: [], ...JSON.parse(raw) };
  } catch { }
  return { total: 0, log : [], stars: [] }
}

const saved = loadSaved()

export default function App() {
  const [log, setLog] = useState(saved.log);
  const [stars, setStars] = useState(saved.stars);
  const total = stars.reduce((sum, m) => sum + m, 0);
  const [ghost, setGhost] = useState(null);
  const dragRef = useRef(null);
  const bigJar = useRef(null);
  const bigBox = useRef(null);
  const smallBox = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ total, log, stars }))
    } catch { }
  }, [total, log, stars]);

  function change(minutes) {
    // setTotal((t) => t + minutes);
    // localStorage.setItem()
    setLog((l) => [...l, { time: Date.now(), minutes, note: '' }]);
  }
  function startDrag(type, e, from) {
    dragRef.current = { type, from };
    setGhost({ type, x: e.clientX, y: e.clientY });
  }

  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = bigBox.current;
    if (!el) return;
    const update = () => setScale(el.getBoundingClientRect().width / REF_W);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  const dragging = ghost !== null;
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('dragging'); 
    function onMove(e) {
      setGhost((g) => g && {...g, x: e.clientX, y: e.clientY });
    }

    function onUp(e) {
      if (!dragRef.current) return;
      const { type, from } = dragRef.current;
      const overBig = inside(bigBox.current, e.clientX, e.clientY);
      
      if (from === 'small' && overBig) {
        bigJar.current.addStar(type);
        change(+type.minutes);
      } else if (from === 'big') {
        if (overBig) bigJar.current.addStar(type);
        else change(-type.minutes);
      }
      dragRef.current = null;
      setGhost(null);
    }
    
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      document.body.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);
  return (
    <>
      <h1>Time Tracker</h1>
      <div id="scene">
        <div>
          <SmallJar src={`${BASE}assets/small-jar.svg`} onGrab={startDrag} scale={scale} />
        </div>
        <div id="total">{fmt(total)} available </div>
        <div ref={bigBox}>
          <Jar ref={bigJar} className="jar-big" src={`${BASE}/assets/thick-jar.svg`} 
          leftSide={BIG_LEFT} onGrab={startDrag} 
          initialStars={saved.stars} onStarsChange={setStars}/>
        </div>
      </div>
      {ghost && (
        <div className="ghost" style={{ left: ghost.x, top: ghost.y }}>
          <StarIcon color={ghost.type.color} size={ghost.type.radius * 2 * scale} />
        </div>
      )}
    </>
  );
}