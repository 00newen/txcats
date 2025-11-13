import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function PatternsPage() {
  return (
    <>
      <PageHeader
        title="Patterns"
        subtitle="View learned categorization patterns"
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </>
  );
}

