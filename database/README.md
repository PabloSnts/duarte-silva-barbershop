# Banco e integração da barbearia

A aplicação usa Supabase para persistência compartilhada. O cliente chama a Edge Function **barbershop**; somente ela utiliza a credencial privilegiada fornecida pelo ambiente Supabase. O navegador recebe apenas a chave publicável, segura para uso no cliente.

## Acesso

- Barbeiro: sessão Supabase Auth, e-mail confirmado e endereço habilitado em **private.barber_access**. A autorização é conferida no servidor em cada solicitação.
- Cliente: catálogo ativo e intervalos ocupados sem identificadores reais, nomes, telefones, notas ou preços históricos de outros clientes. O agendamento público somente cria reservas confirmadas; preço, duração e status vêm do servidor.
- TV: código criptograficamente aleatório, válido por dez minutos e consumido uma única vez. A sessão do dispositivo dura até trinta dias e pode ser revogada pelo barbeiro. A TV recebe nomes conforme a configuração de privacidade, sem telefone, notas ou cadastro do cliente. Pode criar reserva e marcar ausência de atendimento do dia; não altera catálogo, expediente ou configurações.
- Todas as tabelas mantêm RLS habilitado, sem grants de leitura/escrita para anon ou authenticated. As RPCs de negócio também não são executáveis por esses papéis.
- A Edge Function usa verify_jwt=false porque tem rotas públicas e autentica o próprio handler. Isso **não** libera as ações privadas: o handler verifica o usuário em Auth ou o token da TV.
- Limites globais por minuto: catálogo 240, reserva pública 30, pareamento 20 e leitura autenticada 480. Os limites são compartilhados pelos dispositivos, não por IP.

No primeiro acesso, o titular cria a senha pela tela de entrada e confirma o e-mail. O agente não criou uma senha nem enviou mensagem. A conta precisa constar na lista privada; a lista de produção foi inicializada separadamente com o endereço autorizado pelo usuário, sem publicá-lo em uma migration.

Para outro ambiente, um administrador deve cadastrar explicitamente o e-mail autorizado:
    insert into private.barber_access(email) values (lower(trim('<email autorizado>')));
Não exponha essa tabela na API nem permita que o cliente a edite.

## Estrutura

| Domínio | Tabelas |
| --- | --- |
| Catálogo e disponibilidade | public.services, public.service_rules |
| Expediente e férias | public.settings, public.vacations |
| Clientes, reservas e serviços contratados | public.clients, public.bookings, public.booking_services |
| Bloqueios | public.blacklist |
| Ajustes de agenda | public.schedule_adjustments, public.adjustment_bookings |
| Pareamento e dispositivos | public.tv_state, public.tv_sessions |
| Autorização e limitação | private.barber_access, private.request_buckets |

Há doze tabelas public e duas private. As PKs e FKs originais foram preservadas: IDs antigos permanecem texto. Novos IDs do cliente usam crypto.randomUUID; o banco também gera UUID textual por default. tv_sessions usa uuid nativo.

Telefones são armazenados como 55 + DDD + número, sem máscara. Datas e horários da agenda usam America/Sao_Paulo; created_at/updated_at e expirações são timestamptz. A UI converte os timestamps para milissegundos e horários HH:mm. Valores monetários são numeric(12,2) em reais.

services.duration_minutes aceita múltiplos de quinze, de 15 a 480; o preço máximo é 99.999,99. Pigmentação continua com os 45 minutos e o preço zero do catálogo original, que o responsável pode editar. Serviços removidos são inativados; reservas antigas usam snapshots de nome, duração e preço.

## Integridade e concorrência

barbershop_save_booking valida nome, telefone, horário futuro, expediente, pausa, férias, regras de serviço e bloqueios, e salva cliente/reserva/itens na mesma transação. Valores de preço e duração enviados pelo navegador não são aceitos como fonte de verdade. Ajustes podem ultrapassar o fechamento previsto, mas não atravessar a data da reserva.

A constraint GiST impede sobreposição; somente cancelamentos liberam o intervalo. Triggers diferidas exigem pelo menos um item e duração igual à soma dos itens no COMMIT. Operações coletivas usam transação e adiam a exclusão até o final do lote.

barbershop_patch usa um lock da agenda e compara uma revisão derivada do snapshot para rejeitar gravações baseadas em dados desatualizados. O backend exige que o usuário recarregue e repita a alteração em caso de conflito; não sobrescreve silenciosamente outra alteração.

A UI serializa gravações e só informa sucesso após resposta do servidor. Atualizações são lidas a cada quinze segundos e ao voltar para a janela. Não há publicação Realtime das tabelas privadas. Uma tarefa Supabase Cron executa a conclusão automática a cada minuto, preservando ausências e cancelamentos.

## Migrations e instalação

A fonte atual é **supabase/migrations**, em ordem de versão. database/schema.sql é somente o registro histórico da instalação inicial: não o execute em banco instalado nem em conjunto com o baseline.

O baseline conserva a versão 20261028153455 já registrada em produção. Os arquivos seguintes registram hardening, API transacional, Cron e ajustes complementares, com as mesmas versões remotas. Não houve reset, remoção de tabela ou conversão destrutiva de IDs.

Para desenvolvimento com Docker e Supabase CLI, inicializar a stack local e aplicar as migrations com os comandos oficiais da CLI. **db reset só é permitido em ambiente local descartável**, nunca no projeto remoto. Seeds adicionais estão desativados: os quatro serviços e as configurações iniciais já fazem parte do baseline.

As funções e tabelas têm grants explícitos. Defaults de postgres foram endurecidos para novos objetos. Os defaults da role gerenciada supabase_admin não foram modificados. Para funções, o bloqueio do EXECUTE de PUBLIC é global para futuras funções criadas por postgres; um REVOKE limitado a public não removeria esse default global do PostgreSQL.

Configurar URL/chave publicável de outro projeto em .env.local. .env.example contém apenas opções públicas. Nunca atribuir service_role ou uma chave secreta a variável VITE_*; a chave privilegiada pertence exclusivamente aos secrets da Edge Function.

## Dados antigos do navegador

O código não gera demonstrações automaticamente nem substitui o conteúdo antigo de localStorage. A integração não importa esses dados silenciosamente para o banco. A tela de entrada e o painel oferecem **Exportar dados antigos deste aparelho**, para recuperação e revisão antes de uma eventual importação.

A ausência de importação automática é intencional: não confundir demonstrações com reservas reais e não alterar históricos sem conferência.

## Verificação

- npm ci: instalação reproduzível por package-lock.json.
- npm run build, npm run typecheck, npm test.
- npm run check:live: catálogo público, rejeição de ações privadas e proteção de tabela/RPC com chave publicável. Não insere reservas válidas.
- database/tests/booking-integrity.sql: regressões transacionais de reserva, soma de itens, snapshots, CAS, ajuste/undo, conclusão e TV. Os testes terminam com ROLLBACK e não deixam registros de clientes/reservas de teste.

A instalação limpa em Docker não foi executada nesta máquina porque o daemon Docker está desligado. As migrations foram aplicadas ao projeto conectado e os testes de integridade foram executados nele com rollback. A confirmação de e-mail e o login com senha real requerem a ação do titular; não foram simulados com uma credencial pessoal.

Avisos INFO de RLS sem policy são esperados: o acesso passa pela Edge Function. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. Índices não usados devem ser avaliados com carga real, não removidos só porque o banco está vazio.

A integração WhatsApp/n8n não envia mensagens automaticamente nesta mudança. Não foram inventados nem ativados workflows externos.
