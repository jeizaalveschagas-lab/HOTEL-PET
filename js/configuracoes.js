'use strict';

/*
 * configuracoes.js — valor da diária e vagas disponíveis.
 * Esses valores alimentam o cálculo do total e o controle de vagas das reservas.
 * Depende de dados.js e comum.js (carregar antes).
 */
(function () {
    if (!Pagina.autenticada) return; // sem login, o comum.js já redirecionou

    const form = document.querySelector('.main form');
    const campo = (nome) => form.elements.namedItem(nome);

    function preencher() {
        const config = BD.config.obter();
        campo('valor-diaria').value = Util.formatarMoeda(config.valorDiaria);
        campo('vagas').value = config.vagas;
    }

    function mostrarSucesso(mensagem) {
        let p = form.querySelector('.mensagem-sucesso');
        if (!p) {
            p = document.createElement('p');
            p.className = 'mensagem-sucesso';
            p.setAttribute('role', 'status');
            p.style.color = '#0a7a2f';
            form.prepend(p);
        }
        p.textContent = mensagem;
    }

    function limparSucesso() {
        const p = form.querySelector('.mensagem-sucesso');
        if (p) p.remove();
    }

    // "Limpar" volta aos valores salvos (e não ao HTML original da página)
    form.addEventListener('reset', (e) => {
        e.preventDefault();
        Util.limparErro(form);
        limparSucesso();
        preencher();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        Util.limparErro(form);
        limparSucesso();

        const valorDiaria = Util.paraNumero(campo('valor-diaria').value);
        const vagas = Number(campo('vagas').value);
        if (valorDiaria === null || valorDiaria <= 0) return Util.mostrarErro(form, 'Informe um valor de diária maior que zero.');
        if (!Number.isInteger(vagas) || vagas < 1) return Util.mostrarErro(form, 'O número de vagas deve ser um inteiro a partir de 1.');

        if (!BD.config.salvar({ valorDiaria, vagas })) return Util.mostrarErro(form, 'Não foi possível salvar as configurações.');
        preencher(); // reformata o valor, por exemplo "10" -> "R$ 10,00"
        mostrarSucesso('Configurações salvas.');
    });

    preencher();
})();
