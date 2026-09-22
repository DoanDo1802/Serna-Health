import { t as e } from './gsap.Bi_c5vh2.js';
import { t } from './ScrollTrigger.BTGKJApg.js';
e.registerPlugin(t);
var initAntigravityFooter = () => {
  let t = document.querySelector(`[data-antigravity-footer-wrapper]`);
  if (!t || t._footerInitialized) return;
  t._footerInitialized = !0;
  let n = t.querySelector(`[data-letter-y]`),
    r = t.querySelector(`[data-letter-t]`),
    i = e.timeline({
      scrollTrigger: {
        trigger: t,
        start: `top+=30% bottom`,
        end: `center+=30% bottom`,
        scrub: !0,
        id: `AntigravityFooterAnimation`,
      },
    });
  n &&
    r &&
    (i.to(n, { y: -60, ease: `power1.out` }, 0), i.to(r, { y: -60, ease: `power1.out` }, 0));
};
window.initAntigravityFooter = initAntigravityFooter;
document.readyState === `loading` ? document.addEventListener(`DOMContentLoaded`, initAntigravityFooter) : initAntigravityFooter();
