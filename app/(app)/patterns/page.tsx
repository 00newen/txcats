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
          <p className="text-muted-foreground">
            Automate your workflow with smart rules. Review and refine the intelligent patterns that the system uses to automatically categorize your transactions. By teaching the app your preferences, you save time and ensure consistent reporting across your entire financial history.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

