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
          <p className="text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </>
  );
}

