'use strict';

/*
 * comum.js — funções usadas por várias telas.
 * Depende de dados.js (carregar antes).
 */
const Util = {
    // minúsculas e sem acento, para buscas ("joao" encontra "João")
    normalizar: (texto) => String(texto ?? '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(),

    // evita que texto digitado vire HTML ao montar a tabela com innerHTML
    esc: (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    )),

    // data de hoje no formato AAAA-MM-DD (o mesmo do <input type="date">)
    hoje() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    formatarData(iso) {
        if (!iso) return '—';
        const [ano, mes, dia] = iso.split('-');
        return `${dia}/${mes}/${ano}`;
    },

    // o toLocaleString usa um espaço "não separável" depois do R$; troca por espaço comum
    formatarMoeda: (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' '),

    // "R$ 1.234,56" -> 1234.56  |  "10.5" -> 10.5  |  "" -> null
    paraNumero(texto) {
        let t = String(texto ?? '').replace(/[^\d,.]/g, '');
        if (!t) return null;
        if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
        const n = parseFloat(t);
        return Number.isNaN(n) ? null : n;
    },

    // Datas trabalham em UTC para o horário de verão/fuso não afetar a contagem de dias
    _utc(iso) {
        const [a, m, d] = iso.split('-').map(Number);
        return Date.UTC(a, m - 1, d);
    },
    diasEntre(inicio, fim) {
        return Math.round((Util._utc(fim) - Util._utc(inicio)) / 86400000);
    },
    somarDias(iso, n) {
        return new Date(Util._utc(iso) + n * 86400000).toISOString().slice(0, 10);
    },

    nomeCompleto: (usuario) => [usuario.nome, usuario.sobrenome].filter(Boolean).join(' '),

    // Lê um arquivo escolhido no <input type="file"> como texto base64 (data URL)
    lerArquivo: (arquivo) => new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(leitor.error);
        leitor.readAsDataURL(arquivo);
    }),

    // Lê a imagem escolhida em um <input type="file"> (limite de 500 KB por causa do localStorage).
    // Devolve null se nada foi escolhido; lança Error com mensagem amigável se for inválida.
    async lerImagem(input) {
        const arquivo = input.files[0];
        if (!arquivo) return null;
        if (!arquivo.type.startsWith('image/')) throw new Error('O arquivo escolhido não é uma imagem.');
        if (arquivo.size > 500 * 1024) throw new Error('A imagem passa de 500 KB.');
        return Util.lerArquivo(arquivo);
    },

    mostrarErro(form, mensagem) {
        let p = form.querySelector('.mensagem-erro');
        if (!p) {
            p = document.createElement('p');
            p.className = 'mensagem-erro';
            p.setAttribute('role', 'alert');
            p.style.color = '#c00';
            form.prepend(p);
        }
        p.textContent = mensagem;
    },

    limparErro(form) {
        const p = form.querySelector('.mensagem-erro');
        if (p) p.remove();
    },

    mostrarNaoEncontrado(titulo, voltar, textoErro) {
        document.querySelector('.main').innerHTML =
            `<h2>${Util.esc(titulo)}</h2><p>${Util.esc(textoErro)}</p><a href="${voltar}" class="botao-voltar">&larr; Voltar</a>`;
    }
};

