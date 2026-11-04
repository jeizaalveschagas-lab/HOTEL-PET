'use strict';

/*
 * reservas.js — telas de Reservas.
 * Um único arquivo; a função certa roda conforme a página aberta.
 * Depende de dados.js e comum.js (carregar antes).
 */
(function () {
    if (!Pagina.autenticada) return; // sem login, o comum.js já redirecionou

    const TAMANHO_MAX = 500 * 1024; // 500 KB por arquivo (o localStorage tem ~5 MB no total)

    const pagina = location.pathname.split('/').pop();
    const telas = {
        'reservas.html': telaListagem,
        'ver-reserva.html': telaVer,
        'fazer-reserva.html': telaFazer,
        'editar-reserva.html': telaEditar
    };
    if (telas[pagina]) telas[pagina]();

    // ---------- auxiliares ----------

    function idDaUrl() {
        return new URLSearchParams(location.search).get('id');
    }

    function mostrarNaoEncontrada(titulo) {
        document.querySelector('.main').innerHTML =
            `<h2>${titulo}</h2><p>Reserva não encontrada.</p><a href="reservas.html" class="botao-voltar">&larr; Voltar</a>`;
    }

    function mostrarErro(form, mensagem) {
        let p = form.querySelector('.mensagem-erro');
        if (!p) {
            p = document.createElement('p');
            p.className = 'mensagem-erro';
            p.setAttribute('role', 'alert');
            p.style.color = '#c00';
            form.prepend(p);
        }
        p.textContent = mensagem;
    }

    function limparErro(form) {
        const p = form.querySelector('.mensagem-erro');
        if (p) p.remove();
    }

    function acharPet(nome) {
        const alvo = Util.normalizar(nome);
        return BD.pets.listar().find((p) => Util.normalizar(p.nome) === alvo) || null;
    }

    // junta a reserva com o nome do pet e do proprietário
    function enriquecer(reserva) {
        const pet = BD.pets.obter(reserva.petId);
        const dono = BD.usuarios.obter(reserva.proprietarioId);
        return {
            ...reserva,
            pet: pet ? pet.nome : '(pet removido)',
            proprietarioNome: dono ? Util.nomeCompleto(dono) : '—'
        };
    }

    // sugere os pets cadastrados enquanto o usuário digita o nome
    function ligarListaDePets(input) {
        const lista = document.createElement('datalist');
        lista.id = 'lista-pets';
        lista.innerHTML = BD.pets.listar().map((p) => `<option value="${Util.esc(p.nome)}"></option>`).join('');
        input.setAttribute('list', 'lista-pets');
        input.after(lista);
    }

    // valida período e vagas; devolve uma mensagem de erro ou null se está tudo certo
    function validarPeriodo(chegada, partida, status, ignorarId) {
        if (!chegada || !partida) return 'Informe a chegada e a partida.';
        if (partida < chegada) return 'A partida não pode ser anterior à chegada.';
        if (Regras.STATUS_ATIVOS.includes(status)) {
            const semVaga = Regras.primeiroDiaSemVaga(chegada, partida, ignorarId);
            if (semVaga) return `Não há vagas disponíveis em ${Util.formatarData(semVaga)}.`;
        }
        return null;
    }

    // ---------- reservas.html: listagem, busca e ordenação ----------

    function telaListagem() {
        const form = document.querySelector('form.filtros');
        const tabela = document.querySelector('table');
        const corpo = tabela.querySelector('tbody');
        const colunas = ['id', 'pet', 'chegada', 'partida', 'status', 'total']; // a última coluna (ações) não ordena
        const valor = (nome) => form.elements.namedItem(nome).value.trim();
        const ordem = Tabela.ligarOrdenacao(tabela.querySelectorAll('thead th'), colunas, desenhar);

        // devolve a mensagem de erro dos filtros, ou null se estão coerentes
        function validarFiltros() {
            const de = valor('periodo-de');
            const ate = valor('periodo-ate');
            if (de && ate && de > ate) return 'No período, a data inicial não pode ser depois da final.';
            const minimo = Util.paraNumero(valor('total-de'));
            const maximo = Util.paraNumero(valor('total-ate'));
            if (minimo !== null && maximo !== null && minimo > maximo) return 'No total, o valor inicial não pode ser maior que o final.';
            return null;
        }

        function filtrar(lista) {
            const de = valor('periodo-de');
            const ate = valor('periodo-ate');
            const totalMin = Util.paraNumero(valor('total-de'));
            const totalMax = Util.paraNumero(valor('total-ate'));
            const id = valor('id');
            const dono = Util.normalizar(valor('proprietario'));
            const status = valor('status');
            const pet = Util.normalizar(valor('pet'));

            return lista.filter((r) =>
                (!id || r.id.includes(id)) &&
                // o período filtra reservas que "encostam" no intervalo informado
                (!de || r.partida >= de) &&
                (!ate || r.chegada <= ate) &&
                (!dono || Util.normalizar(r.proprietarioNome).includes(dono)) &&
                (totalMin === null || r.total >= totalMin) &&
                (totalMax === null || r.total <= totalMax) &&
                (!status || r.status === status) &&
                (!pet || Util.normalizar(r.pet).includes(pet))
            );
        }

        function desenhar() {
            const erro = validarFiltros();
            if (erro) return Tabela.mostrarAviso(form, erro); // mantém a tabela como estava
            Tabela.limparAviso(form);

            const lista = Tabela.ordenar(filtrar(BD.reservas.listar().map(enriquecer)), ordem);
            Tabela.mostrarContagem(tabela, lista.length);
            if (lista.length === 0) {
                corpo.innerHTML = '<tr><td colspan="7">Nenhuma reserva encontrada.</td></tr>';
                return;
            }
            corpo.innerHTML = lista.map((r) => `
                <tr>
                    <td>${Util.esc(r.id)}</td>
                    <td>${Util.esc(r.pet)}</td>
                    <td>${Util.formatarData(r.chegada)}</td>
                    <td>${Util.formatarData(r.partida)}</td>
                    <td>${Regras.STATUS[r.status] || Util.esc(r.status)}</td>
                    <td>${Util.formatarMoeda(r.total)}</td>
                    <td>
                        <a href="editar-reserva.html?id=${encodeURIComponent(r.id)}">Editar</a>
                        <a href="ver-reserva.html?id=${encodeURIComponent(r.id)}">Visualizar</a>
                    </td>
                </tr>`).join('');
        }

        form.addEventListener('submit', (e) => { e.preventDefault(); desenhar(); });
        // o "reset" limpa os campos depois deste evento, então redesenha logo em seguida
        form.addEventListener('reset', () => setTimeout(desenhar, 0));

        desenhar();
    }

    // ---------- ver-reserva.html ----------

    function telaVer() {
        const reserva = idDaUrl() && BD.reservas.obter(idDaUrl());
        if (!reserva) return mostrarNaoEncontrada('Ver reserva');
        const r = enriquecer(reserva);

        const imagens = r.imagens.length
            ? r.imagens.map((src, i) =>
                `<img src="${Util.esc(src)}" alt="Imagem ${i + 1} da estadia" class="miniatura">`).join(' ')
            : 'Nenhuma imagem';
        const recibo = r.recibo
            ? `<a href="${Util.esc(r.recibo.dados || '#')}" download="${Util.esc(r.recibo.nome)}">${Util.esc(r.recibo.nome)}</a>`
            : '—';

        // chave = texto do <dt> (sem acento/minúsculo); valor = HTML do <dd>
        const valores = {
            'id:': Util.esc(r.id),
            'proprietario:': Util.esc(r.proprietarioNome),
            'pet:': `<a href="visualizar-pet.html?id=${encodeURIComponent(r.petId)}">${Util.esc(r.pet)}</a>`,
            'chegada:': Util.formatarData(r.chegada),
            'partida:': Util.formatarData(r.partida),
            'notas:': Util.esc(r.notas) || '—',
            'anotacoes dos funcionarios:': Util.esc(r.anotacoes) || '—',
            'imagens:': imagens,
            'status:': Regras.STATUS[r.status] || Util.esc(r.status),
            'total das diarias:': Util.formatarMoeda(r.total),
            'recibo:': recibo,
            'criado em:': Util.formatarData(r.criadoEm),
            'atualizado em:': Util.formatarData(r.atualizadoEm)
        };

        document.querySelectorAll('.main dl dt').forEach((dt) => {
            const chave = Util.normalizar(dt.textContent);
            if (chave in valores) dt.nextElementSibling.innerHTML = valores[chave];
        });
    }

    // ---------- fazer-reserva.html ----------

    function telaFazer() {
        const form = document.querySelector('.main form');
        const campo = (nome) => form.elements.namedItem(nome);
        const total = form.querySelector('.total strong');

        ligarListaDePets(campo('pet'));

        const atualizarTotal = () => {
            total.textContent = Util.formatarMoeda(Regras.calcularTotal(campo('periodo-de').value, campo('periodo-ate').value));
        };
        campo('periodo-de').addEventListener('change', atualizarTotal);
        campo('periodo-ate').addEventListener('change', atualizarTotal);
        form.addEventListener('reset', () => setTimeout(atualizarTotal, 0));
        atualizarTotal();

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            limparErro(form);

            const pet = acharPet(campo('pet').value);
            if (!pet) return mostrarErro(form, 'Pet não encontrado. Cadastre o pet antes de fazer a reserva.');

            const chegada = campo('periodo-de').value;
            const partida = campo('periodo-ate').value;
            const erro = validarPeriodo(chegada, partida, 'reservado', null);
            if (erro) return mostrarErro(form, erro);

            const salvo = BD.reservas.salvar({
                petId: pet.id,
                proprietarioId: pet.proprietarioId,
                chegada,
                partida,
                notas: campo('notas').value.trim(),
                anotacoes: '',
                status: 'reservado',
                imagens: [],
                recibo: null,
                total: Regras.calcularTotal(chegada, partida),
                criadoEm: Util.hoje(),
                atualizadoEm: Util.hoje()
            });
            if (!salvo) return mostrarErro(form, 'Não foi possível salvar a reserva.');
            location.href = 'reservas.html';
        });
    }

    // ---------- editar-reserva.html ----------

    function telaEditar() {
        const reserva = idDaUrl() && BD.reservas.obter(idDaUrl());
        if (!reserva) return mostrarNaoEncontrada('Editar reserva');

        const form = document.querySelector('.main form');
        const campo = (nome) => form.elements.namedItem(nome);
        const total = form.querySelector('.total strong');
        const botaoNota = form.querySelector('a.botao-secundario');
        const linkRecibo = form.querySelector('a:not(.botao-secundario)');

        // estado que pode mudar na tela antes de salvar
        let imagens = [...reserva.imagens];
        let recibo = reserva.recibo;

        // miniaturas das imagens, logo abaixo do campo de upload
        const previa = document.createElement('div');
        campo('imagens').after(previa);
        previa.addEventListener('click', (e) => {
            const botao = e.target.closest('[data-remover]');
            if (!botao) return;
            imagens.splice(Number(botao.dataset.remover), 1);
            desenharImagens();
        });

        // input escondido usado pelo botão "Adicionar nota fiscal"
        const campoRecibo = document.createElement('input');
        campoRecibo.type = 'file';
        campoRecibo.accept = '.pdf,image/*';
        campoRecibo.hidden = true;
        form.append(campoRecibo);

        ligarListaDePets(campo('pet'));
        campo('proprietario').readOnly = true; // o dono vem do pet escolhido
        campo('proprietario').style.backgroundColor = '#f3eee9';
        linkRecibo.style.margin = '0 12px';

        function desenharImagens() {
            previa.innerHTML = imagens.map((src, i) => `
                <span style="display:inline-flex;align-items:center;gap:4px;margin:8px 14px 0 0">
                    <img src="${Util.esc(src)}" alt="Imagem ${i + 1} da estadia" class="miniatura">
                    <button type="button" data-remover="${i}" aria-label="Remover imagem ${i + 1}"
                        style="margin:0;padding:2px 8px;font-size:12px">×</button>
                </span>`).join('');
        }

        function atualizarTela() {
            total.textContent = Util.formatarMoeda(Regras.calcularTotal(campo('periodo-de').value, campo('periodo-ate').value));
            // nota fiscal/recibo só fazem sentido para reservas finalizadas
            const finalizada = campo('status').value === 'finalizado';
            botaoNota.style.display = finalizada ? '' : 'none';
            linkRecibo.style.display = finalizada && recibo ? '' : 'none';
            if (recibo) {
                linkRecibo.textContent = recibo.nome;
                linkRecibo.href = recibo.dados || '#';
                linkRecibo.download = recibo.nome;
            }
        }

        function preencher() {
            const dono = BD.usuarios.obter(reserva.proprietarioId);
            const pet = BD.pets.obter(reserva.petId);
            campo('proprietario').value = dono ? Util.nomeCompleto(dono) : '';
            campo('pet').value = pet ? pet.nome : '';
            campo('periodo-de').value = reserva.chegada;
            campo('periodo-ate').value = reserva.partida;
            campo('notas').value = reserva.notas;
            campo('status').value = reserva.status;
            campo('anotacoes-funcionario').value = reserva.anotacoes;
            imagens = [...reserva.imagens];
            recibo = reserva.recibo;
            desenharImagens();
            atualizarTela();
        }

        // ao trocar o pet, o proprietário acompanha
        campo('pet').addEventListener('input', () => {
            const pet = acharPet(campo('pet').value);
            const dono = pet && BD.usuarios.obter(pet.proprietarioId);
            campo('proprietario').value = dono ? Util.nomeCompleto(dono) : '';
        });
        ['periodo-de', 'periodo-ate', 'status'].forEach((nome) => campo(nome).addEventListener('change', atualizarTela));

        // adicionar imagens
        campo('imagens').addEventListener('change', async () => {
            limparErro(form);
            for (const arquivo of campo('imagens').files) {
                if (!arquivo.type.startsWith('image/')) { mostrarErro(form, `"${arquivo.name}" não é uma imagem.`); continue; }
                if (arquivo.size > TAMANHO_MAX) { mostrarErro(form, `"${arquivo.name}" passa de 500 KB.`); continue; }
                imagens.push(await Util.lerArquivo(arquivo));
            }
            campo('imagens').value = '';
            desenharImagens();
        });

        // adicionar nota fiscal / recibo
        botaoNota.addEventListener('click', (e) => { e.preventDefault(); campoRecibo.click(); });
        campoRecibo.addEventListener('change', async () => {
            limparErro(form);
            const arquivo = campoRecibo.files[0];
            if (!arquivo) return;
            if (arquivo.size > TAMANHO_MAX) { mostrarErro(form, 'A nota fiscal passa de 500 KB.'); return; }
            recibo = { nome: arquivo.name, dados: await Util.lerArquivo(arquivo) };
            campoRecibo.value = '';
            atualizarTela();
        });

        // "Limpar" volta aos dados salvos (e não ao HTML original da página)
        form.addEventListener('reset', (e) => { e.preventDefault(); limparErro(form); preencher(); });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            limparErro(form);

            const pet = acharPet(campo('pet').value);
            if (!pet) return mostrarErro(form, 'Pet não encontrado. Escolha um pet cadastrado.');

            const chegada = campo('periodo-de').value;
            const partida = campo('periodo-ate').value;
            const status = campo('status').value;
            const erro = validarPeriodo(chegada, partida, status, reserva.id);
            if (erro) return mostrarErro(form, erro);

            // Como o perfil desta visão é o de Gerente, reservas finalizadas continuam editáveis.
            const salvo = BD.reservas.salvar({
                ...reserva,
                petId: pet.id,
                proprietarioId: pet.proprietarioId,
                chegada,
                partida,
                status,
                notas: campo('notas').value.trim(),
                anotacoes: campo('anotacoes-funcionario').value.trim(),
                imagens,
                recibo: status === 'finalizado' ? recibo : null,
                total: Regras.calcularTotal(chegada, partida),
                atualizadoEm: Util.hoje()
            });
            if (!salvo) return mostrarErro(form, 'Não foi possível salvar. Tente com imagens menores ou menos imagens.');
            location.href = 'reservas.html';
        });

        preencher();
    }
})();
