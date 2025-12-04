// URL da API já hospedada na cloud (Render)
const apiUrl = "https://estacionamento-4m5y.onrender.com";

// Estado simples de autenticação no frontend
let usuarioLogado = null;

// Elementos da tela principal
const vagasContainer = document.getElementById("vagas-container");
const modal = document.getElementById("modal");
const fecharModal = document.getElementById("fecharModal");
const modalTitulo = document.getElementById("modalTitulo");
const conteudoModal = document.getElementById("conteudoModal");
const btnCriarVaga = document.getElementById("btnCriarVaga");
const inputNovoCodigo = document.getElementById("novoCodigo");

// Elementos de autenticação
const loginSection = document.getElementById("login-section");
const appSection = document.getElementById("app-section");
const loginNome = document.getElementById("loginNome");
const loginEmail = document.getElementById("loginEmail");
const loginSenha = document.getElementById("loginSenha");
const btnLogin = document.getElementById("btnLogin");
const btnRegistrar = document.getElementById("btnRegistrar");
const btnLogout = document.getElementById("btnLogout");
const usuarioAtualSpan = document.getElementById("usuarioAtual");

// Controle de exibição entre login e app
function mostrarApp() {
  if (!usuarioLogado) return;
  loginSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  if (usuarioAtualSpan) {
    usuarioAtualSpan.innerText = `Logado como: ${usuarioLogado.nome} (${usuarioLogado.email})`;
  }
}

function mostrarLogin() {
  appSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  if (usuarioAtualSpan) {
    usuarioAtualSpan.innerText = "";
  }
}

// Tenta restaurar usuário logado do localStorage
function restaurarSessao() {
  try {
    const salvo = localStorage.getItem("usuarioLogado");
    if (salvo) {
      usuarioLogado = JSON.parse(salvo);
      mostrarApp();
      carregarVagas();
    } else {
      mostrarLogin();
    }
  } catch (e) {
    console.error("Erro ao restaurar sessão:", e);
    mostrarLogin();
  }
}

// Ações de autenticação
async function fazerLogin() {
  const email = loginEmail.value.trim();
  const senha = loginSenha.value.trim();

  if (!email || !senha) {
    alert("Informe e-mail e senha para entrar.");
    return;
  }

  try {
    const res = await fetch(apiUrl + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(body.error || "Erro ao realizar login.");
      return;
    }

    usuarioLogado = body.usuario;
    localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));
    mostrarApp();
    carregarVagas();
  } catch (e) {
    console.error("Erro ao realizar login:", e);
    alert("Erro ao realizar login.");
  }
}

async function registrarUsuario() {
  const nome = loginNome.value.trim();
  const email = loginEmail.value.trim();
  const senha = loginSenha.value.trim();

  if (!nome || !email || !senha) {
    alert("Preencha nome, e-mail e senha para cadastrar.");
    return;
  }

  try {
    const res = await fetch(apiUrl + "/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha })
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(body.error || "Erro ao cadastrar usuário.");
      return;
    }

    alert("Usuário cadastrado com sucesso! Agora faça login.");

    // Preenche automaticamente o login
    loginEmail.value = email;
    loginSenha.value = senha;
  } catch (e) {
    console.error("Erro ao cadastrar usuário:", e);
    alert("Erro ao cadastrar usuário.");
  }
}

function fazerLogout() {
  usuarioLogado = null;
  localStorage.removeItem("usuarioLogado");
  vagasContainer.innerHTML = "";
  loginSenha.value = "";
  mostrarLogin();
}

// Carregar vagas (apenas se estiver logado)
async function carregarVagas() {
  if (!usuarioLogado) {
    return;
  }

  try {
    const res = await fetch(apiUrl + "/vagas");
    const vagas = await res.json();

    vagasContainer.innerHTML = "";

    vagas.forEach((v) => {
      const div = document.createElement("div");
      div.className = `vaga ${v.status}`;
      div.innerText = v.codigo;
      div.onclick = () => abrirModal(v);
      vagasContainer.appendChild(div);
    });
  } catch (e) {
    console.error("Erro ao carregar vagas:", e);
    vagasContainer.innerHTML = "<p>Erro ao carregar vagas.</p>";
  }
}

