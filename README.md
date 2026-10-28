# Duarte & Silva — Agenda da barbearia

Painel do barbeiro, agendamento público e visualização na TV, com dados compartilhados no Supabase. A integração e as regras de acesso estão documentadas em [database/README.md](database/README.md).

## Executar e verificar

Use Node.js 22.12+ e npm. O arquivo de dependências oficial é package-lock.json.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run typecheck
npm test
npm run check:live
```

O painel é aberto, sem login, por decisão explícita do responsável: qualquer pessoa com o link pode consultar clientes e alterar reservas e configurações. Não é necessário criar usuários ou definir senhas. O agendamento de clientes continua em /agendar; a TV mantém o pareamento e sua visualização reduzida. As validações de reservas, revisão de concorrência e proteção do acesso direto ao banco permanecem no servidor.

Os dados antigos deste navegador são preservados e podem ser exportados pela tela de acesso. Não são importados automaticamente para evitar misturar exemplos com reservas reais.

## Projeto conectado ao Lovable

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm ci
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
