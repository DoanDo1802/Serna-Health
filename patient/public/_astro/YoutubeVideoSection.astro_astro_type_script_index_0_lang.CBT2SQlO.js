import { t as e } from './gsap.Bi_c5vh2.js';
import { t } from './ScrollTrigger.BTGKJApg.js';

var initYoutubeVideoSection = () => {
  e.registerPlugin(t);
  document.querySelectorAll(`[data-youtube-video-section]`).forEach((sec) => {
    let r = sec.querySelector(`[data-video-wrapper]`),
      i = sec.querySelector(`[data-video]`),
      a = sec.querySelector(`[data-cursor]`),
      o = sec.querySelector(`[data-modal-youtube]`);
    if (!r || !a) return;

    // Immediately hide and center cursor anchor
    e.set(a, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 });

    let p = e.quickTo(a, `x`, { duration: 0.2, ease: `power2.out` }),
      m = e.quickTo(a, `y`, { duration: 0.2, ease: `power2.out` });

    let isInside = false;

    let updateCursorPos = (clientX, clientY) => {
      let rect = r.getBoundingClientRect();
      let x = clientX - rect.left;
      let y = clientY - rect.top;
      p(x);
      m(y);
    };

    let onEnter = (evt) => {
      isInside = true;
      r.style.cursor = `none`;
      updateCursorPos(evt.clientX, evt.clientY);
      e.to(a, { scale: 1, opacity: 1, duration: 0.3, ease: `back.out(1.7)` });
    };

    let onLeave = () => {
      isInside = false;
      r.style.cursor = ``;
      e.to(a, { scale: 0, opacity: 0, duration: 0.2, ease: `power2.in` });
    };

    let onMove = (evt) => {
      if (!isInside) {
        onEnter(evt);
      } else {
        updateCursorPos(evt.clientX, evt.clientY);
      }
    };

    r.removeEventListener(`mouseenter`, r._onEnter);
    r.removeEventListener(`mouseleave`, r._onLeave);
    r.removeEventListener(`mousemove`, r._onMove);

    r._onEnter = onEnter;
    r._onLeave = onLeave;
    r._onMove = onMove;

    r.addEventListener(`mouseenter`, onEnter);
    r.addEventListener(`mouseleave`, onLeave);
    r.addEventListener(`mousemove`, onMove);

    // Video auto-play
    if (i) {
      i.muted = true;
      i.playsInline = true;
      let playPromise = i.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
      try {
        t.create({
          trigger: sec,
          start: `top bottom`,
          end: `bottom top`,
          onEnter: () => {
            i.muted = true;
            i.play().catch(() => {});
          },
          onLeave: () => i.pause(),
          onEnterBack: () => {
            i.muted = true;
            i.play().catch(() => {});
          },
          onLeaveBack: () => i.pause(),
        });
      } catch {}
    }

    // Scroll zoom animation
    try {
      e.fromTo(
        sec,
        { scale: 0.75 },
        {
          scale: 1,
          ease: `power2.out`,
          scrollTrigger: {
            trigger: sec,
            start: `top bottom`,
            end: `top center`,
            scrub: 1,
          },
        }
      );
    } catch {}

    // Modal dialog click
    if (o) {
      let modalHelper = null;
      r.addEventListener(`click`, () => {
        onLeave();
        if (!modalHelper && window.ModalYoutubeHelper) {
          modalHelper = new window.ModalYoutubeHelper(o);
        }
        if (modalHelper) modalHelper.show();
      });
      o.addEventListener(`close`, () => {
        isInside = false;
      });
    }
  });
};

window.initYoutubeVideoSection = initYoutubeVideoSection;
document.readyState === `loading` ? document.addEventListener(`DOMContentLoaded`, initYoutubeVideoSection) : initYoutubeVideoSection();
