(function () {
  "use strict";
  const intro = window.BBLongHunt.preface.find((entry) => entry.id === "intro"),
    container = document.getElementById("campaignIntro");
  if (!intro?.narrative || !container) return;
  for (const paragraph of intro.narrative.split(/\n\s*\n/)) {
    const p = document.createElement("p");
    p.textContent = paragraph;
    container.append(p);
  }
})();
