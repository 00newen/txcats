import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your financial transactions"
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </>
  );
}

