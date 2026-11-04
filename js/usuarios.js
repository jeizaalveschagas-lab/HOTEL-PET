'use strict';

/*
 * usuarios.js — telas de Usuários (listar, cadastrar, editar/ver e perfil).
 * Depende de dados.js e comum.js (carregar antes).
 *
 * editar-perfil.html serve a três usos:
 *   ?id=X            -> editar o usuário X (gerente)
 *   ?id=X&modo=ver   -> só visualizar o usuário X
 *   (sem id)         -> editar o próprio perfil (usuário logado)
 */
(function () {
    if (!Pagina.autenticada) return; // sem login, o comum.js já redirecionou

    const telas = {
        'usuarios': telaListagem,
        'cadastrar-usuario': telaCadastrar,
        'editar-perfil': telaEditar
    };
    if (telas[Pagina.nome]) telas[Pagina.nome]();

    // ---------- auxiliares ----------

    // e-mail já usado por outro usuário? (`ignorarId` evita acusar o próprio usuário ao editar)
    function emailEmUso(email, ignorarId) {
        const alvo = Util.normalizar(email);
        return BD.usuarios.listar().some((u) => u.id !== ignorarId && Util.normalizar(u.email) === alvo);
    }

    // ---------- usuarios.html ----------

    // Depois de remover ou inativar `idSaindo`, ainda sobra algum gerente ativo?
    function restaGerenteAtivo(idSaindo) {
        return BD.usuarios.listar().some(
            (u) => u.id !== idSaindo && u.funcao === 'gerente' && u.status === 'ativo'
        );
    }

    function telaListagem() {
        const form = document.querySelector('form.filtros');
        const tabela = document.querySelector('table');
        const corpo = tabela.querySelector('tbody');
        const cabecalhos = tabela.querySelectorAll('thead th');
        const barraAcoes = document.querySelector('.acoes-usuarios');
        const linksModo = document.querySelectorAll('.visualizar-por a');
        const valor = (nome) => form.elements.namedItem(nome).value.trim();
        // colunas: [seleção, foto, email, nome, função, status, criado em, ações]
        const colunas = [null, null, 'email', 'nomeCompleto', 'funcao', 'status', 'criadoEm', null];
        const ordem = Tabela.ligarOrdenacao(cabecalhos, colunas, desenhar);
        let modo = 'usuarios'; // 'usuarios' = lista simples | 'funcao' = agrupada por função

        // caixa no cabeçalho que marca/desmarca todas as linhas
        const marcarTodos = document.createElement('input');
        marcarTodos.type = 'checkbox';
        marcarTodos.setAttribute('aria-label', 'Selecionar todos');
        cabecalhos[0].append(marcarTodos);
        marcarTodos.addEventListener('change', () => {
            corpo.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.checked = marcarTodos.checked; });
        });

        // mensagem do resultado das ações (Ativo / Remover / Mudar status)
        const mensagem = document.createElement('p');
        mensagem.setAttribute('role', 'status');
        mensagem.style.margin = '0 0 12px';
        barraAcoes.after(mensagem);

        function avisar(texto, erro) {
            mensagem.textContent = texto;
            mensagem.style.color = erro ? '#c00' : '#0a7a2f';
        }

        function validarFiltros() {
            const de = valor('criado-em');
            const ate = valor('criado-ate');
            return de && ate && de > ate ? 'Em "criado em", a data inicial não pode ser depois da final.' : null;
        }

        function filtrar(lista) {
            const id = valor('id');
            const de = valor('criado-em');
            const ate = valor('criado-ate');
            const email = Util.normalizar(valor('email'));
            const nome = Util.normalizar(valor('nome'));
            const status = valor('status');
            const funcao = valor('funcao');
            return lista.filter((u) =>
                (!id || u.id.includes(id)) &&
                (!de || u.criadoEm >= de) &&
                (!ate || u.criadoEm <= ate) &&
                (!email || Util.normalizar(u.email).includes(email)) &&
                (!nome || Util.normalizar(u.nomeCompleto).includes(nome)) &&
                (!status || u.status === status) &&
                (!funcao || u.funcao === funcao)
            );
        }

        const linha = (u) => `
            <tr data-id="${Util.esc(u.id)}">
                <td><input type="checkbox" aria-label="Selecionar ${Util.esc(u.nomeCompleto)}"></td>
                <td><img src="${Util.esc(u.foto || 'img/perfil.png')}" alt="Foto de ${Util.esc(u.nomeCompleto)}" class="miniatura"></td>
                <td>${Util.esc(u.email)}</td>
                <td>${Util.esc(u.nomeCompleto)}</td>
                <td>${Regras.FUNCOES[u.funcao] || Util.esc(u.funcao)}</td>
                <td>${Regras.SITUACOES[u.status] || Util.esc(u.status)}</td>
                <td>${Util.formatarData(u.criadoEm)}</td>
                <td>
                    <a href="editar-perfil.html?id=${encodeURIComponent(u.id)}">Editar</a>
                    <a href="editar-perfil.html?id=${encodeURIComponent(u.id)}&modo=ver">Visualizar</a>
                </td>
            </tr>`;

        function desenhar() {
            const erro = validarFiltros();
            if (erro) return Tabela.mostrarAviso(form, erro); // mantém a tabela como estava
            Tabela.limparAviso(form);

            const todos = BD.usuarios.listar().map((u) => ({ ...u, nomeCompleto: Util.nomeCompleto(u) }));
            const lista = Tabela.ordenar(filtrar(todos), ordem);
            Tabela.mostrarContagem(tabela, lista.length);
            marcarTodos.checked = false;

            if (lista.length === 0) {
                corpo.innerHTML = '<tr><td colspan="8">Nenhum usuário encontrado.</td></tr>';
            } else if (modo === 'funcao') {
                // agrupa por função, cada grupo com um título (a ordenação vale dentro do grupo)
                corpo.innerHTML = ['gerente', 'funcionario', 'cliente'].map((funcao) => {
                    const grupo = lista.filter((u) => u.funcao === funcao);
                    if (grupo.length === 0) return '';
                    return `<tr class="grupo-funcao"><td colspan="8" style="background:#f0e9e2">` +
                        `<strong>${Regras.FUNCOES[funcao]}</strong> (${grupo.length})</td></tr>` + grupo.map(linha).join('');
                }).join('');
            } else {
                corpo.innerHTML = lista.map(linha).join('');
            }
        }

        // ---- ações sobre os usuários marcados ----

        function selecionados() {
            const marcados = [...corpo.querySelectorAll('tr[data-id] input[type="checkbox"]:checked')]
                .map((c) => BD.usuarios.obter(c.closest('tr').dataset.id))
                .filter(Boolean);
            if (marcados.length === 0) avisar('Marque pelo menos um usuário na tabela.', true);
            return marcados;
        }

        function concluir(sucesso, problemas) {
            desenhar();
            const texto = [sucesso, ...problemas].filter(Boolean).join(' ');
            avisar(texto, problemas.length > 0);
        }

        function ativar() {
            const marcados = selecionados();
            if (!marcados.length) return;
            let alterados = 0;
            marcados.forEach((u) => {
                if (u.status !== 'ativo') {
                    u.status = 'ativo';
                    if (BD.usuarios.salvar(u)) alterados++;
                }
            });
            concluir(`${alterados} usuário(s) ativado(s).`, []);
        }

        function mudarStatus() {
            const marcados = selecionados();
            if (!marcados.length) return;
            const problemas = new Set();
            let alterados = 0;
            marcados.forEach((u) => {
                const novo = u.status === 'ativo' ? 'inativo' : 'ativo';
                if (novo === 'inativo') {
                    if (u.id === BD.sessao()) { problemas.add('Você não pode inativar o próprio usuário.'); return; }
                    if (u.funcao === 'gerente' && !restaGerenteAtivo(u.id)) { problemas.add('É preciso manter pelo menos um gerente ativo.'); return; }
                }
                u.status = novo;
                if (BD.usuarios.salvar(u)) alterados++;
            });
            concluir(`Status alterado em ${alterados} usuário(s).`, [...problemas]);
        }

        function remover() {
            const marcados = selecionados();
            if (!marcados.length) return;
            if (!confirm(`Remover ${marcados.length} usuário(s) selecionado(s)?`)) return;
            const problemas = new Set();
            let removidos = 0;
            marcados.forEach((u) => {
                const nome = Util.nomeCompleto(u);
                if (u.id === BD.sessao()) { problemas.add('Você não pode remover o próprio usuário.'); return; }
                if (BD.pets.listar().some((p) => p.proprietarioId === u.id)) { problemas.add(`${nome} tem pets cadastrados.`); return; }
                if (u.funcao === 'gerente' && u.status === 'ativo' && !restaGerenteAtivo(u.id)) { problemas.add('É preciso manter pelo menos um gerente ativo.'); return; }
                if (BD.usuarios.remover(u.id)) removidos++;
            });
            concluir(`${removidos} usuário(s) removido(s).`, [...problemas]);
        }

        const acoes = { 'ativo': ativar, 'remover': remover, 'mudar status': mudarStatus };
        barraAcoes.querySelectorAll('button').forEach((botao) => {
            const acao = acoes[Util.normalizar(botao.textContent)];
            if (acao) botao.addEventListener('click', acao);
        });

        // ---- Visualizar por: Usuários | Função ----
        linksModo.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                modo = Util.normalizar(link.textContent) === 'funcao' ? 'funcao' : 'usuarios';
                linksModo.forEach((outro) => outro.classList.toggle('ativo', outro === link));
                desenhar();
            });
        });

        form.addEventListener('submit', (e) => { e.preventDefault(); avisar('', false); desenhar(); });
        form.addEventListener('reset', () => setTimeout(desenhar, 0));
        desenhar();
    }

    // ---------- cadastrar-usuario.html ----------

    function telaCadastrar() {
        const form = document.querySelector('.main form');
        const campo = (nome) => form.elements.namedItem(nome);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Util.limparErro(form);

            const email = campo('email').value.trim();
            if (emailEmUso(email, null)) return Util.mostrarErro(form, 'Já existe um usuário com este e-mail.');

            let foto = '';
            try {
                foto = (await Util.lerImagem(campo('foto'))) || '';
            } catch (erro) {
                return Util.mostrarErro(form, erro.message);
            }

            const salvo = BD.usuarios.salvar({
                email,
                nome: campo('nome').value.trim(),
                sobrenome: campo('sobrenome').value.trim(),
                telefone: campo('telefone').value.trim(),
                funcao: campo('funcao').value,
                status: 'ativo',
                criadoEm: Util.hoje(),
                foto,
                senha: '123456' // senha inicial; sem backend, não há envio de convite
            });
            if (!salvo) return Util.mostrarErro(form, 'Não foi possível salvar o usuário.');
            location.href = 'usuarios.html';
        });
    }

    // ---------- editar-perfil.html ----------

    function telaEditar() {
        const idDaUrl = Pagina.params.get('id');
        const somenteVer = idDaUrl && Pagina.params.get('modo') === 'ver';
        const usuario = BD.usuarios.obter(idDaUrl || BD.sessao());
        if (!usuario) return Util.mostrarNaoEncontrado('Editar usuário', 'usuarios.html', 'Usuário não encontrado.');

        const form = document.querySelector('.main form');
        const campo = (nome) => form.elements.namedItem(nome);
        const titulo = document.querySelector('.main h2');

        function preencher() {
            campo('email').value = usuario.email;
            campo('nome').value = usuario.nome;
            campo('sobrenome').value = usuario.sobrenome;
            campo('telefone').value = usuario.telefone;
            campo('funcao').value = usuario.funcao;
            campo('foto').value = '';
        }
        preencher();

        if (somenteVer) {
            titulo.textContent = 'Ver usuário';
            [...form.elements].forEach((el) => { el.disabled = true; });
            form.querySelectorAll('button').forEach((b) => { b.style.display = 'none'; });
            const voltar = document.createElement('a');
            voltar.href = 'usuarios.html';
            voltar.className = 'botao-voltar';
            voltar.innerHTML = '&larr; Voltar';
            form.after(voltar);
            return;
        }
        if (idDaUrl) titulo.textContent = 'Editar usuário';

        // "Limpar" volta aos dados salvos (e não ao HTML original da página)
        form.addEventListener('reset', (e) => { e.preventDefault(); Util.limparErro(form); preencher(); });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Util.limparErro(form);

            const email = campo('email').value.trim();
            if (emailEmUso(email, usuario.id)) return Util.mostrarErro(form, 'Já existe outro usuário com este e-mail.');

            // o sistema não pode ficar sem nenhum gerente
            const funcao = campo('funcao').value;
            if (usuario.funcao === 'gerente' && funcao !== 'gerente') {
                const outros = BD.usuarios.listar().filter((u) => u.id !== usuario.id && u.funcao === 'gerente');
                if (outros.length === 0) return Util.mostrarErro(form, 'É preciso manter pelo menos um gerente no sistema.');
            }

            let foto = usuario.foto; // sem arquivo novo, mantém a foto atual
            try {
                foto = (await Util.lerImagem(campo('foto'))) || usuario.foto;
            } catch (erro) {
                return Util.mostrarErro(form, erro.message);
            }

            const salvo = BD.usuarios.salvar({
                ...usuario,
                email,
                nome: campo('nome').value.trim(),
                sobrenome: campo('sobrenome').value.trim(),
                telefone: campo('telefone').value.trim(),
                funcao,
                foto
            });
            if (!salvo) return Util.mostrarErro(form, 'Não foi possível salvar. Tente com uma foto menor.');
            location.href = idDaUrl ? 'usuarios.html' : 'reservas.html';
        });
    }
})();
