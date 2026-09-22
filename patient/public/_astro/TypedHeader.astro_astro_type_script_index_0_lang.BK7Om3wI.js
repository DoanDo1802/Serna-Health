import { t as e } from './gsap.Bi_c5vh2.js';
import { t } from './SplitText.Bj_bHxnY.js';
e.registerPlugin(t);
var n = class {
  element;
  cursorContainer;
  typedContent;
  splitContent;
  cursorPersists;
  doneTyping = !1;
  activeTimeline = null;
  constructor(n) {
    ((this.element = n),
      (this.cursorContainer = n.querySelector(`[data-cursor-container]`)),
      (this.typedContent = n.querySelector(`.typed-content`)),
      (this.cursorPersists = n.getAttribute(`data-cursor-persists`) === `true`),
      (this.splitContent = t.create(this.typedContent, { type: `chars, words` })),
      e.set(this.cursorContainer, { opacity: 0 }),
      e.set(this.splitContent.chars, { opacity: 0 }));
    let r = this.splitContent.chars[0];
    if (r) {
      let pos = this.getCharPos(r, false);
      this.updateBlinkingCursor(pos.x, pos.y);
    }
    window.addEventListener(`resize`, () => this.onResize());
  }
  getCharPos(t, after = false) {
    if (!t || !this.element) return { x: 0, y: 0 };
    let pRect = this.element.getBoundingClientRect();
    let cRect = t.getBoundingClientRect();
    let x = after ? cRect.left - pRect.left + cRect.width + 1 : cRect.left - pRect.left - 2;
    let y = cRect.top - pRect.top;
    return { x, y };
  }
  stopAnimation() {
    ((this.activeTimeline &&= (this.activeTimeline.kill(), null)),
      this.cursorContainer && e.killTweensOf(this.cursorContainer),
      this.splitContent?.chars && e.killTweensOf(this.splitContent.chars));
  }
  initialize() {
    if (
      (this.stopAnimation(),
      this.cursorContainer && e.set(this.cursorContainer, { opacity: 0 }),
      this.splitContent?.chars)
    ) {
      e.set(this.splitContent.chars, { opacity: 0 });
      let t = this.splitContent.chars[0];
      if (t) {
        let pos = this.getCharPos(t, false);
        this.updateBlinkingCursor(pos.x, pos.y);
      }
    }
    this.doneTyping = !1;
  }
  setText(e) {
    (this.stopAnimation(),
      this.splitContent && this.splitContent.revert(),
      this.typedContent && (this.typedContent.innerHTML = e));
    let n = this.element.querySelector(`.visually-hidden`);
    (n && (n.innerHTML = e),
      (this.splitContent = t.create(this.typedContent, { type: `chars, words` })),
      this.initialize());
  }
  reset() {
    this.initialize();
  }
  hideAndReset() {
    (this.stopAnimation(),
      this.cursorContainer && e.to(this.cursorContainer, { opacity: 0, duration: 0.01 }),
      this.splitContent?.chars
        ? e.to(this.splitContent.chars, {
            opacity: 0,
            duration: 0.01,
            stagger: -0.05,
            onComplete: () => {
              this.reset();
            },
          })
        : this.reset());
  }
  updateBlinkingCursor(e, t) {
    (this.cursorContainer.style.setProperty(`--cursor-pos-x`, `${e}px`),
      this.cursorContainer.style.setProperty(`--cursor-pos-y`, `${t}px`));
  }
  onResize() {
    if (this.doneTyping && this.cursorPersists) {
      let e = this.splitContent?.chars.length || 1,
        t = this.splitContent?.chars[e - 1];
      if (t) {
        let pos = this.getCharPos(t, true);
        this.updateBlinkingCursor(pos.x, pos.y);
      }
    }
  }
  startTyping(t, n = 0, r = 0.05) {
    this.stopAnimation();
    let i = t || e.timeline();
    this.activeTimeline = i;
    let a = this;
    return (
      i.set(this.cursorContainer, { opacity: 1 }),
      i.fromTo(
        this.splitContent.chars,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.01,
          delay: n,
          stagger: {
            each: r,
            onStart: function () {
              let e = this.targets()[0];
              if (e) {
                let pos = a.getCharPos(e, true);
                a.updateBlinkingCursor(pos.x, pos.y);
              }
            },
          },
          ease: `power2.out`,
          onComplete: () => {
            ((a.doneTyping = !0), (a.activeTimeline = null));
          },
        }
      ),
      this.cursorPersists ||
        i.to(this.cursorContainer, { opacity: 0, duration: 0.5, ease: `none` }),
      i
    );
  }
};
window.TypedHeaderHelper = n;
var r = () => {
  document.querySelectorAll(`[data-typed-header]`).forEach((t) => {
    let r = t;
    if (!r.helper) {
      let t = new n(r);
      ((r.helper = t), t.startTyping(e.timeline(), 0.2));
    }
  });
};
document.readyState === `loading` ? document.addEventListener(`DOMContentLoaded`, r) : r();