const Regras = {
    STATUS: {
        'reservado': 'Reservado',
        'em-andamento': 'Em andamento',
        'finalizado': 'Finalizado',
        'cancelado': 'Cancelado'
    },
    TIPOS: { cachorro: 'Cachorro', gato: 'Gato', outro: 'Outro' },
    TAMANHOS: { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' },
    FUNCOES: { cliente: 'Cliente', funcionario: 'Funcionário', gerente: 'Gerente' },
    SITUACOES: { ativo: 'Ativo', inativo: 'Inativo' },

    // acha um usuário pelo nome completo ou pelo e-mail digitado
    acharUsuario(texto) {
        const alvo = Util.normalizar(texto);
        if (!alvo) return null;
        return BD.usuarios.listar().find(
            (u) => Util.normalizar(Util.nomeCompleto(u)) === alvo || Util.normalizar(u.email) === alvo
        ) || null;
    },

    // reservas que ocupam uma vaga no hotel
    STATUS_ATIVOS: ['reservado', 'em-andamento'],

    // total = número de diárias (noites) x valor da diária nas Configurações.
    // Chegada e partida no mesmo dia contam como 1 diária.
    calcularTotal(chegada, partida) {
        if (!chegada || !partida || partida < chegada) return 0;
        const diarias = Math.max(1, Util.diasEntre(chegada, partida));
        return diarias * BD.config.obter().valorDiaria;
    },

    // Retorna o primeiro dia (AAAA-MM-DD) sem vaga no período, ou null se há vaga em todos.
    // `ignorarId` serve para não contar a própria reserva ao editá-la.
    primeiroDiaSemVaga(chegada, partida, ignorarId) {
        const vagas = BD.config.obter().vagas;
        const ativas = BD.reservas.listar().filter(
            (r) => r.id !== ignorarId && Regras.STATUS_ATIVOS.includes(r.status)
        );
        const noites = Math.max(1, Util.diasEntre(chegada, partida));
        for (let i = 0; i < noites; i++) {
            const dia = Util.somarDias(chegada, i);
            const ocupadas = ativas.filter(
                (r) => r.chegada <= dia && (dia < r.partida || dia === r.chegada)
            ).length;
            if (ocupadas >= vagas) return dia;
        }
        return null;
    }
};

// ---------- Página atual, login e navegação (menu, breadcrumb, topo) ----------

const Pagina = (() => {
    const nome = location.pathname.split('/').pop().replace(/\.html$/, '');
    const params = new URLSearchParams(location.search);
    const publica = nome === 'login' || nome === 'criar-conta';
    let autenticada = publica;

    // Páginas internas exigem login: sem sessão válida, volta para o login.
    if (!publica) {
        const logado = BD.sessao() && BD.usuarios.obter(BD.sessao());
        if (logado) {
            autenticada = true;
        } else {
            BD.sair();
            location.replace('login.html');
        }
    }
    return { nome, params, publica, autenticada };
})();

(function montarNavegacao() {
    if (!Pagina.autenticada || Pagina.publica) return;
    const { nome, params } = Pagina;
    const idNaUrl = params.get('id');

    // --- menu lateral: item ativo conforme a página ---
    const secoes = {
        'pets': 'pets', 'cadastrar-pet': 'pets', 'editar-pet': 'pets', 'visualizar-pet': 'pets',
        'usuarios': 'usuarios', 'cadastrar-usuario': 'usuarios',
        'editar-perfil': idNaUrl ? 'usuarios' : null, // sem id = perfil do próprio usuário logado
        'configuracoes': 'configuracoes',
        'reservas': 'reservas', 'fazer-reserva': 'reservas', 'editar-reserva': 'reservas', 'ver-reserva': 'reservas'
    };
    const itens = [
        ['pets', 'Pet', 'pets.html'],
        ['usuarios', 'Usuários', 'usuarios.html'],
        ['configuracoes', 'Configurações', 'configuracoes.html'],
        ['reservas', 'Reservas', 'reservas.html']
    ];
    const menu = document.querySelector('.sidebar ul');
    if (menu) {
        menu.innerHTML = itens.map(([chave, texto, href]) =>
            `<li><a href="${href}"${secoes[nome] === chave ? ' class="ativo"' : ''}>${texto}</a></li>`).join('');
    }

    // --- breadcrumb: [texto, link?] ---
    const home = ['Home', 'reservas.html'];
    const migalhas = {
        'reservas': [home, ['Reservas']],
        'fazer-reserva': [home, ['Reservas', 'reservas.html'], ['Nova reserva']],
        'editar-reserva': [home, ['Reservas', 'reservas.html'], ['Editar reserva']],
        'ver-reserva': [home, ['Reservas', 'reservas.html'], ['Ver reserva']],
        'pets': [home, ['Pets']],
        'cadastrar-pet': [home, ['Pets', 'pets.html'], ['Novo pet']],
        'editar-pet': [home, ['Pets', 'pets.html'], ['Editar pet']],
        'visualizar-pet': [home, ['Pets', 'pets.html'], ['Ver pet']],
        'usuarios': [home, ['Usuários']],
        'cadastrar-usuario': [home, ['Usuários', 'usuarios.html'], ['Novo usuário']],
        'editar-perfil': idNaUrl
            ? [home, ['Usuários', 'usuarios.html'], [params.get('modo') === 'ver' ? 'Ver usuário' : 'Editar usuário']]
            : [home, ['Editar perfil']],
        'configuracoes': [home, ['Configurações']]
    };
    const trilha = document.querySelector('.breadcrumb');
    if (trilha && migalhas[nome]) {
        trilha.innerHTML = migalhas[nome]
            .map(([texto, href]) => (href ? `<a href="${href}">${texto}</a>` : texto)).join(' / ');
    }

    // --- topo: nome/foto do usuário logado (clique abre o perfil) e botão Sair ---
    const topo = document.querySelector('.topo');
    const perfil = document.querySelector('.topo .perfil');
    const usuario = BD.usuarios.obter(BD.sessao());
    if (perfil && usuario) {
        const nomeTopo = perfil.querySelector('span');
        if (nomeTopo) nomeTopo.textContent = Util.nomeCompleto(usuario);
        const foto = perfil.querySelector('img');
        if (foto && usuario.foto) foto.src = usuario.foto;
        perfil.style.cursor = 'pointer';
        perfil.addEventListener('click', () => { location.href = 'editar-perfil.html'; });
    }
    if (topo) {
        const sair = document.createElement('a');
        sair.href = 'login.html';
        sair.textContent = 'Sair';
        sair.style.marginLeft = '16px';
        sair.addEventListener('click', (e) => {
            e.preventDefault();
            BD.sair();
            location.href = 'login.html';
        });
        topo.append(sair);
    }
})();
