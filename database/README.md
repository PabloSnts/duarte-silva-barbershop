# Banco da barbearia

Estrutura inicial para uma barbearia com uma única agenda, baseada nos tipos e regras de `src/lib/store.ts`. Aplicada ao projeto Supabase `rncocekcfjybpaujgqbs`. `schema.sql` é o registro da instalação inicial: não executar novamente em um banco já instalado.

## Tabelas e correspondência

| Estado no aplicativo | Banco |
| --- | --- |
| `services` e `rules` | `services`, `service_rules` |
| `settings` e `vacations` | `settings`, `vacations` |
| Clientes e histórico | `clients`, `bookings` |
| `bookings` e `serviceIds` | `bookings`, `booking_services` |
| `blacklist` | `blacklist` |
| `adjusts` e `ids` | `schedule_adjustments`, `adjustment_bookings` |
| `tv` | `tv_state` |

IDs são texto, compatíveis com os IDs atuais; novos IDs usam UUID em formato texto. `createdAt`, `at`, `expires` e `connectedAt` devem ser convertidos entre milissegundos e timestamps. Dias da semana continuam 0=domingo a 6=sábado. Horários são locais de São Paulo, datas são `date`; valores monetários usam reais com duas casas decimais. Normalizar telefone para `55` + DDD + número antes de gravar (não duplicar o prefixo).

`serviceId` é o primeiro item em `booking_services`, ordenado por `position`; `serviceIds` são todos os itens nessa ordem. Ao reservar, o servidor deve gravar reserva e itens na mesma transação, copiando nome, duração e preço de cada serviço e somando as durações em `bookings.duration_minutes`. O cliente e telefone da reserva são snapshots para preservar o histórico.

Os valores persistidos de status continuam `confirmada`, `concluida`, `cancelada` e `ausente`. “Agendado” é somente o rótulo na TV. Uma restrição no banco impede reservas sobrepostas, inclusive em pedidos simultâneos, considerando a duração e o deslocamento em minutos. Apenas cancelamentos liberam o horário, conforme a regra atual. Reservas adjacentes são permitidas. Para ajustes coletivos, usar transação e `SET CONSTRAINTS bookings_no_overlap DEFERRED` antes de mover as reservas; gravar o histórico e as reservas afetadas na mesma transação. Desfazer ajuste também exige transação.

## Acesso e integração pendente

Todas as tabelas têm RLS ligado e nenhum acesso para `anon` ou `authenticated`. O backend/n8n pode operar com `service_role`; essa chave deve ficar exclusivamente no servidor. As notificações do verificador sobre ausência de políticas RLS são esperadas nesta fase: o acesso do navegador está deliberadamente fechado. Não há função com privilégios elevados nem políticas abertas.

A aplicação ainda usa `localStorage` e `BroadcastChannel`. Criar as tabelas não conecta automaticamente o painel, o agendamento público ou a TV. O próximo trabalho precisa implementar autenticação do barbeiro, autorização da TV e endpoints do servidor para disponibilidade e reservas, antes de liberar o uso público. Validar no servidor expediente, férias, regras de serviço, bloqueios, datas passadas e preços; a restrição de sobreposição é uma proteção adicional. Realizar pareamento da TV no servidor com expiração e limite de tentativas; `code_hash` armazena SHA-256 do código e não deve ser enviado ao navegador. Nenhuma publicação Realtime foi habilitada.

Foram inseridos apenas configurações iniciais e os quatro serviços padrão do código. O preço zero de Pigmentação reproduz o catálogo atual e deve ser revisado antes do uso real. Não foram importados clientes ou reservas de demonstração. As configurações do navegador precisam ser migradas separadamente; não são acessíveis a partir do GitHub.

## Validação da instalação

A migração `initial_barbershop_schema` foi aplicada e validada no Supabase. Em transação revertida ao final, foram testados: reserva com serviço, horários adjacentes, rejeição de sobreposição, cancelamento liberando horário, rejeição de reativação e de deslocamento conflitantes, status inválido e referência a serviço inexistente. Conferidos RLS e ausência de permissões de navegador. Nenhum dado de teste permaneceu no banco.

Os verificadores retornaram apenas avisos informativos: [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), intencional enquanto o acesso é exclusivo do servidor, e [índices ainda não usados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), esperado em uma instalação vazia.

