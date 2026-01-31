# txCats - Transaction Categorization App

A Next.js + TypeScript application for managing and categorizing financial transactions.

## Features

- 📊 Dashboard with transaction overview
- 📤 CSV file upload for transaction import
- 💰 Transaction management and viewing
- 📁 Category management
- 🤖 Pattern recognition for automatic categorization
- 🏷️ Manual categorization tools
- 🔒 Encryption and security settings

## Tech Stack

- **Next.js 16** with TypeScript
- **React 19** with App Router
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **TanStack Query** for data fetching
- **Drizzle** for connecting with DB
- **Zod** for schema validation
- **Recharts** for data visualization
- **Lucide React** for icons

## Getting Started

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

### Build

```bash
pnpm build
```

### Start Production Server

```bash
pnpm start
```

## Configuration

### Clerk Authentication

This project uses [Clerk](https://clerk.com) for authentication. To enable Clerk features, you need to set the following environment variables in a `.env.local` file:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Note:** Without these environment variables, the app will still render but Clerk components (like `UserButton`) will show placeholder stubs.

Get your Clerk keys from the [Clerk Dashboard](https://dashboard.clerk.com).

## Project Structure

```
src/
├── components/
│   ├── ui/          # shadcn/ui components
│   └── core/        # App-specific components
├── crypto/          # Encryption helpers
├── data/            # Database and repositories
├── features/        # Feature-based pages
│   ├── dashboard/
│   ├── upload/
│   ├── transactions/
│   ├── categories/
│   ├── patterns/
│   ├── categorize/
│   └── lock/
├── hooks/           # Custom React hooks
├── lib/             # Utility functions
├── styles/         # Global styles
└── types/           # TypeScript types and Zod schemas
```

## Routes

- `/` - Dashboard
- `/upload` - Upload transactions
- `/transactions` - View all transactions
- `/categories` - Manage categories
- `/patterns` - View learned patterns
- `/categorize` - Manual categorization
- `/lock` - Security settings

## License

MIT
