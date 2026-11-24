import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Matter from 'matter-js';
import { REF_W, starSvg } from './Star';
import { STAR_TYPES } from './stars';

const { Engine, Render, Runner, Bodies, Composite, Query } = Matter;

const TEX = 300;

const textureCache = {};
function starTexture(color) {
  if (!textureCache[color]) { 
    textureCache[color] = 'data:image/svg+xml;utf8,' + encodeURIComponent(starSvg(color, TEX));
  }
  return textureCache[color];
}

function wallFromPoints(points, W, H, thickness = 24) {
  const walls = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = [points[i][0] * W, points[i][1] * H];
    const [x2, y2] = [points[i + 1][0] * W, points[i + 1][1] * H];
    const len = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    walls.push(
      Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len + 4, thickness, {
        isStatic: true,
        angle,
        render: { visible: false }
      })
    );
  }
  return walls;
}

const Jar = forwardRef(function Jar({ className, src, leftSide, onGrab, onStarsChange, initialStars = [], debug = false }, ref) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const onGrabRef = useRef(null);
  onGrabRef.current = onGrab;
  const sizeRef = useRef({ W: 0, H: 0 });
  const onStarsChangeRef = useRef(null);
  onStarsChangeRef.current = onStarsChange
  const starRef = useRef(null);
  const nextId = useRef(1);

  if (starRef.current === null) {
    starRef.current = new Map();
    for (const m of initialStars) {
      const type = STAR_TYPES.find((t) => t.minutes === m);
      if (!type) continue;
      const id = nextId.current++;
      starRef.current.set(id, { id, type });
    }
  }

  function reportStars() {
    onStarsChangeRef.current?.([...starRef.current.values()].map((s) => s.type.minutes));
  }

  function spawnBody(star, preferredFx = 0.5) {
    if (!starRef.current.has(star.id)) return;
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const { type } = star;
    const { W, H } = sizeRef.current;
    
    const scale = W / REF_W;
    const r = type.radius * scale;
    const mouthLeft = leftSide[0][0];
    const margin = r / W;
    const fx = Math.min(Math.max(preferredFx, mouthLeft + margin), 1 - mouthLeft - margin);
    const body = Bodies.circle(
      fx * W,
      leftSide[0][1] * H + r,
      r * 0.85,
      {
        restitution: 0.3,
        friction: 0.1,
        render: {
          sprite: {
            texture: starTexture(type.color),
            xScale: (r * 2) / TEX, 
            yScale: (r * 2) / TEX,
          },
        },
      }
    );
    body.starType = type;
    body.starId = star.id;
    Composite.add(engine.world, body);
  }

  useImperativeHandle(ref, () => ({
    addStar(type, preferredFx = 0.5) {
      const star = { id: nextId.current++, type };
      starRef.current.set(star.id, star);
      spawnBody(star, preferredFx);
      reportStars();
    },
    clearStars() {
      const engine = engineRef.current;
      if (engine) {
        const bodies = Composite.allBodies(engine.world).filter((b) => b.starType);
        Composite.remove(engine.world, bodies);
      }
      starRef.current.clear();
      reportStars();
    }
  }), [leftSide]);
  
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const rightSide = leftSide.map(([x, y]) => [1 - x, y]).reverse();
    const outline = [...leftSide, ...rightSide.slice(1)];

    let engine, render, runner;

    function teardown() {
      if (render) Render.stop(render);
      if (runner) Runner.stop(runner);
      if (engine) {
        Composite.clear(engine.world, false);
        Engine.clear(engine);
      }
      engine = render = runner = null;
      engineRef.current = null;
    }

    function build() {
      teardown();
      const W = img.clientWidth;
      const H = img.clientHeight;
      sizeRef.current = { W, H };
      if (!W || !H) return;            // image not loaded yet
      canvas.width = W;
      canvas.height = H;

      engine = Engine.create();
      engineRef.current = engine;
      Composite.add(engine.world, wallFromPoints(outline, W, H));

      render = Render.create({
        canvas,
        engine,
        options: {
          width: W,
          height: H,
          pixelRatio: 'auto',
          wireframes: false,
          background: 'transparent',
          wireframeBackground: 'transparent',
        },
      });
      Render.run(render);
      runner = Runner.create();
      Runner.run(runner, engine);
      for (const star of starRef.current.values()){
        spawnBody(star, 0.3 + Math.random() * 0.3);
      }
    }

    function onPointerDown(e) {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (debug) {
        console.log(`[${(x / r.width).toFixed(3)}, ${(y / r.height).toFixed(3)}],`);
        return;
      }
      if (!engine) return;
      const stars = Composite.allBodies(engineRef.current.world).filter((b) => b.starType)
      const hit = Query.point(stars, { x, y})[0];
      if (!hit) return;
      Composite.remove(engineRef.current.world, hit);
      starRef.current.delete(hit.starId);
      reportStars();
      onGrabRef.current(hit.starType, e, 'big');
    }

    function onPointerMove(e) {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (debug || !engine) return;
      const stars = Composite.allBodies(engineRef.current.world).filter((b) => b.starType)
      canvas.style.cursor = Query.point(stars, { x, y }).length ? 'grab' : 'default';
    }

    // Fires when the image loads AND whenever its size changes,
    // so the walls are rebuilt to match the jar.
    const ro = new ResizeObserver(build);
    ro.observe(img);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      teardown();
    };
  }, [src, leftSide, debug]);

  return (
    <div className={`jar-wrap ${className}`}>
      <img ref={imgRef} draggable={false} src={src} alt="" />
      <canvas ref={canvasRef} />
    </div>
  );
});

export default Jar;