import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function TransactionsPage() {
  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="View and manage all your transactions"
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Full visibility into your financial activity. Browse, search, and filter through your complete transaction history with ease. Whether you're auditing past expenses or looking for specific payments, this powerful table view gives you total control over your data.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

