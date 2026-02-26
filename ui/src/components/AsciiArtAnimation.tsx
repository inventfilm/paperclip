import { useEffect, useRef } from "react";

const CHARS = "░▒▓█▄▀■□▪▫●○◆◇◈◉★☆✦✧·.";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  life: number;
  maxLife: number;
  phase: number;
}

function measureChar(container: HTMLElement): { w: number; h: number } {
  const span = document.createElement("span");
  span.textContent = "M";
  span.style.cssText =
    "position:absolute;visibility:hidden;white-space:pre;font-size:11px;font-family:monospace;line-height:1;";
  container.appendChild(span);
  const rect = span.getBoundingClientRect();
  container.removeChild(span);
  return { w: rect.width, h: rect.height };
}

export function AsciiArtAnimation() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!preRef.current) return;
    const preEl: HTMLPreElement = preRef.current;

    const charSize = measureChar(preEl);
    let charW = charSize.w;
    let charH = charSize.h;
    let cols = Math.ceil(preEl.clientWidth / charW);
    let rows = Math.ceil(preEl.clientHeight / charH);
    let particles = particlesRef.current;

    function spawnParticle() {
      const edge = Math.random();
      let x: number, y: number, vx: number, vy: number;
      if (edge < 0.5) {
        x = -1;
        y = Math.random() * rows;
        vx = 0.3 + Math.random() * 0.5;
        vy = (Math.random() - 0.5) * 0.2;
      } else {
        x = Math.random() * cols;
        y = rows + 1;
        vx = (Math.random() - 0.5) * 0.2;
        vy = -(0.2 + Math.random() * 0.4);
      }
      const maxLife = 60 + Math.random() * 120;
      particles.push({
        x, y, vx, vy,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        life: 0,
        maxLife,
        phase: Math.random() * Math.PI * 2,
      });
    }

    function render(time: number) {
      const t = time * 0.001;

      // Spawn particles
      const targetCount = Math.floor((cols * rows) / 12);
      while (particles.length < targetCount) {
        spawnParticle();
      }

      // Build grid
      const grid: string[][] = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => " ")
      );
      const opacity: number[][] = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => 0)
      );

      // Background wave pattern
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wave =
            Math.sin(c * 0.08 + t * 0.7 + r * 0.04) *
            Math.sin(r * 0.06 - t * 0.5) *
            Math.cos((c + r) * 0.03 + t * 0.3);
          if (wave > 0.65) {
            grid[r][c] = wave > 0.85 ? "·" : ".";
            opacity[r][c] = Math.min(1, (wave - 0.65) * 3);
          }
        }
      }

      // Update and render particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // Flow field influence
        const angle =
          Math.sin(p.x * 0.05 + t * 0.3) * Math.cos(p.y * 0.07 - t * 0.2) *
          Math.PI;
        p.vx += Math.cos(angle) * 0.02;
        p.vy += Math.sin(angle) * 0.02;

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx;
        p.y += p.vy;

        // Life fade
        const lifeFrac = p.life / p.maxLife;
        const alpha = lifeFrac < 0.1
          ? lifeFrac / 0.1
          : lifeFrac > 0.8
            ? (1 - lifeFrac) / 0.2
            : 1;

        // Remove dead or out-of-bounds particles
        if (
          p.life >= p.maxLife ||
          p.x < -2 || p.x > cols + 2 ||
          p.y < -2 || p.y > rows + 2
        ) {
          particles.splice(i, 1);
          continue;
        }

        const col = Math.round(p.x);
        const row = Math.round(p.y);
        if (row >= 0 && row < rows && col >= 0 && col < cols) {
          if (alpha > opacity[row][col]) {
            // Cycle through characters based on life
            const charIdx = Math.floor(
              (lifeFrac + Math.sin(p.phase + t)) * CHARS.length
            ) % CHARS.length;
            grid[row][col] = CHARS[Math.abs(charIdx)];
            opacity[row][col] = alpha;
          }
        }
      }

      // Render to string
      let output = "";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = opacity[r][c];
          if (a > 0 && grid[r][c] !== " ") {
            const o = Math.round(a * 60 + 40);
            output += `<span style="opacity:${o}%">${grid[r][c]}</span>`;
          } else {
            output += " ";
          }
        }
        if (r < rows - 1) output += "\n";
      }

      preEl.innerHTML = output;
      frameRef.current = requestAnimationFrame(render);
    }

    // Handle resize
    const observer = new ResizeObserver(() => {
      const size = measureChar(preEl);
      charW = size.w;
      charH = size.h;
      cols = Math.ceil(preEl.clientWidth / charW);
      rows = Math.ceil(preEl.clientHeight / charH);
      // Cull out-of-bounds particles on resize
      particles = particles.filter(
        (p) => p.x >= -2 && p.x <= cols + 2 && p.y >= -2 && p.y <= rows + 2
      );
      particlesRef.current = particles;
    });
    observer.observe(preEl);

    frameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <pre
      ref={preRef}
      className="w-full h-full m-0 p-0 overflow-hidden text-muted-foreground/60 select-none leading-none"
      style={{ fontSize: "11px", fontFamily: "monospace" }}
      aria-hidden="true"
    />
  );
}
