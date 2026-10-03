# Gestão de encomendas · Vitória Régia

Painel web para a portaria registrar encomendas, acompanhar retiradas e consultar relatórios. A interface usa HTML, CSS e JavaScript sem framework; a API em Node.js mantém as credenciais do MySQL fora do navegador.

## Executar em modo de demonstração

1. Instale o Node.js 18 ou superior.
2. Execute `npm install` e depois `npm start`.
3. Acesse http://localhost:3000.

O acesso inicial é `admin` / `admin`. Sem MySQL configurado, a interface começa vazia e não salva novos registros. Para consultar as mesmas encomendas em mais de um dispositivo, todos devem acessar a mesma instalação do servidor, conectada a este banco persistente.

As credenciais podem ser alteradas com `ADMIN_USERNAME` e `ADMIN_PASSWORD`. A sessão é mantida por cookie assinado e expira em oito horas. Para publicar o sistema, defina também um `SESSION_SECRET` longo e troque a senha padrão; a lista de sessões fica em memória e é encerrada ao reiniciar o servidor.

## Instalar no celular

O painel é um PWA. No Android, use **Instalar app** e confirme o prompt do navegador. No iPhone/iPad, abra no Safari, toque em **Instalar app** e siga as instruções para usar **Compartilhar → Adicionar à Tela de Início**. A publicação fora de `localhost` precisa usar HTTPS para permitir a instalação e o service worker.

## Configurar MySQL pelo Workbench

Requisitos: MySQL Server 8.0.16 ou superior, MySQL Workbench e Node.js 18 ou superior. O Workbench é o cliente gráfico; o MySQL Server precisa estar instalado e ativo para armazenar os dados.

1. Abra o MySQL Workbench e conecte-se ao servidor local usando uma conta administradora.
2. Abra `db/schema.sql` (File → Open SQL Script) e execute o script com o botão do raio. Ele cria o banco `vitoria_regia`, a tabela `parcels`, as restrições e os índices. A seção Schemas deve mostrar o banco e a tabela.
3. Na aba SQL do Workbench, crie um usuário exclusivo para a aplicação e conceda apenas as permissões necessárias. Troque o valor de exemplo por uma senha forte:

	```sql
	CREATE USER IF NOT EXISTS 'vitoria_app'@'127.0.0.1' IDENTIFIED BY 'troque-esta-senha';
	GRANT SELECT, INSERT, UPDATE ON vitoria_regia.* TO 'vitoria_app'@'127.0.0.1';
	```

4. Copie `.env.example` para `.env` na raiz do projeto e ajuste `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD` e `MYSQL_DATABASE`. Para a instalação local, os valores iniciais de host, porta e banco já correspondem à configuração padrão do MySQL.
5. No terminal, execute `npm install` e depois `npm start`. A API lê `.env` ao iniciar; reinicie-a sempre que alterar essas configurações.
6. Acesse `http://localhost:3000/api/health`. O resultado esperado é `{"status":"ok","database":"connected"}`. Em seguida, entre no painel e teste o registro e a retirada de uma encomenda.

Para acessar o painel pelo celular na mesma rede, mantenha o servidor Node em execução no computador e acesse o IP desse computador na porta configurada para a aplicação. O Node conecta ao MySQL local; não exponha a porta 3306 à internet. Em produção, configure as variáveis `MYSQL_*` no serviço que hospeda o Node e use um banco MySQL persistente acessível por esse serviço.

Esta mudança troca o driver e o esquema para MySQL, mas não migra dados que já estejam em um PostgreSQL. Se houver registros antigos nesse banco, exporte-os e importe-os separadamente antes de desativar o PostgreSQL.

Rotas iniciais: `POST /api/login`, `POST /api/logout`, `GET /api/health`, `GET /api/orders`, `POST /api/orders` e `PATCH /api/orders/:id/pickup`. As rotas do dashboard e da API de encomendas exigem sessão autenticada.

## Telas

- Visão geral: indicadores, volume semanal, status e atividade recente.
- Encomendas: busca, filtro por status e bloco, registro e confirmação de retirada.
- Relatórios: distribuição por porteiro e moradores com mais entregas, com exportação CSV.
- Login administrativo e navegação responsiva com barra inferior em dispositivos móveis.
- Instalação como PWA em Android e iOS, com ícones próprios e instruções por plataforma.
- Moradores e configurações: telas iniciais para evolução do protótipo.

O banco inicial armazena os dados operacionais das encomendas; notificações e cadastro relacional de moradores ficam para as próximas etapas.