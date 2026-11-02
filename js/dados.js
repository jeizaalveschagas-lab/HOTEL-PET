'use strict';

/*
 * dados.js — "banco de dados" do Hotel Pet.
 * Como não há backend, tudo fica no localStorage do navegador.
 * Na primeira visita, os dados iniciais (seed) abaixo são gravados.
 *
 * Para voltar ao estado inicial, rode no console do navegador:  BD.restaurarPadrao()
 */
const BD = (() => {
    const CHAVE = 'hotelpet:v3';
    const CHAVE_SESSAO = 'hotelpet:sessao';
    let cache = null;

    function padrao() {
        return {
            contador: 100,
            config: { valorDiaria: 10, vagas: 3 },
            usuarios: [
                { id: '12349984001', email: 'joaodasilva@pet.com', nome: 'João', sobrenome: 'da Silva',
                  telefone: '+55 (73) 99876-8943', funcao: 'gerente', status: 'ativo', criadoEm: '2020-02-19', foto: 'img/usuario-1.jpg', senha: '123456' },
                { id: '12349984002', email: 'maria@pet.com', nome: 'Maria', sobrenome: 'da Silva',
                  telefone: '+55 (73) 99111-2222', funcao: 'funcionario', status: 'ativo', criadoEm: '2020-02-19', foto: 'img/usuario-2.jpg', senha: '123456' },
                { id: '12349984003', email: 'josedasilva@pet.com', nome: 'José', sobrenome: 'da Silva',
                  telefone: '+55 (73) 99333-4444', funcao: 'cliente', status: 'ativo', criadoEm: '2020-02-19', foto: 'img/usuario-3.jpg', senha: '123456' }
            ],
            pets: [
                { id: '12349984501', nome: 'Max', tipo: 'cachorro', raca: 'Pastor Alemão', tamanho: 'grande',
                  proprietarioId: '12349984003', imagem: 'img/pet-max.jpg' },
                { id: '12349984502', nome: 'Ginger', tipo: 'gato', raca: 'Não definida', tamanho: 'pequeno',
                  proprietarioId: '12349984003', imagem: '' }
            ],
            reservas: [
                { id: '12349984701', petId: '12349984501', proprietarioId: '12349984003',
                  chegada: '2021-05-02', partida: '2021-05-07', status: 'finalizado', total: 50,
                  notas: 'Lorem ipsum ...', anotacoes: 'Lorem ipsum ...',
                  imagens: ['img/reserva-1.jpg', 'img/reserva-2.jpg', 'img/reserva-3.jpg'],
                  recibo: { nome: 'recibo.pdf', dados: '' }, criadoEm: '2021-05-02', atualizadoEm: '2021-05-07' },
                { id: '12349984702', petId: '12349984502', proprietarioId: '12349984003',
                  chegada: '2021-05-02', partida: '2021-05-07', status: 'em-andamento', total: 50,
                  notas: '', anotacoes: '', imagens: [], recibo: null,
                  criadoEm: '2021-04-28', atualizadoEm: '2021-05-02' },
                { id: '12349984703', petId: '12349984501', proprietarioId: '12349984003',
                  chegada: '2021-06-10', partida: '2021-06-15', status: 'reservado', total: 50,
                  notas: 'Precisa de ração especial.', anotacoes: '', imagens: [], recibo: null,
                  criadoEm: '2021-05-20', atualizadoEm: '2021-05-20' }
            ]
        };
    }

    const copiar = (obj) => JSON.parse(JSON.stringify(obj));

    function carregar() {
        if (cache) return cache;
        try {
            const bruto = localStorage.getItem(CHAVE);
            cache = bruto ? JSON.parse(bruto) : null;
        } catch (erro) {
            cache = null;
        }
        if (!cache) {
            cache = padrao();
            gravar();
        }
        return cache;
    }

    // Grava no localStorage. Se falhar (ex.: armazenamento cheio), descarta o cache
    // para que a próxima leitura volte ao último estado salvo com sucesso.
    function gravar() {
        try {
            localStorage.setItem(CHAVE, JSON.stringify(cache));
            return true;
        } catch (erro) {
            console.error('Não foi possível gravar no localStorage:', erro);
            cache = null;
            return false;
        }
    }

    function proximoId() {
        const dados = carregar();
        dados.contador += 1;
        return String(12350000000 + dados.contador);
    }

    // Cria o CRUD básico de uma coleção (reservas, pets, usuarios)
    function colecao(nome) {
        return {
            listar: () => copiar(carregar()[nome]),
            obter: (id) => {
                const item = carregar()[nome].find((i) => i.id === String(id));
                return item ? copiar(item) : null;
            },
            // Insere (sem id) ou atualiza (com id). Retorna o item salvo, ou null se falhar.
            salvar: (item) => {
                const lista = carregar()[nome];
                const novo = copiar(item);
                if (!novo.id) novo.id = proximoId();
                const posicao = lista.findIndex((i) => i.id === novo.id);
                if (posicao >= 0) lista[posicao] = novo;
                else lista.push(novo);
                return gravar() ? copiar(novo) : null;
            },
            remover: (id) => {
                const dados = carregar();
                dados[nome] = dados[nome].filter((i) => i.id !== String(id));
                return gravar();
            }
        };
    }

    return {
        reservas: colecao('reservas'),
        pets: colecao('pets'),
        usuarios: colecao('usuarios'),
        config: {
            obter: () => copiar(carregar().config),
            salvar: (cfg) => { carregar().config = copiar(cfg); return gravar(); }
        },
        // Sessão: com "mantenha-me conectado" fica no localStorage; sem ele, só até fechar a aba.
        sessao: () => {
            try {
                return sessionStorage.getItem(CHAVE_SESSAO) || localStorage.getItem(CHAVE_SESSAO) || null;
            } catch (erro) { return null; }
        },
        entrar: (usuarioId, manterConectado) => {
            try {
                (manterConectado ? localStorage : sessionStorage).setItem(CHAVE_SESSAO, String(usuarioId));
                return true;
            } catch (erro) { return false; }
        },
        sair: () => {
            try { sessionStorage.removeItem(CHAVE_SESSAO); localStorage.removeItem(CHAVE_SESSAO); } catch (erro) { /* ignora */ }
        },
        restaurarPadrao: () => { cache = padrao(); return gravar(); }
    };
})();
