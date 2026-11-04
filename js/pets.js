'use strict';

/*
 * pets.js — telas de Pets (listar, ver, cadastrar, editar).
 * Depende de dados.js e comum.js (carregar antes).
 */
(function () {
    if (!Pagina.autenticada) return; // sem login, o comum.js já redirecionou

    const telas = {
        'pets': telaListagem,
        'visualizar-pet': telaVer,
        'cadastrar-pet': telaCadastrar,
        'editar-pet': telaEditar
    };
    if (telas[Pagina.nome]) telas[Pagina.nome]();

    // ---------- auxiliares ----------

    function petDaUrl() {
        const id = Pagina.params.get('id');
        return id ? BD.pets.obter(id) : null;
    }

    function ligarListaDeDonos(input) {
        const lista = document.createElement('datalist');
        lista.id = 'lista-donos';
        lista.innerHTML = BD.usuarios.listar().map((u) =>
            `<option value="${Util.esc(Util.nomeCompleto(u))}" label="${Util.esc(u.email)}"></option>`).join('');
        input.setAttribute('list', 'lista-donos');
        input.after(lista);
    }

    // ---------- pets.html ----------

    function telaListagem() {
        const form = document.querySelector('form.filtros');
        const tabela = document.querySelector('table');
        const corpo = tabela.querySelector('tbody');
        const valor = (nome) => form.elements.namedItem(nome).value.trim();
        const colunas = ['id', 'nome', 'tipo', 'raca', 'tamanho', 'proprietarioNome']; // a última coluna (ações) não ordena
        const ORDEM_TAMANHO = { pequeno: 1, medio: 2, grande: 3 };
        const ordem = Tabela.ligarOrdenacao(tabela.querySelectorAll('thead th'), colunas, desenhar);

        // tamanho ordena de Pequeno a Grande (e não em ordem alfabética)
        const valorDe = (pet, chave) => chave === 'tamanho' ? (ORDEM_TAMANHO[pet.tamanho] || 0) : pet[chave];

        function desenhar() {
            const id = valor('id');
            const nome = Util.normalizar(valor('nome'));
            const tipo = valor('tipo');
            const raca = Util.normalizar(valor('raca'));
            const tamanho = Util.normalizar(valor('tamanho'));
            const dono = Util.normalizar(valor('proprietario'));

            const pets = BD.pets.listar().map((p) => {
                const proprietario = BD.usuarios.obter(p.proprietarioId);
                return { ...p, proprietarioNome: proprietario ? Util.nomeCompleto(proprietario) : '—' };
            });

            const lista = Tabela.ordenar(pets.filter((p) =>
                (!id || p.id.includes(id)) &&
                (!nome || Util.normalizar(p.nome).includes(nome)) &&
                (!tipo || p.tipo === tipo) &&
                (!raca || Util.normalizar(p.raca).includes(raca)) &&
                (!tamanho || Util.normalizar(Regras.TAMANHOS[p.tamanho] || p.tamanho).includes(tamanho)) &&
                (!dono || Util.normalizar(p.proprietarioNome).includes(dono))
            ), ordem, valorDe);

            Tabela.mostrarContagem(tabela, lista.length);
            if (lista.length === 0) {
                corpo.innerHTML = '<tr><td colspan="7">Nenhum pet encontrado.</td></tr>';
                return;
            }
            corpo.innerHTML = lista.map((p) => `
                <tr>
                    <td>${Util.esc(p.id)}</td>
                    <td>${Util.esc(p.nome)}</td>
                    <td>${Regras.TIPOS[p.tipo] || Util.esc(p.tipo)}</td>
                    <td>${Util.esc(p.raca)}</td>
                    <td>${Regras.TAMANHOS[p.tamanho] || Util.esc(p.tamanho)}</td>
                    <td>${Util.esc(p.proprietarioNome)}</td>
                    <td>
                        <a href="editar-pet.html?id=${encodeURIComponent(p.id)}">Editar</a>
                        <a href="visualizar-pet.html?id=${encodeURIComponent(p.id)}">Visualizar</a>
                    </td>
                </tr>`).join('');
        }

        form.addEventListener('submit', (e) => { e.preventDefault(); desenhar(); });
        form.addEventListener('reset', () => setTimeout(desenhar, 0));
        desenhar();
    }

    // ---------- visualizar-pet.html ----------

    function telaVer() {
        const pet = petDaUrl();
        if (!pet) return Util.mostrarNaoEncontrado('Ver pet', 'pets.html', 'Pet não encontrado.');

        const dono = BD.usuarios.obter(pet.proprietarioId);
        const reservas = BD.reservas.listar()
            .filter((r) => r.petId === pet.id)
            .sort((a, b) => b.chegada.localeCompare(a.chegada));

        // reservas finalizadas só podem ser vistas aqui; as demais abrem direto para edição
        const historico = reservas.length
            ? reservas.map((r) => {
                const tela = r.status === 'finalizado' ? 'ver-reserva' : 'editar-reserva';
                const situacao = (Regras.STATUS[r.status] || r.status).toLowerCase();
                return `<a href="${tela}.html?id=${encodeURIComponent(r.id)}">` +
                    `${Util.formatarData(r.chegada)} - ${Util.formatarData(r.partida)} (${Util.esc(situacao)})</a>`;
            }).join('<br>')
            : 'Nenhuma reserva';

        const valores = {
            'proprietario:': Util.esc(dono ? Util.nomeCompleto(dono) : '—'),
            'id:': Util.esc(pet.id),
            'nome:': Util.esc(pet.nome),
            'tipo:': Regras.TIPOS[pet.tipo] || Util.esc(pet.tipo),
            'raca:': Util.esc(pet.raca),
            'imagem:': pet.imagem
                ? `<img src="${Util.esc(pet.imagem)}" alt="Foto de ${Util.esc(pet.nome)}" class="miniatura">`
                : 'Sem imagem',
            'reservas:': historico
        };
        document.querySelectorAll('.main dl dt').forEach((dt) => {
            const chave = Util.normalizar(dt.textContent);
            if (chave in valores) dt.nextElementSibling.innerHTML = valores[chave];
        });

        // o protótipo não tem "Tamanho" nesta tela; entra logo depois da raça
        const dtRaca = [...document.querySelectorAll('.main dl dt')].find((dt) => Util.normalizar(dt.textContent) === 'raca:');
        if (dtRaca) {
            const dt = document.createElement('dt');
            dt.textContent = 'Tamanho:';
            const dd = document.createElement('dd');
            dd.textContent = Regras.TAMANHOS[pet.tamanho] || pet.tamanho;
            dtRaca.nextElementSibling.after(dt, dd);
        }

        document.querySelectorAll('.main a.botao-secundario').forEach((botao) => {
            const texto = Util.normalizar(botao.textContent);
            if (texto === 'editar') {
                botao.href = `editar-pet.html?id=${encodeURIComponent(pet.id)}`;
            } else if (texto === 'deletar') {
                botao.addEventListener('click', (e) => {
                    e.preventDefault();
                    deletar(pet);
                });
            }
        });
    }

    function deletar(pet) {
        const ativas = BD.reservas.listar().filter(
            (r) => r.petId === pet.id && Regras.STATUS_ATIVOS.includes(r.status)
        );
        if (ativas.length) {
            alert(`Não dá para deletar ${pet.nome}: há ${ativas.length} reserva(s) ativa(s). Cancele ou finalize antes.`);
            return;
        }
        if (!confirm(`Deseja realmente deletar ${pet.nome}?`)) return;
        if (!BD.pets.remover(pet.id)) {
            alert('Não foi possível deletar o pet.');
            return;
        }
        location.href = 'pets.html';
    }

    // ---------- cadastrar-pet.html ----------

    function telaCadastrar() {
        const form = document.querySelector('.main form');
        const campo = (nome) => form.elements.namedItem(nome);
        ligarListaDeDonos(campo('proprietario'));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Util.limparErro(form);

            const dono = Regras.acharUsuario(campo('proprietario').value);
            if (!dono) return Util.mostrarErro(form, 'Proprietário não encontrado. Escolha um usuário cadastrado.');

            let imagem = '';
            try {
                imagem = (await Util.lerImagem(campo('imagem'))) || '';
            } catch (erro) {
                return Util.mostrarErro(form, erro.message);
            }

            const salvo = BD.pets.salvar({
                nome: campo('nome').value.trim(),
                tipo: campo('tipo').value,
                raca: campo('raca').value.trim(),
                tamanho: campo('tamanho').value,
                proprietarioId: dono.id,
                imagem
            });
            if (!salvo) return Util.mostrarErro(form, 'Não foi possível salvar o pet.');
            location.href = 'pets.html';
        });
    }

    // ---------- editar-pet.html ----------

    function telaEditar() {
        const pet = petDaUrl();
        if (!pet) return Util.mostrarNaoEncontrado('Editar pet', 'pets.html', 'Pet não encontrado.');

        const form = document.querySelector('.main form');
        const campo = (nome) => form.elements.namedItem(nome);

        function preencher() {
            campo('nome').value = pet.nome;
            campo('tipo').value = pet.tipo;
            campo('raca').value = pet.raca;
            campo('tamanho').value = pet.tamanho;
            campo('imagem').value = '';
        }

        // "Limpar" volta aos dados salvos (e não ao HTML original da página)
        form.addEventListener('reset', (e) => { e.preventDefault(); Util.limparErro(form); preencher(); });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Util.limparErro(form);

            let imagem = pet.imagem; // sem arquivo novo, mantém a imagem atual
            try {
                imagem = (await Util.lerImagem(campo('imagem'))) || pet.imagem;
            } catch (erro) {
                return Util.mostrarErro(form, erro.message);
            }

            const salvo = BD.pets.salvar({
                ...pet,
                nome: campo('nome').value.trim(),
                tipo: campo('tipo').value,
                raca: campo('raca').value.trim(),
                tamanho: campo('tamanho').value,
                imagem
            });
            if (!salvo) return Util.mostrarErro(form, 'Não foi possível salvar o pet.');
            location.href = `visualizar-pet.html?id=${encodeURIComponent(pet.id)}`;
        });

        preencher();
    }
})();
