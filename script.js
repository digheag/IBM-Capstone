/**
 * script.js — Spotify Top 2018 Analytics Dashboard
 * Vanilla JavaScript · Chart.js v4 · Data dari top2018.json
 *
 * Arsitektur:
 *  1. Ambil data JSON
 *  2. Populate filter dropdown artis
 *  3. Render semua KPI & chart berdasarkan data yang sudah difilter
 *  4. Pasang event listener filter → re-render semua elemen
 */

'use strict';

/* ============================================================
   KONSTANTA WARNA TEMA (Spotify-inspired)
   ============================================================ */
const COLORS = {
  green:   '#1DB954',
  teal:    '#1ed760',
  purple:  '#9b59b6',
  blue:    '#3498db',
  orange:  '#e67e22',
  pink:    '#e91e63',
  cyan:    '#00bcd4',
  yellow:  '#f1c40f',
  red:     '#e74c3c',
  indigo:  '#5c6bc0',
  muted:   '#B3B3B3',
  card:    '#282828',
  white:   '#FFFFFF',
};

/** Palet warna berulang untuk chart multi-kategori */
const PALETTE = [
  COLORS.green, COLORS.blue, COLORS.purple, COLORS.orange, COLORS.pink,
  COLORS.cyan,  COLORS.yellow, COLORS.red, COLORS.indigo, COLORS.teal,
];

/** Nama not musikal berdasarkan indeks Pitch Class (0-11) */
const KEY_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/* ============================================================
   KONFIGURASI DEFAULT CHART.JS
   ============================================================ */
Chart.defaults.color = COLORS.muted;
Chart.defaults.font.family = "'Segoe UI', system-ui, -apple-system, sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.plugins.tooltip.backgroundColor = COLORS.card;
Chart.defaults.plugins.tooltip.titleColor      = COLORS.white;
Chart.defaults.plugins.tooltip.bodyColor       = COLORS.muted;
Chart.defaults.plugins.tooltip.borderColor     = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.cornerRadius    = 8;

/* ============================================================
   STATE GLOBAL
   Menyimpan referensi instance Chart.js agar bisa di-destroy
   sebelum re-render saat filter berubah.
   ============================================================ */
const charts = {};

/* ============================================================
   UTILITAS
   ============================================================ */

/** Hitung rata-rata array angka */
const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

/** Bulatkan ke N desimal */
const round = (n, d = 2) => +n.toFixed(d);

/** Hapus & buat ulang chart (hindari memory leak) */
function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

/* ============================================================
   ENTRY POINT — ambil data JSON lalu inisialisasi dashboard
   ============================================================ */
fetch('top2018.json')
  .then(res => {
    if (!res.ok) throw new Error(`Gagal memuat data: ${res.status}`);
    return res.json();
  })
  .then(data => initDashboard(data))
  .catch(err => {
    document.querySelector('main').innerHTML =
      `<div class="text-center py-20 text-red-400 font-semibold">
         ⚠️ ${err.message}<br>
         <span class="text-sm font-normal text-spotify-muted">
           Pastikan file top2018.json tersedia di folder yang sama dengan index.html,
           dan dashboard dijalankan melalui server lokal (misalnya Live Server).
         </span>
       </div>`;
    console.error(err);
  });

/* ============================================================
   INISIALISASI DASHBOARD
   ============================================================ */
function initDashboard(rawData) {

  // 1. Isi dropdown artis dari data
  populateArtistFilter(rawData);

  // 2. Render pertama dengan data penuh
  renderDashboard(rawData);

  // 3. Pasang event listener untuk semua filter
  attachFilters(rawData);
}

/* ============================================================
   POPULATE FILTER ARTIS
   ============================================================ */
function populateArtistFilter(data) {
  const sel = document.getElementById('filter-artist');
  // Kumpulkan semua artis unik, urutkan alfabetis
  const artists = [...new Set(data.map(d => d.artists))].sort();
  artists.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  });
}

/* ============================================================
   EVENT LISTENERS FILTER
   ============================================================ */
