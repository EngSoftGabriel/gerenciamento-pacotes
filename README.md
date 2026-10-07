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
2. Abra `db/schema.sql` (File → Open SQL Script) e execute o script com o botão do raio, usando uma conta administradora do MySQL. Ele cria o banco `vitoria_regia`, a tabela `parcels`, as restrições, os índices e o usuário `vitoria_app` com as permissões da aplicação. Antes de executar, defina uma senha forte na instrução `CREATE USER` do script.
3. Crie um arquivo chamado `.env` na raiz do projeto, ao lado de `package.json`, e preencha:

	```dotenv
	PORT=3000
	MYSQL_HOST=127.0.0.1
	MYSQL_PORT=3306
	MYSQL_USER=vitoria_app
	MYSQL_PASSWORD=mesma-senha-definida-no-schema
	MYSQL_DATABASE=vitoria_regia
	ADMIN_USERNAME=admin
	ADMIN_PASSWORD=defina-uma-senha-forte
	SESSION_SECRET=defina-um-segredo-aleatorio-longo
	```

	Substitua os três valores de exemplo por valores fortes. `MYSQL_PASSWORD` deve ser exatamente a mesma senha configurada para `vitoria_app` no `schema.sql`. Se o usuário já existir, `CREATE USER IF NOT EXISTS` não altera a senha; nesse caso, atualize-a com `ALTER USER` e use a mesma senha no `.env`.
4. No terminal, execute `npm install` e depois `npm start`. A API lê `.env` ao iniciar; reinicie-a sempre que alterar essas configurações.
5. Acesse `http://localhost:3000/api/health`. O resultado esperado é `{"status":"ok","database":"connected"}`. Em seguida, entre no painel e teste o registro e a retirada de uma encomenda.

Para acessar o painel pelo celular na mesma rede, mantenha o servidor Node em execução no computador e acesse o IP desse computador na porta configurada para a aplicação. O Node conecta ao MySQL local; não exponha a porta 3306 à internet. Em produção, configure as variáveis `MYSQL_*` no serviço que hospeda o Node e use um banco MySQL persistente acessível por esse serviço.

Esta mudança troca o driver e o esquema para MySQL, mas não migra dados que já estejam em um PostgreSQL. Se houver registros antigos nesse banco, exporte-os e importe-os separadamente antes de desativar o PostgreSQL.

## Exemplos para desenvolvimento

Use os exemplos abaixo apenas em um banco de desenvolvimento. Os nomes das colunas e dos campos da API permanecem em inglês porque são os identificadores usados pelo sistema; os dados de exemplo estão em português.

Para cadastrar uma encomenda de teste no MySQL Workbench:

```sql
INSERT INTO parcels (resident, building, apartment, carrier, porter, notes)
VALUES ('Mariana Costa', 'A', '203', 'Correios', 'João Silva', 'Encomenda de teste para desenvolvimento');

SET @encomenda_teste_id = LAST_INSERT_ID();

SELECT id, resident, building, apartment, carrier, porter, status, received_at
FROM parcels
WHERE id = @encomenda_teste_id;

UPDATE parcels
SET status = 'picked_up', picked_up_at = UTC_TIMESTAMP(3)
WHERE id = @encomenda_teste_id AND status = 'pending';

SELECT id, resident, status, picked_up_at
FROM parcels
WHERE id = @encomenda_teste_id;
```

Execute o bloco na mesma conexão do Workbench para que `LAST_INSERT_ID()` use o identificador da encomenda recém-criada. Para testar o cadastro pela API (`POST /api/orders`), o corpo JSON de exemplo é:

```json
{
	"resident": "Mariana Costa",
	"building": "A",
	"apartment": "203",
	"carrier": "Correios",
	"porter": "João Silva",
	"notes": "Encomenda de teste para desenvolvimento"
}
```

O endpoint exige login; também é possível registrar e confirmar a retirada pela tela **Encomendas**.

Rotas iniciais: `POST /api/login`, `POST /api/logout`, `GET /api/health`, `GET /api/orders`, `POST /api/orders` e `PATCH /api/orders/:id/pickup`. As rotas do dashboard e da API de encomendas exigem sessão autenticada.

## Telas

- Visão geral: indicadores, volume semanal, status e atividade recente.
- Encomendas: busca, filtro por status e bloco, registro e confirmação de retirada.
- Relatórios: distribuição por porteiro e moradores com mais entregas, com exportação CSV.
- Login administrativo e navegação responsiva com barra inferior em dispositivos móveis.
- Instalação como PWA em Android e iOS, com ícones próprios e instruções por plataforma.
- Moradores e configurações: telas iniciais para evolução do protótipo.

O banco inicial armazena os dados operacionais das encomendas; notificações e cadastro relacional de moradores ficam para as próximas etapas.