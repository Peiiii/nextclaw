const titleElement = document.querySelector("#title");
const descriptionElement = document.querySelector("#description");
const actionElement = document.querySelector("#action");
const documentCountElement = document.querySelector("#document-count");
const textBytesElement = document.querySelector("#text-bytes");
const wasmScoreElement = document.querySelector("#wasm-score");
const detailsElement = document.querySelector("#details");
const runButtonElement = document.querySelector("#run-button");

const setDetails = (payload) => {
  detailsElement.textContent = JSON.stringify(payload, null, 2);
};

const loadManifest = async () => {
  const response = await fetch("/__napp/manifest");
  const payload = await response.json();
  titleElement.textContent = payload.manifest.name;
  descriptionElement.textContent = payload.manifest.description ?? "";
  actionElement.textContent = payload.manifest.action;
  setDetails(payload);
};

const runSummary = async () => {
  runButtonElement.disabled = true;
  const response = await fetch("/__napp/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "summarizeNotes",
    }),
  });
  const payload = await response.json();
  documentCountElement.textContent = String(payload.result.input.documentCount);
  textBytesElement.textContent = String(payload.result.input.textBytes);
  wasmScoreElement.textContent = String(payload.result.output.output);
  setDetails(payload);
  runButtonElement.disabled = false;
};

runButtonElement.addEventListener("click", () => {
  void runSummary();
});

void loadManifest();
