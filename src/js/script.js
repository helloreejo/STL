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

    // How much of each panel is inside the track's viewport, 0..1.
    const seenFractions = () => {
      const left = svcTrack.scrollLeft;
      const right = left + svcTrack.clientWidth;
      return positions.map((pos) => {
        const shown =
          Math.min(pos.left + pos.width, right) - Math.max(pos.left, left);
        return Math.max(0, Math.min(shown, pos.width)) / (pos.width || 1);
      });
    };

    // The layout shows two panels at once, so the dashes mark the pair rather
    // than one "active" panel. 0.92 rather than 1 because a scrub lands on
    // sub-pixel scroll positions that would otherwise read as "not quite in".
    const inViewIndices = () => {
      const seen = seenFractions();
      const shown = seen.reduce((acc, f, i) => (f > 0.92 ? acc.concat(i) : acc), []);
      if (shown.length) return shown;
      // Mid-transition nothing is fully in: fall back to the widest-showing.
      let best = 0;
      seen.forEach((f, i) => {
        if (f > seen[best]) best = i;
      });
      return [best];
    };

    let currentKey = "";
    const syncDots = () => {
      const shown = inViewIndices();
      const key = shown.join(",");
      if (key === currentKey) return;
      currentKey = key;
      dots.forEach((dot, j) => {
        dot.dataset.inview = shown.includes(j) ? "true" : "false";
        // aria-current stays singular — the leading panel of the pair.
        dot.setAttribute("aria-current", j === shown[0] ? "true" : "false");
      });
    };

    // Depth pass: panels dim, shrink and let their oversized number drift as
    // they leave the viewport. Driven from both the native scroll listener and
    // the pinned scrub, so the two modes look identical.
    const paintPanels = () => {
      const W = svcTrack.clientWidth;
      const left = svcTrack.scrollLeft;
      const seen = seenFractions();
      panels.forEach((panel, i) => {
        const pos = positions[i];
        if (!pos) return;
        const f = seen[i];
        // Squared so a half-shown panel reads clearly recessed, not just dim.
        panel.style.opacity = (0.18 + 0.82 * f * f).toFixed(3);
        panel.style.transform = "scale(" + (0.945 + 0.055 * f).toFixed(4) + ")";
        const num = panel.querySelector(".service-num-row");
        if (num) {
          // Offset of the panel's centre from the track's, -1..1 -> parallax.
          const off = (pos.left + pos.width / 2 - left - W / 2) / W;
          num.style.transform =
            "translate3d(" + (off * -34).toFixed(1) + "px,0,0)";
        }
      });
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
      paintPanels,
      // Distinct snap positions: with two panels in view the last one a panel
      // can lead is length-2, so the track has that many advances.
      steps: () => Math.max(1, panels.length - 2),
      resetPanels: () => {
        panels.forEach((panel) => {
          panel.style.opacity = "";
          panel.style.transform = "";
          const num = panel.querySelector(".service-num-row");
          if (num) num.style.transform = "";
        });
      },
      scrollTrackTo,
      goTo: scrollTrackTo, // replaced while the section is pinned
    };

    dots.forEach((dot, i) =>
      dot.addEventListener("click", () => services.goTo(i))
    );
    const onTrackScroll = () => {
      syncDots();
      if (!reduce) paintPanels();
    };
    svcTrack.addEventListener("scroll", onTrackScroll, { passive: true });
    window.addEventListener("resize", () => {
      measure();
      onTrackScroll();
    });
    measure();
    onTrackScroll();
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
    // A block that holds several children reads better when they arrive in
    // sequence — heading, then supporting line — rather than the whole box
    // sliding as one rigid unit. Single-child blocks animate themselves.
    const parts = el.children.length > 1 ? Array.from(el.children) : [el];
    gsap.from(parts, {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: parts.length > 1 ? 0.09 : 0,
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

  // Stats reveal — the figures climb to their value as the row arrives.
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

    // Values carry a unit ("2M"), so split the leading number from whatever
    // follows it and only animate the number. Anything without a leading
    // digit is left exactly as authored.
    const valueEl = el.querySelector(".counter-value");
    const parsed = valueEl && /^(\d+(?:\.\d+)?)(.*)$/.exec(valueEl.textContent.trim());
    if (!parsed) return;

    const target = parseFloat(parsed[1]);
    const suffix = parsed[2];
    const decimals = (parsed[1].split(".")[1] || "").length;
    // Hold the final width so the row does not reflow while digits are added.
    // Safe as a `ch` count because the face is set in tabular figures.
    valueEl.style.display = "inline-block";
    valueEl.style.minWidth = parsed[1].length + "ch";

    const counter = { n: 0 };
    gsap.to(counter, {
      n: target,
      duration: 1.6,
      ease: "power2.out",
      delay: i * 0.06,
      onUpdate: () => {
        valueEl.textContent = counter.n.toFixed(decimals) + suffix;
      },
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: "play none none none",
      },
    });
  });

  // Parallax: the care section's artwork drifts against the copy as the
  // section passes, which reads as depth rather than as movement. Kept small
  // — the tree is `mix-blend-mode: screen` over the section fill, and a large
  // offset would drag its glow off the gradient it was composed against.
  const careTree = document.querySelector(".care-tree");
  if (careTree) {
    gsap.fromTo(
      careTree,
      { yPercent: 4 },
      {
        yPercent: -4,
        ease: "none",
        scrollTrigger: {
          trigger: careTree.closest("section"),
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      }
    );
  }

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
  //   Two panels are in view at all times (the CSS sizes them to half the
  //   track). Each scroll gesture advances the track by exactly one panel and
  //   settles there, so the pair is always whole at rest. Once the last pair
  //   is reached the pin releases and the page carries on to the next section.
  if (services && window.ScrollTrigger) {
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1280px) and (min-height: 720px)", () => {
      // The CSS gives the section min-height:100svh so the pin never leaves a
      // bare strip of page background showing. Sub-pixel viewport units can
      // still land a hair over, so allow a pixel before giving up on the pin.
      if (services.section.offsetHeight > window.innerHeight + 1) return;

      const track = services.track;
      const proxy = { x: 0 };
      const steps = services.steps();

      // Snap points fight a programmatically driven scrollLeft.
      track.dataset.pinned = "true";

      const tween = gsap.to(proxy, {
        x: () => services.maxScroll(),
        ease: "none",
        onUpdate: () => {
          track.scrollLeft = proxy.x;
          services.syncDots();
          if (!reduce) services.paintPanels();
        },
        scrollTrigger: {
          trigger: services.section,
          start: "top top",
          // Roughly two-thirds of a screen per panel — long enough that a
          // step feels deliberate, short enough that six panels do not turn
          // into a marathon. The scrub maps this span onto the track's own
          // scrollLeft, so the distance and the track width stay independent.
          end: () => "+=" + Math.round(steps * window.innerHeight * 0.66),
          pin: true,
          anticipatePin: 1,
          scrub: 0.5,
          // One panel per gesture: land on a whole pair, never between two.
          snap: reduce
            ? false
            : {
                snapTo: 1 / steps,
                duration: { min: 0.2, max: 0.5 },
                delay: 0.04,
                ease: "power2.inOut",
              },
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
        services.resetPanels();
        services.syncDots();
        if (!reduce) services.paintPanels();
      };
    });
  }
})();
