import Link from 'next/link';
import { Upload, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-4xl lg:text-5xl font-headline tracking-tight">
            Welcome to TAAS
          </CardTitle>
          <CardDescription className="text-lg text-foreground pt-4">
            Thiagarajar Approval Automation System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="max-w-xl mx-auto">
            Easily upload your documents and track their approval status in real-time. Admins can review submissions and manage the workflow seamlessly, ensuring a smooth and transparent process.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Button size="lg" asChild>
            <Link href="/upload">
              <Upload className="mr-2 h-5 w-5" />
              Upload Document
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/status">
              <ListChecks className="mr-2 h-5 w-5" />
              View Status
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
