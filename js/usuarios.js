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

    function telaListagem() {
        const form = document.querySelector('form.filtros');
        const corpo = document.querySelector('table tbody');
        const valor = (nome) => form.elements.namedItem(nome).value.trim();

        function desenhar() {
            const id = valor('id');
            const de = valor('criado-em');
            const ate = valor('criado-ate');
            const email = Util.normalizar(valor('email'));
            const nome = Util.normalizar(valor('nome'));
            const status = valor('status');
            const funcao = valor('funcao');

            const lista = BD.usuarios.listar().filter((u) =>
                (!id || u.id.includes(id)) &&
                (!de || u.criadoEm >= de) &&
                (!ate || u.criadoEm <= ate) &&
                (!email || Util.normalizar(u.email).includes(email)) &&
                (!nome || Util.normalizar(Util.nomeCompleto(u)).includes(nome)) &&
                (!status || u.status === status) &&
                (!funcao || u.funcao === funcao)
            );

            if (lista.length === 0) {
                corpo.innerHTML = '<tr><td colspan="8">Nenhum usuário encontrado.</td></tr>';
                return;
            }
            corpo.innerHTML = lista.map((u) => `
                <tr data-id="${Util.esc(u.id)}">
                    <td><input type="checkbox" aria-label="Selecionar ${Util.esc(Util.nomeCompleto(u))}"></td>
                    <td><img src="${Util.esc(u.foto || 'img/perfil.png')}" alt="Foto de ${Util.esc(Util.nomeCompleto(u))}" class="miniatura"></td>
                    <td>${Util.esc(u.email)}</td>
                    <td>${Util.esc(Util.nomeCompleto(u))}</td>
                    <td>${Regras.FUNCOES[u.funcao] || Util.esc(u.funcao)}</td>
                    <td>${Regras.SITUACOES[u.status] || Util.esc(u.status)}</td>
                    <td>${Util.formatarData(u.criadoEm)}</td>
                    <td>
                        <a href="editar-perfil.html?id=${encodeURIComponent(u.id)}">Editar</a>
                        <a href="editar-perfil.html?id=${encodeURIComponent(u.id)}&modo=ver">Visualizar</a>
                    </td>
                </tr>`).join('');
        }

        form.addEventListener('submit', (e) => { e.preventDefault(); desenhar(); });
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