function attachFilters(rawData) {
  const selArtist   = document.getElementById('filter-artist');
  const selKey      = document.getElementById('filter-key');
  const selMode     = document.getElementById('filter-mode');
  const rangeMin    = document.getElementById('filter-tempo-min');
  const rangeMax    = document.getElementById('filter-tempo-max');
  const tempoLabel  = document.getElementById('tempo-label');
  const btnReset    = document.getElementById('btn-reset');

  /** Baca nilai filter saat ini dan kembalikan data yang sudah difilter */
  function getFiltered() {
    const artist  = selArtist.value;
    const key     = selKey.value;
    const mode    = selMode.value;
    let   tMin    = +rangeMin.value;
    let   tMax    = +rangeMax.value;

    // Pastikan min ≤ max
    if (tMin > tMax) { [tMin, tMax] = [tMax, tMin]; }

    // Update label tempo
    tempoLabel.textContent = `${tMin} – ${tMax}`;

    return rawData.filter(d =>
      (artist === '' || d.artists === artist) &&
      (key    === '' || d.key    === +key)    &&
      (mode   === '' || d.mode   === +mode)   &&
      d.tempo >= tMin && d.tempo <= tMax
    );
  }

  /** Handler umum untuk semua filter */
  function handleFilterChange() {
    const filtered = getFiltered();
    renderDashboard(filtered);
  }

  selArtist.addEventListener('change', handleFilterChange);
  selKey.addEventListener('change',    handleFilterChange);
  selMode.addEventListener('change',   handleFilterChange);
  rangeMin.addEventListener('input',   handleFilterChange);
  rangeMax.addEventListener('input',   handleFilterChange);

  // Tombol reset — kembalikan semua filter ke default
  btnReset.addEventListener('click', () => {
    selArtist.value   = '';
    selKey.value      = '';
    selMode.value     = '';
    rangeMin.value    = 60;
    rangeMax.value    = 220;
    tempoLabel.textContent = '60 – 220';
    renderDashboard(rawData);
  });
}

/* ============================================================
   RENDER DASHBOARD
   Dipanggil setiap kali filter berubah.
   ============================================================ */
function renderDashboard(data) {
  updateKPIs(data);
  renderTopArtists(data);
  renderScatter(data);
  renderKeyMode(data);
  renderRadar(data);
  renderTempoHistogram(data);
  renderLongestSongs(data);
}

/* ============================================================
   KPI — Perbarui kartu metrik utama
   ============================================================ */
function updateKPIs(data) {
  const n = data.length;

  document.getElementById('badge-count').textContent = `${n} lagu`;
  document.getElementById('kpi-total').textContent   = n;

  if (n === 0) {
    ['kpi-dance','kpi-energy','kpi-tempo','kpi-duration'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    return;
  }

  document.getElementById('kpi-dance').textContent    = round(avg(data.map(d => d.danceability)), 3);
  document.getElementById('kpi-energy').textContent   = round(avg(data.map(d => d.energy)), 3);
  document.getElementById('kpi-tempo').textContent    = round(avg(data.map(d => d.tempo)), 1);

  const avgDurMin = avg(data.map(d => d.duration_ms)) / 60000;
  document.getElementById('kpi-duration').textContent = round(avgDurMin, 2) + ' min';
}

/* ============================================================
   CHART 1 — Top 10 Artis (Horizontal Bar)
   ============================================================ */
function renderTopArtists(data) {
  destroyChart('topArtists');

  // Hitung jumlah lagu per artis
  const counts = {};
  data.forEach(d => { counts[d.artists] = (counts[d.artists] || 0) + 1; });

  // Ambil 10 teratas, urutkan descending
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);

  const ctx = document.getElementById('chart-top-artists').getContext('2d');
  charts['topArtists'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Lagu',
        data: values,
        backgroundColor: PALETTE.slice(0, values.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',       // horizontal bar
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.x} lagu`
          }
        }
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.07)' },
          ticks: { color: COLORS.muted, stepSize: 1 },
          title: { display: true, text: 'Jumlah Lagu', color: COLORS.muted, font: { size: 10 } }
        },
        y: {
          grid:  { display: false },
          ticks: { color: COLORS.white, font: { size: 11 } }
        }
      }
    }
  });
}

/* ============================================================
   CHART 2 — Scatter: Danceability vs Energy
   ============================================================ */
function renderScatter(data) {
  destroyChart('scatter');

  const points = data.map(d => ({
    x: d.danceability,
    y: d.energy,
    name: d.name,
    artist: d.artists,
  }));

  const ctx = document.getElementById('chart-scatter').getContext('2d');
  charts['scatter'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Lagu',
        data: points,
        backgroundColor: COLORS.green + 'CC',   // 80% opacity
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw;
              return [`${p.name}`, `${p.artist}`, `Dance: ${p.x}  Energy: ${p.y}`];
            }
          }
        }
      },
      scales: {
        x: {
          min: 0, max: 1,
          grid:  { color: 'rgba(255,255,255,0.07)' },
          ticks: { color: COLORS.muted },
          title: { display: true, text: 'Danceability', color: COLORS.muted, font: { size: 10 } }
        },
        y: {
          min: 0, max: 1,
          grid:  { color: 'rgba(255,255,255,0.07)' },
          ticks: { color: COLORS.muted },
          title: { display: true, text: 'Energy', color: COLORS.muted, font: { size: 10 } }
        }
      }
    }
  });
}

/* ============================================================
   CHART 3 — Doughnut: Distribusi Key & Mode
   Setiap segmen = kombinasi Key + Mode (Major/Minor)
   ============================================================ */
function renderKeyMode(data) {
  destroyChart('keyMode');

  // Hitung kemunculan setiap kombinasi key-mode
  const counts = {};
  data.forEach(d => {
    const label = `${KEY_NAMES[d.key]} ${d.mode === 1 ? 'Major' : 'Minor'}`;
    counts[label] = (counts[label] || 0) + 1;
  });

  // Urutkan berdasarkan frekuensi (descending), ambil max 12
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  const ctx = document.getElementById('chart-key-mode').getContext('2d');
  charts['keyMode'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#282828',
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 10 }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} lagu`
          }
        }
      }
    }
  });
}

