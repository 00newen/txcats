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
          <p className="text-muted-foreground">
            Welcome to your financial command center. Gain immediate insights into your financial health with a comprehensive overview of your spending, income, and budget status. Visualize trends over time and stay on top of your financial goals with intuitive charts and summaries.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

