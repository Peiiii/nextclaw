const world = document.querySelector(".world");
const creature = document.querySelector("#creature");
const speech = document.querySelector("#speech");
const begin = document.querySelector("#begin");
const reset = document.querySelector("#reset");
const arrival = document.querySelector("#arrival");
const context = document.querySelector("#context");
const dialog = document.querySelector("#info");
const initialSpeech = speech.textContent;
const initialButton = begin.innerHTML;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let taskTimer;
let greetingTimer;
function restore() {
  clearTimeout(taskTimer);
  clearTimeout(greetingTimer);
  world.dataset.state = "idle";
  arrival.hidden = true;
  begin.hidden = false;
  reset.hidden = true;
  begin.innerHTML = initialButton;
  context.textContent = "比如，把「帮我留意新品发布」交给它。";
  speech.textContent = initialSpeech;
  creature.classList.remove("greeting");
}
begin.addEventListener("click", () => {
  clearTimeout(greetingTimer);
  world.dataset.state = "waiting";
  begin.hidden = true;
  reset.hidden = false;
  context.textContent = "Bibo 正在替你留意。你可以先忙自己的。";
  speech.textContent = "交给我。";
  taskTimer = setTimeout(
    () => {
      world.dataset.state = "done";
      arrival.hidden = false;
      reset.hidden = true;
      speech.textContent = "回来啦，有个值得你看的变化。";
      document.querySelector("#acknowledge").focus({ preventScroll: true });
    },
    reduced.matches ? 0 : 2200,
  );
});
reset.addEventListener("click", () => {
  restore();
  begin.focus({ preventScroll: true });
});
document.querySelector("#acknowledge").addEventListener("click", () => {
  restore();
  speech.textContent = "好。该找你的时候，我会来。";
  begin.innerHTML = '再体验一次 <span aria-hidden="true">↗</span>';
  begin.focus({ preventScroll: true });
});
creature.addEventListener("click", () => {
  clearTimeout(greetingTimer);
  creature.classList.add("greeting");
  speech.textContent =
    world.dataset.state === "waiting"
      ? "在呢，正帮你看着。"
      : "看到你啦。有什么事，尽管交给我。";
  greetingTimer = setTimeout(() => {
    creature.classList.remove("greeting");
    speech.textContent =
      world.dataset.state === "done"
        ? "回来啦，有个值得你看的变化。"
        : initialSpeech;
  }, 2300);
});
world.addEventListener("pointermove", (event) => {
  if (reduced.matches || event.pointerType !== "mouse") return;
  const rect = creature.getBoundingClientRect();
  const x = Math.max(
    -10,
    Math.min(10, (event.clientX - rect.left - rect.width / 2) / 35),
  );
  const y = Math.max(
    -8,
    Math.min(8, (event.clientY - rect.top - rect.height / 2) / 40),
  );
  creature.style.setProperty("--eye-x", x + "px");
  creature.style.setProperty("--eye-y", y + "px");
});
world.addEventListener("pointerleave", () => {
  creature.style.setProperty("--eye-x", "0px");
  creature.style.setProperty("--eye-y", "0px");
});
document
  .querySelector("#about")
  .addEventListener("click", () => dialog.showModal());
for (const id of ["close", "back"])
  document
    .querySelector("#" + id)
    .addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () =>
  document.querySelector("#about").focus({ preventScroll: true }),
);
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !dialog.open &&
    world.dataset.state !== "idle"
  ) {
    restore();
    begin.focus({ preventScroll: true });
  }
});
