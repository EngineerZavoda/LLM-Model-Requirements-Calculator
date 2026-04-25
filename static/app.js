const form = document.getElementById("check-form");
const submitBtn = document.getElementById("submit-btn");
const errorEl = document.getElementById("error");
const resultPanel = document.getElementById("result-panel");
const recommendationEl = document.getElementById("recommendation");
const platformEl = document.getElementById("platform");
const ramLabelEl = document.getElementById("ram_label");
const vramLabelEl = document.getElementById("vram_label");
const gpuLabelEl = document.getElementById("gpu_label");
const platformHintEl = document.getElementById("platform_hint");
const hasGpuFieldEl = document.getElementById("has_gpu_field");
const hasGpuEl = document.getElementById("has_gpu");
const weightsEl = document.getElementById("weights");
const kvCacheEl = document.getElementById("kv_cache");
const totalEl = document.getElementById("total");
const quantizationsEl = document.getElementById("quantizations");
const statusChip = document.getElementById("status-chip");

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toGB(value) {
  return `${asNumber(value).toFixed(1)} GB`;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Считаем..." : "Проверить модель";
  statusChip.textContent = isLoading ? "Расчет" : "Готово";
}

function applyPlatformPreset() {
  const platform = platformEl.value;
  const ramInput = document.getElementById("ram_gb");
  const vramInput = document.getElementById("vram_gb");
  const gpuInput = document.getElementById("gpu_name");
  const osInput = document.getElementById("os");

  if (platform === "mac") {
    ramLabelEl.textContent = "Unified Memory, GB";
    vramLabelEl.textContent = "Память под GPU, GB";
    gpuLabelEl.textContent = "Apple GPU/Chip";
    hasGpuFieldEl.classList.add("hidden");
    hasGpuEl.checked = true;

    if (!ramInput.value || asNumber(ramInput.value) === 32) ramInput.value = "36";
    if (!vramInput.value || asNumber(vramInput.value) === 12) vramInput.value = ramInput.value;
    if (!gpuInput.value || gpuInput.value === "NVIDIA RTX 3060") gpuInput.value = "Apple M3 Pro";
    if (!osInput.value || osInput.value === "Linux") osInput.value = "macOS";

    platformHintEl.textContent = "Для Mac (особенно Apple Silicon) обычно используется объединенная память. Часто имеет смысл ставить GPU память близкой к Unified Memory.";
    return;
  }

  ramLabelEl.textContent = "RAM, GB";
  vramLabelEl.textContent = "VRAM, GB";
  gpuLabelEl.textContent = "GPU";
  hasGpuFieldEl.classList.remove("hidden");

  if (!gpuInput.value || gpuInput.value === "Apple M3 Pro") gpuInput.value = "NVIDIA RTX 3060";
  if (!osInput.value || osInput.value === "macOS") osInput.value = "Linux";
  if (!vramInput.value || asNumber(vramInput.value) === asNumber(ramInput.value)) vramInput.value = "12";

  platformHintEl.textContent = "Для PC указывайте отдельные RAM и VRAM. Если дискретной видеокарты нет, снимите галочку \"Есть GPU\".";
}

function collectPayload() {
  const modelName = document.getElementById("model_name").value.trim();
  const mode = document.getElementById("mode").value;
  const platform = platformEl.value;
  const hasGpu = platform === "mac" ? true : hasGpuEl.checked;

  return {
    model_name: modelName,
    mode,
    system_info: {
      ram_gb: asNumber(document.getElementById("ram_gb").value),
      vram_gb: asNumber(document.getElementById("vram_gb").value),
      has_gpu: hasGpu,
      gpu_name: document.getElementById("gpu_name").value.trim() || "Unknown",
      os: document.getElementById("os").value.trim() || "Unknown",
      cpu_cores: asNumber(document.getElementById("cpu_cores").value) || 1,
    },
  };
}

function renderQuantizations(quantizations) {
  quantizationsEl.innerHTML = "";
  const entries = Object.entries(quantizations || {}).sort((a, b) => a[1] - b[1]);
  if (!entries.length) {
    quantizationsEl.innerHTML = '<p class="muted">Нет данных</p>';
    return;
  }

  for (const [name, value] of entries) {
    const row = document.createElement("div");
    row.className = "quant-item";
    row.innerHTML = `<span>${name}</span><strong>${toGB(value)}</strong>`;
    quantizationsEl.appendChild(row);
  }
}

function renderResult(data) {
  recommendationEl.textContent = data.recommendation || "Нет рекомендации";
  weightsEl.textContent = toGB(data.memory_requirements?.weights_gb);
  kvCacheEl.textContent = toGB(data.memory_requirements?.kv_cache_gb);
  totalEl.textContent = toGB(data.memory_requirements?.total_vram_gb);
  renderQuantizations(data.possible_quantizations);
  resultPanel.classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const payload = collectPayload();
  if (!payload.model_name) {
    errorEl.textContent = "Введите название модели.";
    return;
  }

  setLoading(true);

  try {
    const response = await fetch("/api/check_model", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      const details = data?.detail || "Не удалось выполнить расчет.";
      throw new Error(String(details));
    }

    renderResult(data);
  } catch (error) {
    errorEl.textContent = error.message || "Ошибка сети. Проверьте сервер.";
  } finally {
    setLoading(false);
  }
});

platformEl.addEventListener("change", applyPlatformPreset);
applyPlatformPreset();
