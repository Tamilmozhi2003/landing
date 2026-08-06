import React, { useEffect, useRef, useState } from 'react';
import './Home.css';
import AOS from 'aos';
import 'aos/dist/aos.css';
import {
  Sparkles,
  Droplets,
  Leaf,
  ShieldCheck,
  Star,
  ShoppingBag,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Zap,
  Award,
  Heart,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

import profusionImg from '../assets/images/profusion.png';
import gooseberryImg from '../assets/images/goose1.png';

// Dynamically import all frame image URLs from src/assets/frame
const frameModules = import.meta.glob('../assets/frame/frame_*.png', {
  eager: true,
  import: 'default'
});

// Sort keys numerically to ensure frame_001.png to frame_051.png are in perfect chronological order
const sortedFrameUrls = Object.keys(frameModules)
  .sort((a, b) => {
    const numA = parseInt(a.match(/frame_(\d+)\.png/)[1], 10);
    const numB = parseInt(b.match(/frame_(\d+)\.png/)[1], 10);
    return numA - numB;
  })
  .map((key) => frameModules[key]);

const TOTAL_FRAMES = sortedFrameUrls.length;

const ORBIT_INGREDIENTS = [
  {
    id: 'amla',
    name: 'Vitamin C (Amla)',
    desc: 'Cold-pressed Gooseberry',
    icon: Leaf,
    color: '#10b981',
    img: gooseberryImg
  },
  {
    id: 'keratin',
    name: 'Hydrolyzed Keratin',
    desc: 'Micro-peptide bond repair',
    icon: Zap,
    color: '#06b6d4'
  },
  {
    id: 'biotin',
    name: 'Pure Biotin B7',
    desc: 'Follicle density booster',
    icon: Sparkles,
    color: '#e6c669'
  },
  {
    id: 'rosemary',
    name: 'Wild Rosemary',
    desc: 'Scalp micro-soothing oil',
    icon: Droplets,
    color: '#34d399'
  },
  {
    id: 'aloe',
    name: 'Aloe Vera Extract',
    desc: 'Intense moisture lock',
    icon: Heart,
    color: '#38bdf8'
  },
  {
    id: 'vit_e',
    name: 'Vitamin E Complex',
    desc: 'Antioxidant defense barrier',
    icon: ShieldCheck,
    color: '#a855f7'
  }
];

export default function Home() {
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedSize, setSelectedSize] = useState('350ml');
  const [toastMessage, setToastMessage] = useState(null);

  // Zoom mode: 'cover' (Full Widescreen Desktop View clearly) or 'contain' (100% Fit)
  const [zoomMode, setZoomMode] = useState('cover');
  const zoomModeRef = useRef('cover');

  // Parallax section progress state
  const [parallaxProgress, setParallaxProgress] = useState(0);

  const containerRef = useRef(null);
  const parallaxRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);

  // Lerp progress refs for physics inertia
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const currentRawFrameRef = useRef(0);

  const targetParallaxRef = useRef(0);
  const currentParallaxRef = useRef(0);

  const animLoopIdRef = useRef(null);

  // Initialize AOS (Animate On Scroll)
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      offset: 80,
      once: false
    });
    setTimeout(() => {
      AOS.refresh();
    }, 500);
  }, []);

  // 1. Preload all 51 frames into memory
  useEffect(() => {
    let loaded = 0;
    const imgArray = [];

    sortedFrameUrls.forEach((url, idx) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        loaded++;
        setLoadedCount(loaded);
        if (loaded === TOTAL_FRAMES) {
          setTimeout(() => setIsLoaded(true), 200);
        }
      };
      img.onerror = () => {
        loaded++;
        setLoadedCount(loaded);
        if (loaded === TOTAL_FRAMES) {
          setTimeout(() => setIsLoaded(true), 200);
        }
      };
      imgArray[idx] = img;
    });

    imagesRef.current = imgArray;
  }, []);

  // 2. Sub-Frame Canvas Renderer
  const renderSubFrame = (rawFrameIndex) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const total = TOTAL_FRAMES - 1;
    const clampedRaw = Math.max(0, Math.min(total, rawFrameIndex));
    const floorIndex = Math.floor(clampedRaw);
    const ceilIndex = Math.min(total, floorIndex + 1);
    const fraction = clampedRaw - floorIndex;

    const imgBase = imagesRef.current[floorIndex];
    const imgNext = imagesRef.current[ceilIndex];

    if (!imgBase || !imgBase.complete || imgBase.naturalWidth === 0) return;

    // Use device pixel ratio with minimum 2.0 multiplier for ultra-crisp desktop rendering
    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();

    const targetCanvasW = Math.round(rect.width * dpr);
    const targetCanvasH = Math.round(rect.height * dpr);

    if (canvas.width !== targetCanvasW || canvas.height !== targetCanvasH) {
      canvas.width = targetCanvasW;
      canvas.height = targetCanvasH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const imgAspect = imgBase.naturalWidth / imgBase.naturalHeight;
    const containerAspect = rect.width / rect.height;

    let renderW, renderH, offsetX, offsetY;
    const currentMode = zoomModeRef.current || 'cover';

    if (currentMode === 'contain') {
      // Contain mode: 100% full fit without cropping or artificial 0.88 downscaling
      if (containerAspect > imgAspect) {
        renderH = rect.height;
        renderW = renderH * imgAspect;
      } else {
        renderW = rect.width;
        renderH = renderW / imgAspect;
      }
      offsetX = (rect.width - renderW) / 2;
      offsetY = (rect.height - renderH) / 2;
    } else {
      // Cover mode: Full Desktop Edge-to-Edge Widescreen view clearly
      if (containerAspect > imgAspect) {
        renderW = rect.width;
        renderH = rect.width / imgAspect;
        offsetX = 0;
        offsetY = (rect.height - renderH) / 2;
      } else {
        renderH = rect.height;
        renderW = rect.height * imgAspect;
        offsetX = (rect.width - renderW) / 2;
        offsetY = 0;
      }
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.globalAlpha = 1.0;
    ctx.drawImage(imgBase, offsetX, offsetY, renderW, renderH);

    if (fraction > 0.001 && imgNext && imgNext.complete && imgNext.naturalWidth > 0) {
      ctx.globalAlpha = fraction;
      ctx.drawImage(imgNext, offsetX, offsetY, renderW, renderH);
    }

    ctx.restore();
  };

  // 3. Handle window resize
  useEffect(() => {
    const handleResize = () => {
      renderSubFrame(currentRawFrameRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 4. Scroll progress calculation for Hero & Parallax sections
  useEffect(() => {
    if (!isLoaded) return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Hero Container Progress
      if (containerRef.current) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const totalScrollable = rect.height - window.innerHeight;

        if (totalScrollable > 0) {
          const currentScroll = -rect.top;
          const progress = Math.max(0, Math.min(1, currentScroll / totalScrollable));
          targetProgressRef.current = progress;
        }
      }

      // Parallax Showcase Progress
      if (parallaxRef.current) {
        const pContainer = parallaxRef.current;
        const pRect = pContainer.getBoundingClientRect();
        const pTotal = pRect.height - window.innerHeight;

        if (pTotal > 0) {
          let pProgress = 0;
          if (pRect.top > 0 && pRect.top < window.innerHeight) {
            // Smooth entry phase as parallax section scrolls into view from bottom
            const entryRatio = (window.innerHeight - pRect.top) / window.innerHeight;
            pProgress = entryRatio * 0.15;
          } else if (pRect.top <= 0) {
            // Pinned phase as user scrolls through sticky viewport
            const pinnedRatio = Math.max(0, Math.min(1, -pRect.top / pTotal));
            pProgress = 0.15 + pinnedRatio * 0.85;
          }
          targetParallaxRef.current = pProgress;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoaded]);

  // 5. Continuous 60 FPS Lerp Loop
  useEffect(() => {
    if (!isLoaded) return;

    let isActive = true;

    const lerpLoop = () => {
      if (!isActive) return;

      // Hero lerp
      const diff = targetProgressRef.current - currentProgressRef.current;
      if (Math.abs(diff) > 0.00005) {
        currentProgressRef.current += diff * 0.065;
      } else {
        currentProgressRef.current = targetProgressRef.current;
      }

      const p = currentProgressRef.current;
      setScrollProgress(p);

      const rawFrame = p * (TOTAL_FRAMES - 1);
      currentRawFrameRef.current = rawFrame;

      const displayFrameInt = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.round(rawFrame))
      );

      setCurrentFrameIndex(displayFrameInt);
      renderSubFrame(rawFrame);

      // Parallax lerp
      const pDiff = targetParallaxRef.current - currentParallaxRef.current;
      if (Math.abs(pDiff) > 0.00005) {
        currentParallaxRef.current += pDiff * 0.07;
      } else {
        currentParallaxRef.current = targetParallaxRef.current;
      }

      setParallaxProgress(currentParallaxRef.current);

      animLoopIdRef.current = requestAnimationFrame(lerpLoop);
    };

    animLoopIdRef.current = requestAnimationFrame(lerpLoop);

    return () => {
      isActive = false;
      if (animLoopIdRef.current) cancelAnimationFrame(animLoopIdRef.current);
    };
  }, [isLoaded]);

  const handleAddToCart = () => {
    setToastMessage(`Added ProFusion Shampoo (${selectedSize}) to your bag!`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Parallax phase calculations
  const isOrbitPhase = parallaxProgress <= 0.48;
  const orbitFactor = Math.min(1, parallaxProgress / 0.48);
  const handFactor = Math.max(0, (parallaxProgress - 0.48) / 0.52);

  // Orbit radius expand from 150px to 280px
  const currentRadius = 150 + orbitFactor * 130;
  // Rotation angle in degrees
  const rotationDeg = orbitFactor * 180;

  return (
    <div className="landing-page-root">
      {/* ---------------- Preloader ---------------- */}
      <div className={`preloader ${isLoaded ? 'fade-out' : ''}`}>
        <div className="preloader-brand">
          <Sparkles className="preloader-logo-icon" />
          <div className="preloader-title">PROFUSION</div>
        </div>
        <div className="preloader-bar-bg">
          <div
            className="preloader-bar-fill"
            style={{ width: `${Math.round((loadedCount / TOTAL_FRAMES) * 100)}%` }}
          />
        </div>
        <div className="preloader-text">
          Loading Cinematic Experience ({loadedCount} / {TOTAL_FRAMES})
        </div>
      </div>

      {/* Top Fixed Progress Line */}
      <div
        className="scroll-progress-line"
        style={{ width: `${scrollProgress * 100}%` }}
      />

      {/* ---------------- Navbar ---------------- */}
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <a href="#hero" className="nav-brand">
          <Sparkles className="nav-logo" />
          <span className="nav-brand-text">
            ProFusion <span>Professional</span>
          </span>
        </a>

        <ul className="nav-links">
          <li>
            <a href="/#" className="nav-link">
              Ingredient Orbit
            </a>
          </li>
          <li>
            <a href="/#" className="nav-link">
              Key Benefits
            </a>
          </li>
          <li>
            <a href="/#" className="nav-link">
              Formula & Science
            </a>
          </li>
          <li>
            <a href="/#" className="nav-link">
              Product
            </a>
          </li>
          <li>
            <a href="#" className="nav-link">
              Reviews
            </a>
          </li>
        </ul>

        <div className="nav-actions">
          <a href="#shop" className="btn-primary btn-gold">
            <ShoppingBag size={16} /> Order Now
          </a>
        </div>
      </nav>

      {/* ---------------- Hero Sticky Frame Scroll Section ---------------- */}
      <div id="hero" className="scroll-hero-container" ref={containerRef}>
        <div className="sticky-canvas-wrapper">
          <canvas ref={canvasRef} className="cinematic-canvas" />

          {/* Ambient Lighting Overlay & Bottom Vignette Gradient */}
          <div className="hero-ambient-glow" />
          <div className="canvas-bottom-vignette" />

          
          {/* Floating Story Cards */}
          <div className="story-cards-container">
            {/* Card 1: Nature / Gooseberry (Frames 0 - 15) */}
            <div
              className={`story-card left-aligned ${
                scrollProgress >= 0.01 && scrollProgress <= 0.28 ? 'active' : ''
              }`}
            >
              <div className="story-tag">
                <Leaf size={14} /> Stage 1 — Pure Origin
              </div>
              <h2 className="story-title">Harvested From Organic Gooseberry</h2>
              <p className="story-desc">
                Handpicked Indian Amla packed with potent Vitamin C & bio-active polyphenol
                antioxidants to revive idle hair follicles and strengthen roots.
              </p>
              <div className="story-features">
                <div className="story-feature-item">
                  <CheckCircle2 className="feature-check-icon" />
                  100% Organic Cold-Pressed Extract
                </div>
                <div className="story-feature-item">
                  <CheckCircle2 className="feature-check-icon" />
                  Nourishes Scalp & Prevents Premature Graying
                </div>
              </div>
            </div>

            {/* Card 2: Science & Laboratory Extraction (Frames 18 - 36) */}
            <div
              className={`story-card right-aligned ${
                scrollProgress >= 0.35 && scrollProgress <= 0.65 ? 'active' : ''
              }`}
            >
              <div className="story-tag gold">
                <Zap size={14} /> Stage 2 — Scientific Fusion
              </div>
              <h2 className="story-title">Keratin + Biotin Deep Repair Formula</h2>
              <p className="story-desc">
                State-of-the-art laboratory synthesis infuses natural herbal elixirs directly
                into damaged hair cuticles for 10x structural reinforcement.
              </p>
              <div className="story-features">
                <div className="story-feature-item">
                  <CheckCircle2 className="feature-check-icon" />
                  Hydrolyzed Keratin Rebuilds Fiber Bond
                </div>
                <div className="story-feature-item">
                  <CheckCircle2 className="feature-check-icon" />
                  Biotin Complex Accelerates Dense Growth
                </div>
              </div>
            </div>

            {/* Card 3: ProFusion Professional Reveal (Frames 40 - 50) */}
            <div
              className={`story-card left-aligned ${
                scrollProgress >= 0.72 && scrollProgress <= 0.98 ? 'active' : ''
              }`}
            >
              <div className="story-tag">
                <Award size={14} /> Stage 3 — Salon Perfection
              </div>
              <h2 className="story-title">ProFusion Professional Shampoo</h2>
              <p className="story-desc">
                The ultimate transformation. Experience silky smooth, deeply repaired, and
                radiantly glossy hair from the very first wash.
              </p>
              <div className="story-features" style={{ marginBottom: '20px' }}>
                <div className="story-feature-item">
                  <CheckCircle2 className="feature-check-icon" />
                  Sulfate-Free & Paraben-Free Clean Care
                </div>
                <div className="story-feature-item">
                  <CheckCircle2 className="feature-check-icon" />
                  Color Safe & Suitable For All Hair Types
                </div>
              </div>
              <a href="#shop" className="btn-primary btn-gold" style={{ width: '100%', justifyContent: 'center' }}>
                Explore Product Details <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- STICKY PARALLAX INGREDIENT ORBIT & NOURISHMENT SECTION ---------------- */}
      <div id="parallax-section" className="parallax-hero-section" ref={parallaxRef}>
        <div className="parallax-sticky-viewport">
          
          {/* Header Title */}
          <div className="parallax-header-box">
            <span className="section-subtitle">
              {isOrbitPhase ? 'PHASE 1 — INGREDIENT HARMONY' : 'PHASE 2 — PALM RESTING NOURISHMENT'}
            </span>
            <h2 className="parallax-section-title">
              {isOrbitPhase
                ? 'Nourishing Active Matrix'
                : 'Formulated to Hold Pure Restorative Power'}
            </h2>
          </div>

          {/* Center Stage Container */}
          <div className="parallax-center-stage">
            
            {/* 1. Orbit Ingredient Badges (Phase 1) */}
            <div
              className="ingredient-orbit-container"
              style={{
                opacity: isOrbitPhase ? Math.min(1, orbitFactor * 2.5) : Math.max(0, 1 - (parallaxProgress - 0.5) * 4),
                pointerEvents: isOrbitPhase ? 'auto' : 'none'
              }}
            >
              {ORBIT_INGREDIENTS.map((item, idx) => {
                const baseAngle = idx * (360 / ORBIT_INGREDIENTS.length);
                const currentAngle = baseAngle + rotationDeg;
                const rad = (currentAngle * Math.PI) / 180;
                const x = Math.cos(rad) * currentRadius;
                const y = Math.sin(rad) * currentRadius;

                const IconComponent = item.icon;

                return (
                  <div
                    key={item.id}
                    className="orbit-node-badge"
                    style={{
                      transform: `translate(${x}px, ${y}px) scale(${0.88 + orbitFactor * 0.2})`,
                      borderColor: item.color,
                      boxShadow: `0 0 25px ${item.color}40`
                    }}
                  >
                    <div className="orbit-icon-circle" style={{ background: `${item.color}20` }}>
                      {item.img ? (
                        <img src={item.img} alt={item.name} className="orbit-img-thumb" />
                      ) : (
                        <IconComponent size={20} color={item.color} />
                      )}
                    </div>
                    <div className="orbit-node-text">
                      <div className="orbit-node-title" style={{ color: item.color }}>
                        {item.name}
                      </div>
                      <div className="orbit-node-desc">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Hand Palm Foundation (Phase 2 - Slides up to cradle bottle base) */}
            <div
              className="hand-palm-container"
              style={{
                opacity: Math.min(1, handFactor * 3),
                transform: `translate(-50%, ${(1 - handFactor) * 50}px)`
              }}
            >
              <div className="hand-palm-graphic">
                <svg viewBox="0 0 500 250" className="hand-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M50 240 C120 180, 180 150, 250 150 C320 150, 380 180, 450 240 L480 260 L20 260 Z"
                    fill="url(#handGlow)"
                    opacity="0.35"
                  />
                  <defs>
                    <linearGradient id="handGlow" x1="250" y1="150" x2="250" y2="260" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#10b981" stopOpacity="0.6" />
                      <stop offset="1" stopColor="#e6c669" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="hand-cradle-glow"></div>
              </div>
            </div>

            {/* 3. Dynamic Parallax Moving Bottle Centerpiece */}
            <div
              className="parallax-bottle-wrapper"
              style={{
                transform: `scale(${0.95 + parallaxProgress * 0.1})`
              }}
            >
              <div className="bottle-cradle-glow" />
              <img
                src={profusionImg}
                alt="ProFusion Parallax Bottle"
                className="parallax-bottle-img"
              />
              <div className="parallax-bottle-shadow" />
            </div>

            {/* 4. Side Benefit Cards (Phase 2 - Fade in alongside hand resting bottle) */}
            <div
              className="hand-benefits-overlay"
              style={{
                opacity: Math.min(1, Math.max(0, (handFactor - 0.1) * 2.5)),
                pointerEvents: handFactor > 0.3 ? 'auto' : 'none'
              }}
            >
              <div className="hand-benefit-card card-left">
                <div className="hand-card-icon-box cyan">
                  <Droplets size={20} color="#06b6d4" />
                </div>
                <div>
                  <h4>Deep Hydration</h4>
                  <p>Keeps scalp clean, moist, and velvety soft.</p>
                </div>
              </div>

              <div className="hand-benefit-card card-right">
                <div className="hand-card-icon-box gold">
                  <Heart size={20} color="#e6c669" />
                </div>
                <div>
                  <h4>Soothes Irritated Scalp</h4>
                  <p>Calms redness with cold-pressed botanical essence.</p>
                </div>
              </div>

              <div className="hand-benefit-card card-left-bottom">
                <div className="hand-card-icon-box emerald">
                  <Zap size={20} color="#10b981" />
                </div>
                <div>
                  <h4>Promotes Hair Health</h4>
                  <p>Hydrolyzed keratin rebuilds fiber bonds.</p>
                </div>
              </div>

              <div className="hand-benefit-card card-right-bottom">
                <div className="hand-card-icon-box mint">
                  <Leaf size={20} color="#34d399" />
                </div>
                <div>
                  <h4>Rich in Antioxidants</h4>
                  <p>Fights free radicals & thermal stress.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Progress Indicator Prompt */}
          <div className="parallax-progress-prompt">
            <div className="parallax-progress-bar-bg">
              <div
                className="parallax-progress-bar-fill"
                style={{ width: `${parallaxProgress * 100}%` }}
              />
            </div>
            <span>
              {isOrbitPhase ? 'SCROLL: INGREDIENT ORBIT' : 'SCROLL: HAND RESTING PARALLAX'}
            </span>
          </div>

        </div>
      </div>

      {/* ---------------- Main Content Sections ---------------- */}
      <div className="content-wrapper">
        {/* ---------------- REFERENCE BENEFIT SHOWCASE SECTION ---------------- */}
        <section id="benefits" className="section-container reference-benefits-section">
          <div className="section-header">
            <span className="section-subtitle">TARGETED FORMULATION</span>
            <h2 className="section-title">Designed For Total Scalp & Hair Vitality</h2>
            <p className="section-description">
              Pure botanical extracts engineered to deliver targeted cellular nourishment at every step.
            </p>
          </div>

          <div className="reference-layout-container">
            {/* Center Circle Spotlight Image */}
            <div className="ref-spotlight-box">
              <div className="ref-circle-halo"></div>
              <img
                src={profusionImg}
                alt="ProFusion Product Showcase"
                className="ref-product-img"
              />
            </div>

            {/* Alternating Benefit Badges List */}
            <div className="ref-benefits-list">
              {/* Row 1: Left Circular Icon */}
              <div className="ref-benefit-row align-left">
                <div className="ref-badge-circle circle-cyan">
                  <Droplets size={26} color="#06b6d4" />
                </div>
                <div className="ref-text-box">
                  <h3 className="ref-title">Deep Hydration</h3>
                  <p className="ref-desc">
                    Provides long-lasting moisture, keeping scalp clean, refreshed, and velvety soft all day.
                  </p>
                </div>
              </div>

              {/* Row 2: Right Circular Icon */}
              <div className="ref-benefit-row align-right">
                <div className="ref-text-box text-right-desktop">
                  <h3 className="ref-title">Soothes Irritated Scalp</h3>
                  <p className="ref-desc">
                    Calms redness, itching, and dryness with cold-pressed Amla and wild Rosemary essence.
                  </p>
                </div>
                <div className="ref-badge-circle circle-gold">
                  <Heart size={26} color="#e6c669" />
                </div>
              </div>

              {/* Row 3: Left Circular Icon */}
              <div className="ref-benefit-row align-left">
                <div className="ref-badge-circle circle-emerald">
                  <Zap size={26} color="#10b981" />
                </div>
                <div className="ref-text-box">
                  <h3 className="ref-title">Promotes Hair Growth</h3>
                  <p className="ref-desc">
                    Nourishes root follicles directly with hydrolyzed keratin peptides to prevent hair thinning.
                  </p>
                </div>
              </div>

              {/* Row 4: Right Circular Icon */}
              <div className="ref-benefit-row align-right">
                <div className="ref-text-box text-right-desktop">
                  <h3 className="ref-title">Rich in Antioxidants</h3>
                  <p className="ref-desc">
                    Fights free radical oxidation and thermal damage, sealing in vibrant natural shine.
                  </p>
                </div>
                <div className="ref-badge-circle circle-mint">
                  <Leaf size={26} color="#34d399" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Formula Section ---------------- */}
        <section id="formula" className="section-container">
          <div className="section-header">
            <span className="section-subtitle">Botanical Mastery</span>
            <h2 className="section-title">Engineered With Nature's Most Powerful Actives</h2>
            <p className="section-description">
              Our master chemists combined centuries-old herbal wisdom with modern biomimetic
              peptide science for unprecedented hair recovery.
            </p>
          </div>

          <div className="ingredients-grid">
            <div className="ingredient-card" data-aos="fade-up" data-aos-delay="100">
              <div className="ingredient-icon-box">
                <Leaf size={28} />
              </div>
              <h3 className="ingredient-title">Organic Gooseberry (Amla)</h3>
              <p className="ingredient-desc">
                Rich in natural Vitamin C and polyphenols. Stimulates blood circulation to scalp
                follicles, boosting natural thickness and root anchor strength.
              </p>
            </div>

            <div className="ingredient-card" data-aos="fade-up" data-aos-delay="250">
              <div className="ingredient-icon-box">
                <Zap size={28} />
              </div>
              <h3 className="ingredient-title">Hydrolyzed Keratin Protein</h3>
              <p className="ingredient-desc">
                Micro-peptides penetrate deep into damaged cortex layers, sealing split ends and
                filling micro-fissures in heat-damaged hair strands.
              </p>
            </div>

            <div className="ingredient-card" data-aos="fade-up" data-aos-delay="400">
              <div className="ingredient-icon-box">
                <Sparkles size={28} />
              </div>
              <h3 className="ingredient-title">Pure Biotin & Vitamin B7</h3>
              <p className="ingredient-desc">
                Essential cellular co-enzyme that fortifies keratin infrastructure, creating
                bounce, volume, and resistance against breakage.
              </p>
            </div>

            <div className="ingredient-card" data-aos="fade-up" data-aos-delay="550">
              <div className="ingredient-icon-box">
                <Droplets size={28} />
              </div>
              <h3 className="ingredient-title">Wild Rosemary Oil</h3>
              <p className="ingredient-desc">
                Natural anti-inflammatory essence that balances scalp microbiome, soothing
                irritation while locking in weightless moisture.
              </p>
            </div>
          </div>
        </section>

      

        {/* ---------------- Reviews Section ---------------- */}
        <section id="reviews" className="section-container">
          <div className="section-header" data-aos="fade-up">
            <span className="section-subtitle">Real Results</span>
            <h2 className="section-title">Loved By Professional Stylists & Customers</h2>
            <p className="section-description">
              See what women and men are saying about their ProFusion hair transformation.
            </p>
          </div>

          <div className="reviews-grid">
            <div className="review-card" data-aos="fade-up" data-aos-delay="100">
              <div>
                <div className="review-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="#e6c669" color="#e6c669" />
                  ))}
                </div>
                <p className="review-text">
                  "The scroll sequence on the website caught my attention, but the shampoo itself is magic! My hair was severely damaged from bleaching. After two weeks of ProFusion, it feels silky soft and strong again."
                </p>
              </div>
              <div className="reviewer-profile">
                <div className="avatar-circle">SL</div>
                <div>
                  <div className="reviewer-name">Sophia Laurent</div>
                  <div className="reviewer-tag">Verified Buyer • Celebrity Hair Stylist</div>
                </div>
              </div>
            </div>

            <div className="review-card" data-aos="fade-up" data-aos-delay="250">
              <div>
                <div className="review-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="#e6c669" color="#e6c669" />
                  ))}
                </div>
                <p className="review-text">
                  "Gooseberry and Biotin combined is brilliant. Hair shedding dropped significantly within 5 days. Smells luxurious like a high-end salon spa!"
                </p>
              </div>
              <div className="reviewer-profile">
                <div className="avatar-circle">EM</div>
                <div>
                  <div className="reviewer-name">Elena Martinez</div>
                  <div className="reviewer-tag">Verified Buyer • Verified Purchase</div>
                </div>
              </div>
            </div>

            <div className="review-card" data-aos="fade-up" data-aos-delay="400">
              <div>
                <div className="review-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="#e6c669" color="#e6c669" />
                  ))}
                </div>
                <p className="review-text">
                  "Hands down the best shampoo I have ever used. My curls have never looked this defined and healthy without feeling weighed down."
                </p>
              </div>
              <div className="reviewer-profile">
                <div className="avatar-circle">AR</div>
                <div>
                  <div className="reviewer-name">Amara Reed</div>
                  <div className="reviewer-tag">Verified Buyer • Verified Purchase</div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

  

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <CheckCircle2 style={{ color: '#10b981' }} size={20} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
