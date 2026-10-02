# Gestão de encomendas · Vitória Régia

Painel web para a portaria registrar encomendas, acompanhar retiradas e consultar relatórios. A interface usa HTML, CSS e JavaScript sem framework; a API em Node.js mantém as credenciais do PostgreSQL fora do navegador.

## Executar em modo de demonstração

1. Instale o Node.js 18 ou superior.
2. Execute `npm install` e depois `npm start`.
3. Acesse http://localhost:3000.

O acesso inicial é `admin` / `admin`. Sem PostgreSQL configurado, a interface começa vazia; novos registros funcionam na sessão atual do navegador, sem persistência. Para gravar os dados no banco, configure a conexão abaixo.

As credenciais podem ser alteradas com `ADMIN_USERNAME` e `ADMIN_PASSWORD`. A sessão é mantida por cookie assinado e expira em oito horas. Para publicar o sistema, defina também um `SESSION_SECRET` longo e troque a senha padrão; a lista de sessões fica em memória e é encerrada ao reiniciar o servidor.

## Instalar no celular

O painel é um PWA. No Android, use **Instalar app** e confirme o prompt do navegador. No iPhone/iPad, abra no Safari, toque em **Instalar app** e siga as instruções para usar **Compartilhar → Adicionar à Tela de Início**. A publicação fora de `localhost` precisa usar HTTPS para permitir a instalação e o service worker.

## Conectar ao PostgreSQL

1. Crie um banco chamado `vitoria_regia`.
2. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` com usuário, senha, host e banco.
3. Execute o arquivo `db/schema.sql` no banco.
4. Reinicie a aplicação. A API usa o PostgreSQL automaticamente quando disponível.

Rotas iniciais: `POST /api/login`, `POST /api/logout`, `GET /api/health`, `GET /api/orders`, `POST /api/orders` e `PATCH /api/orders/:id/pickup`. As rotas do dashboard e da API de encomendas exigem sessão autenticada.

## Telas

- Visão geral: indicadores, volume semanal, status e atividade recente.
- Encomendas: busca, filtro por status e bloco, registro e confirmação de retirada.
- Relatórios: distribuição por porteiro e moradores com mais entregas, com exportação CSV.
- Login administrativo e navegação responsiva com barra inferior em dispositivos móveis.
- Instalação como PWA em Android e iOS, com ícones próprios e instruções por plataforma.
- Moradores e configurações: telas iniciais para evolução do protótipo.

O banco inicial armazena os dados operacionais das encomendas; notificações e cadastro relacional de moradores ficam para as próximas etapas.