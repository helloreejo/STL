(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nofx = new URLSearchParams(location.search).has("nofx");

  // --- Lenis smooth scroll ----------------------------------------------
  //   Lenis animates the real window scroll position, so `window.scrollY`,
  //   the header shadow listener and every ScrollTrigger keep working as they
  //   are — ScrollTrigger only needs telling when Lenis moves. Under reduced
  //   motion (or ?nofx) we stay out of the way and let the browser scroll.
  const lenis =
    reduce || nofx || typeof window.Lenis === "undefined"
      ? null
      : new window.Lenis({
          duration: 1.05,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          smoothWheel: true,
          anchors: true, // in-page #links animate through Lenis too
        });

  if (lenis) {
    if (window.gsap) {
      // Share GSAP's ticker instead of running a second rAF loop, so Lenis and
      // the ScrollTriggers it feeds always read the same frame. lagSmoothing
      // off keeps GSAP from skipping time after a stall and desyncing the two.
      if (window.ScrollTrigger) lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  // --- Mobile nav toggle -----------------------------------------------
  const toggle = document.querySelector("[data-nav-toggle]");
  const panel = document.querySelector("[data-nav-panel]");
  let closeNavPanel = null;
  if (toggle && panel) {
    const closePanel = () => {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    };
    closeNavPanel = closePanel;
    const openPanel = () => {
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
    };
    toggle.addEventListener("click", () => {
      panel.hidden ? openPanel() : closePanel();
    });
    panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", closePanel));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) closePanel();
    });
  }

  // --- Header: scrolled shadow, and the compact dock past the hero -------
  //   Inside the hero the header is an absolute pill that scrolls away with
  //   the section. Once the page passes the hero's midpoint it slides back
  //   down as a fixed, compact bar; scrolling back up sends it away again.
  //   Both looks are CSS — this owns only the threshold and the attribute, so
  //   it works with or without GSAP, and reduced motion flattens the slide
  //   through the global animation-duration override.
  const header = document.querySelector("[data-nav]");
  if (header) {
    const hero = document.querySelector("[data-hero]");
    const root = document.documentElement;
    let dockPoint = 0;
    let docked = false;

    // Cached rather than read per scroll event: the dock swaps absolute for
    // fixed, and neither is in flow, so nothing but a resize can move it.
    const measureDock = () => {
      dockPoint = hero
        ? hero.offsetTop + hero.offsetHeight / 2
        : window.innerHeight / 2;
    };

    // The mobile panel hangs below the docked header, so it needs the live
    // header height — which the padding and logo transitions keep changing
    // for ~300ms after the dock flips, long after the attribute is set. An
    // observer tracks it instead of trying to guess at transition timing.
    const publishHeight = (h) =>
      root.style.setProperty("--stl-header-h", Math.round(h) + "px");
    if (typeof ResizeObserver === "undefined") {
      publishHeight(header.offsetHeight);
    } else {
      new ResizeObserver((entries) => {
        const box = entries[0].borderBoxSize && entries[0].borderBoxSize[0];
        publishHeight(box ? box.blockSize : header.offsetHeight);
      }).observe(header);
    }

    const setDocked = (next) => {
      if (next === docked) return;
      docked = next;
      if (closeNavPanel) closeNavPanel();
      if (next) {
        header.dataset.docked = "true";
      } else {
        // Hold the docked styles for one more beat so it can slide back up
        // before the hero takes the header back at its own scroll position.
        header.dataset.docked = "leaving";
      }
    };

    header.addEventListener("animationend", (e) => {
      if (e.target === header && header.dataset.docked === "leaving") {
        delete header.dataset.docked;
      }
    });

    const onScroll = () => {
      const y = window.scrollY;
      header.dataset.scrolled = y > 20 ? "true" : "false";
      setDocked(y > dockPoint);
    };

    measureDock();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      measureDock();
      onScroll();
    });
  }

  // --- Services: horizontal track + pagination --------------------------
  //   Base behaviour, and the only behaviour under reduced motion / no GSAP:
  //   the track is a native horizontal scroller with snap, the dashes mirror
  //   its position and scroll it when clicked. The pinned scroll-jack further
  //   down only drives this same scrollLeft, so both modes share one source
  //   of truth and the dashes never need a second code path.
  const svcSection = document.querySelector("[data-services]");
  const svcTrack = svcSection && svcSection.querySelector("[data-services-track]");
  let services = null;

  if (svcSection && svcTrack) {
    const panels = Array.from(svcTrack.querySelectorAll("[data-services-panel]"));
    const dots = Array.from(svcSection.querySelectorAll("[data-services-dot]"));

    const maxScroll = () => Math.max(0, svcTrack.scrollWidth - svcTrack.clientWidth);

    // Panel positions in the track's own scroll coordinates. Measured from
    // rects rather than offsetLeft, which resolves against the offsetParent
    // (the section) and so carries the container's left margin as a bias.
    // The value is scroll-invariant, so one measure per layout is enough.
    let positions = [];
    const measure = () => {
      const base = svcTrack.getBoundingClientRect().left + svcTrack.scrollLeft;
      positions = panels.map((panel) => {
        const rect = panel.getBoundingClientRect();
        return { left: rect.left - base, width: rect.width };
      });
    };

    // Panel start, clamped — the last panels cannot all reach the left edge.
    const targetFor = (i) =>
      positions[i] ? Math.max(0, Math.min(positions[i].left, maxScroll())) : 0;

    // Active = the panel whose centre sits nearest the middle of the viewport.
    // Centre-distance (rather than "first fully visible") is what keeps the
    // final dash reachable once scrollLeft clamps at the end of the track.
    const activeIndex = () => {
      const mid = svcTrack.scrollLeft + svcTrack.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      positions.forEach((pos, i) => {
        const dist = Math.abs(pos.left + pos.width / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    };

    let current = -1;
    const syncDots = () => {
      const i = activeIndex();
      if (i === current) return;
      current = i;
      dots.forEach((dot, j) =>
        dot.setAttribute("aria-current", j === i ? "true" : "false")
      );
    };

    const scrollTrackTo = (i) =>
      svcTrack.scrollTo({ left: targetFor(i), behavior: "smooth" });

    services = {
      section: svcSection,
      track: svcTrack,
      panels,
      measure,
      maxScroll,
      targetFor,
      syncDots,
      scrollTrackTo,
      goTo: scrollTrackTo, // replaced while the section is pinned
    };

    dots.forEach((dot, i) =>
      dot.addEventListener("click", () => services.goTo(i))
    );
    svcTrack.addEventListener("scroll", syncDots, { passive: true });
    window.addEventListener("resize", () => {
      measure();
      syncDots();
    });
    measure();
    syncDots();
  }

  // --- Testimonial slider (Swiper) --------------------------------------
  //   Sits above the GSAP guard: the slider is functionality, not decoration,
  //   so it must still work under prefers-reduced-motion and ?nofx. Both the
  //   desktop arrows on the rule and the stacked mobile pair carry the same
  //   data attributes, so one Swiper drives either set.
  const testiEl = document.querySelector("[data-testi-swiper]");
  if (testiEl && typeof window.Swiper !== "undefined") {
    const swiper = new window.Swiper(testiEl, {
      slidesPerView: 1,
      speed: reduce ? 0 : 500,
      // No loop, so the first and last slides disable an arrow — which is what
      // the Figma frame shows (dimmed prev, solid next on slide one).
      loop: false,
      autoHeight: false,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: {
        prevSlideMessage: "Previous testimonial",
        nextSlideMessage: "Next testimonial",
      },
    });

    const prevs = document.querySelectorAll("[data-testi-prev]");
    const nexts = document.querySelectorAll("[data-testi-next]");
    prevs.forEach((b) => b.addEventListener("click", () => swiper.slidePrev()));
    nexts.forEach((b) => b.addEventListener("click", () => swiper.slideNext()));

    const syncArrows = () => {
      prevs.forEach((b) => {
        b.classList.toggle("swiper-button-disabled", swiper.isBeginning);
        b.disabled = swiper.isBeginning;
      });
      nexts.forEach((b) => {
        b.classList.toggle("swiper-button-disabled", swiper.isEnd);
        b.disabled = swiper.isEnd;
      });
    };
    swiper.on("slideChange", syncArrows);
    swiper.on("resize", syncArrows);
    syncArrows();
  }

  // --- GSAP animations --------------------------------------------------
  if (reduce || nofx || typeof window.gsap === "undefined") return;

  const { gsap } = window;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  // Hero entrance timeline (runs on load)
  const heroTitle = document.querySelector("[data-hero-title]");
  const heroDesc = document.querySelector("[data-hero-desc]");
  const heroCtas = document.querySelector("[data-hero-ctas]");
  const heroProof = document.querySelector("[data-hero-proof]");
  const heroImage = document.querySelector("[data-hero-image]");
  const siteHeader = document.querySelector("[data-nav]");

  const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.9 } });
  if (siteHeader && !siteHeader.dataset.docked)
    tl.from(siteHeader, { y: -30, opacity: 0, duration: 0.6 }, 0);
  if (heroTitle) tl.from(heroTitle, { y: 40, opacity: 0 }, 0.15);
  if (heroDesc) tl.from(heroDesc, { y: 30, opacity: 0 }, 0.35);
  if (heroCtas) tl.from(heroCtas, { y: 24, opacity: 0 }, 0.5);
  if (heroProof) tl.from(heroProof, { y: 24, opacity: 0 }, 0.65);
  if (heroImage) {
    tl.from(
      heroImage,
      { x: 60, opacity: 0, scale: 0.95, duration: 1.1, ease: "power2.out" },
      0.1
    );
    // Gentle continuous float on the tree
    gsap.to(heroImage, {
      y: -12,
      duration: 3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  }

  if (!window.ScrollTrigger) return;

  // Section blocks reveal
  gsap.utils.toArray("[data-reveal-block]").forEach((el) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      // Hand the element back to CSS once it has landed. GSAP otherwise
      // leaves its own `transform` (and a `translate: none`) inline, and an
      // inline style outranks a rule — which silently kills the :hover lift
      // on any revealed control, the contact CTA button among them.
      clearProps: "transform",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none",
      },
    });
  });

  // Cards stagger reveal (per section)
  document.querySelectorAll("section").forEach((section) => {
    const cards = section.querySelectorAll("[data-reveal-card]");
    if (!cards.length) return;
    gsap.from(cards, {
      y: 40,
      opacity: 0,
      duration: 0.7,
      ease: "power2.out",
      stagger: 0.08,
      scrollTrigger: {
        trigger: section,
        start: "top 75%",
        toggleActions: "play none none none",
      },
    });
  });

  // Stats reveal
  gsap.utils.toArray("[data-reveal-stat]").forEach((el, i) => {
    gsap.from(el, {
      y: 24,
      opacity: 0,
      duration: 0.6,
      ease: "power2.out",
      delay: i * 0.06,
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: "play none none none",
      },
    });
  });

  // ------------------------------------------------------------------
  // Distributed model — scroll-driven timeline
  //   - Vertical fill grows as user scrolls through the section
  //   - Each numbered step (01–04) activates as its number crosses the
  //     viewport middle; the matching dot lights up in sync
  // ------------------------------------------------------------------
  const distSection = document.querySelector("[data-distributed]");
  if (distSection) {
    const steps = Array.from(distSection.querySelectorAll(".step"));
    const dots = Array.from(distSection.querySelectorAll(".timeline-dot"));
    const timeline = distSection.querySelector("[data-timeline]");
    const fill = distSection.querySelector("[data-timeline-fill]");

    const positionDots = () => {
      if (!timeline || timeline.offsetParent === null) return;
      const timelineRect = timeline.getBoundingClientRect();
      steps.forEach((step, i) => {
        const dot = dots[i];
        if (!dot) return;
        const numberEl = step.querySelector(".step-number");
        const rect = (numberEl || step).getBoundingClientRect();
        const centerY = rect.top + rect.height / 2 - timelineRect.top;
        dot.style.top = `${centerY}px`;
      });
    };

    positionDots();
    window.addEventListener("resize", () => {
      positionDots();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });

    if (fill) {
      gsap.to(fill, {
        height: "100%",
        ease: "none",
        scrollTrigger: {
          trigger: distSection,
          start: "top 55%",
          end: "bottom 65%",
          scrub: 0.4,
          onRefresh: positionDots,
        },
      });
    }

    steps.forEach((step, i) => {
      window.ScrollTrigger.create({
        trigger: step,
        start: "top 60%",
        end: "bottom 40%",
        onEnter: () => {
          step.setAttribute("data-active", "true");
          if (dots[i]) dots[i].setAttribute("data-active", "true");
        },
        onEnterBack: () => {
          step.setAttribute("data-active", "true");
          if (dots[i]) dots[i].setAttribute("data-active", "true");
        },
        onLeave: () => {
          /* keep active once passed */
        },
        onLeaveBack: () => {
          step.setAttribute("data-active", "false");
          if (dots[i]) dots[i].setAttribute("data-active", "false");
        },
      });
    });
  }

  // --- Services: pin the section and drive the track from page scroll ---
  //   Wide enough for the Figma 960px panels and tall enough that the whole
  //   section fits one screen, otherwise the pin would crop the pagination.
  //   Scrolling down advances the track left-to-right, 1px for 1px.
  if (services && window.ScrollTrigger) {
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1280px) and (min-height: 720px)", () => {
      // Belt-and-braces: the CSS scales the section to fit one screen, but if
      // it ever does not, pinning would crop the pagination off the bottom —
      // leave it as a plain horizontal scroller instead.
      if (services.section.offsetHeight > window.innerHeight) return;

      const track = services.track;
      const proxy = { x: 0 };

      // Snap points fight a programmatically driven scrollLeft.
      track.dataset.pinned = "true";

      const tween = gsap.to(proxy, {
        x: () => services.maxScroll(),
        ease: "none",
        onUpdate: () => {
          track.scrollLeft = proxy.x;
          services.syncDots();
        },
        scrollTrigger: {
          trigger: services.section,
          start: "top top",
          end: () => "+=" + Math.max(1, services.maxScroll()),
          pin: true,
          anticipatePin: 1,
          scrub: 0.4,
          invalidateOnRefresh: true,
          onRefresh: () => services.measure(),
        },
      });

      // While pinned the track's scrollLeft belongs to the page scroll, so a
      // dash has to move the page rather than the track.
      const st = tween.scrollTrigger;
      services.goTo = (i) => {
        const total = services.maxScroll();
        if (total <= 0) return;
        const progress = services.targetFor(i) / total;
        const top = st.start + progress * (st.end - st.start);
        if (lenis) lenis.scrollTo(top);
        else window.scrollTo({ top, behavior: "smooth" });
      };

      return () => {
        delete track.dataset.pinned;
        track.scrollLeft = 0;
        services.goTo = services.scrollTrackTo;
        services.syncDots();
      };
    });
  }
})();
