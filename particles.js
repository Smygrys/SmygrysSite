// Particles Animation - Only in Welcome Modal
(function () {
  const container = document.getElementById("particles");
  if (!container) return;
  
  for (let i = 0; i < 15; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    const size = Math.random() * 150 + 40;
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = Math.random() * 100 + "%";
    p.style.animationDuration = Math.random() * 15 + 10 + "s";
    p.style.animationDelay = Math.random() * 5 + "s";
    p.style.opacity = Math.random() * 0.4 + 0.15;
    container.appendChild(p);
  }
})();