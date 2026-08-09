import Link from "next/link";
import { NotFoundState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/layout/Container";

export default function NotFound() {
  return (
    <Container className="py-16">
      <NotFoundState
        action={
          <div className="flex gap-3">
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
            <Link href="/tools">
              <Button variant="outline">Browse audit tools</Button>
            </Link>
          </div>
        }
      />
    </Container>
  );
}
