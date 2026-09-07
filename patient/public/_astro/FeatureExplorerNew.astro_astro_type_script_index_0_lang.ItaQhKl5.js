import { t as e } from './gsap.Bi_c5vh2.js';
import { t } from './ScrollTrigger.BTGKJApg.js';
import { t as n } from './SplitText.Bj_bHxnY.js';
e.registerPlugin(t, n);
var initFeatureExplorer = () => {
  document.querySelectorAll(`[data-feature-explorer-section]`).forEach((t) => {
    t.querySelectorAll(`[data-feature-item]`).forEach((t) => {
      let r = t.querySelector(`[data-feature-title]`),
        i = t.querySelector(`[data-feature-desc]`);
      !r ||
        !i ||
        setTimeout(() => {
          let t = new n(i, { type: `words, chars` });
          (e.set(t.chars, { opacity: 0 }),
            e
              .timeline({
                scrollTrigger: {
                  trigger: r,
                  start: `top 85%`,
                  toggleActions: `play none none none`,
                },
              })
              .to(t.chars, { opacity: 1, stagger: 0.005, duration: 0.1, ease: `power2.out` }));
        }, 100);
    });
  });
};
window.initFeatureExplorer = initFeatureExplorer;
document.readyState === `loading` ? document.addEventListener(`DOMContentLoaded`, initFeatureExplorer) : initFeatureExplorer();