function abrirModal(vaga) {
  modal.classList.remove("hidden");
  modalTitulo.innerText = `Vaga ${vaga.codigo} – ${vaga.status}`;

  if (vaga.status === "LIVRE") {
    conteudoModal.innerHTML = `
      <label>Placa:</label>
      <input id="placa" type="text"/>

      <label>Cliente:</label>
      <input id="cliente" type="text"/>

      <button id="btnRegistrarEntrada">Registrar Entrada</button>
    `;

    const btn = document.getElementById("btnRegistrarEntrada");
    if (btn) {
      btn.onclick = () => registrarEntrada(vaga.id);
    }
  } else {
    conteudoModal.innerHTML = `
      <p><strong>Placa:</strong> ${vaga.placa || "-"}</p>
      <p><strong>Cliente:</strong> ${vaga.cliente || "-"}</p>
      <button id="btnRegistrarSaida">Registrar Saída</button>
    `;

    const btn = document.getElementById("btnRegistrarSaida");
    if (btn) {
      btn.onclick = () => registrarSaida(vaga.id);
    }
  }
}

async function registrarEntrada(id) {
  if (!usuarioLogado) {
    alert("Faça login antes de registrar movimentações.");
    return;
  }

  const placa = document.getElementById("placa").value;
  const cliente = document.getElementById("cliente").value;

  if (!placa || !cliente) {
    alert("Preencha placa e cliente.");
    return;
  }

  try {
    const res = await fetch(apiUrl + `/vagas/${id}/entrada`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placa,
        cliente,
        usuarioId: usuarioLogado.id,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(body.error || "Erro ao registrar entrada");
      return;
    }

    fechar();
    carregarVagas();
  } catch (e) {
    console.error("Erro ao registrar entrada:", e);
    alert("Erro ao registrar entrada.");
  }
}

async function registrarSaida(id) {
  if (!usuarioLogado) {
    alert("Faça login antes de registrar movimentações.");
    return;
  }

  try {
    const res = await fetch(apiUrl + `/vagas/${id}/saida`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioId: usuarioLogado.id,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(body.error || "Erro ao registrar saída");
      return;
    }

    fechar();
    carregarVagas();
  } catch (e) {
    console.error("Erro ao registrar saída:", e);
    alert("Erro ao registrar saída.");
  }
}

async function criarVaga() {
  if (!usuarioLogado) {
    alert("Faça login antes de criar vagas.");
    return;
  }

  const codigo = inputNovoCodigo.value.trim();
  if (!codigo) {
    alert("Informe o código da vaga (ex: A01)");
    return;
  }

  try {
    const res = await fetch(apiUrl + "/vagas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo,
        usuarioId: usuarioLogado.id,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(body.error || "Erro ao criar vaga");
      return;
    }

    inputNovoCodigo.value = "";
    carregarVagas();
  } catch (e) {
    console.error("Erro ao criar vaga:", e);
    alert("Erro ao criar vaga.");
  }
}

function fechar() {
  modal.classList.add("hidden");
}

// Ligações de eventos
if (fecharModal) {
  fecharModal.onclick = fechar;
}
if (modal) {
  modal.onclick = (e) => {
    if (e.target === modal) fechar();
  };
}
if (btnCriarVaga) {
  btnCriarVaga.onclick = criarVaga;
}
if (btnLogin) {
  btnLogin.onclick = fazerLogin;
}
if (btnRegistrar) {
  btnRegistrar.onclick = registrarUsuario;
}
if (btnLogout) {
  btnLogout.onclick = fazerLogout;
}

// Inicializa a tela
restaurarSessao();

// Expõe funções no escopo global (caso necessário em algum momento)
window.carregarVagas = carregarVagas;
window.registrarEntrada = registrarEntrada;
window.registrarSaida = registrarSaida;
