'use strict';

/*
 * auth.js — telas de Login e Criar conta.
 * Depende de dados.js e comum.js (carregar antes).
 *
 * Como não há backend, as contas ficam no localStorage.
 * Contas de exemplo (senha 123456): joaodasilva@pet.com (gerente),
 * maria@pet.com (funcionária) e josedasilva@pet.com (cliente).
 */
(function () {
    // quem já está logado não precisa ver o login de novo
    if (BD.sessao() && BD.usuarios.obter(BD.sessao())) {
        location.replace('reservas.html');
        return;
    }

    const form = document.querySelector('.login-formulario form');
    const campo = (nome) => form.elements.namedItem(nome);

    if (Pagina.nome === 'login') {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            Util.limparErro(form);

            const login = campo('login').value.trim();
            const senha = campo('senha').value;
            if (!login || !senha) return Util.mostrarErro(form, 'Informe o login e a senha.');

            const usuario = BD.usuarios.listar().find((u) => Util.normalizar(u.email) === Util.normalizar(login));
            if (!usuario || usuario.senha !== senha) return Util.mostrarErro(form, 'Login ou senha incorretos.');
            if (usuario.status !== 'ativo') return Util.mostrarErro(form, 'Este usuário está inativo.');

            if (!BD.entrar(usuario.id, campo('manter-conectado').checked)) {
                return Util.mostrarErro(form, 'Não foi possível iniciar a sessão neste navegador.');
            }
            location.href = 'reservas.html';
        });
    }

    if (Pagina.nome === 'criar-conta') {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            Util.limparErro(form);

            const login = campo('login').value.trim();
            const senha = campo('senha').value;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) return Util.mostrarErro(form, 'Use um e-mail válido como login.');
            if (senha.length < 6) return Util.mostrarErro(form, 'A senha precisa ter pelo menos 6 caracteres.');
            if (BD.usuarios.listar().some((u) => Util.normalizar(u.email) === Util.normalizar(login))) {
                return Util.mostrarErro(form, 'Já existe uma conta com este e-mail.');
            }

            // nome provisório = parte do e-mail antes do @ (pode ser mudado em Editar perfil)
            const parte = login.split('@')[0];
            const usuario = BD.usuarios.salvar({
                email: login,
                nome: parte.charAt(0).toUpperCase() + parte.slice(1),
                sobrenome: '',
                telefone: '',
                funcao: 'cliente',
                status: 'ativo',
                criadoEm: Util.hoje(),
                foto: '',
                senha
            });
            if (!usuario) return Util.mostrarErro(form, 'Não foi possível criar a conta.');

            BD.entrar(usuario.id, false);
            location.href = 'reservas.html';
        });
    }
})();
