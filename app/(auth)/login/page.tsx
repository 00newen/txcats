import { PageHeader } from '@/components/core/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <PageHeader
          title="Login"
          subtitle="Sign in to your account"
        />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