/* ============================================================
   CHART 4 — Radar: Rata-rata Fitur Audio
   ============================================================ */
function renderRadar(data) {
  destroyChart('radar');

  if (data.length === 0) {
    destroyChart('radar');
    return;
  }

  const features = [
    { label: 'Danceability',     key: 'danceability'     },
    { label: 'Energy',           key: 'energy'           },
    { label: 'Speechiness',      key: 'speechiness'      },
    { label: 'Acousticness',     key: 'acousticness'     },
    { label: 'Instrumentalness', key: 'instrumentalness' },
    { label: 'Liveness',         key: 'liveness'         },
    { label: 'Valence',          key: 'valence'          },
  ];

  const labels = features.map(f => f.label);
  const values = features.map(f => round(avg(data.map(d => d[f.key])), 3));

  const ctx = document.getElementById('chart-radar').getContext('2d');
  charts['radar'] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Rata-rata',
        data: values,
        backgroundColor: COLORS.green + '33',   // 20% opacity fill
        borderColor:     COLORS.green,
        pointBackgroundColor: COLORS.green,
        pointBorderColor:     '#fff',
        pointRadius: 4,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0, max: 1,
          grid:        { color: 'rgba(255,255,255,0.1)' },
          angleLines:  { color: 'rgba(255,255,255,0.1)' },
          pointLabels: { color: COLORS.white, font: { size: 10 } },
          ticks: {
            color:           COLORS.muted,
            backdropColor:   'transparent',
            stepSize:        0.2,
            font:            { size: 9 },
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.r}`
          }
        }
      }
    }
  });
}

/* ============================================================
   CHART 5 — Histogram: Distribusi Tempo
   Bin lebar 20 BPM dari 60 hingga 220
   ============================================================ */
function renderTempoHistogram(data) {
  destroyChart('tempoHist');

  const BIN_SIZE   = 20;
  const BIN_START  = 60;
  const BIN_END    = 220;
  const binCount   = (BIN_END - BIN_START) / BIN_SIZE;

  // Inisialisasi bin
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: `${BIN_START + i * BIN_SIZE}–${BIN_START + (i + 1) * BIN_SIZE}`,
    count: 0,
  }));

  // Masukkan setiap lagu ke bin yang sesuai
  data.forEach(d => {
    const idx = Math.min(
      Math.floor((d.tempo - BIN_START) / BIN_SIZE),
      binCount - 1
    );
    if (idx >= 0) bins[idx].count++;
  });

  const labels = bins.map(b => b.label);
  const values = bins.map(b => b.count);

  const ctx = document.getElementById('chart-tempo-hist').getContext('2d');
  charts['tempoHist'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Lagu',
        data: values,
        backgroundColor: COLORS.purple + 'CC',
        borderColor:     COLORS.purple,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} lagu`
          }
        }
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { color: COLORS.muted, font: { size: 9 } },
          title: { display: true, text: 'BPM (Bin)', color: COLORS.muted, font: { size: 10 } }
        },
        y: {
          grid:  { color: 'rgba(255,255,255,0.07)' },
          ticks: { color: COLORS.muted, stepSize: 2 },
          title: { display: true, text: 'Jumlah Lagu', color: COLORS.muted, font: { size: 10 } }
        }
      }
    }
  });
}

/* ============================================================
   CHART 6 — Horizontal Bar: Top 10 Lagu Terlama
   ============================================================ */
function renderLongestSongs(data) {
  destroyChart('longest');

  // Urutkan descending berdasarkan durasi_ms, ambil 10 teratas
  const top10 = [...data]
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 10);

  const labels   = top10.map(d => truncate(d.name, 28));
  const minutes  = top10.map(d => round(d.duration_ms / 60000, 2));
  const artists  = top10.map(d => d.artists);

  const ctx = document.getElementById('chart-longest').getContext('2d');
  charts['longest'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Durasi (menit)',
        data: minutes,
        backgroundColor: top10.map((_, i) => PALETTE[i % PALETTE.length] + 'CC'),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${labels[items[0].dataIndex]}`,
            label: (ctx) => ` ${artists[ctx.dataIndex]}  —  ${ctx.parsed.x} menit`
          }
        }
      },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.07)' },
          ticks: { color: COLORS.muted },
          title: { display: true, text: 'Durasi (menit)', color: COLORS.muted, font: { size: 10 } }
        },
        y: {
          grid:  { display: false },
          ticks: { color: COLORS.white, font: { size: 10 } }
        }
      }
    }
  });
}

/* ============================================================
   HELPER — Potong teks jika terlalu panjang
   ============================================================ */
function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
