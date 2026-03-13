const API = "https://script.google.com/macros/s/AKfycbyRAyYdpFB_VLhbCCPPccto5-5-ywbQRFRSVR1eaNB1II0vPCMyNK22iBqpwfJtdPo/exec";
const PLANILHA = "https://docs.google.com/spreadsheets/d/1ItfOyHZhqiZVQcaYIq4S3Dz4PLdeu_LRwNSXFLyw5sE/edit";
const JORNADA_MINUTOS = 540;
const STORAGE_KEY = "ponto_db";

const hoje = new Date().toLocaleDateString("pt-BR");
document.getElementById("dataHoje").innerText = hoje;

let gps = "";
let endereco = "";

let dados = {
  entrada: null,
  almocoSai: null,
  almocoVolta: null,
  saida: null,
};

function hora() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function horaParaMinutos(valor) {
  if (!valor) return null;
  const [h, m] = valor.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function calcularMinutosTrabalhados(registro = dados) {
  const entrada = horaParaMinutos(registro.entrada);
  const almocoSai = horaParaMinutos(registro.almocoSai);
  const almocoVolta = horaParaMinutos(registro.almocoVolta);
  const saida = horaParaMinutos(registro.saida);

  if ([entrada, almocoSai, almocoVolta, saida].some((v) => v === null)) return null;

  const manha = almocoSai - entrada;
  const tarde = saida - almocoVolta;

  if (manha < 0 || tarde < 0) return null;
  return manha + tarde;
}

function registrarAgora() {
  if (!dados.entrada) {
    dados.entrada = hora();
    document.getElementById("entrada").innerText = dados.entrada;
  } else if (!dados.almocoSai) {
    dados.almocoSai = hora();
    document.getElementById("saidaAlmoco").innerText = dados.almocoSai;
  } else if (!dados.almocoVolta) {
    dados.almocoVolta = hora();
    document.getElementById("voltaAlmoco").innerText = dados.almocoVolta;
  } else if (!dados.saida) {
    dados.saida = hora();
    document.getElementById("saidaFinal").innerText = dados.saida;
  }
}

function obterGPS() {
  if (!navigator.geolocation) {
    document.querySelector(".gps").innerText = "GPS não suportado";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const precisao = Math.round(pos.coords.accuracy);

      gps = `${lat},${lon} (${precisao}m)`;
      document.querySelector(".gps").innerText = `GPS ativo (${precisao}m)`;

      mostrarMapa(lat, lon);
      buscarEndereco(lat, lon);
    },
    () => {
      document.querySelector(".gps").innerText = "GPS bloqueado";
    },
    { enableHighAccuracy: true }
  );
}

function mostrarMapa(lat, lon) {
  document.getElementById("mapa").innerHTML =
    `<iframe width="100%" height="200" src="https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed"></iframe>`;
}

async function buscarEndereco(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const resposta = await fetch(url);
    if (!resposta.ok) return;

    const payload = await resposta.json();
    endereco = payload.display_name || "";
    document.getElementById("endereco").innerText = endereco;
  } catch (_) {
    // endereço é opcional
  }
}

function enviarParaPlanilha(payload) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const params = new URLSearchParams();

    Object.entries(payload).forEach(([chave, valor]) => {
      params.set(chave, String(valor ?? ""));
    });

    params.set("_ts", String(Date.now()));

    const timeoutId = setTimeout(() => {
      reject(new Error("Tempo excedido na sincronização."));
    }, 12000);

    img.onload = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Erro ao enviar para planilha."));
    };

    img.src = `${API}?${params.toString()}`;
  });
}

