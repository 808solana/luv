import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type ApiShellProps = {
  children: React.ReactNode;
  title?: string;
};

export function ApiShell({ children, title = "API keys" }: ApiShellProps) {
  return (
    <div className="relative z-10 flex flex-1 flex-col bg-white px-4 py-10 text-black sm:px-6 md:py-16">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Button
            asChild
            variant="link"
            className="group h-auto gap-1.5 p-0 text-black no-underline hover:text-black hover:no-underline"
          >
            <Link
              href="/"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] rounded-lg"
              aria-label="Back to home"
            >
              <ArrowLeft
                className="h-5 w-5 transition-transform duration-300 ease-out group-hover:-translate-x-1"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold">Back</span>
            </Link>
          </Button>
        </header>

        <div className="rounded-[32px] bg-white px-6 py-8 shadow-lg sm:px-8 sm:py-10 flex flex-col gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}
