import { t as e } from "./gsap.Bi_c5vh2.js";
import { t } from "./ScrollTrigger.BTGKJApg.js";
import { t as n } from "./deviceInfo.eHzC_0c8.js";
e.registerPlugin(t);
var initWelcomeTimeline = window.initWelcomeTimeline = () => {
  let t = document.querySelector(`[data-welcome-section]`);
  if (!t) return;
  let r = t.querySelector(`[data-logo]`),
    i = t.querySelector(`[data-welcome-header]`),
    a = t.querySelector(`[data-cta]`),
    o = t.querySelector(`[data-hero-particles]`);
  let c = e.timeline();
  if (i && i.helper) {
    i.helper.initialize();
    i.helper.startTyping(c);
  }
  c.from(r, { opacity: 0, y: `1em`, duration: 2, ease: `power2.out` })
   .from(a, { opacity: 0, y: 50, duration: 2, ease: `power2.out` }, `<`)
   .from(o, { opacity: 0, duration: 3, ease: `power2.out` }, `<`);
  e.to(o, {
    scrollTrigger: {
      trigger: t,
      start: `center top`,
      end: `bottom top`,
      scrub: !0,
      onUpdate: (e) => {
        o.style.opacity = String(1 - e.progress);
      },
    },
    opacity: 0,
    ease: `power2.out`,
  });
};
document.readyState === `loading` ? document.addEventListener(`DOMContentLoaded`, initWelcomeTimeline) : initWelcomeTimeline();