function lerBanco() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function salvarBanco(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function arquivarDia() {
  const totalMinutos = calcularMinutosTrabalhados();
  if (totalMinutos === null) {
    alert("Registro incompleto ou inválido");
    return;
  }

  const saldo = totalMinutos - JORNADA_MINUTOS;

  const payload = {
    data: hoje,
    entrada: dados.entrada,
    almocoSai: dados.almocoSai,
    almocoVolta: dados.almocoVolta,
    saida: dados.saida,
    totalMinutos,
    saldo,
    geo: `${gps} | ${endereco}`,
  };

  document.getElementById("statusSync").innerText = "🟡 enviando...";

  enviarParaPlanilha(payload)
    .then(() => {
      document.getElementById("statusSync").innerText = "🟢 sincronizado";
      salvarLocal(payload, true);
      resetarDia();
    })
    .catch(() => {
      document.getElementById("statusSync").innerText = "🔴 erro de sincronização";
      salvarLocal(payload, false);
      alert("Falha no envio para planilha. Registro salvo localmente.");
    });
}

function salvarLocal(payload, sincronizado) {
  const banco = lerBanco();
  banco.push({
    data: payload.data,
    entrada: payload.entrada,
    almocoSai: payload.almocoSai,
    almocoVolta: payload.almocoVolta,
    saida: payload.saida,
    totalMinutos: payload.totalMinutos,
    saldo: payload.saldo,
    sincronizado: !!sincronizado,
  });

  salvarBanco(banco);
  carregarHistorico();
  if (typeof gerarGrafico === "function") gerarGrafico();
}

function carregarHistorico() {
  const banco = lerBanco();
  const tabela = document.querySelector("#historico tbody");
  tabela.innerHTML = "";

  banco.slice(-5).reverse().forEach((registro) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${registro.data}</td><td>${registro.entrada ?? "--:--"}</td><td>${registro.saida ?? "--:--"}</td>`;
    tabela.appendChild(tr);
  });
}

function baixarCSV() {
  const banco = lerBanco();
  if (banco.length === 0) {
    alert("Sem dados para exportar.");
    return;
  }

  const cabecalho = [
    "Data",
    "Entrada",
    "Saída Almoço",
    "Volta Almoço",
    "Saída Final",
    "Minutos Trabalhados",
    "Saldo (min)",
    "Sincronizado",
  ];

  const linhas = banco.map((d) => [
    d.data,
    d.entrada,
    d.almocoSai,
    d.almocoVolta,
    d.saida,
    d.totalMinutos ?? "",
    d.saldo ?? "",
    d.sincronizado ? "SIM" : "NÃO",
  ]);

  const csv = [cabecalho, ...linhas]
    .map((colunas) => colunas.map((valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ponto-pro-${hoje.replaceAll("/", "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function abrirPlanilha() {
  window.location.href = PLANILHA;
}

function resetarDia() {
  dados = { entrada: null, almocoSai: null, almocoVolta: null, saida: null };
  document.getElementById("entrada").innerText = "--:--";
  document.getElementById("saidaAlmoco").innerText = "--:--";
  document.getElementById("voltaAlmoco").innerText = "--:--";
  document.getElementById("saidaFinal").innerText = "--:--";
}

function abrirAjuste() {
  const painel = document.getElementById("painelAjuste");
  if (painel.style.display === "none" || painel.style.display === "") {
    painel.style.display = "block";
    document.getElementById("ajEntrada").value = dados.entrada || "";
    document.getElementById("ajAlmocoSai").value = dados.almocoSai || "";
    document.getElementById("ajAlmocoVolta").value = dados.almocoVolta || "";
    document.getElementById("ajSaida").value = dados.saida || "";
  } else {
    painel.style.display = "none";
  }
}

function salvarAjuste() {
  dados.entrada = document.getElementById("ajEntrada").value || null;
  dados.almocoSai = document.getElementById("ajAlmocoSai").value || null;
  dados.almocoVolta = document.getElementById("ajAlmocoVolta").value || null;
  dados.saida = document.getElementById("ajSaida").value || null;

  document.getElementById("entrada").innerText = dados.entrada || "--:--";
  document.getElementById("saidaAlmoco").innerText = dados.almocoSai || "--:--";
  document.getElementById("voltaAlmoco").innerText = dados.almocoVolta || "--:--";
  document.getElementById("saidaFinal").innerText = dados.saida || "--:--";

  alert("Horário ajustado");
}

window.addEventListener("load", () => {
  obterGPS();
  carregarHistorico();
  if (typeof gerarGrafico === "function") gerarGrafico();
});
